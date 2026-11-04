const assert = require("node:assert/strict");

const payment = require("#built");

/**
 * This package is a contract: the calls are `InterfaceFunction` declarations
 * with no body, and what they do is the runtime's business rather than this
 * package's. What it does execute is the status helper, the error classes and
 * the frozen vocabularies, so that is what is covered here. The behaviour of
 * the calls themselves is covered by the shared conformance suite in
 * `src/tests`, against a real implementation.
 */

const TERMINAL = ["succeeded", "failed", "canceled"];
const NON_TERMINAL = ["pending", "requires_action", "authorized"];

it("classifies a terminal status", () => {
  for (const status of TERMINAL) {
    assert.equal(
      payment.isTerminalPaymentStatus(status),
      true,
      `${status} cannot change without a new call`,
    );
  }
});

it("classifies a status that will change again", () => {
  for (const status of NON_TERMINAL) {
    assert.equal(
      payment.isTerminalPaymentStatus(status),
      false,
      `${status} still changes on its own`,
    );
  }
});

it("classifies every status the contract declares", () => {
  const unclassified = payment.PAYMENT_STATUSES.filter(
    (status) => ![...TERMINAL, ...NON_TERMINAL].includes(status),
  );

  assert.deepEqual(
    unclassified,
    [],
    "a new status needs classifying as terminal or not",
  );
});

it("keeps classifying correctly after a consumer tries to corrupt it", () => {
  assert.throws(() => payment.TERMINAL_PAYMENT_STATUSES.push("pending"));
  assert.throws(() => payment.PAYMENT_STATUSES.push("invented"));

  assert.equal(payment.isTerminalPaymentStatus("pending"), false);
  assert.equal(payment.isTerminalPaymentStatus("succeeded"), true);
});

it("offers the hosted page locales a consumer can request", () => {
  for (const locale of ["auto", "en", "en-GB", "fr-CA", "pt-BR", "zh-TW"]) {
    assert.ok(
      payment.PAYMENT_LOCALES.includes(locale),
      `${locale} is a locale Stripe Checkout accepts`,
    );
  }
  assert.equal(payment.PAYMENT_LOCALES.includes("en-US"), false);
  assert.throws(() => payment.PAYMENT_LOCALES.push("xx"));
});

const PAYMENT_ID = "pay_contract";
const REFUND_ID = "ref_contract";
const SESSION_ID = "cs_contract";
const CUSTOMER_ID = "cus_contract";
const METHOD_ID = "pm_contract";
const PROVIDER_CODE = "provider_specific_code";

const ERRORS = [
  {
    name: "PaymentNotFoundError",
    build: () => new payment.PaymentNotFoundError(PAYMENT_ID),
    withCode: () =>
      new payment.PaymentNotFoundError(REFUND_ID, "refund", PROVIDER_CODE),
  },
  {
    name: "CustomerNotFoundError",
    build: () => new payment.CustomerNotFoundError(CUSTOMER_ID),
    withCode: () =>
      new payment.CustomerNotFoundError(
        METHOD_ID,
        "payment method",
        PROVIDER_CODE,
      ),
  },
  {
    name: "WebhookVerificationError",
    build: () => new payment.WebhookVerificationError("unsigned"),
    withCode: () =>
      new payment.WebhookVerificationError("unsigned", PROVIDER_CODE),
  },
  {
    name: "InvalidPaymentStateError",
    build: () => new payment.InvalidPaymentStateError("already captured"),
    withCode: () =>
      new payment.InvalidPaymentStateError(
        "already captured",
        "succeeded",
        PROVIDER_CODE,
      ),
  },
  {
    name: "UnsupportedOperationError",
    build: () => new payment.UnsupportedOperationError("CapturePayment"),
    withCode: () =>
      new payment.UnsupportedOperationError("CapturePayment", PROVIDER_CODE),
  },
];

for (const { name, build, withCode } of ERRORS) {
  it(`${name} can be caught as itself and as a PaymentError`, () => {
    const error = build();

    assert.ok(error instanceof Error);
    assert.ok(error instanceof payment.PaymentError);
    assert.ok(error instanceof payment[name]);
    assert.equal(error.name, name);
    assert.ok(error.message.length > 0);

    for (const other of ERRORS) {
      if (other.name === name) continue;
      assert.equal(
        error instanceof payment[other.name],
        false,
        `catching ${other.name} must not also catch ${name}`,
      );
    }
  });

  it(`${name} carries the provider's own code to a support ticket`, () => {
    assert.equal(withCode().providerCode, PROVIDER_CODE);
    assert.equal(build().providerCode, undefined);
  });
}

it("says which kind of record was not found", () => {
  assert.match(
    new payment.PaymentNotFoundError(REFUND_ID, "refund").message,
    /No such refund: ref_contract/,
  );
  assert.match(
    new payment.PaymentNotFoundError(SESSION_ID, "checkout session").message,
    /No such checkout session: cs_contract/,
  );
  assert.match(
    new payment.CustomerNotFoundError(METHOD_ID, "payment method").message,
    /No such payment method: pm_contract/,
  );
});

it("defaults to the commonest record when the kind is not given", () => {
  assert.match(
    new payment.PaymentNotFoundError(PAYMENT_ID).message,
    /No such payment: pay_contract/,
  );
  assert.match(
    new payment.CustomerNotFoundError(CUSTOMER_ID).message,
    /No such customer: cus_contract/,
  );
});

it("says which operation is unsupported, and which status blocked a call", () => {
  const unsupported = new payment.UnsupportedOperationError("CapturePayment");
  assert.equal(unsupported.operation, "CapturePayment");
  assert.match(unsupported.message, /CapturePayment/);

  const state = new payment.InvalidPaymentStateError("nope", "succeeded");
  assert.equal(state.status, "succeeded");
});
