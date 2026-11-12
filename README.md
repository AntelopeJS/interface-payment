<a href="https://github.com/AntelopeJS/antelopejs"><img data-illustration src="./.github/readme/strip.svg" width="100%" alt="INTERFACE · PAYMENT: part of AntelopeJS, hexagonal architecture beyond your own code. A glowing button reads Star AntelopeJS."></a>

<div align="center">

# `@antelopejs/interface-payment`

<a href="https://www.npmjs.com/package/@antelopejs/interface-payment"><img data-illustration alt="npm" src="https://img.shields.io/npm/v/@antelopejs/interface-payment?style=for-the-badge&labelColor=000000&color=000000"></a> <a href="./LICENSE"><img data-illustration alt="License" src="https://img.shields.io/npm/l/@antelopejs/interface-payment?style=for-the-badge&labelColor=000000&color=000000"></a> <a href="https://discord.gg/g4pFt6eXqu"><img data-illustration alt="Discord" src="https://img.shields.io/badge/Discord-18181B?logo=discord&style=for-the-badge&color=000000"></a> <a href="./docs/1.introduction.md"><img data-illustration alt="Documentation" src="https://img.shields.io/badge/Docs-18181B?style=for-the-badge&color=000000"></a> <a href="https://github.com/AntelopeJS/antelopejs"><img data-illustration alt="Star AntelopeJS" src="https://img.shields.io/github/stars/AntelopeJS/antelopejs?label=Star%20AntelopeJS&style=for-the-badge&labelColor=000000&color=000000&logo=github"></a>

**The AntelopeJS contract for payments. Take payments, refund them, save payment methods and react to settlement events without naming a provider.**

[Documentation](./docs/1.introduction.md) · [Implementations](./docs/5.provider-capability-matrix.md) · [All interfaces and providers](https://github.com/AntelopeJS/antelopejs#ecosystem)

</div>

The provider-agnostic payment interface for AntelopeJS. You take payments,
refund them, save payment methods, and react to settlement events without naming
a provider. To change provider, you swap the module that implements the
interface.

## Install

```bash
pnpm add @antelopejs/interface-payment
```

This package declares the contract and ships no provider logic. Wire a module
that implements it, such as `@antelopejs/stripe`, in your AntelopeJS project
config.

## What it covers

| Area                        | Functions                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| Hosted checkout             | `CreateCheckoutSession`, `GetCheckoutSession`                                                  |
| Direct payments             | `CreatePayment`, `GetPayment`, `CapturePayment`, `CancelPayment`                               |
| Refunds                     | `RefundPayment`, `GetRefund`                                                                   |
| Customers and saved methods | `CreateCustomer`, `GetCustomer`, `DeleteCustomer`, `ListPaymentMethods`, `DetachPaymentMethod` |
| Webhooks                    | `VerifyWebhook`                                                                                |

Subscriptions, marketplace split payments, dispute management, payment links,
and in-person terminals are out of scope on purpose. Providers differ most in
those areas. For anything beyond this contract, use the provider's own interface
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

Generate one idempotency key per checkout attempt, persist it, and reuse it on
retries. Call `startCheckout` from your authenticated checkout route. Persist the
returned session ID against the order, then redirect the payer to
`redirectUrl`. Use your own return URLs, and configure the provider credentials
and the webhook route.

Fulfil the order from the `payment.succeeded` webhook, not from the payer's
return. The payer's browser can reach `successUrl` without a payment behind it.

Replay protection lasts only for the provider-defined replay window. Persist
operation keys and provider IDs. After the window expires, reconcile uncertain
payments with the provider's records before you retry. Otherwise a reused key
can charge the payer again.

## Choose a task

- Take a payment: [checkout and direct payments](./docs/2.payments.md).
- Save a method or charge off-session: [customers and methods](./docs/3.customers-and-methods.md).
- Confirm settlement safely: [webhooks](./docs/4.webhooks.md).
- Add a provider: [capabilities and conformance](./docs/5.provider-capability-matrix.md).
- Add recurring billing with Stripe: use Stripe's native subscriptions through
  `@antelopejs/interface-subscriptions`. To run a generic renewal clock instead,
  choose `@antelopejs/payment-subscriptions` explicitly. Do not run both clocks
  for the same subscription.

## Conventions

- **Integer minor units.** `{ value: 1050, currency: "EUR" }` is €10.50, never a float.
- **An idempotency key on every mutating call.** The key is the positional argument after the request.
- **Opaque provider identifiers.** Do not parse them.
- **A decline is a result, not an exception.** `CreatePayment` resolves with
  `status: "failed"`. It rejects only when the call itself could not be made.
- **An optional trailing `provider` argument.** It selects one of several configured accounts.

## Conformance suite

The package ships a conformance suite, `src/tests/payment.test.ts` and
`src/tests/payment-charges.test.ts`. The build publishes it as
`@antelopejs/interface-payment/tests/*`, and it runs against whichever provider
module is wired in. The suite tests the contract, not one provider's behavior. A
new provider implementation must pass it.

Session creation, the customer lifecycle, idempotency replay, unknown-identifier
errors, and webhook rejection need no fixture. They also cannot pass without a
live provider. With nothing implementing the interface, the calls queue and the
suite times out instead of reporting green.

The charge tests need a provider test token, because there is no portable way to
mint a chargeable payment method:

| Variable                                | Purpose                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ANTELOPE_PAYMENT_TEST_METHOD`          | A token `CreatePayment` charges successfully. Without it the charge, capture and refund blocks skip by name. |
| `ANTELOPE_PAYMENT_TEST_METHOD_DECLINED` | A token the provider declines. Without it the decline block skips.                                           |
| `ANTELOPE_PAYMENT_TEST_CURRENCY`        | ISO-4217 code to run against. Defaults to `EUR`.                                                             |

## Documentation

| Document                                                             | Contents                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [Introduction](./docs/1.introduction.md)                             | Scope, conventions, and installation                                      |
| [Payments](./docs/2.payments.md)                                     | Checkout, direct payments, authorize and capture, refunds, and errors     |
| [Customers and methods](./docs/3.customers-and-methods.md)           | Saved methods, and off-session and recurring charges                      |
| [Webhooks](./docs/4.webhooks.md)                                     | Verification, the event set, and handling                                 |
| [Provider capability matrix](./docs/5.provider-capability-matrix.md) | What each provider family does behind each call, and why the scope is set |

## Compatibility

<!-- antelopejs-docs-compat:start -->

| Package                      | Supported        | Tested with |
| ---------------------------- | ---------------- | ----------- |
| `@antelopejs/interface-core` | `>=0.0.3 <1.0.0` | `0.4.0`     |

<!-- antelopejs-docs-compat:end -->

The table lists the peer requirements in `package.json`, not the development or
test-tool ranges. The implementing module can add requirements of its own.

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md). Use the Node.js version in `.nvmrc`
and the pnpm version in the `packageManager` field of `package.json`:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm format:check
pnpm knip
```

`pnpm test` runs the local contract tests through the AntelopeJS runner, with no
payment provider and no credentials. The provider conformance suite above is a
separate integration check.

## Part of AntelopeJS

This package belongs to [AntelopeJS](https://github.com/AntelopeJS/antelopejs), the TypeScript framework where modules depend on contracts and the application chooses the provider. The open-source back office [AntelopeJS DMS](https://github.com/AntelopeJS/dms) is built on it.

<!-- antelopejs-framework-modules:start -->

| Area         | Contracts                                                                                                                                                                                                                                                                                                                                                                                                                  | Providers                                                                                                                                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API          | [`interface-api`](https://github.com/AntelopeJS/interface-api) · [`interface-api-util`](https://github.com/AntelopeJS/interface-api-util) · [`interface-data-api`](https://github.com/AntelopeJS/interface-data-api)                                                                                                                                                                                                       | [`api`](https://github.com/AntelopeJS/api)                                                                                                                                                                                                          |
| Auth         | [`interface-auth`](https://github.com/AntelopeJS/interface-auth)                                                                                                                                                                                                                                                                                                                                                           | [`auth-jwt`](https://github.com/AntelopeJS/auth-jwt)                                                                                                                                                                                                |
| Database     | [`interface-database`](https://github.com/AntelopeJS/interface-database) · [`interface-database-decorators`](https://github.com/AntelopeJS/interface-database-decorators) · [`interface-database-catalog`](https://github.com/AntelopeJS/interface-database-catalog) · [`interface-mongodb`](https://github.com/AntelopeJS/interface-mongodb) · [`interface-rethinkdb`](https://github.com/AntelopeJS/interface-rethinkdb) | [`postgres`](https://github.com/AntelopeJS/postgres) · [`mongodb`](https://github.com/AntelopeJS/mongodb) · [`rethinkdb`](https://github.com/AntelopeJS/rethinkdb)                                                                                  |
| Redis        | [`interface-redis`](https://github.com/AntelopeJS/interface-redis) · [`interface-redis-scheduler`](https://github.com/AntelopeJS/interface-redis-scheduler)                                                                                                                                                                                                                                                                | [`redis`](https://github.com/AntelopeJS/redis)                                                                                                                                                                                                      |
| Email        | [`interface-email`](https://github.com/AntelopeJS/interface-email)                                                                                                                                                                                                                                                                                                                                                         | [`nodemailer`](https://github.com/AntelopeJS/nodemailer) · [`brevo`](https://github.com/AntelopeJS/brevo)                                                                                                                                           |
| File storage | [`interface-file-storage`](https://github.com/AntelopeJS/interface-file-storage)                                                                                                                                                                                                                                                                                                                                           | [`file-storage-local`](https://github.com/AntelopeJS/file-storage-local) · [`file-storage-s3`](https://github.com/AntelopeJS/file-storage-s3)                                                                                                       |
| Payments     | **`interface-payment`** · [`interface-subscriptions`](https://github.com/AntelopeJS/interface-subscriptions) · [`interface-stripe`](https://github.com/AntelopeJS/interface-stripe)                                                                                                                                                                                                                                        | [`stripe`](https://github.com/AntelopeJS/stripe) · [`mollie`](https://github.com/AntelopeJS/mollie) · [`checkout-com`](https://github.com/AntelopeJS/checkout-com) · [`payment-subscriptions`](https://github.com/AntelopeJS/payment-subscriptions) |

<!-- antelopejs-framework-modules:end -->

## License

[Apache-2.0](./LICENSE)
