/**
 * An in-memory provider for the conformance suite: it attaches to every function of the packed interface the way a provider module does, and a
 * `FLAW` environment variable breaks one documented rule so the suite has something to refuse.
 */
export const REFERENCE_PROVIDER = `
const payment = require(process.env.DIST);
const flaw = process.env.FLAW || "none";
const declinedMethod = process.env.ANTELOPE_PAYMENT_TEST_METHOD_DECLINED;
const sessions = new Map();
const payments = new Map();
const customers = new Map();
const methods = new Map();
const refunds = new Map();
const replays = new Map();
let counter = 0;
const next = (prefix) => prefix + "_" + ++counter;
const now = () => (flaw === "seconds" ? Math.floor(Date.now() / 1000) : Date.now());
const memo = (key, make, skip = false) => { if (!skip && replays.has(key)) return replays.get(key); const value = make(); replays.set(key, value); return value; };
const attach = (name, answer) => payment[name].proxy.onCall(async (...args) => answer(...args), true);
const money = (value, currency) => ({ value, currency });
const payment_ = (id) => { const found = payments.get(id); if (found) return found; if (flaw === "absent") return { id, amount: money(1, "EUR"), amountCaptured: money(1, "EUR"), amountRefunded: money(0, "EUR"), status: "succeeded", reference: "invented", createdAt: now() }; throw new payment.PaymentNotFoundError(id); };
const customer_ = (id) => { const found = customers.get(id); if (!found) throw new payment.CustomerNotFoundError(id); return found; };

attach("CreateCheckoutSession", (request, key) => memo("session:" + key, () => {
  const id = next("cs");
  const session = { id, redirectUrl: "https://pay.example/" + id, status: "pending", expiresAt: Date.now() + 3_600_000 };
  sessions.set(id, session);
  return session;
}, flaw === "replay"));
attach("GetCheckoutSession", (id) => { const found = sessions.get(id); if (!found) throw new payment.PaymentNotFoundError(id, "checkout session"); return found; });
attach("CreatePayment", (request, key) => memo("payment:" + key, () => {
  const declined = request.paymentMethod === declinedMethod;
  const status = declined ? "failed" : request.authorizeOnly ? "authorized" : "succeeded";
  const record = {
    id: next("pay"),
    amount: request.amount,
    amountCaptured: money(status === "succeeded" ? request.amount.value : 0, request.amount.currency),
    amountRefunded: money(0, request.amount.currency),
    status,
    reference: request.reference,
    createdAt: now(),
    ...(request.metadata ? { metadata: request.metadata } : {}),
    ...(declined ? { failure: { code: "declined", message: "Card declined" } } : {}),
  };
  payments.set(record.id, record);
  if (request.savePaymentMethod && request.customer && status === "succeeded") {
    const method = { id: next("pm"), type: "card", customer: request.customer, card: { brand: "visa", last4: "4242", expiryMonth: 12, expiryYear: new Date().getFullYear() + 2 }, createdAt: now() };
    methods.set(method.id, method);
  }
  return record;
}));
attach("GetPayment", (id) => payment_(id));
attach("CapturePayment", (id, key, value) => {
  const found = payment_(id);
  if (found.status !== "authorized") throw new payment.InvalidPaymentStateError("Payment is not authorized", found.status);
  const captured = { ...found, status: "succeeded", amountCaptured: value ?? found.amount };
  payments.set(id, captured);
  return captured;
});
attach("CancelPayment", (id) => {
  const found = payment_(id);
  if (found.status !== "authorized") throw new payment.InvalidPaymentStateError("Payment is not authorized", found.status);
  const canceled = { ...found, status: "canceled" };
  payments.set(id, canceled);
  return canceled;
});
attach("RefundPayment", (request, key) => memo("refund:" + key, () => {
  const found = payment_(request.payment);
  const value = request.amount ?? found.amountCaptured;
  if (found.status !== "succeeded" || value.value > found.amountCaptured.value - found.amountRefunded.value) throw new payment.InvalidPaymentStateError("Not refundable", found.status);
  const refund = { id: next("re"), payment: found.id, amount: value, status: "succeeded", createdAt: now() };
  refunds.set(refund.id, refund);
  payments.set(found.id, { ...found, amountRefunded: money(found.amountRefunded.value + value.value, value.currency) });
  return refund;
}));
attach("GetRefund", (id) => { const found = refunds.get(id); if (!found) throw new payment.PaymentNotFoundError(id, "refund"); return found; });
attach("CreateCustomer", (request, key) => memo("customer:" + key, () => { const created = { id: next("cus"), ...request }; customers.set(created.id, created); return created; }));
attach("GetCustomer", (id) => customer_(id));
attach("DeleteCustomer", (id) => { customer_(id); customers.delete(id); for (const [methodId, method] of methods) if (method.customer === id) methods.delete(methodId); });
attach("ListPaymentMethods", (id) => { customer_(id); return [...methods.values()].filter((method) => method.customer === id).reverse(); });
attach("DetachPaymentMethod", (id) => { if (!methods.delete(id)) throw new payment.CustomerNotFoundError(id, "payment method"); });
attach("VerifyWebhook", () => { throw new payment.WebhookVerificationError("no valid signature"); });
`;
