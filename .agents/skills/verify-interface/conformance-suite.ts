import { realpathSync } from "node:fs";
import { createRequire } from "node:module";

import { equal } from "@antelopejs/tooling-configs/verify";
import type { Journey } from "@antelopejs/tooling-configs/verify";

import { REFERENCE_PROVIDER } from "./reference-provider.ts";

/** What a mocha JSON report says about one run of the conformance suite. */
interface SuiteReport {
  stats: { passes: number; pending: number };
  failures: { fullTitle: string }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCount(value: unknown): value is number {
  return typeof value === "number";
}

function isFailure(value: unknown): value is { fullTitle: string } {
  return isRecord(value) && typeof value.fullTitle === "string";
}

function isSuiteReport(value: unknown): value is SuiteReport {
  return (
    isRecord(value) &&
    isRecord(value.stats) &&
    isCount(value.stats.passes) &&
    isCount(value.stats.pending) &&
    Array.isArray(value.failures) &&
    value.failures.every(isFailure)
  );
}

/** The shape this journey compares: how many tests passed or were skipped, and which failed. */
type SuiteSummary = {
  passes: number;
  pending: number;
  failed: string[];
};

function summarize(stdout: string): SuiteSummary {
  const report: unknown = JSON.parse(stdout);
  if (!isSuiteReport(report)) throw new Error("the conformance run did not print a mocha JSON report");
  return { passes: report.stats.passes, pending: report.stats.pending, failed: report.failures.map((entry) => entry.fullTitle).sort() };
}

/** The runs of the shipped conformance suite: the reference provider passes it, and each flawed variant fails exactly the tests that guard its rule. */
const SUITE_RUNS: { flaw: string; expected: SuiteSummary }[] = [
  { flaw: "none", expected: { passes: 22, pending: 0, failed: [] } },
  {
    flaw: "seconds",
    expected: {
      passes: 17,
      pending: 0,
      failed: [
        "authorize and capture (requires ANTELOPE_PAYMENT_TEST_METHOD) authorizes without capturing, then captures in part",
        "declines (requires ANTELOPE_PAYMENT_TEST_METHOD_DECLINED) resolves a decline instead of throwing",
        "direct payments (requires ANTELOPE_PAYMENT_TEST_METHOD) charges a saved method off-session",
        "direct payments (requires ANTELOPE_PAYMENT_TEST_METHOD) saves a method against a customer and lists it back",
        "refunds (requires ANTELOPE_PAYMENT_TEST_METHOD) refunds part of a captured payment",
      ],
    },
  },
  { flaw: "replay", expected: { passes: 21, pending: 0, failed: ["hosted checkout returns the first session when an idempotency key is replayed"] } },
  { flaw: "absent", expected: { passes: 21, pending: 0, failed: ["unknown identifiers reports an absent payment rather than inventing one"] } },
];

export const conformanceSuite: Journey = {
  title: "the shipped conformance suite passes a reference provider and fails a provider that breaks a documented rule",
  entryPoint: "the packed interface's `dist/tests` run with mocha against an in-memory provider attached to its functions",
  async run(context) {
    const core = realpathSync(`${context.repo}/node_modules/@antelopejs/core`);
    const mocha = createRequire(`${core}/`).resolve("mocha/bin/mocha.js");
    const provider = `${context.work}/provider.js`;
    context.edit("write the reference provider", provider, REFERENCE_PROVIDER);
    for (const run of SUITE_RUNS) {
      const ran = await context.command(
        `run the suite against the ${run.flaw} provider`,
        "node",
        [mocha, "--require", provider, "--reporter", "json", "--exit", `${context.repo}/dist/tests/payment.test.js`, `${context.repo}/dist/tests/payment-charges.test.js`],
        {
          cwd: context.work,
          env: { DIST: `${context.repo}/dist/index.js`, FLAW: run.flaw, ANTELOPE_PAYMENT_TEST_METHOD: "tok_ok", ANTELOPE_PAYMENT_TEST_METHOD_DECLINED: "tok_declined" },
          timeoutMs: 120_000,
        },
      );
      context.expect(ran.folder, [equal(`the ${run.flaw} provider gets the documented verdict`, summarize(ran.stdout), run.expected)]);
    }
  },
};
