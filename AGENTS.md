# interface-payment

The provider-agnostic AntelopeJS payment interface, published as `@antelopejs/interface-payment`. It declares the contract only: the calls in `src/functions.ts` are `InterfaceFunction` declarations with no body, and provider modules implement them in their own repositories. What this package executes is the status helper and the frozen vocabularies in `src/types.ts`, and the error classes in `src/errors.ts`.

## Layout

- `src/index.ts` re-exports `errors`, `functions` and `types`; that root and `./tests/*` are the only code entry points in `exports`.
- `src/tests` is the provider conformance suite. It compiles to `dist/tests` and ships through the `./tests/*` export, so provider repositories run it against their implementation. Renaming or moving a file there breaks those consumers.
- `docs/` and `skills/` ship in the npm package. `docs/` is the guide the package `homepage` points to; CI type-checks its snippets through `docs/tsconfig.json`, which maps the package name onto `src/index.ts`. When a public contract changes, update the matching doc page, `README.md` and `skills/taking-payments/SKILL.md`.

## Versioning

- In `@antelopejs/interface-core` 0.0.12 (the version installed here), `ImplementInterface` throws on a provider that lacks a declared function; 0.0.3, the peer minimum, does not check. Adding a function or a member a provider must implement, or changing a signature, is a breaking change for providers: release it as a new minor (`0.x.0`), never a patch.
- `@antelopejs/interface-core` is a peer dependency with a `>=minimum <1.0.0` range, and the devDependency uses the same range. Change both together with the compatibility table in `README.md`, which the docs check compares to `peerDependencies`.

## Tests

- `pnpm test` builds `dist` once, then runs `ajs module test .`. `src/antelope.test.ts` (`antelopeJs.test` in `package.json`) loads no modules and runs `test/*.test.js` against `dist`: the status helper, the error classes and the vocabularies. `pnpm run checks` runs it.
- `pnpm run checks` does not run the conformance suite in `src/tests`. It needs a provider module wired in, and with nothing implementing the interface its calls queue and time out. Run it from a provider repository; `ANTELOPE_PAYMENT_TEST_METHOD` and `ANTELOPE_PAYMENT_TEST_METHOD_DECLINED` enable the charge and decline blocks, and `ANTELOPE_PAYMENT_TEST_CURRENCY` sets the currency (default `EUR`; see `README.md`).
- `pnpm run checks` does not run the docs check (Markdown links, the compatibility table, and the `docs/` snippets type-checked through `docs/tsconfig.json`). Only CI runs it, through the `docs-files` and `docs-typescript-project` inputs of `.github/workflows/ci.yml`.

<!-- antelopejs-guardrails:start -->
<!-- Managed by @antelopejs/tooling-configs. `antelopejs-sync` rewrites everything between these markers; write repository-specific guidance outside them. -->

## Guardrails

Finish every change with `pnpm run checks`. It runs typecheck, lint, format, knip, tests, size, suppressions, and sync, and prints only what failed. The change is done when it prints no failure.

The tools enforce most rules, listed in the table at the end. The sections below hold the rules no tool checks.

### Comments

Say it in code. A constraint belongs in a type, a lint rule, or a test. A public item's contract belongs in TSDoc (`/** */`) on that item. The only other comments are lint directives that name their rules, `@ts-expect-error <reason>`, `SAFETY: <reason>` above a type assertion, `/*!` license headers, and bundler or formatter directives.

Before suppressing a type rule, try inference or a type derived from its owner with `Parameters`, `ReturnType`, or indexed access. A private alias can still appear in a published declaration. Keep a suppression only after checking the published contract and the unchecked boundary it protects.

Check each directive reason against the current line and its callers. Returning a value is not the same as awaiting and discarding it. A reason must describe what the code does now.

### Tests

Hold every test you write or keep to this checklist:

- Name the wrong implementation this test fails on. A test with no answer is deleted, not kept.
- No test reads the file it tests. Drive the behaviour through the public interface.
- An invariant over many files is a lint rule, not a test.

### Cleanup proof

A behaviour-preserving cleanup PR shows `antelopejs-api-diff <base-ref>` passing. Published declarations and built runtime exports stay unchanged; pass `--allow-added <glob>` (repeatable, e.g. `'**/internal/**'`) to let added entries under that glob pass when their module is `@internal`, and copy its "Added (allowed)" list. A comment-only PR shows `antelopejs-comment-proof <base-ref>` passing instead of a verifier. Both compare committed HEAD.

Copy counts from the proof's base and HEAD table. Never type counts by hand. Keep the command and the committed head beside the copied output. The table counts a lint directive once per rule it names, inline directives included.

Pass `--probe <file.cjs>` to api-diff when changing receivers, positional calls, or modules that no published entry reaches. The same captured script runs against both worktree roots, supplied as `argv[2]`, and prints JSON observations. Matching metadata alone does not prove those behaviours.

An entry-only rule exempts only its own module. Add a second module entry rather than exempting another importer. A no-upward rule must reject peers in the same tier as well as higher tiers. Probe the rank decision with an import, not just a reading of the configuration.

Moving a method body into a function keeps how it is called: the same receiver, argument count, read order and laziness.

Verify a boundary against the imports a developer or agent would plausibly write: static and dynamic imports, re-exports, Vue `src`, CSS `@import`, and worker or child-process entries in normally named files. A construction only an evasion would write, an edit to resolution configuration (`package.json` `browser`, `exports`, `main` or `imports`, bundler aliases, tsconfig `paths`), and a difference observable only by patching private fields or internal methods go under Attention and never block. Public API and ordinary subclass behaviour stay part of the contract.

### Suppression budget

`guardrails.suppressions.json` caps the suppressions in authored code: lint directives per rule they name (`*` for none), `@ts-expect-error`, `@ts-ignore` and `SAFETY:` comments. A suppression over its ceiling fails: fix the code, or remove another suppression of the same kind. A rule that keeps needing suppressions should be changed in the preset. Never raise or remove a number in that file: the check fails a ceiling higher than on the pull request base, and only the operator approves a raise. A directive disabling `anti-slop/require-safety-comment-for-type-assertion` is burn-down debt: remove the assertion, or, where it holds, replace the directive with `SAFETY: <why it holds>`, which takes over its room without a raise. After you remove suppressions, run `pnpm run suppressions:update` and commit the lowered file.

### What enforces what

| Rule                                                                           | Enforced by                                         |
| ------------------------------------------------------------------------------ | --------------------------------------------------- |
| Formatting                                                                     | oxfmt                                               |
| Lint findings are errors; no rule warns                                        | oxlint preset                                       |
| Comments are TSDoc, directives, or `SAFETY:` only                              | `antelopejs/no-comments`                            |
| Every test asserts                                                             | `antelopejs/require-assertion`                      |
| Tests read no files outside fixtures, helpers, locales                         | `antelopejs/no-fs-read-in-tests`                    |
| Tests import the code under test from local source, not their own package name | `antelopejs/no-self-import-in-tests`                |
| No assertion that restates a constant                                          | `antelopejs/no-constant-value-assertion`            |
| No test whose only check is "is a function"                                    | `antelopejs/no-typeof-function-only-test`           |
| Params ≤ 5, function ≤ 120 lines, file ≤ 500 lines, depth ≤ 4, complexity ≤ 20 | `eslint/max-*`, `eslint/complexity`                 |
| Cleanup preserves declarations and built runtime export metadata               | `antelopejs-api-diff <base-ref>`                    |
| Comment-only changes preserve JavaScript emit                                  | `antelopejs-comment-proof <base-ref>`               |
| PR-body counts come from tracked code files                                    | api-diff and comment-proof tables                   |
| Receiver, positional and unpublished-module behaviour                          | `antelopejs-api-diff <base-ref> --probe <file.cjs>` |
| Directive and `SAFETY:` reasons are true of the code                           | review; no tool                                     |
| Evasion-only and patched-internal findings go under Attention                  | review; no tool                                     |
| No-upward rules reject same-tier peers                                         | review and import probes                            |
| No `@ts-ignore`                                                                | `typescript/ban-ts-comment`                         |
| Files ≤ 20,000 bytes, tests included                                           | `antelopejs-check-size` (pre-commit)                |
| Suppressions stay within `guardrails.suppressions.json`                        | `antelopejs-suppressions` (pre-commit, checks)      |
| No added directive disables the `SAFETY:`, comment or test rules               | `antelopejs-suppressions` (pre-commit, checks)      |
| An added suppression gives a specific reason                                   | `antelopejs-suppressions` (pre-commit, checks)      |
| A block disable is closed in its file                                          | `antelopejs-suppressions` (pre-commit, checks)      |
| Types check                                                                    | `tsc` (pre-push)                                    |
| No dead files, exports, or dependencies                                        | knip                                                |
| Managed files match the pack                                                   | `antelopejs-sync --check`                           |
| Entry-only rules exempt no tracked outsider                                    | `antelopejs-sync --check`                           |
| A test names the wrong implementation it catches                               | review; no tool                                     |

<!-- antelopejs-guardrails:end -->
