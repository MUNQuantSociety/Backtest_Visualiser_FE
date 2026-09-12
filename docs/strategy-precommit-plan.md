# Pre-commit flow: confirming strategies with linters and formatters

**Status:** plan, nothing implemented.
**Date:** 2026-09-11

A git pre-commit hook that confirms a staged strategy file still passes the
engine's contract, and that it is lint-clean and formatted.

Companion to [`ondata-only-authoring-plan.md`](./ondata-only-authoring-plan.md).
That one narrows what a *member* can author at runtime; this one guards what a
*developer* commits to the repo. Same scanner, different rule subset — and the
difference is the whole design.

> **No spec source.** `cair-mun-github-check-ride.docx` was checked for a
> precommit section and has none. It is a GitHub *account security* check ride
> (2FA, SSH keys, commit signing, PATs, OAuth apps, off-boarding). Its §14
> covers `git config` for commit signing and its §8 mentions the
> `admin:repo_hook` OAuth scope — GitHub webhooks, not git hooks. Nothing in it
> describes linting, formatting, or strategy validation. This plan is written
> from the code instead.

## Baseline: what the checker says about our own strategies today

Ran `check_compatibility` over every tracked strategy file
(`engine/strategies/portfolio_*/strategy.py`):

| File | Verdict | Detail |
|---|---|---|
| `portfolio_1` | pass | `VolMomentum`, 0 issues |
| `portfolio_2` | pass | `MomentumStrategy`, 0 issues |
| `portfolio_dummy` | pass | `CrossoverRmiStrategy`, 0 issues |
| `portfolio_3` | **fail** | 5 issues — imports `json` (L1) and `os` (L3), uses `os.path` (L31) |
| `portfolio_BASE` | **fail** | 6 issues — defines no `BasePortfolio` subclass; imports `importlib`, `re` |

**A hook that just runs `check_compatibility` over staged strategy files would
be unshippable on day one.** It would block every commit touching
`portfolio_3` or `portfolio_BASE`.

Neither failure is a bug. They are the design working correctly on the wrong
input.

## The finding: two rule families, only one belongs in a hook

`check_compatibility` (`scanning.py:260`) runs two kinds of rule over the same
AST pass, and they answer different questions:

**1. Trust rules** — `_violation()` (`scanning.py:130`), driven by
`ALLOWED_IMPORT_ROOTS`, `BANNED_NAMES`, `BANNED_MODULE_ROOTS`,
`BANNED_ATTRIBUTES`. These exist because *an upload is untrusted*. They are a
boundary against a member's code, not a quality bar.

**2. Contract rules** — `_contract_issues()` (`scanning.py:520`),
`_indicator_issues()` (`scanning.py:423`), `_strategy_class_nodes()`
(`scanning.py:487`). Exactly one `BasePortfolio` subclass, an `OnData` the
engine can call, indicator names the engine actually ships. These are "will the
engine drive this", and they are true of *any* strategy, ours or a member's.

First-party engine code is trusted. `portfolio_3` importing `os` and `json` is
fine — it is our code, reviewed, not uploaded through a form. Applying the
trust rules to it is a category error.

**So the hook runs the contract rules only.** That is the split that makes this
shippable, and it is the same isolation argument as the authoring plan: keep
the trust boundary in one place and do not let it leak into jobs it was not
written for.

`portfolio_BASE` is excluded outright — it is the base class every strategy
inherits from, definitionally not a strategy, and "defines no `BasePortfolio`
subclass" is the correct answer for it.

**Verified.** Re-running the contract rules alone (`_strategy_class_nodes` +
`_contract_issues` + `_indicator_issues`, skipping `_violation`):

| File | Class | Contract issues |
|---|---|---|
| `portfolio_1` | `VolMomentum` | 0 |
| `portfolio_2` | `MomentumStrategy` | 0 |
| `portfolio_3` | `RegimeAdaptiveStrategy` | **0** |
| `portfolio_dummy` | `CrossoverRmiStrategy` | 0 |
| `portfolio_BASE` | — | excluded (0 subclasses) |

All four real strategies pass. The hook is green against the repo as it stands
today, which is the precondition for anyone leaving it installed.

## Backend change required

`scanning.py` currently exposes one entry point that always runs both families.
Add a narrow one beside it:

```python
def check_contract(source: str) -> CompatibilityReport:
    """The engine's contract only: no trust rules.

    For first-party strategies in this repo, which are reviewed rather than
    uploaded and may legitimately import os, json or importlib.
    """
```

Both `check_compatibility` and `check_contract` compose the same helpers; the
only difference is whether the `_violation` walk runs. Export it from
`strategy_validation/__init__.py`.

### The hook must not import the app

Confirmed while taking the baseline above: importing
`src.services.strategy_validation` executes its `__init__`, which pulls in
`packaging` → `strategy_store` → `src.core.config` → `dotenv`, and fails with
`ModuleNotFoundError: No module named 'dotenv'` on a bare interpreter.

A pre-commit hook that needs the app's full dependency tree and a populated
`.env` is a hook people disable. Load `scanning.py` directly by path with
`importlib.util.spec_from_file_location`, exactly as the baseline run did. Its
only imports are stdlib (`ast`, `importlib.util`, `re`, `dataclasses`,
`functools`, `pathlib`) — confirmed by reading its import block — so it runs
anywhere Python does.

Worth a test asserting `scanning.py` stays stdlib-only, since the value here is
easy to lose to one convenient import.

## Linters and formatters

The backend has **none** — no ruff, black, flake8, mypy, no `pyproject.toml`,
nothing lint-related in `requirements.txt`. So this introduces the tool as well
as the hook.

Use **ruff** — it is both the linter and the formatter, so one dependency and
one config covers "linters and formatters", and it is fast enough that a hook
running it does not train people to pass `--no-verify`.

- Add `pyproject.toml` with a `[tool.ruff]` section; target the Python version
  in `Dockerfile`/`requirements.txt`.
- Add `ruff` to a dev requirements file (not the runtime image).
- **Baseline it first.** Run `ruff check` across the repo before wiring
  anything and record the count. If existing code is dirty, either fix it in a
  separate pass or scope the hook to staged files only — a hook that fails on
  code the committer did not touch gets bypassed within a day.

Formatting is `ruff format --check` on staged files. Do **not** let the hook
rewrite files behind the committer: a hook that reformats and then fails leaves
a confusing half-staged state. Report, and let them run `ruff format`.

## Hook behaviour

On `git commit`, for each **staged** file matching
`engine/strategies/portfolio_*/strategy.py` (excluding `portfolio_BASE`):

1. `ruff format --check` — formatted.
2. `ruff check` — lint-clean.
3. `check_contract` — exactly one `BasePortfolio` subclass, a callable
   `OnData`, indicator names that exist.

Any failure prints the file, the line and the message, and exits non-zero.
No staged strategy file means the hook exits 0 immediately, so it costs nothing
on unrelated commits.

Read the **staged** content (`git show :<path>`), not the working tree. A
partially staged file otherwise gets judged on lines that are not being
committed.

### Installation

Git hooks are not tracked by git, so `.git/hooks/pre-commit` cannot simply be
committed. Two options:

- **`pre-commit` framework** (`.pre-commit-config.yaml`, `pre-commit install`)
  — standard, handles ruff out of the box, but adds a dependency and a manual
  install step per clone.
- **Tracked hooks directory** — commit `.githooks/pre-commit` and set
  `git config core.hooksPath .githooks`. No new dependency; still one manual
  command per clone.

Either way the install step is manual, so put it in the README and **also run
the same three checks in CI**. The hook is a fast local signal, not the
enforcement point — anyone can `--no-verify`. CI is what actually holds the
line.

## Frontend

Out of scope. This repo already has `lint`, `format:check` and a `validate`
script, and no strategy source lives here. If a hook is wanted here too it is a
separate, much smaller job: `npm run validate` on staged files via
husky + lint-staged.

## Order

1. Baseline `ruff check` on the backend; decide fix-now vs. staged-only scope.
2. `pyproject.toml` + ruff in dev requirements.
3. `check_contract` in `scanning.py`, plus the stdlib-only test.
4. The hook script, reading staged content, `portfolio_BASE` excluded.
5. The same three checks in CI.
6. README: the one-line install.

Step 3 is independently useful — it is the right entry point for any first-party
strategy check, hook or not.

## Open question

`portfolio_3` passes the contract rules but fails the trust rules. That is
correct for a repo file. It does mean a member could not upload `portfolio_3`
as their own strategy, which is worth knowing but is not this hook's problem.
