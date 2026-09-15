---
name: payment-interface
description: Provider-agnostic AntelopeJS payments — hosted checkout, direct payments with authorize/capture, refunds, saved payment methods charged off-session, and normalised webhook events. Use when code imports "@antelopejs/interface-payment", when an AntelopeJS module takes payments, refunds or recurring charges, or when you encounter CreateCheckoutSession, CreatePayment, CapturePayment, RefundPayment, ListPaymentMethods, VerifyWebhook, PaymentStatus, or PaymentEvent.
category: antelopejs-interface
tags: [payment, checkout, refund, webhook, stripe, antelopejs]
---

# payment interface

Provider-agnostic payments. The PascalCase functions are thin wrappers over
`internal.*` proxy points, so every call is async and queues until a provider
module attaches. This package declares the contract and contains no provider
logic.

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

A method is saved as a side effect of a payment — `savePaymentMethod: true` on a
checkout session, with a `customer` set. It appears in `ListPaymentMethods` once
the payment reaches `succeeded` or `authorized`.

`Customer` guarantees only `id`. PayPal and Adyen store no email or name; keep
the payer's details in your own records.

## Webhooks

```ts
const event = await VerifyWebhook({ body: rawBuffer, headers });
if (!event) return new HTTPResult(200, "Ignored");
```

- A `PaymentEvent` — handle it.
- `undefined` — verified but unmodelled. Respond 200; providers send many.
- Throws `WebhookVerificationError` — respond 403, act on nothing.

Body must be **raw bytes**, not re-serialised JSON.

Types: `payment.pending|authorized|succeeded|failed|canceled`,
`refund.succeeded|failed`, `dispute.opened`.

De-duplicate on `event.id` — providers redeliver — and do not assume an event is
newer than the state you hold; they arrive out of order.

## Implementing this interface

Wire it in `construct()`, mirroring `@antelopejs/mongodb`:

```ts
await ImplementInterface(
  await import("@antelopejs/interface-payment"),
  await import("./implementations/payment"),
);
```

Export one function per `internal.*` proxy, PascalCase-free — the implementation
names match the proxy names. Then run the shipped conformance suite
(`dist/tests/payment.test.js`) against your module, with
`ANTELOPE_PAYMENT_TEST_METHOD` set to a chargeable provider test token.
