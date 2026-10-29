---
covers:
  - src/tests/**
docs:
  - docs/5.provider-capability-matrix.md
journeys:
  - conformance-suite
---

# Conformance

A provider author runs the suite shipped under `@antelopejs/interface-payment/tests/*` (`payment.test.js`, `payment-charges.test.js`) against the module that implements the interface; it holds the implementation to the documented contract (identifiers round-trip, idempotency replay, not-found errors, webhook refusal, and with a test token the charge, capture, decline and refund rules).

## Sub-features

- `conformance-suite`: the suite runs under mocha against an in-memory reference provider attached to the packed interface's functions, with the charge and decline tokens set. The reference provider passes every test with none skipped. Three flawed variants must fail exactly the tests that guard the rule they break: timestamps in epoch seconds, a replayed idempotency key creating a second checkout session, and an unknown payment identifier answered with an invented payment.

## How to get to it (user POV)

- In a provider module: `ANTELOPE_PAYMENT_TEST_METHOD=<token> ajs module test .` with the suite listed in the module's test setup.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" conformance
```

## Gotchas

- The reference provider is a stand-in written for this journey; it proves the suite accepts a conforming implementation and refuses these three flaws, not that it catches every possible flaw. The suite's own README says a refund total hard-coded to zero is caught by a poll that runs to its deadline, so no variant here exercises that rule.
