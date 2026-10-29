---
covers:
  - src/index.ts
  - src/functions.ts
  - src/types.ts
docs:
  - docs/1.introduction.md
  - docs/2.payments.md
journeys:
  - checkout-through-core
  - checkout-pass-through
  - checkout-types
---

# Checkout

A backend calls `CreateCheckoutSession(request, idempotencyKey, provider?)` to get a hosted page to redirect the payer to, and `GetCheckoutSession(id, provider?)` when the payer returns to learn what happened.

## Sub-features

- `checkout-through-core`: in `ajs project dev`, a consumer calls both functions through core and the stub provider receives exactly the arguments, the provider scope included.
- `checkout-pass-through`: with a stand-in provider attached, the request, the key and the scope reach the provider unchanged, the session comes back untouched (with `payment` set once a payment exists), and an unknown session surfaces as a `PaymentNotFoundError` that names a checkout session and keeps its provider code.
- `checkout-types`: a strict `tsc` probe against the packed declarations pins the parameters and answers of both functions and the exact shape of `CheckoutSessionRequest`, `CheckoutSession`, `Amount` and the status and failure types, in both directions.

## How to get to it (user POV)

- `const session = await CreateCheckoutSession({ amount, reference, successUrl, cancelUrl }, key)`, then `response.redirect(session.redirectUrl)`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" checkout
```

## Gotchas

- The provider is a stand-in: what a real provider does behind each call (charging, idempotency replay windows, settlement) is the provider's, so these journeys prove what this interface hands over and returns.
