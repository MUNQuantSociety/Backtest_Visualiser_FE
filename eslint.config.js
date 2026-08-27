import js from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
    { ignores: ['dist', 'coverage', 'node_modules', 'src/components/ui/**'] },

    {
        extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2023,
            globals: globals.browser,
            parserOptions: {
                project: ['./tsconfig.app.json', './tsconfig.node.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
            'import-x': importX,
        },
        settings: {
            // Teaches import-x how to follow the "@/" alias, without which
            // `no-cycle` would silently miss cycles that route through it.
            'import-x/resolver-next': [
                createTypeScriptImportResolver({ project: './tsconfig.app.json' }),
            ],
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

            // Force `import type` so type-only imports are erased at build time.
            '@typescript-eslint/consistent-type-imports': [
                'error',
                { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
            ],
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': [
                'error',
                { checksVoidReturn: { attributes: false } },
            ],

            // Enforce the layering rules described in src/README.md.
            'import-x/no-cycle': ['error', { maxDepth: 4 }],
            'import-x/order': [
                'error',
                {
                    // 'type' is deliberately absent: type imports sort with the value
                    // imports from the same path group, so `import type { Foo } from
                    // './foo'` sits next to `import { bar } from './foo'` rather than
                    // being exiled to its own block at the bottom.
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                    pathGroups: [{ pattern: '@/**', group: 'internal', position: 'before' }],
                    'newlines-between': 'always',
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],
            // A feature may never reach into another feature's internals. Cross-feature
            // use goes through the feature's public barrel (`@/features/x`) only.
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['@/features/*/*'],
                            message:
                                'Import from the feature barrel (e.g. "@/features/backtests") instead of reaching into its internals.',
                        },
                        {
                            group: ['../../*'],
                            message: 'Use the "@/" path alias instead of deep relative imports.',
                        },
                    ],
                },
            ],
        },
    },

    // Config files and tests run in Node / have looser rules.
    {
        files: ['**/*.config.{ts,js}', 'src/test/**/*.ts'],
        languageOptions: { globals: globals.node },
        rules: {
            'no-restricted-imports': 'off',
        },
    },

    // The router module exports a route table, not components — fast refresh
    // does not apply, and pages are intentionally reached only through it.
    {
        files: ['src/app/router/**/*.{ts,tsx}'],
        rules: {
            'react-refresh/only-export-components': 'off',
        },
    },

    // Feature barrels exist precisely to re-export across a boundary.
    {
        files: ['src/features/*/index.ts'],
        rules: {
            'no-restricted-imports': 'off',
        },
    },
    // Test files and helpers are never part of the fast-refresh graph.
    {
        files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            'react-refresh/only-export-components': 'off',
        },
    },

    // Must stay last so formatting rules never fight Prettier.
    prettierConfig,
);
