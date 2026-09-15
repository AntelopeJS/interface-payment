# @antelopejs/interface-payment

[![npm version](https://img.shields.io/npm/v/@antelopejs/interface-payment.svg)](https://www.npmjs.com/package/@antelopejs/interface-payment)
[![license](https://img.shields.io/npm/l/@antelopejs/interface-payment.svg)](./LICENSE)

Provider-agnostic payment interface for AntelopeJS. Take payments, refund them,
save payment methods and react to settlement events without naming a provider —
and change provider by swapping the module wired underneath.

## Installation

```bash
npm install @antelopejs/interface-payment
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

```ts
import {
  CreateCheckoutSession,
  GetPayment,
} from "@antelopejs/interface-payment";
import { randomUUID } from "node:crypto";

const session = await CreateCheckoutSession(
  {
    amount: { value: 4999, currency: "EUR" },
    reference: orderId,
    successUrl: "https://shop.example/thanks",
    cancelUrl: "https://shop.example/cart",
  },
  randomUUID(),
);

response.redirect(session.redirectUrl);
```

Fulfil the order from the `payment.succeeded` webhook, not from the payer's
return — the browser is not a trustworthy reporter.

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
errors and webhook signature rejection need no fixture and cannot pass without a
live provider. The charge tests need a chargeable provider test token in
`ANTELOPE_PAYMENT_TEST_METHOD` (and optionally a declining one in
`ANTELOPE_PAYMENT_TEST_METHOD_DECLINED`); they skip by name when it is absent.

## License

Apache-2.0
