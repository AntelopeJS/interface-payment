# Feature map

One file per feature. `covers:` lists the source globs it owns, `docs:` the pages a verdict judges, `journeys:` the journeys it runs, and `seeded-breaks/<feature>.patch` the break its journeys must catch. `pnpm exec antelopejs-verify map` checks that every user-facing file is covered.

| Feature | What the user does | Journeys |
|---|---|---|
| [checkout](checkout.md) | A backend creates a hosted checkout session and reads it back when the payer returns. | checkout-through-core, checkout-pass-through, checkout-types |
| [payments](payments.md) | A backend charges a method, reads, captures and cancels a payment. | payments-through-core, payments-pass-through, payments-types |
| [refunds](refunds.md) | A backend refunds a captured payment in full or in part and follows the refund. | refunds-through-core, refunds-pass-through, refunds-types |
| [customers](customers.md) | A backend manages customers and their saved payment methods. | customers-through-core, customers-pass-through, customers-types |
| [webhooks](webhooks.md) | A backend verifies a webhook delivery and gets a normalised event. | webhooks-through-core, webhooks-pass-through, webhooks-types |
| [errors](errors.md) | A caller catches payment errors and reads the provider code, the status or the operation. | error-classes, error-types |
| [statuses](statuses.md) | A backend branches on the frozen vocabularies and the terminal-status helper. | vocabularies, status-types |
| [conformance](conformance.md) | A provider author runs the shipped conformance suite against an implementation. | conformance-suite |
| [smoke](smoke.md) | The fixed journeys every verdict runs: load the packed interface with a stub provider and call every function. | every-function, minor-bump |
