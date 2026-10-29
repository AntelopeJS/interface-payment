---
covers:
  - src/types.ts
docs:
  - docs/2.payments.md
  - docs/4.webhooks.md
journeys:
  - vocabularies
  - status-types
---

# Statuses and vocabularies

A backend branches on the frozen vocabularies (`PAYMENT_STATUSES`, `PAYMENT_FAILURE_CODES`, `REFUND_STATUSES`, `REFUND_REASONS`, `PAYMENT_METHOD_TYPES`, `PAYMENT_EVENT_TYPES`) and asks `isTerminalPaymentStatus(status)` whether a payment can still change.

## Sub-features

- `vocabularies`: in a Node process on the packed interface, every list holds exactly the documented values in order and is frozen; `TERMINAL_PAYMENT_STATUSES` is `succeeded`, `failed`, `canceled` and cannot be changed by a consumer; `isTerminalPaymentStatus` is true for those three and false for `pending`, `requires_action` and `authorized`.
- `status-types`: a strict `tsc` probe against the packed declarations pins the type of each vocabulary as a readonly tuple of the exact literals, and the signature of `isTerminalPaymentStatus`, in both directions.

## How to get to it (user POV)

- `if (isTerminalPaymentStatus(payment.status)) { /* stop polling */ }`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" statuses
```

## Gotchas

- The strings are stored by consumers: a changed value is a format change, covered by the format door.
