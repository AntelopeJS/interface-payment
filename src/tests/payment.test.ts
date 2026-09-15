import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import {
  type Amount,
  CancelPayment,
  CapturePayment,
  CreateCheckoutSession,
  CreateCustomer,
  CreatePayment,
  type Customer,
  CustomerNotFoundError,
  DeleteCustomer,
  DetachPaymentMethod,
  GetCheckoutSession,
  GetCustomer,
  GetPayment,
  GetRefund,
  isTerminalPaymentStatus,
  ListPaymentMethods,
  PAYMENT_METHOD_TYPES,
  PAYMENT_STATUSES,
  type Payment,
  PaymentNotFoundError,
  type PaymentStatus,
  REFUND_STATUSES,
  RefundPayment,
  VerifyWebhook,
  WebhookVerificationError,
} from "../index";

const SUITE_TIMEOUT = 60_000;
const SETTLE_TIMEOUT = 30_000;
const SETTLE_INTERVAL = 1_000;
const CHARGE_VALUE = 2500;
const PARTIAL_VALUE = 1000;
const REFUND_VALUE = 700;
const SUCCESS_URL = "https://merchant.invalid/return/success";
const CANCEL_URL = "https://merchant.invalid/return/cancel";
const GARBAGE_SIGNATURE = "t=0,v1=0000000000000000000000000000000000000000";

/**
 * An identifier no provider has a record for.
 *
 * Providers differ on whether an identifier they cannot even parse is a 404 or a
 * 400, and a caller cannot tell those apart through opaque ids. The contract
 * therefore folds both into the not-found errors, and this value exercises that.
 */
const ABSENT_ID = `antelope-absent-${"0".repeat(24)}`;

/**
 * A provider-specific token that {@link CreatePayment} accepts as
 * `paymentMethod` and charges successfully in test mode.
 *
 * There is no portable way to mint one: a real card is entered by a payer, and
 * every provider substitutes its own published test token instead. The provider
 * module supplies it, so the charge tests are data-driven rather than faked.
 */
const TEST_METHOD = process.env.ANTELOPE_PAYMENT_TEST_METHOD;

/** As {@link TEST_METHOD}, but a token the provider declines. */
const TEST_METHOD_DECLINED = process.env.ANTELOPE_PAYMENT_TEST_METHOD_DECLINED;

const CURRENCY = process.env.ANTELOPE_PAYMENT_TEST_CURRENCY ?? "EUR";

const CHARGEABLE = "requires ANTELOPE_PAYMENT_TEST_METHOD";
const DECLINABLE = "requires ANTELOPE_PAYMENT_TEST_METHOD_DECLINED";

function amount(value: number): Amount {
  return { value, currency: CURRENCY };
}

function key(): string {
  return `antelope-conformance-${randomUUID()}`;
}

function reference(): string {
  return `conformance-${randomUUID()}`;
}

function assertAmount(actual: Amount, expected: Amount, label: string): void {
  assert.ok(Number.isInteger(actual.value), `${label} must be minor units`);
  assert.equal(actual.value, expected.value, `${label} value`);
  assert.equal(actual.currency, expected.currency, `${label} currency`);
}

function assertPaymentShape(payment: Payment, expected: Amount): void {
  assert.ok(payment.id.length > 0, "payment id must be non-empty");
  assert.ok(
    PAYMENT_STATUSES.includes(payment.status),
    `status ${payment.status} is outside the contract`,
  );
  assertAmount(payment.amount, expected, "payment amount");
  assert.equal(
    payment.amountCaptured.currency,
    payment.amount.currency,
    "captured amount must share the payment currency",
  );
  assert.equal(
    payment.amountRefunded.currency,
    payment.amount.currency,
    "refunded amount must share the payment currency",
  );
  assert.ok(Number.isInteger(payment.amountCaptured.value));
  assert.ok(Number.isInteger(payment.amountRefunded.value));
  assert.ok(payment.createdAt > 0, "createdAt must be epoch milliseconds");
  assert.equal(
    payment.redirectUrl !== undefined,
    payment.status === "requires_action",
    "redirectUrl is present exactly when the payer must act",
  );
  assert.equal(
    payment.failure !== undefined,
    payment.status === "failed",
    "failure is present exactly when the payment failed",
  );
}

/**
 * Polls until the payment leaves the states it can leave on its own.
 *
 * Providers settle asynchronously, so `pending` right after a call says nothing.
 * A payment still pending at the deadline is a conformance failure: the contract
 * promises a terminal state is reachable without payer action for these flows.
 */
async function settle(id: string, expected: PaymentStatus): Promise<Payment> {
  const deadline = Date.now() + SETTLE_TIMEOUT;
  let payment = await GetPayment(id);
  while (payment.status === "pending" && Date.now() < deadline) {
    await delay(SETTLE_INTERVAL);
    payment = await GetPayment(id);
  }
  assert.equal(
    payment.status,
    expected,
    `payment ${id} reached ${payment.status}, not ${expected}`,
  );
  return payment;
}

const customers: string[] = [];

after(async () => {
  await Promise.all(
    customers.map((id) => DeleteCustomer(id, key()).catch(() => undefined)),
  );
});

function track(customer: Customer): Customer {
  customers.push(customer.id);
  return customer;
}

async function newCustomer(): Promise<Customer> {
  return track(
    await CreateCustomer(
      { email: `${randomUUID()}@merchant.invalid`, name: "Conformance Payer" },
      key(),
    ),
  );
}

async function charge(): Promise<Payment> {
  return CreatePayment(
    {
      amount: amount(CHARGE_VALUE),
      reference: reference(),
      paymentMethod: TEST_METHOD,
      offSession: true,
    },
    key(),
  );
}

describe("hosted checkout", function () {
  this.timeout(SUITE_TIMEOUT);

  it("hands back a usable redirect for an unpaid session", async () => {
    const session = await CreateCheckoutSession(
      {
        amount: amount(CHARGE_VALUE),
        reference: reference(),
        successUrl: SUCCESS_URL,
        cancelUrl: CANCEL_URL,
        description: "Conformance checkout",
      },
      key(),
    );

    assert.ok(session.id.length > 0, "session id must be non-empty");
    assert.doesNotThrow(
      () => new URL(session.redirectUrl),
      "redirectUrl must be an absolute URL",
    );
    assert.ok(
      !isTerminalPaymentStatus(session.status),
      `a session nobody has paid must not report ${session.status}`,
    );
    if (session.expiresAt !== undefined) {
      assert.ok(session.expiresAt > Date.now(), "expiresAt must be ahead");
    }
  });

  it("reads a created session back by its identifier", async () => {
    const value = amount(CHARGE_VALUE);
    const created = await CreateCheckoutSession(
      {
        amount: value,
        reference: reference(),
        successUrl: SUCCESS_URL,
        cancelUrl: CANCEL_URL,
      },
      key(),
    );

    const read = await GetCheckoutSession(created.id);
    assert.equal(read.id, created.id);
    assert.equal(read.status, created.status);
    if (created.payment !== undefined) {
      assert.equal(read.payment, created.payment);
      assertPaymentShape(await GetPayment(created.payment), value);
    }
  });

  it("returns the first session when an idempotency key is replayed", async () => {
    const idempotencyKey = key();
    const request = {
      amount: amount(CHARGE_VALUE),
      reference: reference(),
      successUrl: SUCCESS_URL,
      cancelUrl: CANCEL_URL,
    };

    const first = await CreateCheckoutSession(request, idempotencyKey);
    const replay = await CreateCheckoutSession(request, idempotencyKey);

    assert.equal(
      replay.id,
      first.id,
      "a replayed key must not create a second session",
    );
  });
});

describe("customers and saved payment methods", function () {
  this.timeout(SUITE_TIMEOUT);

  it("round-trips an identifier and starts with no saved methods", async () => {
    const customer = await newCustomer();
    assert.ok(customer.id.length > 0, "customer id must be non-empty");

    const read = await GetCustomer(customer.id);
    assert.equal(read.id, customer.id);

    const methods = await ListPaymentMethods(customer.id);
    assert.deepEqual(methods, [], "a new customer has no saved methods");
  });

  it("returns the first customer when an idempotency key is replayed", async () => {
    const idempotencyKey = key();
    const request = { email: `${randomUUID()}@merchant.invalid` };

    const first = track(await CreateCustomer(request, idempotencyKey));
    const replay = await CreateCustomer(request, idempotencyKey);

    assert.equal(
      replay.id,
      first.id,
      "a replayed key must not create a second customer",
    );
  });

  it("forgets a deleted customer", async () => {
    const customer = await CreateCustomer({}, key());
    await DeleteCustomer(customer.id, key());

    await assert.rejects(() => GetCustomer(customer.id), CustomerNotFoundError);
  });
});

describe("unknown identifiers", function () {
  this.timeout(SUITE_TIMEOUT);

  it("reports an absent payment rather than inventing one", async () => {
    await assert.rejects(() => GetPayment(ABSENT_ID), PaymentNotFoundError);
  });

  it("reports an absent refund rather than inventing one", async () => {
    await assert.rejects(() => GetRefund(ABSENT_ID), PaymentNotFoundError);
  });

  it("reports an absent checkout session rather than inventing one", async () => {
    await assert.rejects(
      () => GetCheckoutSession(ABSENT_ID),
      PaymentNotFoundError,
    );
  });

  it("reports an absent customer rather than inventing one", async () => {
    await assert.rejects(() => GetCustomer(ABSENT_ID), CustomerNotFoundError);
    await assert.rejects(
      () => ListPaymentMethods(ABSENT_ID),
      CustomerNotFoundError,
    );
  });
});

describe("webhooks", function () {
  this.timeout(SUITE_TIMEOUT);

  it("refuses a delivery whose signature does not verify", async () => {
    await assert.rejects(
      () =>
        VerifyWebhook({
          body: Buffer.from(
            JSON.stringify({ id: randomUUID(), type: "payment.succeeded" }),
          ),
          headers: {
            "adyen-hmac-signature": GARBAGE_SIGNATURE,
            "content-type": "application/json",
            "paypal-transmission-sig": GARBAGE_SIGNATURE,
            "stripe-signature": GARBAGE_SIGNATURE,
          },
        }),
      WebhookVerificationError,
      "an unsigned body must not be accepted as a genuine event",
    );
  });

  it("refuses a delivery carrying no signature at all", async () => {
    await assert.rejects(
      () =>
        VerifyWebhook({
          body: Buffer.from("{}"),
          headers: { "content-type": "application/json" },
        }),
      WebhookVerificationError,
    );
  });
});

describe(`direct payments (${CHARGEABLE})`, function () {
  this.timeout(SUITE_TIMEOUT);

  before(function () {
    if (!TEST_METHOD) this.skip();
  });

  it("charges a saved method off-session", async () => {
    const value = amount(CHARGE_VALUE);
    const payment = await charge();

    assertPaymentShape(payment, value);
    assert.notEqual(
      payment.status,
      "requires_action",
      "an off-session charge must not ask an absent payer to act",
    );

    const read = await settle(payment.id, "succeeded");
    assert.equal(read.id, payment.id);
    assertAmount(read.amountCaptured, value, "captured");
    assert.equal(read.amountRefunded.value, 0);
  });

  it("returns the first payment when an idempotency key is replayed", async () => {
    const idempotencyKey = key();
    const request = {
      amount: amount(CHARGE_VALUE),
      reference: reference(),
      paymentMethod: TEST_METHOD,
      offSession: true,
    };

    const first = await CreatePayment(request, idempotencyKey);
    const replay = await CreatePayment(request, idempotencyKey);

    assert.equal(
      replay.id,
      first.id,
      "a replayed key must not charge the payer twice",
    );
  });

  it("echoes the caller's reference and metadata back", async () => {
    const ownReference = reference();
    const metadata = { order: ownReference, tier: "conformance" };
    const payment = await CreatePayment(
      {
        amount: amount(CHARGE_VALUE),
        reference: ownReference,
        paymentMethod: TEST_METHOD,
        offSession: true,
        metadata,
      },
      key(),
    );

    assert.equal(payment.reference, ownReference);
    assert.deepEqual(payment.metadata, metadata);
    assert.equal((await GetPayment(payment.id)).reference, ownReference);
  });

  it("saves a method against a customer and lists it back", async () => {
    const customer = await newCustomer();

    await CreatePayment(
      {
        amount: amount(CHARGE_VALUE),
        reference: reference(),
        paymentMethod: TEST_METHOD,
        customer: customer.id,
        offSession: true,
      },
      key(),
    );

    const methods = await ListPaymentMethods(customer.id);
    assert.ok(methods.length > 0, "the charged method must be saved");

    const [method] = methods;
    assert.equal(method.customer, customer.id);
    assert.ok(PAYMENT_METHOD_TYPES.includes(method.type));
    assert.ok(method.createdAt > 0);
    if (method.type === "card") {
      assert.ok(method.card, "a card method must carry card details");
      assert.equal(method.card.last4.length, 4);
      assert.ok(method.card.expiryMonth >= 1 && method.card.expiryMonth <= 12);
      assert.ok(method.card.expiryYear >= new Date().getFullYear());
    }

    await DetachPaymentMethod(method.id, key());
    const remaining = await ListPaymentMethods(customer.id);
    assert.ok(
      !remaining.some((entry) => entry.id === method.id),
      "a detached method must not be listed",
    );
  });
});

describe(`authorize and capture (${CHARGEABLE})`, function () {
  this.timeout(SUITE_TIMEOUT);

  before(function () {
    if (!TEST_METHOD) this.skip();
  });

  it("authorizes without capturing, then captures in part", async () => {
    const value = amount(CHARGE_VALUE);
    const authorized = await CreatePayment(
      {
        amount: value,
        reference: reference(),
        paymentMethod: TEST_METHOD,
        offSession: true,
        authorizeOnly: true,
      },
      key(),
    );

    assertPaymentShape(authorized, value);
    assert.equal(authorized.status, "authorized");
    assert.equal(
      authorized.amountCaptured.value,
      0,
      "nothing is captured by an authorization",
    );

    const partial = amount(PARTIAL_VALUE);
    const captured = await CapturePayment(authorized.id, key(), partial);

    assert.equal(captured.id, authorized.id);
    assert.equal(captured.status, "succeeded");
    assertAmount(captured.amountCaptured, partial, "partial capture");
    assertAmount(captured.amount, value, "authorized amount is unchanged");
  });

  it("releases an authorization on cancel", async () => {
    const authorized = await CreatePayment(
      {
        amount: amount(CHARGE_VALUE),
        reference: reference(),
        paymentMethod: TEST_METHOD,
        offSession: true,
        authorizeOnly: true,
      },
      key(),
    );
    assert.equal(authorized.status, "authorized");

    const canceled = await CancelPayment(authorized.id, key());
    assert.equal(canceled.id, authorized.id);
    assert.equal(canceled.status, "canceled");
    assert.equal(canceled.amountCaptured.value, 0);
    assert.equal((await GetPayment(authorized.id)).status, "canceled");
  });

  it("refuses to capture a payment that was never authorized", async () => {
    const payment = await charge();
    await settle(payment.id, "succeeded");

    await assert.rejects(
      () => CapturePayment(payment.id, key()),
      (error: unknown) => error instanceof Error,
      "capturing a captured payment must not silently succeed",
    );
  });
});

describe(`declines (${DECLINABLE})`, function () {
  this.timeout(SUITE_TIMEOUT);

  before(function () {
    if (!TEST_METHOD_DECLINED) this.skip();
  });

  it("resolves a decline instead of throwing", async () => {
    const value = amount(CHARGE_VALUE);
    const payment = await CreatePayment(
      {
        amount: value,
        reference: reference(),
        paymentMethod: TEST_METHOD_DECLINED,
        offSession: true,
      },
      key(),
    );

    assertPaymentShape(payment, value);
    assert.equal(payment.status, "failed");
    assert.ok(payment.failure, "a failed payment must say why");
    assert.ok(payment.failure.message.length > 0);
    assert.equal(payment.amountCaptured.value, 0);
    assert.equal(
      (await GetPayment(payment.id)).status,
      "failed",
      "a declined payment must still be readable by its identifier",
    );
  });
});

describe(`refunds (${CHARGEABLE})`, function () {
  this.timeout(SUITE_TIMEOUT);

  before(function () {
    if (!TEST_METHOD) this.skip();
  });

  it("refunds part of a captured payment", async () => {
    const payment = await charge();
    await settle(payment.id, "succeeded");

    const refunded = amount(REFUND_VALUE);
    const refund = await RefundPayment(
      {
        payment: payment.id,
        amount: refunded,
        reason: "requested_by_customer",
      },
      key(),
    );

    assert.ok(refund.id.length > 0, "refund id must be non-empty");
    assert.equal(refund.payment, payment.id);
    assertAmount(refund.amount, refunded, "refund amount");
    assert.ok(
      REFUND_STATUSES.includes(refund.status),
      `status ${refund.status} is outside the contract`,
    );
    assert.ok(refund.createdAt > 0);
    assert.equal(
      refund.failure !== undefined,
      refund.status === "failed",
      "failure is present exactly when the refund failed",
    );

    const read = await GetRefund(refund.id);
    assert.equal(read.id, refund.id);
    assert.equal(read.payment, payment.id);
    assertAmount(read.amount, refunded, "refund amount on read");
  });

  it("refuses to refund more than was captured", async () => {
    const payment = await charge();
    await settle(payment.id, "succeeded");

    await assert.rejects(
      () =>
        RefundPayment(
          { payment: payment.id, amount: amount(CHARGE_VALUE * 2) },
          key(),
        ),
      (error: unknown) => error instanceof Error,
      "over-refunding must not silently succeed",
    );
  });
});
