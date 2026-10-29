import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import {
  type Amount,
  CreateCustomer,
  CreatePayment,
  type Customer,
  DeleteCustomer,
  GetPayment,
  PAYMENT_STATUSES,
  type Payment,
  type PaymentStatus,
  isTerminalPaymentStatus,
} from "../index";

export const SUITE_TIMEOUT = 60_000;
const SETTLE_TIMEOUT = 30_000;
const SETTLE_INTERVAL = 1_000;
export const CHARGE_VALUE = 2500;
export const PARTIAL_VALUE = 1000;
export const REFUND_VALUE = 700;
export const SUCCESS_URL = "https://merchant.invalid/return/success";
export const CANCEL_URL = "https://merchant.invalid/return/cancel";
export const GARBAGE_SIGNATURE =
  "t=0,v1=0000000000000000000000000000000000000000";

/**
 * An identifier no provider has a record for.
 *
 * Providers differ on whether an identifier they cannot even parse is a 404 or a
 * 400, and a caller cannot tell those apart through opaque ids. The contract
 * therefore folds both into the not-found errors, and this value exercises that.
 */
export const ABSENT_ID = `antelope-absent-${"0".repeat(24)}`;

/**
 * A provider-specific token that {@link CreatePayment} accepts as
 * `paymentMethod` and charges successfully in test mode.
 *
 * There is no portable way to mint one: a real card is entered by a payer, and
 * every provider substitutes its own published test token instead. The provider
 * module supplies it, so the charge tests are data-driven rather than faked.
 */
export const TEST_METHOD = process.env.ANTELOPE_PAYMENT_TEST_METHOD;

/** As {@link TEST_METHOD}, but a token the provider declines. */
export const TEST_METHOD_DECLINED =
  process.env.ANTELOPE_PAYMENT_TEST_METHOD_DECLINED;

const CURRENCY = process.env.ANTELOPE_PAYMENT_TEST_CURRENCY || "EUR";

export const CHARGEABLE = "requires ANTELOPE_PAYMENT_TEST_METHOD";
export const DECLINABLE = "requires ANTELOPE_PAYMENT_TEST_METHOD_DECLINED";

export function amount(value: number): Amount {
  return { value, currency: CURRENCY };
}

export function key(): string {
  return `antelope-conformance-${randomUUID()}`;
}

export function reference(): string {
  return `conformance-${randomUUID()}`;
}

const EPOCH_MILLIS_FLOOR = Date.UTC(2020, 0, 1);
const CLOCK_SKEW_ALLOWANCE = 5 * 60 * 1000;

/**
 * Asserts a timestamp is epoch milliseconds rather than epoch seconds.
 *
 * Every timestamp in the contract is specified in milliseconds, and the
 * providers do not agree: Stripe reports `created` in seconds. A bare
 * `> 0` check passes a seconds value happily and the backend renders every
 * payment as dated 1970.
 */
export function assertEpochMillis(value: number, label: string): void {
  assert.ok(
    value > EPOCH_MILLIS_FLOOR,
    `${label} is ${value}, which is not epoch milliseconds (seconds, perhaps?)`,
  );
  assert.ok(
    value < Date.now() + CLOCK_SKEW_ALLOWANCE,
    `${label} is ${value}, which is in the future`,
  );
}

export function assertAmount(
  actual: Amount,
  expected: Amount,
  label: string,
): void {
  assert.ok(Number.isInteger(actual.value), `${label} must be minor units`);
  assert.equal(actual.value, expected.value, `${label} value`);
  assert.equal(actual.currency, expected.currency, `${label} currency`);
}

/**
 * Asserts a payment obeys the invariants the contract promises: a non-empty id,
 * a status inside {@link PAYMENT_STATUSES}, the expected amount, one currency
 * across the amounts, integer minor units, epoch-millisecond `createdAt`, and
 * `redirectUrl` and `failure` present exactly when the status calls for them.
 *
 * @param payment - The payment a provider returned
 * @param expected - The amount the payment was created for
 */
export function assertPaymentContract(
  payment: Payment,
  expected: Amount,
): void {
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
  assertEpochMillis(payment.createdAt, "payment createdAt");
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
export async function settle(
  id: string,
  expected: PaymentStatus,
): Promise<Payment> {
  const deadline = Date.now() + SETTLE_TIMEOUT;
  let payment = await GetPayment(id);
  while (
    payment.status !== expected &&
    !isTerminalPaymentStatus(payment.status) &&
    Date.now() < deadline
  ) {
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

export function track(customer: Customer): Customer {
  customers.push(customer.id);
  return customer;
}

export async function newCustomer(): Promise<Customer> {
  return track(
    await CreateCustomer(
      { email: `${randomUUID()}@merchant.invalid`, name: "Conformance Payer" },
      key(),
    ),
  );
}

export async function charge(): Promise<Payment> {
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

/**
 * Polls the payment until its refunded total moves off zero.
 *
 * `amountRefunded` is otherwise only ever observed at zero, so an
 * implementation that hardcodes it satisfies every other assertion in this
 * file. Refunds settle asynchronously, hence the poll; a total still at zero at
 * the deadline is the failure this exists to catch.
 */
export async function settleRefundedTotal(id: string): Promise<Amount> {
  const deadline = Date.now() + SETTLE_TIMEOUT;
  let payment = await GetPayment(id);
  while (payment.amountRefunded.value === 0 && Date.now() < deadline) {
    await delay(SETTLE_INTERVAL);
    payment = await GetPayment(id);
  }
  assert.notEqual(
    payment.amountRefunded.value,
    0,
    `payment ${id} still reports nothing refunded after a settled refund`,
  );
  return payment.amountRefunded;
}
