---
covers:
  - src/index.ts
  - src/functions.ts
  - src/types.ts
docs:
  - docs/1.introduction.md
  - docs/3.customers-and-methods.md
journeys:
  - customers-through-core
  - customers-pass-through
  - customers-types
---

# Customers and methods

A backend creates a customer to save payment methods against (`CreateCustomer`, `GetCustomer`, `DeleteCustomer`), lists the methods chargeable off-session (`ListPaymentMethods`) and detaches one (`DetachPaymentMethod`).

## Sub-features

- `customers-through-core`: in `ajs project dev`, a consumer calls the five functions through core and the stub provider receives exactly the arguments.
- `customers-pass-through`: with a stand-in provider attached, the requests and keys reach the provider unchanged, the customer and the saved methods come back untouched (an empty list stays empty), delete and detach resolve with no value, and an unknown customer or method surfaces as a `CustomerNotFoundError` that names its kind and keeps its provider code.
- `customers-types`: a strict `tsc` probe against the packed declarations pins the five functions, `Customer`, `CustomerRequest`, `PaymentMethod`, `CardDetails` and `PaymentMethodType`, in both directions.

## How to get to it (user POV)

- `const customer = await CreateCustomer({ email }, key)`, then `await ListPaymentMethods(customer.id)` after a payment saved a method.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" customers
```

## Gotchas

- The provider is a stand-in: what a real provider does behind each call (charging, idempotency replay windows, settlement) is the provider's, so these journeys prove what this interface hands over and returns.
