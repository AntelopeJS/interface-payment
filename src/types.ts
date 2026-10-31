/**
 * A monetary amount as an integer number of minor units plus its currency.
 *
 * Minor units are the currency's smallest indivisible unit: cents for `EUR`,
 * yen for `JPY` (which has no subunit), fils for `KWD` (which has three decimal
 * places). `{ value: 1050, currency: "EUR" }` is €10.50. Never a float, and
 * never a major-unit value.
 */
export interface Amount {
  /** Integer number of minor units. Must not be fractional. */
  value: number;
  /** ISO-4217 alphabetic code, uppercase (e.g. `"EUR"`, `"USD"`, `"JPY"`). */
  currency: string;
}

/**
 * Every value {@link PaymentStatus} can take, in lifecycle order.
 */
export const PAYMENT_STATUSES = Object.freeze([
  "pending",
  "requires_action",
  "authorized",
  "succeeded",
  "failed",
  "canceled",
] as const);

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
export const TERMINAL_PAYMENT_STATUSES: readonly PaymentStatus[] =
  Object.freeze(["succeeded", "failed", "canceled"]);

/**
 * Whether a payment has reached a state it cannot leave on its own.
 *
 * A non-terminal payment will change again, either because the payer acts or
 * because settlement completes; expect a {@link PaymentEvent}.
 *
 * @param status - The status to classify
 * @returns true for `succeeded`, `failed` and `canceled`
 */
export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return TERMINAL_PAYMENT_STATUSES.includes(status);
}

/**
 * Every value {@link PaymentFailureCode} can take.
 *
 * A coarse set, for branching. The verbatim code is available alongside it in
 * {@link PaymentFailure.providerCode}.
 */
export const PAYMENT_FAILURE_CODES = Object.freeze([
  "declined",
  "insufficient_funds",
  "expired_card",
  "incorrect_details",
  "authentication_failed",
  "canceled_by_payer",
  "expired",
  "processing_error",
] as const);

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
 * A payment, in whatever state it was last reported in.
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
   * Save the method this payment uses for later off-session charges.
   *
   * Requires `customer`. Mutually exclusive with `offSession`: saving a method
   * takes a mandate from the payer, so the payer must be present.
   *
   * The saved method appears in {@link ListPaymentMethods} once the payment
   * reaches `succeeded` or `authorized` — not as soon as this call returns.
   */
  savePaymentMethod?: boolean;
  /**
   * Where to return the payer after an interactive step. Required unless
   * `offSession` is set: any payment may turn out to need authentication.
   */
  returnUrl?: string;
  /** Shown to the payer where supported. */
  description?: string;
  /** Round-tripped opaque key/value pairs. */
  metadata?: Record<string, string>;
}

/**
 * Every value {@link PaymentLocale} can take: the hosted page languages
 * Stripe Checkout accepts. `auto` lets the provider pick from the payer's
 * browser.
 */
export const PAYMENT_LOCALES = Object.freeze([
  "auto",
  "bg",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "en-GB",
  "es",
  "es-419",
  "et",
  "fi",
  "fil",
  "fr",
  "fr-CA",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "ko",
  "lt",
  "lv",
  "ms",
  "mt",
  "nb",
  "nl",
  "pl",
  "pt",
  "pt-BR",
  "ro",
  "ru",
  "sk",
  "sl",
  "sv",
  "th",
  "tr",
  "vi",
  "zh",
  "zh-HK",
  "zh-TW",
] as const);

/**
 * Language of a hosted checkout page. Providers that name their languages
 * differently map each value to their own code, and fall back to their own
 * default where they have no match.
 */
export type PaymentLocale = (typeof PAYMENT_LOCALES)[number];

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
  /** Shown to the payer where supported. */
  description?: string;
  /** Language of the hosted page, where supported. */
  locale?: PaymentLocale;
  /** Round-tripped opaque key/value pairs. */
  metadata?: Record<string, string>;
}

/**
 * A hosted checkout session: an externally hosted page that takes the payment.
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
   * Absent until a payment exists behind the session, which may not be until
   * the payer has acted. May be equal to {@link CheckoutSession.id}.
   */
  payment?: string;
  /** Unix epoch milliseconds after which `redirectUrl` stops working. */
  expiresAt?: number;
}

/** Normalised refund lifecycle. */
export const REFUND_STATUSES = Object.freeze([
  "pending",
  "succeeded",
  "failed",
] as const);

/**
 * Normalised refund status.
 *
 * `pending` is the usual result of {@link RefundPayment}; the terminal state
 * arrives as a `refund.succeeded` or `refund.failed` {@link PaymentEvent}.
 */
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/**
 * Every value {@link RefundReason} can take.
 */
export const REFUND_REASONS = Object.freeze([
  "duplicate",
  "fraudulent",
  "requested_by_customer",
  "other",
] as const);

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
 * A customer: the container saved payment methods are attached to.
 *
 * Only `id` is guaranteed to survive a round trip; {@link GetCustomer} may
 * return it alone. Keep the payer's details in your own records rather than
 * reading them back from here.
 */
export interface Customer {
  /** Opaque provider identifier. */
  id: string;
  /** Not guaranteed to survive a round trip. */
  email?: string;
  /** Not guaranteed to survive a round trip. */
  name?: string;
  /** Not guaranteed to survive a round trip. */
  metadata?: Record<string, string>;
}

/**
 * Parameters for {@link CreateCustomer}.
 */
export interface CustomerRequest {
  /** Stored where supported. */
  email?: string;
  /** Stored where supported. */
  name?: string;
  /** Stored where supported. */
  metadata?: Record<string, string>;
}

/** Broad category of a saved payment method. */
export const PAYMENT_METHOD_TYPES = Object.freeze([
  "card",
  "wallet",
  "bank_account",
  "other",
] as const);

/** Normalised payment method category. */
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

/**
 * The displayable parts of a saved card.
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
 * to a dispute is not modelled.
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
 * Every value {@link PaymentEventType} can take.
 *
 * The `payment.*` types are every {@link PaymentStatus} except
 * `requires_action`, which is known synchronously from the call that created
 * the payment and so never arrives as an event.
 */
export const PAYMENT_EVENT_TYPES = Object.freeze([
  "payment.pending",
  "payment.authorized",
  "payment.succeeded",
  "payment.failed",
  "payment.canceled",
  "refund.succeeded",
  "refund.failed",
  "dispute.opened",
] as const);

/** Normalised webhook event type. */
export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];

/**
 * A verified webhook delivery, normalised.
 *
 * Exactly one of `payment`, `refund` and `dispute` is set, matching the `type`
 * prefix. It carries the state at the moment the event was sent, which may
 * already be stale.
 */
export interface PaymentEvent {
  /**
   * Opaque identifier for the delivery.
   *
   * Deliveries repeat and arrive out of order. Treat handling as idempotent and
   * de-duplicate on this id.
   */
  id: string;
  /** Normalised type. */
  type: PaymentEventType;
  /** Unix epoch milliseconds, as reported with the delivery. */
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
   * The unparsed request body, exactly as it arrived.
   *
   * A body that has been through `JSON.parse` and re-serialised will not
   * verify. Read it with a raw body handler. A Node `Buffer` is a
   * `Uint8Array` and can be passed straight through.
   */
  body: Uint8Array;
  /** Every request header, lowercased names. */
  headers: Record<string, string | string[] | undefined>;
}
