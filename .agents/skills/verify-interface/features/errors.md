---
covers:
  - src/errors.ts
docs:
  - docs/2.payments.md
  - docs/4.webhooks.md
journeys:
  - error-classes
  - error-types
---

# Errors

A caller catches `PaymentError` or one of its subclasses (`PaymentNotFoundError`, `CustomerNotFoundError`, `WebhookVerificationError`, `InvalidPaymentStateError`, `UnsupportedOperationError`) and reads the provider's own code, the real status or the unsupported operation.

## Sub-features

- `error-classes`: in a Node process on the packed interface, each class carries its own `name`, is an `Error` and a `PaymentError`, is not an instance of any other subclass, builds the documented message (kind named, default kind `payment` or `customer`) and exposes `providerCode`, `status` and `operation`.
- `error-types`: a strict `tsc` probe against the packed declarations pins the constructor parameters and the readable fields of every class and the entity unions, in both directions.

## How to get to it (user POV)

- `try { await CapturePayment(id, key) } catch (error) { if (error instanceof InvalidPaymentStateError) { ... } }`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" errors
```

## Gotchas

- The classes are the contract between a provider and its callers; no journey raises them from a real provider.
