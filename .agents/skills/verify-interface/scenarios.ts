export const CHECKOUT_BODY = `
  const request = { amount: amount(4999), reference: "order-1042", successUrl: "https://shop.example/ok", cancelUrl: "https://shop.example/cart", description: "Order", locale: "fr", authorizeOnly: true, customer: "cus_1", savePaymentMethod: true, metadata: { cart: "c1" } };
  const session = { id: "cs_1", redirectUrl: "https://pay.example/cs_1", status: "pending", expiresAt: 1_790_003_600_000 };
  attach("CreateCheckoutSession", () => session);
  attach("GetCheckoutSession", (id) => { if (id === "cs_absent") throw new payment.PaymentNotFoundError(id, "checkout session", "no_such_session"); return { ...session, status: "succeeded", payment: "pay_1" }; });
  const created = await payment.CreateCheckoutSession(request, "key-1");
  const scoped = await payment.CreateCheckoutSession(request, "key-2", "account-b");
  const read = await payment.GetCheckoutSession("cs_1");
  const absent = await failure(payment.GetCheckoutSession("cs_absent", "account-b"));
  return {
    argsReached: same(received.map(([name, args]) => [name, args]), [["CreateCheckoutSession", [request, "key-1"]], ["CreateCheckoutSession", [request, "key-2", "account-b"]], ["GetCheckoutSession", ["cs_1"]], ["GetCheckoutSession", ["cs_absent", "account-b"]]]),
    created: same(created, session),
    scoped: same(scoped, session),
    paymentSet: read.payment,
    absent,
  };
`;

export const PAYMENTS_BODY = `
  const request = { amount: amount(2500), reference: "order-1", paymentMethod: "pm_1", customer: "cus_1", offSession: true, authorizeOnly: true, returnUrl: "https://shop.example/return", description: "Renewal", metadata: { order: "1" } };
  const declined = paymentRecord({ id: "pay_declined", status: "failed", failure: { code: "declined", message: "Card declined", providerCode: "card_declined" } });
  const authorized = paymentRecord({ status: "authorized" });
  let state = authorized;
  attach("CreatePayment", (req) => (req.paymentMethod === "pm_declined" ? declined : authorized));
  attach("GetPayment", (id) => { if (id === "pay_absent") throw new payment.PaymentNotFoundError(id); return state; });
  attach("CapturePayment", (id, key, value) => {
    if (state.status !== "authorized") throw new payment.InvalidPaymentStateError("Payment is not authorized", state.status, "payment_intent_unexpected_state");
    state = { ...state, status: "succeeded", amountCaptured: value ?? state.amount };
    return state;
  });
  attach("CancelPayment", () => { throw new payment.InvalidPaymentStateError("Payment has been captured", "succeeded"); });
  const created = await payment.CreatePayment(request, "key-1", "account-a");
  const resolvedDecline = await payment.CreatePayment({ amount: amount(2500), reference: "order-2", paymentMethod: "pm_declined" }, "key-2");
  const partial = await payment.CapturePayment("pay_1", "key-3", amount(1000));
  const again = await failure(payment.CapturePayment("pay_1", "key-4"));
  const cancel = await failure(payment.CancelPayment("pay_1", "key-5", "account-a"));
  const absent = await failure(payment.GetPayment("pay_absent"));
  return {
    createdArgs: same(received[0], ["CreatePayment", [request, "key-1", "account-a"]]),
    created: same(created, authorized),
    declineIsAResult: same(resolvedDecline, declined),
    partial: [partial.status, partial.amountCaptured.value, partial.amount.value],
    captureArgs: same(received[2], ["CapturePayment", ["pay_1", "key-3", amount(1000)]]),
    again,
    cancelArgs: same(received.find(([name]) => name === "CancelPayment"), ["CancelPayment", ["pay_1", "key-5", "account-a"]]),
    cancel,
    absent,
  };
`;

export const REFUND_BODY = `
  const request = { payment: "pay_1", amount: amount(700), reason: "requested_by_customer", metadata: { ticket: "t1" } };
  const refund = { id: "re_1", payment: "pay_1", amount: amount(700), status: "pending", createdAt: 1_790_000_000_000 };
  attach("RefundPayment", (req) => { if (req.payment === "pay_open") throw new payment.InvalidPaymentStateError("Payment is not captured", "authorized"); if (req.payment === "pay_absent") throw new payment.PaymentNotFoundError(req.payment); return refund; });
  attach("GetRefund", (id) => { if (id === "re_absent") throw new payment.PaymentNotFoundError(id, "refund"); return { ...refund, status: "succeeded" }; });
  const created = await payment.RefundPayment(request, "key-1", "account-a");
  const whole = await payment.RefundPayment({ payment: "pay_1" }, "key-2");
  const open = await failure(payment.RefundPayment({ payment: "pay_open" }, "key-3"));
  const missing = await failure(payment.RefundPayment({ payment: "pay_absent" }, "key-4"));
  const read = await payment.GetRefund("re_1");
  const absent = await failure(payment.GetRefund("re_absent"));
  return {
    requestReached: same(received[0], ["RefundPayment", [request, "key-1", "account-a"]]),
    wholeReached: same(received[1], ["RefundPayment", [{ payment: "pay_1" }, "key-2"]]),
    created: same(created, refund),
    whole: whole.id,
    open,
    missing,
    read: [read.id, read.status],
    absent,
  };
`;

export const CUSTOMERS_BODY = `
  const customer = { id: "cus_1" };
  const methods = [{ id: "pm_2", type: "wallet", customer: "cus_1", createdAt: 1_790_000_100_000 }, { id: "pm_1", type: "card", customer: "cus_1", card: { brand: "visa", last4: "4242", expiryMonth: 12, expiryYear: 2030 }, createdAt: 1_790_000_000_000 }];
  attach("CreateCustomer", () => customer);
  attach("GetCustomer", (id) => { if (id === "cus_absent") throw new payment.CustomerNotFoundError(id); return customer; });
  attach("DeleteCustomer", (id) => { if (id === "cus_absent") throw new payment.CustomerNotFoundError(id); });
  attach("ListPaymentMethods", (id) => { if (id === "cus_absent") throw new payment.CustomerNotFoundError(id); return id === "cus_new" ? [] : methods; });
  attach("DetachPaymentMethod", (id) => { if (id === "pm_absent") throw new payment.CustomerNotFoundError(id, "payment method", "no_such_method"); });
  const created = await payment.CreateCustomer({ email: "a@example.com", name: "A", metadata: { user: "u1" } }, "key-1", "account-a");
  const bare = await payment.CreateCustomer({}, "key-2");
  const read = await payment.GetCustomer("cus_1");
  const listed = await payment.ListPaymentMethods("cus_1");
  const empty = await payment.ListPaymentMethods("cus_new");
  const deleted = await payment.DeleteCustomer("cus_1", "key-3");
  const detached = await payment.DetachPaymentMethod("pm_1", "key-4", "account-a");
  const absent = await failure(payment.GetCustomer("cus_absent"));
  const absentList = await failure(payment.ListPaymentMethods("cus_absent"));
  const absentMethod = await failure(payment.DetachPaymentMethod("pm_absent", "key-5"));
  return {
    createdArgs: same(received[0], ["CreateCustomer", [{ email: "a@example.com", name: "A", metadata: { user: "u1" } }, "key-1", "account-a"]]),
    bareArgs: same(received[1], ["CreateCustomer", [{}, "key-2"]]),
    answers: same([created, bare, read], [customer, customer, customer]),
    listed: same(listed, methods),
    empty,
    deleted: deleted ?? null,
    detached: detached ?? null,
    deleteArgs: same(received.find(([name]) => name === "DeleteCustomer"), ["DeleteCustomer", ["cus_1", "key-3"]]),
    absent,
    absentList,
    absentMethod,
  };
`;

export const WEBHOOK_BODY = `
  const event = { id: "evt_1", type: "payment.succeeded", createdAt: 1_790_000_000_000, payment: paymentRecord({ status: "succeeded" }) };
  const body = Buffer.from('{"id":"evt_1","raw":true}');
  const headers = { "content-type": "application/json", "x-signature": ["a", "b"], "x-missing": undefined };
  attach("VerifyWebhook", (request, scope) => {
    if (request.headers["x-signature"] === undefined) throw new payment.WebhookVerificationError("signature missing", "sig_missing");
    return scope === "ignored" ? undefined : event;
  });
  const verified = await payment.VerifyWebhook({ body, headers }, "account-a");
  const unmodeled = await payment.VerifyWebhook({ body, headers }, "ignored");
  const refused = await failure(payment.VerifyWebhook({ body: new Uint8Array([1, 2, 3]), headers: { "content-type": "text/plain" } }));
  const sent = received[0][1][0];
  return {
    verified: same(verified, event),
    unmodeledIsUndefined: unmodeled === undefined,
    bodyUntouched: sent.body instanceof Uint8Array && Buffer.compare(Buffer.from(sent.body), body) === 0,
    headersUntouched: same(sent.headers, headers),
    scopeReached: received[0][1][1],
    refused,
  };
`;

export const ERRORS_BODY = `
  const build = {
    PaymentNotFoundError: () => new payment.PaymentNotFoundError("pay_1"),
    CustomerNotFoundError: () => new payment.CustomerNotFoundError("cus_1"),
    WebhookVerificationError: () => new payment.WebhookVerificationError("unsigned"),
    InvalidPaymentStateError: () => new payment.InvalidPaymentStateError("already captured"),
    UnsupportedOperationError: () => new payment.UnsupportedOperationError("CapturePayment"),
  };
  const names = Object.keys(build);
  const matrix = Object.fromEntries(names.map((name) => [name, names.filter((other) => build[name]() instanceof payment[other])]));
  const base = new payment.PaymentError("plain", "code-1");
  return {
    base: [base.name, base.message, base.providerCode, base instanceof Error],
    matrix,
    names: names.map((name) => build[name]().name),
    messages: [
      new payment.PaymentNotFoundError("pay_1").message,
      new payment.PaymentNotFoundError("re_1", "refund").message,
      new payment.PaymentNotFoundError("cs_1", "checkout session", "code").message,
      new payment.CustomerNotFoundError("cus_1").message,
      new payment.CustomerNotFoundError("pm_1", "payment method").message,
      new payment.WebhookVerificationError("unsigned").message,
      new payment.UnsupportedOperationError("CapturePayment").message,
    ],
    providerCodes: [new payment.PaymentNotFoundError("a", "refund", "c1").providerCode, new payment.CustomerNotFoundError("a", "customer", "c2").providerCode, new payment.WebhookVerificationError("m", "c3").providerCode, new payment.InvalidPaymentStateError("m", "succeeded", "c4").providerCode, new payment.UnsupportedOperationError("Op", "c5").providerCode, build.PaymentNotFoundError().providerCode],
    state: [new payment.InvalidPaymentStateError("m", "succeeded").status, build.InvalidPaymentStateError().status],
    operation: new payment.UnsupportedOperationError("CapturePayment").operation,
  };
`;

export const VOCABULARY_BODY = `
  const lists = {
    PAYMENT_STATUSES: payment.PAYMENT_STATUSES,
    TERMINAL_PAYMENT_STATUSES: payment.TERMINAL_PAYMENT_STATUSES,
    PAYMENT_FAILURE_CODES: payment.PAYMENT_FAILURE_CODES,
    REFUND_STATUSES: payment.REFUND_STATUSES,
    REFUND_REASONS: payment.REFUND_REASONS,
    PAYMENT_METHOD_TYPES: payment.PAYMENT_METHOD_TYPES,
    PAYMENT_EVENT_TYPES: payment.PAYMENT_EVENT_TYPES,
  };
  const classified = Object.fromEntries(payment.PAYMENT_STATUSES.map((status) => [status, payment.isTerminalPaymentStatus(status)]));
  const frozen = Object.fromEntries(Object.entries(lists).map(([name, list]) => [name, Object.isFrozen(list)]));
  const before = JSON.stringify(payment.TERMINAL_PAYMENT_STATUSES);
  let pushed = false;
  try { payment.TERMINAL_PAYMENT_STATUSES.push("pending"); pushed = true; } catch {}
  return { lists, classified, frozen, terminalUntouched: JSON.stringify(payment.TERMINAL_PAYMENT_STATUSES) === before && !pushed, unknownIsTerminal: payment.isTerminalPaymentStatus("unknown") };
`;
