const { mock } = require("node:test");
const assert = require("node:assert/strict");

const payment = require("../dist/index.js");

afterEach(() => mock.restoreAll());

const PAYMENT_ID = "pay_conformance";
const REFUND_ID = "ref_conformance";
const SESSION_ID = "cs_conformance";
const CUSTOMER_ID = "cus_conformance";
const METHOD_ID = "pm_conformance";
const KEY = "idem_conformance";
const PROVIDER = "secondary-account";
const AMOUNT = { value: 2500, currency: "EUR" };

const PAYMENT_REQUEST = {
  amount: AMOUNT,
  reference: "order-1",
  returnUrl: "https://merchant.invalid/return",
};
const SESSION_REQUEST = {
  amount: AMOUNT,
  reference: "order-1",
  successUrl: "https://merchant.invalid/ok",
  cancelUrl: "https://merchant.invalid/no",
};
const REFUND_REQUEST = { payment: PAYMENT_ID, amount: AMOUNT };
const CUSTOMER_REQUEST = { email: "payer@merchant.invalid" };
const WEBHOOK_REQUEST = {
  body: Buffer.from("{}"),
  headers: { "stripe-signature": "t=0,v1=0" },
};

/**
 * Every exported wrapper, the proxy it must reach, and two calls: one naming
 * every argument, one omitting every optional. The second is the one that
 * catches a wrapper dropping a trailing argument or filling the wrong slot.
 */
const FORWARDING = [
  {
    wrapper: "CreateCheckoutSession",
    proxy: "createCheckoutSession",
    full: [SESSION_REQUEST, KEY, PROVIDER],
    minimal: [SESSION_REQUEST, KEY],
    expectedMinimal: [SESSION_REQUEST, KEY, undefined],
  },
  {
    wrapper: "GetCheckoutSession",
    proxy: "getCheckoutSession",
    full: [SESSION_ID, PROVIDER],
    minimal: [SESSION_ID],
    expectedMinimal: [SESSION_ID, undefined],
  },
  {
    wrapper: "CreatePayment",
    proxy: "createPayment",
    full: [PAYMENT_REQUEST, KEY, PROVIDER],
    minimal: [PAYMENT_REQUEST, KEY],
    expectedMinimal: [PAYMENT_REQUEST, KEY, undefined],
  },
  {
    wrapper: "GetPayment",
    proxy: "getPayment",
    full: [PAYMENT_ID, PROVIDER],
    minimal: [PAYMENT_ID],
    expectedMinimal: [PAYMENT_ID, undefined],
  },
  {
    wrapper: "CapturePayment",
    proxy: "capturePayment",
    full: [PAYMENT_ID, KEY, AMOUNT, PROVIDER],
    minimal: [PAYMENT_ID, KEY],
    expectedMinimal: [PAYMENT_ID, KEY, undefined, undefined],
  },
  {
    wrapper: "CancelPayment",
    proxy: "cancelPayment",
    full: [PAYMENT_ID, KEY, PROVIDER],
    minimal: [PAYMENT_ID, KEY],
    expectedMinimal: [PAYMENT_ID, KEY, undefined],
  },
  {
    wrapper: "RefundPayment",
    proxy: "refundPayment",
    full: [REFUND_REQUEST, KEY, PROVIDER],
    minimal: [REFUND_REQUEST, KEY],
    expectedMinimal: [REFUND_REQUEST, KEY, undefined],
  },
  {
    wrapper: "GetRefund",
    proxy: "getRefund",
    full: [REFUND_ID, PROVIDER],
    minimal: [REFUND_ID],
    expectedMinimal: [REFUND_ID, undefined],
  },
  {
    wrapper: "CreateCustomer",
    proxy: "createCustomer",
    full: [CUSTOMER_REQUEST, KEY, PROVIDER],
    minimal: [CUSTOMER_REQUEST, KEY],
    expectedMinimal: [CUSTOMER_REQUEST, KEY, undefined],
  },
  {
    wrapper: "GetCustomer",
    proxy: "getCustomer",
    full: [CUSTOMER_ID, PROVIDER],
    minimal: [CUSTOMER_ID],
    expectedMinimal: [CUSTOMER_ID, undefined],
  },
  {
    wrapper: "DeleteCustomer",
    proxy: "deleteCustomer",
    full: [CUSTOMER_ID, KEY, PROVIDER],
    minimal: [CUSTOMER_ID, KEY],
    expectedMinimal: [CUSTOMER_ID, KEY, undefined],
  },
  {
    wrapper: "ListPaymentMethods",
    proxy: "listPaymentMethods",
    full: [CUSTOMER_ID, PROVIDER],
    minimal: [CUSTOMER_ID],
    expectedMinimal: [CUSTOMER_ID, undefined],
  },
  {
    wrapper: "DetachPaymentMethod",
    proxy: "detachPaymentMethod",
    full: [METHOD_ID, KEY, PROVIDER],
    minimal: [METHOD_ID, KEY],
    expectedMinimal: [METHOD_ID, KEY, undefined],
  },
  {
    wrapper: "VerifyWebhook",
    proxy: "verifyWebhook",
    full: [WEBHOOK_REQUEST, PROVIDER],
    minimal: [WEBHOOK_REQUEST],
    expectedMinimal: [WEBHOOK_REQUEST, undefined],
  },
];

function stub(proxy, result) {
  return mock.method(payment.internal, proxy, () => result);
}

function rejectEveryOtherProxy(except) {
  for (const { proxy } of FORWARDING) {
    if (proxy === except) continue;
    mock.method(payment.internal, proxy, () => {
      assert.fail(`${except} must not reach ${proxy}`);
    });
  }
}

for (const entry of FORWARDING) {
  it(`${entry.wrapper} forwards every argument to internal.${entry.proxy}`, async () => {
    rejectEveryOtherProxy(entry.proxy);
    const result = Promise.resolve({ id: "result" });
    const proxy = stub(entry.proxy, result);

    assert.equal(payment[entry.wrapper](...entry.full), result);
    assert.deepEqual(proxy.mock.calls[0].arguments, entry.full);
    assert.equal(proxy.mock.callCount(), 1);
    await result;
  });

  it(`${entry.wrapper} keeps argument positions when optionals are omitted`, async () => {
    rejectEveryOtherProxy(entry.proxy);
    const proxy = stub(entry.proxy, Promise.resolve(undefined));

    await payment[entry.wrapper](...entry.minimal);
    assert.deepEqual(proxy.mock.calls[0].arguments, entry.expectedMinimal);
    assert.equal(proxy.mock.callCount(), 1);
  });

  it(`${entry.wrapper} lets a provider failure through unchanged`, async () => {
    rejectEveryOtherProxy(entry.proxy);
    const failure = new payment.PaymentError("provider unreachable", "net_1");
    const proxy = stub(entry.proxy, Promise.reject(failure));

    await assert.rejects(
      () => payment[entry.wrapper](...entry.full),
      (error) => error === failure,
    );
    assert.equal(
      proxy.mock.callCount(),
      1,
      "a failed call must not be retried by the interface",
    );
  });
}

it("exports exactly one wrapper for every proxy", () => {
  const proxies = Object.keys(payment.internal).sort();
  const declared = FORWARDING.map((entry) => entry.proxy).sort();
  assert.deepEqual(
    proxies,
    declared,
    "a proxy without a wrapper is unreachable by consumers",
  );

  for (const { wrapper } of FORWARDING) {
    assert.equal(
      typeof payment[wrapper],
      "function",
      `${wrapper} must be exported`,
    );
  }
});

it("classifies terminal statuses and nothing else", () => {
  const terminal = payment.PAYMENT_STATUSES.filter(
    payment.isTerminalPaymentStatus,
  );
  assert.deepEqual(terminal, ["succeeded", "failed", "canceled"]);
  assert.deepEqual(
    [...payment.TERMINAL_PAYMENT_STATUSES].sort(),
    [...terminal].sort(),
  );
});

it("names an event type for every asynchronous payment transition", () => {
  const eventStatuses = payment.PAYMENT_EVENT_TYPES.filter((type) =>
    type.startsWith("payment."),
  ).map((type) => type.slice("payment.".length));

  assert.deepEqual(
    [...eventStatuses].sort(),
    payment.PAYMENT_STATUSES.filter((status) => status !== "requires_action")
      .slice()
      .sort(),
    "requires_action is known synchronously; every other status needs an event",
  );
});

const ERRORS = [
  {
    name: "PaymentNotFoundError",
    build: () => new payment.PaymentNotFoundError(PAYMENT_ID),
  },
  {
    name: "CustomerNotFoundError",
    build: () => new payment.CustomerNotFoundError(CUSTOMER_ID),
  },
  {
    name: "WebhookVerificationError",
    build: () => new payment.WebhookVerificationError("bad signature"),
  },
  {
    name: "InvalidPaymentStateError",
    build: () => new payment.InvalidPaymentStateError("already captured"),
  },
  {
    name: "UnsupportedOperationError",
    build: () => new payment.UnsupportedOperationError("CapturePayment"),
  },
];

for (const { name, build } of ERRORS) {
  it(`${name} is a distinguishable PaymentError`, () => {
    const error = build();
    assert.ok(error instanceof Error);
    assert.ok(error instanceof payment.PaymentError);
    assert.equal(error.name, name);
    assert.ok(error.message.length > 0);

    for (const other of ERRORS) {
      if (other.name === name) continue;
      assert.equal(
        error instanceof payment[other.name],
        false,
        `${name} must not also be a ${other.name}`,
      );
    }
  });
}

it("carries the provider's own code on a bare PaymentError", () => {
  const error = new payment.PaymentError("gateway timeout", "gw_504");
  assert.equal(error.providerCode, "gw_504");
  assert.equal(new payment.PaymentError("no code").providerCode, undefined);
});

it("names the unsupported operation so a caller can report it", () => {
  const error = new payment.UnsupportedOperationError("CapturePayment");
  assert.equal(error.operation, "CapturePayment");
  assert.match(error.message, /CapturePayment/);
});

const PROVIDER_CODE = "provider_specific_code";

it("carries the provider's own code through every error subclass", () => {
  const built = [
    new payment.PaymentNotFoundError(PAYMENT_ID, "refund", PROVIDER_CODE),
    new payment.CustomerNotFoundError(
      METHOD_ID,
      "payment method",
      PROVIDER_CODE,
    ),
    new payment.WebhookVerificationError("bad", PROVIDER_CODE),
    new payment.InvalidPaymentStateError("bad", "succeeded", PROVIDER_CODE),
    new payment.UnsupportedOperationError("CapturePayment", PROVIDER_CODE),
  ];

  for (const error of built) {
    assert.equal(
      error.providerCode,
      PROVIDER_CODE,
      `${error.name} dropped the provider code on the way to super()`,
    );
  }
});

it("names the entity it could not find, not a hardcoded one", () => {
  assert.match(
    new payment.PaymentNotFoundError(REFUND_ID, "refund").message,
    /No such refund:/,
  );
  assert.match(
    new payment.PaymentNotFoundError(SESSION_ID, "checkout session").message,
    /No such checkout session:/,
  );
  assert.match(
    new payment.CustomerNotFoundError(METHOD_ID, "payment method").message,
    /No such payment method:/,
  );
  assert.match(
    new payment.PaymentNotFoundError(PAYMENT_ID).message,
    /No such payment:/,
  );
  assert.match(
    new payment.CustomerNotFoundError(CUSTOMER_ID).message,
    /No such customer:/,
  );
});

it("freezes the vocabulary so no consumer can rewrite it", () => {
  const vocabularies = [
    "PAYMENT_STATUSES",
    "TERMINAL_PAYMENT_STATUSES",
    "PAYMENT_FAILURE_CODES",
    "REFUND_STATUSES",
    "REFUND_REASONS",
    "PAYMENT_METHOD_TYPES",
    "PAYMENT_EVENT_TYPES",
  ];

  for (const name of vocabularies) {
    assert.ok(Object.isFrozen(payment[name]), `${name} is mutable`);
    assert.throws(() => payment[name].push("injected"), TypeError, name);
  }

  assert.equal(payment.isTerminalPaymentStatus("pending"), false);
});
