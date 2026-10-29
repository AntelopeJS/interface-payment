---
covers:
  - src/index.ts
  - src/functions.ts
  - src/types.ts
docs:
  - docs/1.introduction.md
  - docs/2.payments.md
journeys:
  - payments-through-core
  - payments-pass-through
  - payments-types
---

# Payments

A backend calls `CreatePayment` to charge a saved method or a hosted form, `GetPayment` to read the state, `CapturePayment` to take an authorized amount (in full or in part) and `CancelPayment` to release it. A declined payment is a result with status `failed`, not an error.

## Sub-features

- `payments-through-core`: in `ajs project dev`, a consumer calls the four functions through core and the stub provider receives exactly the arguments.
- `payments-pass-through`: with a stand-in provider attached, the request, the idempotency key, the amount and the provider scope reach the provider unchanged; a decline resolves as a `failed` payment with its `failure`; capturing or cancelling a payment in the wrong state surfaces as an `InvalidPaymentStateError` carrying the real status and the provider code; an unknown payment surfaces as a `PaymentNotFoundError`.
- `payments-types`: a strict `tsc` probe against the packed declarations pins the parameters and answers of the four functions and the exact shape of `Payment`, `PaymentRequest`, `Amount`, `PaymentFailure` and the status and failure code unions, in both directions.

## How to get to it (user POV)

- `const payment = await CreatePayment({ amount, reference, paymentMethod, offSession: true }, key)`, then `CapturePayment(payment.id, key2)` once it is `authorized`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" payments
```

## Gotchas

- The provider is a stand-in: what a real provider does behind each call (charging, idempotency replay windows, settlement) is the provider's, so these journeys prove what this interface hands over and returns.
