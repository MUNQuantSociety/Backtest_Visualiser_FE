# OnData-only strategy authoring

**Status:** plan, nothing implemented.
**Date:** 2026-09-11

Narrow the strategy editor's surface to the `OnData` body plus a structured
indicator spec. Everything else in the file — imports, the class statement,
`__init__`, `super().__init__(...)`, `RegisterIndicatorSet` — is generated on
the backend and appended around the fragment before the file is checked,
stored and run.

## Two repositories

This spans two checkouts and the larger half is not this one.

| | |
|---|---|
| Frontend | `Backtest_Visualiser_FE` (this repo) — editor UI, Zod schemas, API client |
| Backend | `../mqs-backtest-visualizer` — FastAPI, the `ast` scanner, the engine |

Land the backend first: the frontend cannot be built against a response shape
that does not exist yet.

## What this buys

1. **Line numbers become usable.** Issues currently point into a file the
   member largely did not write. Remapped to the fragment, `L7` is line 7 of
   what they typed.
2. **A class of issues stops existing.** `async def`, `on_data`/`ondata`
   misspellings, wrong arity, a stray `@staticmethod` — all unreachable once
   the signature is generated (`scanning.py:520-598` handles every one of
   these today).
3. **Indicator names get validated before parsing.** A spec field checked
   against `known_indicators()` beats reading string literals out of an AST.
4. **The dev-only gate can relax.** `strategy-editor.tsx:399,407` hides
   diagnostics because they name internals the member did not write. Fragment
   issues are about the member's own code, so most can be shown to everyone.

## The authoring contract

The member supplies exactly two things:

- **`body`** — the statements inside `OnData`, written at column 0, no `def`
  line. Seeded from the template's OnData body.
- **`indicators`** — a list of `{attribute, indicator, params}`. Renders into
  the generated `RegisterIndicatorSet({...})`.

The backend generates the prelude (imports, class, docstring, `__init__`,
`super().__init__`, logger, indicator registration) and the `def OnData(self,
context: StrategyContext):` line, then indents and inserts the body.

`name` and `description` are unchanged. The full-file upload path
(`POST /strategies/upload`, `_read_source_file` at `routes/strategies.py:124`)
stays exactly as it is — this adds an authoring mode, it does not remove one.

## Backend: module split

New module, sibling to the scanner:

`src/services/strategy_validation/authoring.py`

```python
@dataclass(frozen=True)
class StrategyDraft:
    body: str
    indicators: tuple[IndicatorSpec, ...]

@dataclass(frozen=True)
class Assembled:
    source: str
    body_offset: int   # 1-based line in `source` holding the body's line 1
    body_lines: int

def assemble(draft: StrategyDraft) -> Assembled: ...
def check_draft(draft: StrategyDraft) -> CompatibilityReport: ...
```

`check_draft` is `assemble` → `check_compatibility` → remap line numbers.

**`scanning.py` is not modified.** That is the isolation. The scanner keeps one
job — judge a complete file — and `authoring.py` owns the fragment↔file
translation. `check_compatibility` (`scanning.py:260`) already reports every
problem at once with absolute line numbers; remapping is subtraction, and it
belongs outside the parser.

Export `assemble`, `check_draft`, `StrategyDraft` from
`strategy_validation/__init__.py`, which is already declared the public surface.

### Line remapping

For an issue at assembled line `L`:

- `body_offset <= L < body_offset + body_lines` → fragment line
  `L - body_offset + 1`.
- `L == 0` → stays 0 ("the file as a whole").
- anything else → **a bug in the generated scaffold, not the member's code.**
  Do not clamp it to line 1 and blame the member. Log it, and surface it as
  line 0 with a message saying the generated scaffold is at fault.

### Determinism

`assemble` must be byte-deterministic. Check assembles, then submit assembles
again, and `scanning.py:260` carries an explicit invariant that a file passing
the check cannot then be refused by `POST /strategies`. If indicator ordering
or dict iteration varies between the two calls, that invariant breaks in a way
that is very hard to read from a bug report. Sort the indicator spec by
attribute name at assembly and test the property directly.

### The structural escape

A body line at column 0 must not be able to close the method and define
module-level code. Uniform indentation of every line helps but is **not** the
defense — the load-bearing check is post-assembly, on the tree:

- `_strategy_class_nodes(tree)` (`scanning.py:487`) returns exactly one class,
  and it is the generated one.
- Every node in that class's `OnData` body has a `lineno` inside the fragment
  span.
- The module body contains only the generated imports and that one class.

Fail any of these and the draft is rejected outright, not reported as an issue.

Note the cost of uniform indentation honestly: it rewrites the interior of
multi-line string literals in the fragment, so "the code I typed" is not
byte-identical to "the code that ran". Acceptable, but it is a real seam and
the assembled-source preview is what keeps it visible.

## Backend: wire changes

`src/schemas/strategies.py`

- `IndicatorSpec` — `attribute`, `indicator`, `params: dict`.
- `StrategyDraftRequest` — `body`, `indicators`, `filename`.
- `StrategyCheckResult` gains `assembled_source: str | None` and
  `body_offset: int | None`.

`src/api/routes/strategies.py`

- `POST /strategies/check/draft` — the fragment equivalent of
  `/check` (`routes/strategies.py:85`). Same rule: a verdict of incompatible
  is still a 200, with the problems in the body.
- `POST /strategies/draft` — the fragment equivalent of submit. Assembles,
  runs `scan_source`, then hands the assembled source to the existing
  `store_strategy_source`/`start_validation` path untouched.
- `GET /strategies/template` gains `body` (the OnData body alone) and
  `indicators` (the starter's two SMAs as a spec) alongside the existing
  full `source`.
- Size limits: the fragment needs its own, smaller limit checked *before*
  assembly; `MAX_SOURCE_BYTES` continues to apply to the assembled file.

**Return the assembled source in the check response.** It makes "append the
rest afterwards" visible rather than magic, and it is the only way to render a
preview without a second assembler in the frontend. This repo already has that
scar: `strategy-editor.tsx:17-28` documents a duplicated template that drifted
against a base class which never existed. Do not rebuild it.

## Backend: persistence

Store the fragment and indicator spec on the **database row**, not in the
object store.

`src/models/strategies.py:26` already carries JSONB columns. Add a nullable
`authoring` JSONB holding `{body, indicators}`. Null means a strategy authored
as a full file, which is how every existing row reads — no backfill.

Add the `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to `_ADDITIVE_MIGRATIONS`
(`src/db/init.py:37`), which is the documented migration story until Alembic
arrives; the comment there says append, never edit.

**Do not add a third file to the strategy store.** `store_strategy_source`
(`packaging.py:71`) compares exactly `SOURCE_FILENAME` and `CONFIG_FILENAME`
on the retry path and returns early on a match — a `fragment.py` would be
silently skipped on any retry, with no error. (The loader itself reads
`strategy.py` by exact name, `engine/strategies/user_loader.py:113`, so it
would not be confused by the extra file; the retry path is the real problem.)
The store keeps its two-file contract.

## Frontend

`src/features/strategies/`

- `types.ts` — `indicatorSpecSchema`, `strategyDraftSchema`; extend
  `strategyCheckResultSchema` (`types.ts:142`) with `assembledSource` and
  `bodyOffset`, both nullable with defaults so the existing full-file response
  still parses.
- `strategies-api.ts` — `checkDraft` / `submitDraft` beside the existing
  `checkStrategy` (`strategies-api.ts:146`). Fixture mode returns `unchecked`
  exactly as it does now.
- `strategy-editor.tsx` — the write mode becomes: name, description, indicator
  rows, and a body textarea. Add a collapsed "Show generated file" panel
  rendering `assembledSource` read-only. Keep the upload mode on the full-file
  path.
- `IssueList` (`strategy-editor.tsx:419`) is unchanged in shape — `L{line}` now
  means a line the member wrote, which is the whole point. Revisit the
  `env.isDev` gate at `:399` and `:407` in the same pass.
- `FALLBACK_TEMPLATE` (`strategy-editor.tsx:29`) needs a fragment counterpart,
  with the same warning attached.

## Verification

Baseline first: run the backend suite unchanged (`pytest`, notably
`tests/unit/test_api_contract.py` and the template test) so breakage is
distinguishable from what was already failing.

New tests, in rough order of how much they matter:

1. **Offset mapping.** Insert a known-bad line (`import os`) at fragment line
   *N* for *N* across the fragment, assert the reported line is exactly *N*.
   This is the off-by-one regression test and the single most valuable one here.
2. **Scaffold invariant.** An empty body, a `pass` body, and the starter
   fragment each assemble to a file that passes `check_compatibility` with zero
   issues. If the generated scaffold ever stops being compatible with our own
   checker, this fails loudly.
3. **Determinism.** Assemble the same draft twice, compare bytes.
4. **Structural escape.** A fragment that dedents to column 0 and opens
   `class Evil:`, one that closes the class, one ending inside a bracket — each
   rejected by the post-assembly tree assertions, not merely reported.
5. **Indicator split.** Bad name in the spec → a field error on the spec. Bad
   name written inside the body (`self.AddIndicator("Foo", ticker)` is still
   legal there) → an issue at a fragment line. This pair is what proves a
   generated-scaffold problem is never misattributed to a line the member
   never wrote.
6. **Syntax errors map.** An unterminated triple quote, a bad indent, a
   fragment that is only a string literal — each a fragment-line issue, never
   a 500.
7. **Whitespace.** Tabs, mixed indentation, leading and trailing blank lines,
   CRLF.
8. **Unreachability, asserted.** Body-only authoring makes every
   `_contract_issues` branch (`scanning.py:520-598`) impossible. Assert that —
   an explicit invariant, so a future change to the generated signature fails
   here instead of silently.
9. **Contract.** Extend `tests/unit/test_api_contract.py` for the new
   response, and mirror it in the frontend's Zod tests.
10. **Frontend.** Extend `strategy-editor.test.tsx:58` for draft mode: a
    fragment issue renders its line number, and the generated-file preview
    shows the assembled source.

## Accepted losses

- No helper methods, no class attributes, no module-level constants, no
  imports of the member's choosing. `OnData` is the teaching contract; a second
  optional "helpers" region is a later question, not part of this.
- The starter template's `__init__` becomes unreachable from the editor. That
  is the intent, but it means the member never sees `super().__init__(...)` —
  and `_contract_warnings` (`scanning.py:627`) exists precisely to catch
  skipping it. That warning goes quiet on this path, correctly.
- **Still not a sandbox.** Narrowing the surface removes accidents, not
  intent; a determined author gets out with a string and a dunder. The security
  note at `scanning.py:8` stands unchanged, and so does the isolation work it
  asks for.

## Order

1. `authoring.py` — `assemble`, `check_draft`, the tree assertions, tests 1-8.
2. Schemas + the two new routes + the extended template response, test 9.
3. The `authoring` column and the additive migration.
4. Frontend: types, API client, editor, test 10.

Steps 1 and 2 are independently useful: with them landed, the fragment path is
exercisable by hand before any UI exists.
