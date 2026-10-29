---
covers:
  - src/index.ts
  - src/functions.ts
  - src/types.ts
docs:
  - docs/2.payments.md
journeys:
  - refunds-through-core
  - refunds-pass-through
  - refunds-types
---

# Refunds

A backend calls `RefundPayment(request, idempotencyKey, provider?)` to refund a captured payment in full (no `amount`) or in part, and `GetRefund(id, provider?)` to follow a refund that is usually still `pending`.

## Sub-features

- `refunds-through-core`: in `ajs project dev`, a consumer calls both functions through core and the stub provider receives exactly the arguments.
- `refunds-pass-through`: with a stand-in provider attached, a whole and a partial request reach the provider unchanged, the refund comes back untouched, a payment in the wrong state surfaces as an `InvalidPaymentStateError` with its status, and an unknown payment or refund surfaces as a `PaymentNotFoundError`.
- `refunds-types`: a strict `tsc` probe against the packed declarations pins both functions, `Refund`, `RefundRequest`, `RefundStatus` and `RefundReason`, in both directions.

## How to get to it (user POV)

- `const refund = await RefundPayment({ payment: payment.id, amount, reason: "requested_by_customer" }, key)`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" refunds
```

## Gotchas

- The provider is a stand-in: what a real provider does behind each call (charging, idempotency replay windows, settlement) is the provider's, so these journeys prove what this interface hands over and returns.
