import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  ABSENT_ID,
  CANCEL_URL,
  CHARGE_VALUE,
  GARBAGE_SIGNATURE,
  SUCCESS_URL,
  SUITE_TIMEOUT,
  amount,
  assertPaymentContract,
  key,
  newCustomer,
  reference,
  track,
} from "./support";
import {
  CreateCheckoutSession,
  CreateCustomer,
  CustomerNotFoundError,
  DeleteCustomer,
  GetCheckoutSession,
  GetCustomer,
  GetPayment,
  GetRefund,
  ListPaymentMethods,
  PaymentNotFoundError,
  VerifyWebhook,
  WebhookVerificationError,
  isTerminalPaymentStatus,
} from "../index";

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
      assertPaymentContract(await GetPayment(created.payment), value);
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
    const replay = track(await CreateCustomer(request, idempotencyKey));

    assert.equal(
      replay.id,
      first.id,
      "a replayed key must not create a second customer",
    );
  });

  it("forgets a deleted customer", async () => {
    const customer = track(await CreateCustomer({}, key()));
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
