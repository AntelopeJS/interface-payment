import { InterfaceFunction } from "@antelopejs/interface-core";

/**
 * A monetary amount as an integer number of minor units plus its currency.
 *
 * Minor units are the currency's smallest indivisible unit: cents for `EUR`,
 * yen for `JPY` (which has no subunit), fils for `KWD` (which has three decimal
 * places). `{ value: 1050, currency: "EUR" }` is €10.50. Never a float, and
 * never a major-unit value — providers disagree about rounding and the error is
 * silent.
 */
export interface Amount {
  /** Integer number of minor units. Must not be fractional. */
  value: number;
  /** ISO-4217 alphabetic code, uppercase (e.g. `"EUR"`, `"USD"`, `"JPY"`). */
  currency: string;
}

/**
 * The lifecycle of a payment, normalised across providers.
 *
 * Providers name these differently and at different granularity; this is the
 * set every provider can report and a backend must actually branch on.
 */
export const PAYMENT_STATUSES = [
  "pending",
  "requires_action",
  "authorized",
  "succeeded",
  "failed",
  "canceled",
] as const;

/**
 * Normalised payment status.
 *
 * | Status | Meaning |
 * | --- | --- |
 * | `pending` | Accepted by the provider, no payer action outstanding, not yet settled. |
 * | `requires_action` | The payer must be sent to {@link Payment.redirectUrl} (3DS/SCA, bank redirect, wallet approval). |
 * | `authorized` | Funds are held. {@link CapturePayment} or {@link CancelPayment} must follow. |
 * | `succeeded` | Captured. Terminal. |
 * | `failed` | Declined, errored or expired without payment. Terminal. |
 * | `canceled` | Voided before capture, by the merchant or by the payer abandoning. Terminal. |
 */
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Statuses from which a payment can no longer change without a new call.
 */
export const TERMINAL_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "succeeded",
  "failed",
  "canceled",
];

/**
 * Whether a payment has reached a state it cannot leave on its own.
 *
 * A non-terminal payment will change again, either because the payer acts or
 * because the provider settles it asynchronously; expect a webhook.
 *
 * @param status - The status to classify
 * @returns true for `succeeded`, `failed` and `canceled`
 */
export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return TERMINAL_PAYMENT_STATUSES.includes(status);
}

/**
 * Why a payment or refund did not go through.
 *
 * Coarse on purpose: providers report hundreds of decline reasons under
 * incompatible names, and a backend branches on very few of them. The provider's
 * own code travels alongside in {@link PaymentFailure.providerCode}.
 */
export const PAYMENT_FAILURE_CODES = [
  "declined",
  "insufficient_funds",
  "expired_card",
  "incorrect_details",
  "authentication_failed",
  "canceled_by_payer",
  "expired",
  "processing_error",
] as const;

/** Normalised reason a payment or refund did not go through. */
export type PaymentFailureCode = (typeof PAYMENT_FAILURE_CODES)[number];

/**
 * Detail attached to a `failed` payment or refund.
 */
export interface PaymentFailure {
  /** Normalised reason, for branching. */
  code: PaymentFailureCode;
  /** Human-readable explanation, suitable for a log. Not for the payer. */
  message: string;
  /** The provider's own code, verbatim and opaque. For support tickets. */
  providerCode?: string;
}

/**
 * A payment, in whatever state the provider last reported it.
 *
 * `id` is opaque: it is the provider's own identifier and carries no structure
 * a caller may parse. Correlate with your own records through
 * {@link Payment.reference}.
 */
export interface Payment {
  /** Opaque provider identifier. */
  id: string;
  /** The amount the payment was created for. */
  amount: Amount;
  /**
   * How much has been captured so far. Zero until capture.
   * Always in {@link Payment.amount}'s currency.
   */
  amountCaptured: Amount;
  /**
   * How much has been refunded so far. Zero until a refund settles.
   * Always in {@link Payment.amount}'s currency.
   */
  amountRefunded: Amount;
  /** Normalised status. */
  status: PaymentStatus;
  /** The caller's own identifier, echoed back from the request. */
  reference: string;
  /** Opaque customer identifier, when the payment was attached to one. */
  customer?: string;
  /** Opaque payment method identifier, once the payer has chosen one. */
  paymentMethod?: string;
  /**
   * Where to send the payer. Present exactly when `status` is
   * `requires_action`.
   */
  redirectUrl?: string;
  /** Unix epoch milliseconds. */
  createdAt: number;
  /** Present exactly when `status` is `failed`. */
  failure?: PaymentFailure;
  /** The metadata the payment was created with. */
  metadata?: Record<string, string>;
}

/**
 * Parameters for {@link CreatePayment}.
 */
export interface PaymentRequest {
  /** What to charge. */
  amount: Amount;
  /** Your own identifier for this payment. Echoed back on {@link Payment}. */
  reference: string;
  /**
   * Authorize only, leaving capture to a later {@link CapturePayment}.
   * Defaults to false, which captures immediately.
   */
  authorizeOnly?: boolean;
  /**
   * Opaque identifier of a saved payment method to charge, from
   * {@link ListPaymentMethods}.
   */
  paymentMethod?: string;
  /** Opaque customer identifier to attach the payment to. */
  customer?: string;
  /**
   * The payer is not present and cannot be prompted. The provider will not
   * return `requires_action`; it declines instead. Requires `paymentMethod`.
   */
  offSession?: boolean;
  /**
   * Where to return the payer after an interactive step. Required unless
   * `offSession` is set, because any payment may turn out to need
   * authentication.
   */
  returnUrl?: string;
  /** Shown to the payer where the provider supports it. */
  description?: string;
  /** Round-tripped opaque key/value pairs. */
  metadata?: Record<string, string>;
}

/**
 * Parameters for {@link CreateCheckoutSession}.
 */
export interface CheckoutSessionRequest {
  /** What to charge. */
  amount: Amount;
  /** Your own identifier for this payment. Echoed back on {@link Payment}. */
  reference: string;
  /** Where the provider sends the payer after a completed payment. */
  successUrl: string;
  /** Where the provider sends the payer if they abandon. */
  cancelUrl: string;
  /**
   * Authorize only, leaving capture to a later {@link CapturePayment}.
   * Defaults to false.
   */
  authorizeOnly?: boolean;
  /** Opaque customer identifier to attach the payment to. */
  customer?: string;
  /**
   * Save the method the payer chooses for later off-session charges.
   * Requires `customer`. The saved method appears in
   * {@link ListPaymentMethods} once the payment reaches `succeeded` or
   * `authorized`.
   */
  savePaymentMethod?: boolean;
  /** Shown to the payer where the provider supports it. */
  description?: string;
  /** BCP-47 language tag for the hosted page, where the provider supports it. */
  locale?: string;
  /** Round-tripped opaque key/value pairs. */
  metadata?: Record<string, string>;
}

/**
 * A hosted checkout session: a provider-rendered page that takes the payment.
 */
export interface CheckoutSession {
  /** Opaque provider identifier for the session. */
  id: string;
  /** Send the payer here. */
  redirectUrl: string;
  /** Status of the payment behind the session. */
  status: PaymentStatus;
  /**
   * Opaque identifier of the payment the session produced, for
   * {@link GetPayment}, {@link CapturePayment} and {@link RefundPayment}.
   *
   * Absent until the provider has created one, which for some providers is only
   * once the payer has acted. Providers whose session and payment are the same
   * object return the same id in both fields.
   */
  payment?: string;
  /** Unix epoch milliseconds after which `redirectUrl` stops working. */
  expiresAt?: number;
}

/** Normalised refund lifecycle. */
export const REFUND_STATUSES = ["pending", "succeeded", "failed"] as const;

/**
 * Normalised refund status.
 *
 * Refunds settle asynchronously on every provider modelled here, so `pending`
 * is the usual result of {@link RefundPayment} and the terminal state arrives by
 * webhook.
 */
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/**
 * Why a refund was issued. Providers that take free text receive this as a note.
 */
export const REFUND_REASONS = [
  "duplicate",
  "fraudulent",
  "requested_by_customer",
  "other",
] as const;

/** Normalised refund reason. */
export type RefundReason = (typeof REFUND_REASONS)[number];

/**
 * A refund against a captured payment.
 */
export interface Refund {
  /** Opaque provider identifier. */
  id: string;
  /** Opaque identifier of the payment refunded. */
  payment: string;
  /** How much was refunded. */
  amount: Amount;
  /** Normalised status. */
  status: RefundStatus;
  /** Unix epoch milliseconds. */
  createdAt: number;
  /** Present exactly when `status` is `failed`. */
  failure?: PaymentFailure;
  /** The metadata the refund was created with. */
  metadata?: Record<string, string>;
}

/**
 * Parameters for {@link RefundPayment}.
 */
export interface RefundRequest {
  /** Opaque identifier of the payment to refund. */
  payment: string;
  /**
   * How much to refund. Omit to refund everything not yet refunded.
   * Must be in the payment's currency.
   */
  amount?: Amount;
  /** Why, for the provider's records. */
  reason?: RefundReason;
  /** Round-tripped opaque key/value pairs. */
  metadata?: Record<string, string>;
}

/**
 * A customer: a container the provider associates saved payment methods with.
 *
 * Only `id` is guaranteed to survive a round trip. Providers that have no
 * first-class customer object (PayPal's vault, Adyen's `shopperReference`) treat
 * the id as a key they attach tokens to and store nothing else, so
 * {@link GetCustomer} returns the id alone. Keep the payer's details in your own
 * records; do not read them back from here.
 */
export interface Customer {
  /** Opaque provider identifier. */
  id: string;
  /** Stored only by providers with a customer object. */
  email?: string;
  /** Stored only by providers with a customer object. */
  name?: string;
  /** Stored only by providers with a customer object. */
  metadata?: Record<string, string>;
}

/**
 * Parameters for {@link CreateCustomer}.
 */
export interface CustomerRequest {
  /** Stored where the provider supports it. */
  email?: string;
  /** Stored where the provider supports it. */
  name?: string;
  /** Stored where the provider supports it. */
  metadata?: Record<string, string>;
}

/** Broad category of a saved payment method. */
export const PAYMENT_METHOD_TYPES = [
  "card",
  "wallet",
  "bank_account",
  "other",
] as const;

/** Normalised payment method category. */
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

/**
 * The parts of a saved card every provider surfaces.
 *
 * Enough to let a payer recognise which card they saved, and nothing more.
 * Never the PAN, never a token you could charge directly.
 */
export interface CardDetails {
  /** Network name as the provider reports it, e.g. `"visa"`. Opaque. */
  brand: string;
  /** Final four digits of the PAN. */
  last4: string;
  /** Expiry month, 1-12. */
  expiryMonth: number;
  /** Expiry year, four digits. */
  expiryYear: number;
}

/**
 * A payment method saved against a customer and chargeable off-session.
 */
export interface PaymentMethod {
  /** Opaque provider identifier. Pass to {@link PaymentRequest.paymentMethod}. */
  id: string;
  /** Broad category. */
  type: PaymentMethodType;
  /** Opaque identifier of the customer it is saved against. */
  customer: string;
  /** Present when `type` is `card`. */
  card?: CardDetails;
  /** Unix epoch milliseconds. */
  createdAt: number;
}

/**
 * A payer's challenge to a captured payment.
 *
 * Reported so a backend can react — hold the goods, notify someone. Responding
 * to a dispute is provider-specific and is not modelled; use the provider's own
 * interface or dashboard.
 */
export interface Dispute {
  /** Opaque provider identifier. */
  id: string;
  /** Opaque identifier of the payment being disputed. */
  payment: string;
  /** The amount under dispute. */
  amount: Amount;
  /** The provider's own reason string, verbatim and opaque. */
  reason?: string;
  /** Unix epoch milliseconds. */
  createdAt: number;
}

/**
 * The normalised event types a provider webhook can produce.
 *
 * The `payment.*` types are exactly the {@link PaymentStatus} transitions a
 * backend learns about asynchronously. `requires_action` has no event because it
 * is known synchronously, from the call that created the payment.
 */
export const PAYMENT_EVENT_TYPES = [
  "payment.pending",
  "payment.authorized",
  "payment.succeeded",
  "payment.failed",
  "payment.canceled",
  "refund.succeeded",
  "refund.failed",
  "dispute.opened",
] as const;

/** Normalised webhook event type. */
export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];

/**
 * A verified provider webhook, normalised.
 *
 * Exactly one of `payment`, `refund` and `dispute` is set, matching the `type`
 * prefix. The object carries the state at the moment the provider sent the
 * event, which may already be stale.
 */
export interface PaymentEvent {
  /**
   * Opaque provider identifier for the delivery.
   *
   * Providers redeliver, and deliver out of order. Treat handling as idempotent
   * and de-duplicate on this id.
   */
  id: string;
  /** Normalised type. */
  type: PaymentEventType;
  /** Unix epoch milliseconds, as the provider reports it. */
  createdAt: number;
  /** Set when `type` starts with `payment.`. */
  payment?: Payment;
  /** Set when `type` starts with `refund.`. */
  refund?: Refund;
  /** Set when `type` is `dispute.opened`. */
  dispute?: Dispute;
}

/**
 * A webhook delivery, exactly as it arrived.
 */
export interface WebhookRequest {
  /**
   * The unparsed request body.
   *
   * Signature schemes cover the bytes, so a body that has been through
   * `JSON.parse` and re-serialised will fail verification. Read it with a raw
   * body handler.
   */
  body: Buffer;
  /** Every request header, lowercased names. */
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Base class for every error this interface raises.
 *
 * A failed *payment* is not an error: {@link CreatePayment} returns a
 * {@link Payment} with status `failed` and a {@link PaymentFailure}. These
 * errors mean the call itself did not happen.
 */
export class PaymentError extends Error {
  constructor(
    message: string,
    /** The provider's own error code, verbatim and opaque. */
    public readonly providerCode?: string,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

/**
 * The provider has no record under that identifier.
 */
export class PaymentNotFoundError extends PaymentError {
  constructor(id: string) {
    super(`No such payment: ${id}`);
    this.name = "PaymentNotFoundError";
  }
}

/**
 * The provider has no customer or payment method under that identifier.
 */
export class CustomerNotFoundError extends PaymentError {
  constructor(id: string) {
    super(`No such customer: ${id}`);
    this.name = "CustomerNotFoundError";
  }
}

/**
 * A webhook delivery did not carry a valid signature for the configured secret.
 *
 * Respond 403 and do not act on the body. Distinct from a verified delivery this
 * interface does not model, which {@link VerifyWebhook} reports by resolving
 * `undefined`.
 */
export class WebhookVerificationError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

/**
 * The request was well-formed but the provider cannot apply it to this payment.
 *
 * Capturing a payment that is not `authorized`, refunding more than was
 * captured, cancelling something already captured. The state is the problem, not
 * the arguments.
 */
export class InvalidPaymentStateError extends PaymentError {
  constructor(
    message: string,
    /** The status the payment was actually in. */
    public readonly status?: PaymentStatus,
  ) {
    super(message);
    this.name = "InvalidPaymentStateError";
  }
}

/**
 * The provider behind this interface does not offer the operation at all.
 *
 * The contract is chosen so that this is rare — a backend on the generic
 * interface should be able to change provider without meeting one. An
 * implementation that must raise it says so in its README, and the operation is
 * unavailable for every call, not conditionally.
 */
export class UnsupportedOperationError extends PaymentError {
  constructor(
    /** The interface function that is unavailable, e.g. `"CapturePayment"`. */
    public readonly operation: string,
  ) {
    super(`Operation not supported by this payment provider: ${operation}`);
    this.name = "UnsupportedOperationError";
  }
}

/**
 * @internal
 */
export namespace internal {
  /**
   * Creates a hosted checkout session and returns the URL to send the payer to.
   */
  export const createCheckoutSession =
    InterfaceFunction<
      (
        request: CheckoutSessionRequest,
        idempotencyKey: string,
        provider?: string,
      ) => Promise<CheckoutSession>
    >();

  /**
   * Reads a checkout session, resolving the payment behind it once one exists.
   */
  export const getCheckoutSession =
    InterfaceFunction<
      (id: string, provider?: string) => Promise<CheckoutSession>
    >();

  /**
   * Creates a payment directly, without a hosted page.
   * A declined payment resolves with status `failed`; it does not reject.
   */
  export const createPayment =
    InterfaceFunction<
      (
        request: PaymentRequest,
        idempotencyKey: string,
        provider?: string,
      ) => Promise<Payment>
    >();

  /**
   * Reads a payment's current state.
   */
  export const getPayment =
    InterfaceFunction<(id: string, provider?: string) => Promise<Payment>>();

  /**
   * Captures an authorized payment, in full or in part.
   */
  export const capturePayment =
    InterfaceFunction<
      (
        id: string,
        idempotencyKey: string,
        amount?: Amount,
        provider?: string,
      ) => Promise<Payment>
    >();

  /**
   * Cancels a payment that has not been captured.
   */
  export const cancelPayment =
    InterfaceFunction<
      (
        id: string,
        idempotencyKey: string,
        provider?: string,
      ) => Promise<Payment>
    >();

  /**
   * Refunds a captured payment, in full or in part.
   */
  export const refundPayment =
    InterfaceFunction<
      (
        request: RefundRequest,
        idempotencyKey: string,
        provider?: string,
      ) => Promise<Refund>
    >();

  /**
   * Reads a refund's current state.
   */
  export const getRefund =
    InterfaceFunction<(id: string, provider?: string) => Promise<Refund>>();

  /**
   * Creates a customer to save payment methods against.
   */
  export const createCustomer =
    InterfaceFunction<
      (
        request: CustomerRequest,
        idempotencyKey: string,
        provider?: string,
      ) => Promise<Customer>
    >();

  /**
   * Reads a customer. Providers without a customer object return the id alone.
   */
  export const getCustomer =
    InterfaceFunction<(id: string, provider?: string) => Promise<Customer>>();

  /**
   * Deletes a customer and detaches every payment method saved against it.
   */
  export const deleteCustomer =
    InterfaceFunction<
      (id: string, idempotencyKey: string, provider?: string) => Promise<void>
    >();

  /**
   * Lists the payment methods saved against a customer.
   */
  export const listPaymentMethods =
    InterfaceFunction<
      (customer: string, provider?: string) => Promise<PaymentMethod[]>
    >();

  /**
   * Detaches a saved payment method, leaving the customer in place.
   */
  export const detachPaymentMethod =
    InterfaceFunction<
      (id: string, idempotencyKey: string, provider?: string) => Promise<void>
    >();

  /**
   * Verifies a webhook delivery's signature and normalises it.
   * Resolves `undefined` for a verified delivery this interface does not model.
   */
  export const verifyWebhook =
    InterfaceFunction<
      (
        request: WebhookRequest,
        provider?: string,
      ) => Promise<PaymentEvent | undefined>
    >();
}

/**
 * Creates a hosted checkout session: a provider-rendered page that collects the
 * payment method and takes the payment.
 *
 * Send the payer to {@link CheckoutSession.redirectUrl}. They come back to
 * `successUrl` or `cancelUrl`, neither of which is proof of anything — the
 * payer's browser is not a trustworthy reporter and a redirect can be lost.
 * Treat the return as a prompt to call {@link GetCheckoutSession}, and treat the
 * webhook as the record.
 *
 * @param request - Amount, reference and the URLs to return the payer to
 * @param idempotencyKey - Caller-generated key; replaying it returns the
 *   original session rather than creating a second one
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The session, including the URL to redirect to
 */
export function CreateCheckoutSession(
  request: CheckoutSessionRequest,
  idempotencyKey: string,
  provider?: string,
): Promise<CheckoutSession> {
  return internal.createCheckoutSession(request, idempotencyKey, provider);
}

/**
 * Reads a checkout session.
 *
 * Call this when the payer returns, to find out what actually happened.
 * {@link CheckoutSession.payment} is set once the provider has created a payment
 * behind the session.
 *
 * @param id - Opaque session identifier
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The session's current state
 * @throws PaymentNotFoundError if no session has that identifier
 */
export function GetCheckoutSession(
  id: string,
  provider?: string,
): Promise<CheckoutSession> {
  return internal.getCheckoutSession(id, provider);
}

/**
 * Creates a payment directly, without a hosted page.
 *
 * Two uses: charging a saved method off-session (set `paymentMethod` and
 * `offSession`), and taking a payment through a payment form you host yourself.
 *
 * A declined payment is a result, not an error: this resolves with a
 * {@link Payment} whose status is `failed` and whose {@link Payment.failure} says
 * why, so the synchronous decline and the one that arrives later by webhook are
 * handled in the same place. It rejects only when the call itself could not be
 * made.
 *
 * A status of `requires_action` means the payer must be sent to
 * {@link Payment.redirectUrl} — the same redirect the hosted flow uses, and the
 * only mechanism for 3DS/SCA in this interface.
 *
 * @param request - Amount, reference and how to charge it
 * @param idempotencyKey - Caller-generated key; replaying it returns the
 *   original payment rather than charging twice
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The payment, in whatever state the provider left it
 */
export function CreatePayment(
  request: PaymentRequest,
  idempotencyKey: string,
  provider?: string,
): Promise<Payment> {
  return internal.createPayment(request, idempotencyKey, provider);
}

/**
 * Reads a payment's current state.
 *
 * @param id - Opaque payment identifier
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The payment
 * @throws PaymentNotFoundError if no payment has that identifier
 */
export function GetPayment(id: string, provider?: string): Promise<Payment> {
  return internal.getPayment(id, provider);
}

/**
 * Captures an authorized payment.
 *
 * Omit `amount` to capture the full authorized amount. Capturing less than was
 * authorized releases the remainder; there is no second capture against the same
 * authorization in this interface, because not every provider allows one.
 *
 * @param id - Opaque payment identifier, in status `authorized`
 * @param idempotencyKey - Caller-generated key; replaying it returns the result
 *   of the original capture rather than capturing again
 * @param amount - How much to capture, at most the authorized amount
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The payment, with `amountCaptured` updated
 * @throws PaymentNotFoundError if no payment has that identifier
 * @throws InvalidPaymentStateError if the payment is not `authorized`, or the
 *   amount exceeds what was authorized
 */
export function CapturePayment(
  id: string,
  idempotencyKey: string,
  amount?: Amount,
  provider?: string,
): Promise<Payment> {
  return internal.capturePayment(id, idempotencyKey, amount, provider);
}

/**
 * Cancels a payment that has not been captured, releasing any held funds.
 *
 * @param id - Opaque payment identifier, in a non-terminal status
 * @param idempotencyKey - Caller-generated key; replaying it is safe
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The payment, with status `canceled`
 * @throws PaymentNotFoundError if no payment has that identifier
 * @throws InvalidPaymentStateError if the payment has already been captured or
 *   has otherwise reached a terminal status
 */
export function CancelPayment(
  id: string,
  idempotencyKey: string,
  provider?: string,
): Promise<Payment> {
  return internal.cancelPayment(id, idempotencyKey, provider);
}

/**
 * Refunds a captured payment, in full or in part.
 *
 * Refunds settle asynchronously on every provider this interface targets, so the
 * usual result is a {@link Refund} with status `pending`; the terminal state
 * arrives as a `refund.succeeded` or `refund.failed` event. Several partial
 * refunds against one payment are allowed, up to the captured amount.
 *
 * @param request - Which payment, and how much
 * @param idempotencyKey - Caller-generated key; replaying it returns the
 *   original refund rather than refunding twice
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The refund, usually still `pending`
 * @throws PaymentNotFoundError if no payment has that identifier
 * @throws InvalidPaymentStateError if the payment is not captured, or the amount
 *   exceeds what remains refundable
 */
export function RefundPayment(
  request: RefundRequest,
  idempotencyKey: string,
  provider?: string,
): Promise<Refund> {
  return internal.refundPayment(request, idempotencyKey, provider);
}

/**
 * Reads a refund's current state.
 *
 * @param id - Opaque refund identifier
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The refund
 * @throws PaymentNotFoundError if no refund has that identifier
 */
export function GetRefund(id: string, provider?: string): Promise<Refund> {
  return internal.getRefund(id, provider);
}

/**
 * Creates a customer to save payment methods against.
 *
 * The returned id is the only field guaranteed to survive a round trip; see
 * {@link Customer}. Store it against your own user record.
 *
 * @param request - Details to store where the provider supports it
 * @param idempotencyKey - Caller-generated key; replaying it returns the
 *   original customer rather than creating a second one
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The customer
 */
export function CreateCustomer(
  request: CustomerRequest,
  idempotencyKey: string,
  provider?: string,
): Promise<Customer> {
  return internal.createCustomer(request, idempotencyKey, provider);
}

/**
 * Reads a customer.
 *
 * Providers without a first-class customer object return the id and nothing
 * else. Do not treat a populated `email` or `name` as available everywhere.
 *
 * @param id - Opaque customer identifier
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The customer
 * @throws CustomerNotFoundError if no customer has that identifier
 */
export function GetCustomer(id: string, provider?: string): Promise<Customer> {
  return internal.getCustomer(id, provider);
}

/**
 * Deletes a customer and detaches every payment method saved against it.
 *
 * Payments already taken are unaffected and remain readable.
 *
 * @param id - Opaque customer identifier
 * @param idempotencyKey - Caller-generated key; replaying it is safe
 * @param provider - Optional provider identifier for multi-account setups
 * @throws CustomerNotFoundError if no customer has that identifier
 */
export function DeleteCustomer(
  id: string,
  idempotencyKey: string,
  provider?: string,
): Promise<void> {
  return internal.deleteCustomer(id, idempotencyKey, provider);
}

/**
 * Lists the payment methods saved against a customer and chargeable
 * off-session.
 *
 * @param customer - Opaque customer identifier
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The saved methods, newest first. Empty when none are saved.
 * @throws CustomerNotFoundError if no customer has that identifier
 */
export function ListPaymentMethods(
  customer: string,
  provider?: string,
): Promise<PaymentMethod[]> {
  return internal.listPaymentMethods(customer, provider);
}

/**
 * Detaches a saved payment method, leaving the customer in place.
 *
 * @param id - Opaque payment method identifier
 * @param idempotencyKey - Caller-generated key; replaying it is safe
 * @param provider - Optional provider identifier for multi-account setups
 * @throws CustomerNotFoundError if no payment method has that identifier
 */
export function DetachPaymentMethod(
  id: string,
  idempotencyKey: string,
  provider?: string,
): Promise<void> {
  return internal.detachPaymentMethod(id, idempotencyKey, provider);
}

/**
 * Verifies a webhook delivery's signature and normalises it into a
 * {@link PaymentEvent}.
 *
 * This is the only way a backend learns a payment reached a terminal state:
 * every provider modelled here settles asynchronously, and the payer's return
 * from a redirect is not a report you can trust.
 *
 * Three outcomes:
 *
 * - A {@link PaymentEvent}, for a delivery this interface models.
 * - `undefined`, for a delivery that verified but is not one of
 *   {@link PAYMENT_EVENT_TYPES}. Providers send many such events. Respond 200:
 *   the delivery was genuine and rejecting it makes the provider retry forever.
 * - A rejection with {@link WebhookVerificationError}, for a delivery whose
 *   signature does not check out. Respond 403 and act on nothing.
 *
 * Providers redeliver and reorder. De-duplicate on {@link PaymentEvent.id}, and
 * do not assume an event describes a newer state than the one you hold.
 *
 * @param request - The raw body and headers, unmodified
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The normalised event, or undefined if it is not one this interface
 *   models
 * @throws WebhookVerificationError if the signature does not verify
 */
export function VerifyWebhook(
  request: WebhookRequest,
  provider?: string,
): Promise<PaymentEvent | undefined> {
  return internal.verifyWebhook(request, provider);
}
