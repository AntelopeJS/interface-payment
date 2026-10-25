# interface-payment

The provider-agnostic AntelopeJS payment interface, published as `@antelopejs/interface-payment`. It declares the contract only: the calls in `src/functions.ts` are `InterfaceFunction` declarations with no body, and provider modules implement them in their own repositories. What this package executes is the status helper and the frozen vocabularies in `src/types.ts`, and the error classes in `src/errors.ts`.

## Layout

- `src/index.ts` re-exports `errors`, `functions` and `types`; that root is the only public entry besides `./tests/*`.
- `src/tests` is the provider conformance suite. It compiles to `dist/tests` and ships through the `./tests/*` export, so provider repositories run it against their implementation. Renaming or moving a file there breaks those consumers.
- `docs/` and `skills/` ship in the npm package. `docs/` is the guide the package `homepage` points to; CI type-checks its snippets through `docs/tsconfig.json`, which maps the package name onto `src/index.ts`. When a public contract changes, update the matching doc page, `README.md` and `skills/taking-payments/SKILL.md`.

## Versioning

- `ImplementInterface` refuses a provider that lacks a declared function. Adding a function or a member a provider must implement, or changing a signature, is a breaking change for providers: release it as a new minor (`0.x.0`), never a patch.
- `@antelopejs/interface-core` is a peer dependency with a `>=minimum <1.0.0` range, and the devDependency uses the same range. Change both together with the compatibility table in `README.md`, which the docs check compares to `peerDependencies`.

## Tests

- `pnpm test` builds `dist` once, then runs `ajs module test .`. `src/antelope.test.ts` (`antelopeJs.test` in `package.json`) loads no modules and runs `test/*.test.js` against `dist`: the status helper, the error classes and the vocabularies. `pnpm run checks` runs it.
- `pnpm run checks` does not run the conformance suite in `src/tests`. It needs a provider module wired in, and with nothing implementing the interface its calls queue and time out. Run it from a provider repository; `ANTELOPE_PAYMENT_TEST_METHOD`, `ANTELOPE_PAYMENT_TEST_METHOD_DECLINED` and `ANTELOPE_PAYMENT_TEST_CURRENCY` enable the charge and decline blocks (see `README.md`).
- `pnpm run checks` does not run the docs check (Markdown links, the compatibility table, and the `docs/` snippets type-checked through `docs/tsconfig.json`). Only CI runs it, through the `docs-files` and `docs-typescript-project` inputs of `.github/workflows/ci.yml`.

<!-- antelopejs-guardrails:start -->
<!-- Managed by @antelopejs/tooling-configs. `antelopejs-sync` rewrites everything between these markers; write repository-specific guidance outside them. -->

## Guardrails

Finish every change with `pnpm run checks`. It runs typecheck, lint, format, knip, tests, size, ratchet, and sync, and prints only what failed. The change is done when it prints no failure.

The tools enforce most rules, listed in the table at the end. The sections below hold the rules no tool checks.

### Comments

Say it in code. A constraint belongs in a type, a lint rule, or a test. A public item's contract belongs in TSDoc (`/** */`) on that item. The only other comments are lint directives that name their rules, `@ts-expect-error <reason>`, `SAFETY: <reason>` above a type assertion, `/*!` license headers, and bundler or formatter directives.

### Tests

Hold every test you write or keep to this checklist:

- Name the wrong implementation this test fails on. A test with no answer is deleted, not kept.
- No test reads the file it tests. Drive the behaviour through the public interface.
- An invariant over many files is a lint rule, not a test.

### Debt

`guardrails.ratchet.json` records the lint findings and oversize files this repository already had. Its numbers only go down. After you remove debt, run `pnpm run ratchet:update` and commit the lowered file. A rule listed there is off for `oxlint`. The ratchet counts it instead, and the pre-commit hook rejects it on every line you add.

### What enforces what

| Rule                                                                           | Enforced by                               |
| ------------------------------------------------------------------------------ | ----------------------------------------- |
| Formatting                                                                     | oxfmt                                     |
| Lint findings are errors; no rule warns                                        | oxlint preset                             |
| Comments are TSDoc, directives, or `SAFETY:` only                              | `antelopejs/no-comments`                  |
| Every test asserts                                                             | `antelopejs/require-assertion`            |
| Tests read no files outside fixtures, helpers, locales                         | `antelopejs/no-fs-read-in-tests`          |
| No assertion that restates a constant                                          | `antelopejs/no-constant-value-assertion`  |
| No test whose only check is "is a function"                                    | `antelopejs/no-typeof-function-only-test` |
| Params ≤ 5, function ≤ 120 lines, file ≤ 500 lines, depth ≤ 4, complexity ≤ 20 | `eslint/max-*`, `eslint/complexity`       |
| Files ≤ 20,000 bytes, tests included                                           | `antelopejs-check-size` (pre-commit)      |
| Existing debt only shrinks                                                     | `antelopejs-ratchet`                      |
| Types check                                                                    | `tsc` (pre-push)                          |
| No dead files, exports, or dependencies                                        | knip                                      |
| Managed files match the pack                                                   | `antelopejs-sync --check`                 |
| A test names the wrong implementation it catches                               | review; no tool                           |

<!-- antelopejs-guardrails:end -->
