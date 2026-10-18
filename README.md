# @antelopejs/interface-payment

[![npm version](https://img.shields.io/npm/v/@antelopejs/interface-payment.svg)](https://www.npmjs.com/package/@antelopejs/interface-payment)
[![license](https://img.shields.io/npm/l/@antelopejs/interface-payment.svg)](./LICENSE)

Provider-agnostic payment interface for AntelopeJS. Take payments, refund them,
save payment methods and react to settlement events without naming a provider —
and change provider by swapping the module wired underneath.

## Installation

```bash
pnpm add @antelopejs/interface-payment
```

This package declares the contract and ships no provider logic. Wire a module
that implements it — `@antelopejs/stripe` — in your Antelope config.

## What it covers

| Area                        | Functions                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| Hosted checkout             | `CreateCheckoutSession`, `GetCheckoutSession`                                                  |
| Direct payments             | `CreatePayment`, `GetPayment`, `CapturePayment`, `CancelPayment`                               |
| Refunds                     | `RefundPayment`, `GetRefund`                                                                   |
| Customers and saved methods | `CreateCustomer`, `GetCustomer`, `DeleteCustomer`, `ListPaymentMethods`, `DetachPaymentMethod` |
| Webhooks                    | `VerifyWebhook`                                                                                |

Subscriptions, marketplace split payments, dispute management, payment links and
in-person terminals are deliberately out of scope — they are where providers
diverge most. For anything beyond this contract, use the provider's own interface
(`@antelopejs/interface-stripe`) alongside this one.

## Quick start

```ts docs-check
import { CreateCheckoutSession } from "@antelopejs/interface-payment";

export async function startCheckout(orderId: string, idempotencyKey: string) {
  return CreateCheckoutSession(
    {
      amount: { value: 4999, currency: "EUR" },
      reference: orderId,
      successUrl: "https://shop.example/thanks",
      cancelUrl: "https://shop.example/cart",
    },
    idempotencyKey,
  );
}
```

Generate and persist one idempotency key per checkout attempt, and reuse it on
retries. Call `startCheckout` from your authenticated checkout route, persist the
returned session ID against the order, and redirect the payer to `redirectUrl`.
Use your own return URLs and configure the provider credentials and webhook route.

Fulfil the order from the `payment.succeeded` webhook, not from the payer's
return — the browser is not a trustworthy reporter.

Replay protection lasts only for the provider-defined replay window. Persist
operation keys and provider IDs; after expiration, reconcile uncertain payments
with provider records before retrying. A reused key can otherwise charge again.

## Choose a task

- Take a payment: [checkout and direct payments](./docs/2.payments.md).
- Save a method or charge off-session: [customers and methods](./docs/3.customers-and-methods.md).
- Confirm settlement safely: [webhooks](./docs/4.webhooks.md).
- Add a provider: [capabilities and conformance](./docs/5.provider-capability-matrix.md).
- Add recurring billing: use Stripe's native subscriptions through
  `@antelopejs/interface-subscriptions` when using Stripe. Choose
  `@antelopejs/payment-subscriptions` explicitly when you want a generic renewal
  clock instead; do not run both clocks for the same subscription.

## Compatibility

<!-- docs-compat: ./package.json#peerDependencies -->

| Package                      | Range            |
| ---------------------------- | ---------------- |
| `@antelopejs/interface-core` | `>=0.0.3 <1.0.0` |

These are the peer requirements in `package.json`, not development or test-tool
ranges. The implementing module may impose additional requirements.

## Conventions

- **Integer minor units.** `{ value: 1050, currency: "EUR" }` is €10.50, never a float.
- **An idempotency key on every mutating call**, positionally after the request.
- **Opaque provider identifiers.** Do not parse them.
- **A decline is a result, not an exception.** `CreatePayment` resolves with
  `status: "failed"`; it rejects only when the call could not be made.
- **An optional trailing `provider`** selects between configured accounts.

## Documentation

| Document                                                             | Contents                                                                         |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Introduction](./docs/1.introduction.md)                             | Scope, conventions, installation                                                 |
| [Payments](./docs/2.payments.md)                                     | Checkout, direct payments, authorize/capture, errors                             |
| [Customers and methods](./docs/3.customers-and-methods.md)           | Saved methods, off-session and recurring charges                                 |
| [Webhooks](./docs/4.webhooks.md)                                     | Verification, the event set, handling                                            |
| [Provider capability matrix](./docs/5.provider-capability-matrix.md) | What each provider family does behind each call, and why the scope is what it is |

## Conformance suite

`src/tests/payment.test.ts` ships in the package and runs against whichever
provider module is wired in. It is written against the contract, not against any
one provider's behaviour, and it is what a new provider implementation is held
to.

Session creation, customer lifecycle, idempotency replay, unknown-identifier
errors and webhook rejection need no fixture and cannot pass without a live
provider — with nothing implementing the interface the proxies queue and the
suite times out rather than reporting green.

The charge tests need a provider test token, because there is no portable way to
mint a chargeable payment method:

| Variable                                | Purpose                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ANTELOPE_PAYMENT_TEST_METHOD`          | A token `CreatePayment` charges successfully. Without it the charge, capture and refund blocks skip by name. |
| `ANTELOPE_PAYMENT_TEST_METHOD_DECLINED` | A token the provider declines. Without it the decline block skips.                                           |
| `ANTELOPE_PAYMENT_TEST_CURRENCY`        | ISO-4217 code to run against. Defaults to `EUR`.                                                             |

## License

Apache-2.0
