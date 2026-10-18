---
name: taking-payments
description: Takes and refunds AntelopeJS payments and verifies settlement. Use when adding checkout, saved payment methods, payment webhooks, or a payment provider implementation.
category: antelopejs-interface
tags: [payment, checkout, refund, webhook, stripe, antelopejs]
---

# payment interface

## Task workflow

1. Read `README.md` for the task entry point and peer requirements.
2. Choose hosted checkout or direct payment in `docs/2.payments.md`; use
   `docs/3.customers-and-methods.md` when saving a method or charging off-session.
3. Persist one operation key and returned provider IDs. Replay only within the
   provider-defined replay window. After expiration, reconcile uncertain payments
   before retrying; the same key can create another charge.
4. Verify raw webhook bytes using `docs/4.webhooks.md`, deduplicate events, and
   fulfil only after authenticated settlement. Completion means duplicate and
   out-of-order deliveries cannot fulfil twice.
5. For provider work, run `pnpm test` for local contracts, then run the shipped
   conformance suites against the configured provider; report skipped fixtures.

Use Stripe native subscriptions for Stripe recurring billing. Choose
`@antelopejs/payment-subscriptions` explicitly for a generic renewal clock;
assign one owner per subscription.

Provider-agnostic payments. Every call is an `InterfaceFunction` declaration,
so it is async and queues until a provider module attaches. This package
declares the contract and contains no provider logic.

For anything beyond this contract, use the provider's own interface
(`@antelopejs/interface-stripe`) alongside it. This interface has no escape
hatch by design — one would hand back a provider-shaped object and undo the
portability.

## Imports

Add `@antelopejs/interface-payment` to the module's `dependencies`:

```ts
import {
  CreateCheckoutSession,
  GetCheckoutSession,
  CreatePayment,
  GetPayment,
  CapturePayment,
  CancelPayment,
  RefundPayment,
  GetRefund,
  CreateCustomer,
  GetCustomer,
  DeleteCustomer,
  ListPaymentMethods,
  DetachPaymentMethod,
  VerifyWebhook,
  isTerminalPaymentStatus,
  PaymentError,
  PaymentNotFoundError,
  CustomerNotFoundError,
  InvalidPaymentStateError,
  WebhookVerificationError,
  UnsupportedOperationError,
  PAYMENT_STATUSES,
  PAYMENT_EVENT_TYPES,
} from "@antelopejs/interface-payment";
import type {
  Amount,
  Payment,
  PaymentRequest,
  PaymentStatus,
  PaymentFailure,
  CheckoutSession,
  CheckoutSessionRequest,
  Refund,
  RefundRequest,
  Customer,
  PaymentMethod,
  PaymentEvent,
  WebhookRequest,
  Dispute,
} from "@antelopejs/interface-payment";
```

## Four rules that are easy to get wrong

1. **Amounts are integer minor units.** `{ value: 1050, currency: "EUR" }` is
   €10.50. Never a float. `JPY` has no subunit; `KWD` has three decimals.
2. **Every mutating call takes an idempotency key**, positionally, right after
   the request. Derive it from your own record so a retry reuses it.
3. **A decline is not a throw.** `CreatePayment` resolves with
   `status: "failed"` and a `failure`. It rejects only if the call could not be
   made.
4. **The payer's return is not proof.** Fulfil from the webhook, not from
   `successUrl`.

## Taking a payment (hosted checkout)

```ts
const session = await CreateCheckoutSession(
  {
    amount: { value: 4999, currency: "EUR" },
    reference: orderId,
    successUrl: `https://shop.example/orders/${orderId}/thanks`,
    cancelUrl: `https://shop.example/orders/${orderId}/cart`,
  },
  idempotencyKey,
);
response.redirect(session.redirectUrl);
```

On return: `GetCheckoutSession(id)` → `session.payment` → `GetPayment(...)`.

## Status

`pending` · `requires_action` · `authorized` · `succeeded` · `failed` ·
`canceled`. The last three are terminal (`isTerminalPaymentStatus`).

`redirectUrl` is set exactly when `requires_action`; `failure` exactly when
`failed`. Branch on the status alone.

## Authorize then capture

```ts
const auth = await CreatePayment({ ...request, authorizeOnly: true }, key);
const captured = await CapturePayment(auth.id, captureKey, {
  value: 3999,
  currency: "EUR",
});
```

Capturing less than authorized releases the rest — there is no second capture
against one authorization. `CancelPayment` voids an uncaptured payment.

## Saved methods and recurring

Subscriptions are deliberately not modelled. Run your own cycle:

```ts
const [method] = await ListPaymentMethods(customerId);
await CreatePayment(
  {
    amount,
    reference: `sub-${userId}-${period}`,
    customer: customerId,
    paymentMethod: method.id,
    offSession: true,
  },
  `renewal-${userId}-${period}`,
);
```

A method is saved as a side effect of a payment — `savePaymentMethod: true` with
a `customer` set, on either a checkout session or a `CreatePayment`. It appears
in `ListPaymentMethods` once the payment reaches `succeeded` or `authorized`,
not as soon as the call returns.

`Customer` guarantees only `id`. PayPal and Adyen store no email or name; keep
the payer's details in your own records.

## Webhooks

```ts
const event = await VerifyWebhook({ body: rawBuffer, headers });
if (!event) return new HTTPResult(200, "Ignored");
```

- A `PaymentEvent` — handle it.
- `undefined` — genuine but unmodelled. Respond 200; providers send many.
- Throws `WebhookVerificationError` — respond 403, act on nothing.

Not necessarily a signature check: providers that do not sign (Mollie,
Mangopay) send a bare record id and the implementation confirms it by reading
that record back. Both satisfy the same contract.

**If you implement a re-fetch provider, the body is a pointer and nothing else.**
A signature authenticates the whole body; a re-fetch authenticates one record and
proves nothing about any other field in the body. Derive the event's `type`, the
kind of record it is, and every field of `payment`/`refund`/`dispute` from the
record you read back — never from a type field in the body. Taking
Mangopay's `EventType` from the body after re-fetching `RessourceId` accepts a
forged payment state from anyone who can reach the endpoint.

Body must be **raw bytes**, not re-serialised JSON.

Types: `payment.pending|authorized|succeeded|failed|canceled`,
`refund.succeeded|failed`, `dispute.opened`.

De-duplicate on `event.id`, and do not assume an event is newer than the state
you hold — deliveries repeat and arrive out of order.

## Implementing this interface

Declare `"antelopeJs": { "implements": ["@antelopejs/interface-payment"] }` and
attach the whole module, the way `@antelopejs/mongodb` does:

```ts
import { ImplementInterface } from "@antelopejs/interface-core";
import * as payment from "@antelopejs/interface-payment";

await ImplementInterface(payment, await import("./implementations/payment"));
```

Export one function per declared call, named **exactly** as the call is —
`CreatePayment`, `GetPayment`, `CapturePayment` and so on. The names a consumer
calls are the attachment points; there is no separate lowercase proxy.

```ts
export async function CreatePayment(request, idempotencyKey, provider) {
  /* ... */
}
```

Extra exports alongside them are fine, so the implementation can be split across
files and re-exported from a barrel.

Then run the shipped conformance suite against your module, with
`ANTELOPE_PAYMENT_TEST_METHOD` set to a chargeable provider test token:

```ts
// src/test/conformance.test.ts
import "@antelopejs/interface-payment/tests/payment.test";
import "@antelopejs/interface-payment/tests/payment-charges.test";
```

### Conformance fixtures

| Variable                                | Purpose                                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ANTELOPE_PAYMENT_TEST_METHOD`          | A provider test token `CreatePayment` charges successfully. Without it the charge, capture and refund blocks skip by name. |
| `ANTELOPE_PAYMENT_TEST_METHOD_DECLINED` | A provider test token that declines. Without it the decline block skips.                                                   |
| `ANTELOPE_PAYMENT_TEST_CURRENCY`        | ISO-4217 code to run against. Defaults to `EUR`; set it when the test account cannot settle euros.                         |
