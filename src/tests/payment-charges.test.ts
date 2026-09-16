import assert from "node:assert/strict";

import {
  CancelPayment,
  CapturePayment,
  CreatePayment,
  DetachPaymentMethod,
  GetPayment,
  GetRefund,
  InvalidPaymentStateError,
  ListPaymentMethods,
  PAYMENT_METHOD_TYPES,
  type PaymentMethod,
  REFUND_STATUSES,
  RefundPayment,
} from "../index";
import {
  CHARGEABLE,
  CHARGE_VALUE,
  DECLINABLE,
  PARTIAL_VALUE,
  REFUND_VALUE,
  SUCCESS_URL,
  SUITE_TIMEOUT,
  TEST_METHOD,
  TEST_METHOD_DECLINED,
  amount,
  assertAmount,
  assertEpochMillis,
  assertPaymentShape,
  charge,
  key,
  newCustomer,
  reference,
  settle,
  settleRefundedTotal,
} from "./support";

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

    const payment = await CreatePayment(
      {
        amount: amount(CHARGE_VALUE),
        reference: reference(),
        paymentMethod: TEST_METHOD,
        customer: customer.id,
        savePaymentMethod: true,
        returnUrl: SUCCESS_URL,
      },
      key(),
    );
    await settle(payment.id, "succeeded");

    const methods = await ListPaymentMethods(customer.id);
    assert.ok(methods.length > 0, "the charged method must be saved");

    const [method] = methods;
    assert.equal(method.customer, customer.id);
    assert.ok(PAYMENT_METHOD_TYPES.includes(method.type));
    assertEpochMillis(method.createdAt, "payment method createdAt");
    if (method.type === "card") {
      assert.ok(method.card, "a card method must carry card details");
      assert.equal(method.card.last4.length, 4);
      assert.ok(method.card.expiryMonth >= 1 && method.card.expiryMonth <= 12);
      assert.ok(method.card.expiryYear >= new Date().getFullYear());
    }

    const renewal = await CreatePayment(
      {
        amount: amount(PARTIAL_VALUE),
        reference: reference(),
        customer: customer.id,
        paymentMethod: method.id,
        offSession: true,
      },
      key(),
    );
    await settle(renewal.id, "succeeded");

    await DetachPaymentMethod(method.id, key());
    const remaining = await ListPaymentMethods(customer.id);
    assert.ok(
      !remaining.some((entry: PaymentMethod) => entry.id === method.id),
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
      InvalidPaymentStateError,
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
    assertEpochMillis(refund.createdAt, "refund createdAt");
    assert.equal(
      refund.failure !== undefined,
      refund.status === "failed",
      "failure is present exactly when the refund failed",
    );

    const read = await GetRefund(refund.id);
    assert.equal(read.id, refund.id);
    assert.equal(read.payment, payment.id);
    assertAmount(read.amount, refunded, "refund amount on read");

    assertAmount(
      await settleRefundedTotal(payment.id),
      refunded,
      "the payment's refunded total",
    );
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
      InvalidPaymentStateError,
      "over-refunding must not silently succeed",
    );
  });
});
