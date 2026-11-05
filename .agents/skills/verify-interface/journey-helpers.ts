import { equal, interrupted } from "@antelopejs/tooling-configs/verify";
import type { CallRequest, Journey } from "@antelopejs/tooling-configs/verify";

/** A consumer call of one payment function and the arguments it sends. */
interface Call {
  name: string;
  args: NonNullable<CallRequest["args"]>;
}

/** Loads the packed interface next to a stub provider and calls each function through core: the stub must answer, with the arguments it received. */
export function throughCore(title: string, calls: Call[]): Journey {
  return {
    title,
    entryPoint: "a consumer module calling the packed interface in `ajs project dev`",
    async run(context) {
      const app = await context.dev("ajs project dev", context.fixture());
      for (const { name, args } of calls) {
        const result = await context.call(`call ${name}`, app, { path: [name], args });
        context.expect(result.folder, [
          { name: `${name} resolved through core`, pass: result.ok, detail: JSON.stringify(result.value) },
          equal(`${name} reached the provider with its arguments`, result.value, { stub: `.:${name}`, args }),
        ]);
      }
      const stopped = await context.stop("SIGINT", app);
      context.expect(stopped.folder, [interrupted(stopped)]);
    },
  };
}

/** The setup every scenario shares: the packed interface and a recording stand-in provider attached to a function. */
const SCENARIO_PRELUDE = `
const assert = require("node:assert/strict");
const payment = require(process.argv[2]);
const received = [];
const attach = (name, answer) => payment[name].proxy.onCall(async (...args) => { received.push([name, args]); return answer(...args); }, true);
const same = (a, b) => { try { assert.deepStrictEqual(a, b); return true; } catch { return false; } };
const failure = async (promise) => { try { await promise; return null; } catch (error) { return { name: error.name, message: error.message, providerCode: error.providerCode ?? null, status: error.status ?? null, isPaymentError: error instanceof payment.PaymentError }; } };
const amount = (value, currency = "EUR") => ({ value, currency });
const paymentRecord = (over = {}) => ({ id: "pay_1", amount: amount(2500), amountCaptured: amount(0), amountRefunded: amount(0), status: "pending", reference: "order-1", createdAt: 1_790_000_000_000, ...over });
`;

const SCENARIO_TAIL = `
main().then((out) => { console.log(JSON.stringify(out, (key, value) => (value === undefined ? null : value))); process.exit(0); }, (error) => { console.error(error); process.exit(1); });
`;

/** The probe header: `Assert<Identical<A, B>>` fails to compile unless A and B are the same type, so an added optional field or a widening to `any` is caught. */
const PROBE_HEADER = `
type Identical<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type Answer<F extends (...args: never[]) => unknown> = Awaited<ReturnType<F>>;
`;

/** Runs a scenario against the packed interface and a recording stand-in provider, then checks what it printed against the documented behaviour. */
export function scenario(title: string, body: string, printed: string): Journey {
  return {
    title,
    entryPoint: "the packed interface driven from a Node process with a stand-in provider attached to its functions",
    async run(context) {
      const file = `${context.work}/scenario.js`;
      context.edit("write the scenario", file, `${SCENARIO_PRELUDE}\nasync function main() {\n${body}\n}\n${SCENARIO_TAIL}`);
      const ran = await context.command("run the scenario", "node", [file, `${context.repo}/dist/index.js`], { timeoutMs: 60_000 });
      context.expect(ran.folder, [
        { name: "the scenario ended cleanly", pass: ran.exitCode === 0, detail: ran.stderr.slice(-300) },
        equal("the answers are what the docs promise", ran.stdout.trim().split("\n").at(-1) ?? "", printed),
      ]);
    },
  };
}

/** Compiles a probe against the packed declarations in the consumer's strict mode. */
export function declared(title: string, probe: string): Journey {
  return {
    title,
    entryPoint: "a TypeScript consumer compiling against the packed declarations",
    async run(context) {
      const file = `${context.work}/probe.ts`;
      await context.command("link the repository's dependencies", "ln", ["-s", `${context.repo}/node_modules`, `${context.work}/node_modules`]);
      context.edit("write the shape probe", file, `import * as Api from "${context.repo}/dist/index";\n${PROBE_HEADER}\n${probe}`);
      const compiled = await context.command("compile the shape probe", "node", [
        `${context.repo}/node_modules/typescript/bin/tsc`,
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--target",
        "es2022",
        "--module",
        "commonjs",
        "--moduleResolution",
        "node",
        "--typeRoots",
        `${context.repo}/node_modules/@types`,
        "--types",
        "node",
        file,
      ]);
      context.expect(compiled.folder, [{ name: "every export has the documented shape", pass: compiled.exitCode === 0, detail: compiled.stdout.slice(0, 600) }]);
    },
  };
}
