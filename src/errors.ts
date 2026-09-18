import type { PaymentStatus } from "./types";

/**
 * Base class for every error this interface raises.
 *
 * A failed *payment* is not an error: {@link CreatePayment} resolves with a
 * {@link Payment} whose status is `failed`. These errors mean the call itself
 * did not happen.
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

/** What a not-found error was looking for, for the message alone. */
export type PaymentEntity = "payment" | "refund" | "checkout session";

/**
 * No payment, refund or checkout session exists under that identifier.
 *
 * Also raised for an identifier that cannot be parsed at all, which a caller
 * holding opaque identifiers cannot distinguish from one that is merely absent.
 */
export class PaymentNotFoundError extends PaymentError {
  constructor(
    id: string,
    /** Which kind of record was looked for. Names it in the message only. */
    entity: PaymentEntity = "payment",
    providerCode?: string,
  ) {
    super(`No such ${entity}: ${id}`, providerCode);
    this.name = "PaymentNotFoundError";
  }
}

/** What a customer-side not-found error was looking for. */
export type CustomerEntity = "customer" | "payment method";

/**
 * No customer or payment method exists under that identifier.
 *
 * As {@link PaymentNotFoundError}, this also covers an unparseable identifier.
 */
export class CustomerNotFoundError extends PaymentError {
  constructor(
    id: string,
    /** Which kind of record was looked for. Names it in the message only. */
    entity: CustomerEntity = "customer",
    providerCode?: string,
  ) {
    super(`No such ${entity}: ${id}`, providerCode);
    this.name = "CustomerNotFoundError";
  }
}

/**
 * A webhook delivery could not be established as genuine.
 *
 * Respond 403 and do not act on the body.
 *
 * Distinct from a genuine delivery this interface does not model, which
 * {@link VerifyWebhook} reports by resolving `undefined`.
 */
export class WebhookVerificationError extends PaymentError {
  constructor(message: string, providerCode?: string) {
    super(message, providerCode);
    this.name = "WebhookVerificationError";
  }
}

/**
 * The request was well-formed but does not apply to the payment's current
 * state.
 *
 * Capturing a payment that is not `authorized`, refunding more than was
 * captured, cancelling something already captured.
 */
export class InvalidPaymentStateError extends PaymentError {
  constructor(
    message: string,
    /** The status the payment was actually in. */
    public readonly status?: PaymentStatus,
    providerCode?: string,
  ) {
    super(message, providerCode);
    this.name = "InvalidPaymentStateError";
  }
}

/**
 * The implementation behind this interface does not offer the operation at all.
 *
 * Unconditional: an implementation that raises this raises it for every call to
 * that function, and says so in its README.
 */
export class UnsupportedOperationError extends PaymentError {
  constructor(
    /** The interface function that is unavailable, e.g. `"CapturePayment"`. */
    public readonly operation: string,
    providerCode?: string,
  ) {
    super(
      `Operation not supported by this payment provider: ${operation}`,
      providerCode,
    );
    this.name = "UnsupportedOperationError";
  }
}
