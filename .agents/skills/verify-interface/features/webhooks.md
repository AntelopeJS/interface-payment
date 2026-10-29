---
covers:
  - src/index.ts
  - src/functions.ts
  - src/types.ts
docs:
  - docs/4.webhooks.md
journeys:
  - webhooks-through-core
  - webhooks-pass-through
  - webhooks-types
---

# Webhooks

A backend hands the raw body and the headers of a webhook delivery to `VerifyWebhook(request, provider?)` and gets a normalised `PaymentEvent`, `undefined` for a genuine delivery the interface does not model, or a `WebhookVerificationError`.

## Sub-features

- `webhooks-through-core`: in `ajs project dev`, a consumer calls `VerifyWebhook` through core and the stub provider receives exactly the request.
- `webhooks-pass-through`: with a stand-in provider attached, the body (a `Uint8Array`, byte for byte) and the headers (arrays and absent values kept) reach the provider untouched, the event comes back as is, `undefined` stays `undefined`, and a refusal surfaces as a `WebhookVerificationError` with its provider code.
- `webhooks-types`: a strict `tsc` probe against the packed declarations pins `VerifyWebhook`, `WebhookRequest`, `PaymentEvent`, `PaymentEventType` and `Dispute`, in both directions.

## How to get to it (user POV)

- `const event = await VerifyWebhook({ body: rawBody, headers })` in the route that receives the provider's deliveries, answering 200 for `undefined` and 403 for a verification error.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" webhooks
```

## Gotchas

- The provider is a stand-in: what a real provider does behind each call (charging, idempotency replay windows, settlement) is the provider's, so these journeys prove what this interface hands over and returns.
