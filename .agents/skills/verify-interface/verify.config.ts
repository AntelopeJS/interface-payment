import type { VerifyConfig } from "@antelopejs/tooling-configs/verify";

import type * as PaymentInterface from "../../../src/index.ts";
import { conformanceSuite } from "./conformance-suite.ts";
import { declared, scenario, throughCore } from "./journey-helpers.ts";
import { CHECKOUT_TYPES, CUSTOMER_TYPES, ERROR_TYPES, PAYMENT_TYPES, REFUND_TYPES, STATUS_TYPES, WEBHOOK_TYPES } from "./probes.ts";
import { CHECKOUT_BODY, CUSTOMERS_BODY, ERRORS_BODY, PAYMENTS_BODY, REFUND_BODY, VOCABULARY_BODY, WEBHOOK_BODY } from "./scenarios.ts";

/** The name, message and provider code of an error, as the consumer reads them. */
function readError(error: PaymentInterface.PaymentError): string[] {
  return [error.name, error.message, error.providerCode ?? ""];
}

const config: VerifyConfig<typeof PaymentInterface> = {
  doors: {
    data: null,
    format: {
      globs: ["src/types.ts"],
      funnels: [],
      why: "the status, failure code, refund reason, method type and event type strings, the minor-unit amounts and the epoch-millisecond timestamps are what consumers store and compare",
    },
    contract: {
      globs: ["src/index.ts", "src/functions.ts", "src/errors.ts", "src/types.ts", "package.json"],
      funnels: [],
      why: "the fourteen functions, the error classes and the types are what every payment module imports and every provider implements",
    },
    outbound: {
      globs: ["src/functions.ts"],
      funnels: [],
      why: "CreatePayment, CapturePayment, RefundPayment and CreateCheckoutSession move money at a provider; the amount, the method and the idempotency key leave this file for it",
    },
    exposure: null,
    publish: {
      globs: ["package.json", ".release-it.json", "changelogen.config.json", ".github/workflows/release.yml"],
      funnels: [],
      why: "the package name and release workflow claim @antelopejs/interface-payment on npm",
    },
  },
  interface: {
    calls: {
      ".:PaymentError": { call: (api) => readError(new api.PaymentError("plain", "code-1")), expect: ["PaymentError", "plain", "code-1"] },
      ".:PaymentNotFoundError": { call: (api) => readError(new api.PaymentNotFoundError("re_1", "refund", "code-2")), expect: ["PaymentNotFoundError", "No such refund: re_1", "code-2"] },
      ".:CustomerNotFoundError": { call: (api) => readError(new api.CustomerNotFoundError("pm_1", "payment method", "code-3")), expect: ["CustomerNotFoundError", "No such payment method: pm_1", "code-3"] },
      ".:WebhookVerificationError": { call: (api) => readError(new api.WebhookVerificationError("unsigned", "code-4")), expect: ["WebhookVerificationError", "unsigned", "code-4"] },
      ".:InvalidPaymentStateError": { call: (api) => readError(new api.InvalidPaymentStateError("already captured", "succeeded", "code-5")), expect: ["InvalidPaymentStateError", "already captured", "code-5"] },
      ".:UnsupportedOperationError": {
        call: (api) => readError(new api.UnsupportedOperationError("CapturePayment", "code-6")),
        expect: ["UnsupportedOperationError", "Operation not supported by this payment provider: CapturePayment", "code-6"],
      },
      ".:isTerminalPaymentStatus": { call: (api) => [api.isTerminalPaymentStatus("succeeded"), api.isTerminalPaymentStatus("authorized")], expect: [true, false] },
    },
  },
  journeys: {
    "conformance-suite": conformanceSuite,
    "checkout-through-core": throughCore("CreateCheckoutSession and GetCheckoutSession reach the provider through core", [
      { name: "CreateCheckoutSession", args: [{ amount: { value: 4999, currency: "EUR" }, reference: "order-1042", successUrl: "https://shop.example/ok", cancelUrl: "https://shop.example/cart" }, "key-1"] },
      { name: "GetCheckoutSession", args: ["cs_1", "account-b"] },
    ]),
    "checkout-pass-through": scenario("the checkout calls hand the request, the key and the provider scope over unchanged and return the session, or a not-found error naming a checkout session", CHECKOUT_BODY, '{"argsReached":true,"created":true,"scoped":true,"paymentSet":"pay_1","absent":{"name":"PaymentNotFoundError","message":"No such checkout session: cs_absent","providerCode":"no_such_session","status":null,"isPaymentError":true}}'),
    "checkout-types": declared("the checkout functions and types have the documented shapes", CHECKOUT_TYPES),
    "payments-through-core": throughCore("the payment functions reach the provider through core", [
      { name: "CreatePayment", args: [{ amount: { value: 2500, currency: "EUR" }, reference: "order-1", paymentMethod: "pm_1", offSession: true }, "key-1"] },
      { name: "GetPayment", args: ["pay_1"] },
      { name: "CapturePayment", args: ["pay_1", "key-2", { value: 1000, currency: "EUR" }, "account-a"] },
      { name: "CancelPayment", args: ["pay_1", "key-3"] },
    ]),
    "payments-pass-through": scenario("the payment calls hand their arguments over unchanged, resolve a decline as a payment and surface a state or not-found error with its status and provider code", PAYMENTS_BODY, '{"createdArgs":true,"created":true,"declineIsAResult":true,"partial":["succeeded",1000,2500],"captureArgs":true,"again":{"name":"InvalidPaymentStateError","message":"Payment is not authorized","providerCode":"payment_intent_unexpected_state","status":"succeeded","isPaymentError":true},"cancelArgs":true,"cancel":{"name":"InvalidPaymentStateError","message":"Payment has been captured","providerCode":null,"status":"succeeded","isPaymentError":true},"absent":{"name":"PaymentNotFoundError","message":"No such payment: pay_absent","providerCode":null,"status":null,"isPaymentError":true}}'),
    "payments-types": declared("the payment functions and types have the documented shapes", PAYMENT_TYPES),
    "refunds-through-core": throughCore("RefundPayment and GetRefund reach the provider through core", [
      { name: "RefundPayment", args: [{ payment: "pay_1", amount: { value: 700, currency: "EUR" }, reason: "requested_by_customer" }, "key-1"] },
      { name: "GetRefund", args: ["re_1"] },
    ]),
    "refunds-pass-through": scenario("the refund calls hand a whole or partial request over unchanged and surface a state or not-found error", REFUND_BODY, '{"requestReached":true,"wholeReached":true,"created":true,"whole":"re_1","open":{"name":"InvalidPaymentStateError","message":"Payment is not captured","providerCode":null,"status":"authorized","isPaymentError":true},"missing":{"name":"PaymentNotFoundError","message":"No such payment: pay_absent","providerCode":null,"status":null,"isPaymentError":true},"read":["re_1","succeeded"],"absent":{"name":"PaymentNotFoundError","message":"No such refund: re_absent","providerCode":null,"status":null,"isPaymentError":true}}'),
    "refunds-types": declared("the refund functions and types have the documented shapes", REFUND_TYPES),
    "customers-through-core": throughCore("the customer functions reach the provider through core", [
      { name: "CreateCustomer", args: [{ email: "a@example.com" }, "key-1"] },
      { name: "GetCustomer", args: ["cus_1"] },
      { name: "DeleteCustomer", args: ["cus_1", "key-2"] },
      { name: "ListPaymentMethods", args: ["cus_1"] },
      { name: "DetachPaymentMethod", args: ["pm_1", "key-3"] },
    ]),
    "customers-pass-through": scenario("the customer calls hand their arguments over unchanged, return the saved methods as listed and resolve a delete or detach with nothing", CUSTOMERS_BODY, '{"createdArgs":true,"bareArgs":true,"answers":true,"listed":true,"empty":[],"deleted":null,"detached":null,"deleteArgs":true,"absent":{"name":"CustomerNotFoundError","message":"No such customer: cus_absent","providerCode":null,"status":null,"isPaymentError":true},"absentList":{"name":"CustomerNotFoundError","message":"No such customer: cus_absent","providerCode":null,"status":null,"isPaymentError":true},"absentMethod":{"name":"CustomerNotFoundError","message":"No such payment method: pm_absent","providerCode":"no_such_method","status":null,"isPaymentError":true}}'),
    "customers-types": declared("the customer functions and types have the documented shapes", CUSTOMER_TYPES),
    "webhooks-through-core": throughCore("VerifyWebhook reaches the provider through core", [{ name: "VerifyWebhook", args: [{ body: [123, 125], headers: { "content-type": "application/json" } }] }]),
    "webhooks-pass-through": scenario("VerifyWebhook hands the raw body and the headers over untouched and returns the event, undefined for an event it does not model, or a verification error", WEBHOOK_BODY, '{"verified":true,"unmodeledIsUndefined":true,"bodyUntouched":true,"headersUntouched":true,"scopeReached":"account-a","refused":{"name":"WebhookVerificationError","message":"signature missing","providerCode":"sig_missing","status":null,"isPaymentError":true}}'),
    "webhooks-types": declared("VerifyWebhook, PaymentEvent, Dispute and WebhookRequest have the documented shapes", WEBHOOK_TYPES),
    "error-classes": scenario("each error class is its own name, a PaymentError and not any of the others, and carries its message, kind, provider code, status and operation", ERRORS_BODY, '{"base":["PaymentError","plain","code-1",true],"matrix":{"PaymentNotFoundError":["PaymentNotFoundError"],"CustomerNotFoundError":["CustomerNotFoundError"],"WebhookVerificationError":["WebhookVerificationError"],"InvalidPaymentStateError":["InvalidPaymentStateError"],"UnsupportedOperationError":["UnsupportedOperationError"]},"names":["PaymentNotFoundError","CustomerNotFoundError","WebhookVerificationError","InvalidPaymentStateError","UnsupportedOperationError"],"messages":["No such payment: pay_1","No such refund: re_1","No such checkout session: cs_1","No such customer: cus_1","No such payment method: pm_1","unsigned","Operation not supported by this payment provider: CapturePayment"],"providerCodes":["c1","c2","c3","c4","c5",null],"state":["succeeded",null],"operation":"CapturePayment"}'),
    "error-types": declared("the error classes have the documented constructors and fields", ERROR_TYPES),
    vocabularies: scenario("the vocabularies list exactly the documented values, frozen, and isTerminalPaymentStatus classifies each status", VOCABULARY_BODY, '{"lists":{"PAYMENT_STATUSES":["pending","requires_action","authorized","succeeded","failed","canceled"],"TERMINAL_PAYMENT_STATUSES":["succeeded","failed","canceled"],"PAYMENT_FAILURE_CODES":["declined","insufficient_funds","expired_card","incorrect_details","authentication_failed","canceled_by_payer","expired","processing_error"],"REFUND_STATUSES":["pending","succeeded","failed"],"REFUND_REASONS":["duplicate","fraudulent","requested_by_customer","other"],"PAYMENT_METHOD_TYPES":["card","wallet","bank_account","other"],"PAYMENT_EVENT_TYPES":["payment.pending","payment.authorized","payment.succeeded","payment.failed","payment.canceled","refund.succeeded","refund.failed","dispute.opened"],"PAYMENT_LOCALES":["auto","bg","cs","da","de","el","en","en-GB","es","es-419","et","fi","fil","fr","fr-CA","hr","hu","id","it","ja","ko","lt","lv","ms","mt","nb","nl","pl","pt","pt-BR","ro","ru","sk","sl","sv","th","tr","vi","zh","zh-HK","zh-TW"]},"classified":{"pending":false,"requires_action":false,"authorized":false,"succeeded":true,"failed":true,"canceled":true},"frozen":{"PAYMENT_STATUSES":true,"TERMINAL_PAYMENT_STATUSES":true,"PAYMENT_FAILURE_CODES":true,"REFUND_STATUSES":true,"REFUND_REASONS":true,"PAYMENT_METHOD_TYPES":true,"PAYMENT_EVENT_TYPES":true,"PAYMENT_LOCALES":true},"terminalUntouched":true,"unknownIsTerminal":false}'),
    "status-types": declared("the vocabularies and isTerminalPaymentStatus have the documented types", STATUS_TYPES),
  },
};

export default config;
