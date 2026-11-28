# interface-payment

The provider-agnostic AntelopeJS payment interface, published as `@antelopejs/interface-payment`. It declares the contract only: the calls in `src/functions.ts` are `InterfaceFunction` declarations with no body, and provider modules implement them in their own repositories. What this package executes is the status helper and the frozen vocabularies in `src/types.ts`, and the error classes in `src/errors.ts`.

## Layout

- `src/index.ts` re-exports `errors`, `functions` and `types`; that root and `./tests/*` are the only code entry points in `exports`.
- `src/tests` is the provider conformance suite. It compiles to `dist/tests` and ships through the `./tests/*` export, so provider repositories run it against their implementation. Renaming or moving a file there breaks those consumers.
- `docs/` and `skills/` ship in the npm package. `docs/` is the guide the package `homepage` points to; CI type-checks its snippets through `docs/tsconfig.json`, which maps the package name onto `src/index.ts`. When a public contract changes, update the matching doc page, `README.md` and `skills/taking-payments/SKILL.md`.

## Versioning

- `@antelopejs/interface-core` `ImplementInterface` throws on a provider that lacks a declared function. Adding a function or a member a provider must implement, or changing a signature, is a breaking change for providers: release it as a new minor (`0.x.0`), never a patch.
- `@antelopejs/interface-core` is a peer dependency, and the devDependency uses the same range. Every `@antelopejs/*` range stops below the next minor of its floor: `>=0.5.1 <0.6.0` on a 0.x package, `~1.23.3` on a 1.x one. The `dependency:ranges` step of `pnpm run checks` enforces it. Change the peer and dev ranges together with the compatibility table in `README.md`, which the docs check compares to `peerDependencies`.

## Tests

- `pnpm test` builds `dist` once, then runs `ajs module test .`. `src/antelope.test.ts` (`antelopeJs.test` in `package.json`) loads no modules and runs `test/*.test.js` against `dist`: the status helper, the error classes and the vocabularies. `pnpm run checks` runs it.
- `pnpm run checks` does not run the conformance suite in `src/tests`. It needs a provider module wired in, and with nothing implementing the interface its calls queue and time out. Run it from a provider repository; `ANTELOPE_PAYMENT_TEST_METHOD` and `ANTELOPE_PAYMENT_TEST_METHOD_DECLINED` enable the charge and decline blocks, and `ANTELOPE_PAYMENT_TEST_CURRENCY` sets the currency (default `EUR`; see `README.md`).
- `pnpm run checks` does not run the docs check (Markdown links, the compatibility table, and the `docs/` snippets type-checked through `docs/tsconfig.json`). Only CI runs it, through the `docs-files` and `docs-typescript-project` inputs of `.github/workflows/ci.yml`.

<!-- antelopejs-guardrails:start -->
<!-- Managed by @antelopejs/tooling-configs. `antelopejs-sync` rewrites everything between these markers; write repository-specific guidance outside them. -->

## Guardrails

CI runs `pnpm run checks` in full on every pull request and reports what failed. The commit hook formats and lints the staged files. Locally, check only what you touched, one test file and not the suite, as the [`verify-changes`](.agents/skills/verify-changes/SKILL.md) skill says.

### Comments

Say it in code: a constraint in a type, a lint rule or a test, a public item's contract in TSDoc. Other comments are lint directives naming their rules, `@ts-expect-error <reason>`, `SAFETY: <reason>` above a type assertion, and license or tool directives. A reason states what the code does now.

### Tests

Each test names the wrong implementation it fails on, or is deleted. Drive behaviour through the public interface. An invariant over many files is a lint rule.

### Review

No tool checks these:

- A type guard checks the nested elements and values it claims.
- A no-upward import rule rejects same-tier peers; probe it with an import.
- A finding only an evasion or a patched internal can trigger goes under Attention and never blocks.

### Suppressions

`guardrails.suppressions.json` caps lint directives, `@ts-expect-error`, `SAFETY:` comments and rules a lint config turns off. Over a cap, fix the code or remove another suppression of that kind; only the operator raises a number. After removing suppressions, run `pnpm run suppressions:update` and commit the file.

<!-- antelopejs-guardrails:end -->
