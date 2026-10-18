import { InterfaceFunction } from "@antelopejs/interface-core";

import type {
  Amount,
  CheckoutSession,
  CheckoutSessionRequest,
  Customer,
  CustomerRequest,
  Payment,
  PaymentEvent,
  PaymentMethod,
  PaymentRequest,
  Refund,
  RefundRequest,
  WebhookRequest,
} from "./types";

/**
 * Creates a hosted checkout session: an externally hosted page that collects
 * the payment method and takes the payment.
 *
 * Send the payer to {@link CheckoutSession.redirectUrl}. Their return to
 * `successUrl` or `cancelUrl` is not proof of the outcome: treat it as a prompt
 * to call {@link GetCheckoutSession}, and take the {@link PaymentEvent} as the
 * record.
 *
 * Implementations must document their replay window. After expiration,
 * applications must reconcile uncertain payments before retrying; reusing a
 * key may create a new charge.
 *
 * @param request - Amount, reference and the URLs to return the payer to
 * @param idempotencyKey - Caller-generated key; within the provider-defined
 *   replay window, replaying it returns the
 *   original session rather than creating a second one
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The session, including the URL to redirect to
 */
export const CreateCheckoutSession =
  InterfaceFunction<
    (
      request: CheckoutSessionRequest,
      idempotencyKey: string,
      provider?: string,
    ) => Promise<CheckoutSession>
  >();

/**
 * Reads a checkout session.
 *
 * Call this when the payer returns, to find out what actually happened.
 * {@link CheckoutSession.payment} is set once a payment exists behind the
 * session.
 *
 * @param id - Opaque session identifier
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The session's current state
 * @throws PaymentNotFoundError if no session has that identifier
 */
export const GetCheckoutSession =
  InterfaceFunction<
    (id: string, provider?: string) => Promise<CheckoutSession>
  >();

/**
 * Creates a payment directly, without a hosted page.
 *
 * Two uses: charging a saved method off-session (set `paymentMethod` and
 * `offSession`), and taking a payment through a payment form you host yourself.
 *
 * `savePaymentMethod` and `offSession` are mutually exclusive — a mandate can
 * only be taken from a payer who is present. See
 * {@link PaymentRequest.savePaymentMethod}.
 *
 * A declined payment is a result, not an error: this resolves with a
 * {@link Payment} whose status is `failed` and whose {@link Payment.failure}
 * says why. It rejects only when the call itself could not be made.
 *
 * A status of `requires_action` means the payer must be sent to
 * {@link Payment.redirectUrl}. That redirect is the only mechanism for 3DS and
 * SCA in this interface.
 *
 * Implementations must document their replay window. After expiration,
 * applications must reconcile uncertain payments before retrying; reusing a
 * key may create a new charge.
 *
 * @param request - Amount, reference and how to charge it
 * @param idempotencyKey - Caller-generated key; within the provider-defined
 *   replay window, replaying it returns the
 *   original payment rather than charging twice
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The payment, in whatever state the call left it
 */
export const CreatePayment =
  InterfaceFunction<
    (
      request: PaymentRequest,
      idempotencyKey: string,
      provider?: string,
    ) => Promise<Payment>
  >();

/**
 * Reads a payment's current state.
 *
 * @param id - Opaque payment identifier
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The payment
 * @throws PaymentNotFoundError if no payment has that identifier
 */
export const GetPayment =
  InterfaceFunction<(id: string, provider?: string) => Promise<Payment>>();

/**
 * Captures an authorized payment.
 *
 * Omit `amount` to capture the full authorized amount. Capturing less releases
 * the remainder: one capture per authorization, so authorize per instalment if
 * you need to capture in stages.
 *
 * @param id - Opaque payment identifier, in status `authorized`
 * @param idempotencyKey - Caller-generated key; within the provider-defined
 *   replay window, replaying it returns the result
 *   of the original capture rather than capturing again
 * @param amount - How much to capture, at most the authorized amount
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The payment, with `amountCaptured` updated
 * @throws PaymentNotFoundError if no payment has that identifier
 * @throws InvalidPaymentStateError if the payment is not `authorized`, or the
 *   amount exceeds what was authorized
 */
export const CapturePayment =
  InterfaceFunction<
    (
      id: string,
      idempotencyKey: string,
      amount?: Amount,
      provider?: string,
    ) => Promise<Payment>
  >();

/**
 * Cancels a payment that has not been captured, releasing any held funds.
 *
 * @param id - Opaque payment identifier, in a non-terminal status
 * @param idempotencyKey - Caller-generated key; replay is safe within the
 *   provider-defined replay window
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The payment, with status `canceled`
 * @throws PaymentNotFoundError if no payment has that identifier
 * @throws InvalidPaymentStateError if the payment has already been captured or
 *   has otherwise reached a terminal status
 */
export const CancelPayment =
  InterfaceFunction<
    (id: string, idempotencyKey: string, provider?: string) => Promise<Payment>
  >();

/**
 * Refunds a captured payment, in full or in part.
 *
 * The usual result is a {@link Refund} with status `pending`; the terminal
 * state arrives as a `refund.succeeded` or `refund.failed`
 * {@link PaymentEvent}. Several partial refunds against one payment are
 * allowed, up to the captured amount.
 *
 * @param request - Which payment, and how much
 * @param idempotencyKey - Caller-generated key; within the provider-defined
 *   replay window, replaying it returns the
 *   original refund rather than refunding twice
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The refund, usually still `pending`
 * @throws PaymentNotFoundError if no payment has that identifier
 * @throws InvalidPaymentStateError if the payment is not captured, or the amount
 *   exceeds what remains refundable
 */
export const RefundPayment =
  InterfaceFunction<
    (
      request: RefundRequest,
      idempotencyKey: string,
      provider?: string,
    ) => Promise<Refund>
  >();

/**
 * Reads a refund's current state.
 *
 * @param id - Opaque refund identifier
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The refund
 * @throws PaymentNotFoundError if no refund has that identifier
 */
export const GetRefund =
  InterfaceFunction<(id: string, provider?: string) => Promise<Refund>>();

/**
 * Creates a customer to save payment methods against.
 *
 * The returned id is the only field guaranteed to survive a round trip. Store
 * it against your own user record.
 *
 * @param request - Details to store where supported
 * @param idempotencyKey - Caller-generated key; within the provider-defined
 *   replay window, replaying it returns the
 *   original customer rather than creating a second one
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The customer
 */
export const CreateCustomer =
  InterfaceFunction<
    (
      request: CustomerRequest,
      idempotencyKey: string,
      provider?: string,
    ) => Promise<Customer>
  >();

/**
 * Reads a customer.
 *
 * May return the id and nothing else. Do not rely on `email` or `name` being
 * populated; see {@link Customer}.
 *
 * @param id - Opaque customer identifier
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The customer
 * @throws CustomerNotFoundError if no customer has that identifier
 */
export const GetCustomer =
  InterfaceFunction<(id: string, provider?: string) => Promise<Customer>>();

/**
 * Deletes a customer and detaches every payment method saved against it.
 *
 * Payments already taken are unaffected and remain readable.
 *
 * @param id - Opaque customer identifier
 * @param idempotencyKey - Caller-generated key; replay is safe within the
 *   provider-defined replay window
 * @param provider - Optional provider identifier for multi-account setups
 * @throws CustomerNotFoundError if no customer has that identifier
 */
export const DeleteCustomer =
  InterfaceFunction<
    (id: string, idempotencyKey: string, provider?: string) => Promise<void>
  >();

/**
 * Lists the payment methods saved against a customer and chargeable
 * off-session.
 *
 * @param customer - Opaque customer identifier
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The saved methods, newest first. Empty when none are saved.
 * @throws CustomerNotFoundError if no customer has that identifier
 */
export const ListPaymentMethods =
  InterfaceFunction<
    (customer: string, provider?: string) => Promise<PaymentMethod[]>
  >();

/**
 * Detaches a saved payment method, leaving the customer in place.
 *
 * @param id - Opaque payment method identifier
 * @param idempotencyKey - Caller-generated key; replay is safe within the
 *   provider-defined replay window
 * @param provider - Optional provider identifier for multi-account setups
 * @throws CustomerNotFoundError if no payment method has that identifier
 */
export const DetachPaymentMethod =
  InterfaceFunction<
    (id: string, idempotencyKey: string, provider?: string) => Promise<void>
  >();

/**
 * Establishes that a webhook delivery is genuine and normalises it into a
 * {@link PaymentEvent}.
 *
 * This is the only way a backend learns that a payment reached a terminal
 * state. The payer's return from a redirect is not a substitute.
 *
 * Three outcomes:
 *
 * - A {@link PaymentEvent}, for a delivery this interface models.
 * - `undefined`, for a genuine delivery that is not one of
 *   {@link PAYMENT_EVENT_TYPES}. Respond 200; this is a normal result, and
 *   rejecting it causes redelivery.
 * - A rejection with {@link WebhookVerificationError}. Respond 403 and act on
 *   nothing.
 *
 * Deliveries repeat and arrive out of order. De-duplicate on
 * {@link PaymentEvent.id}, and do not assume an event describes a newer state
 * than the one you hold.
 *
 * Implementations must populate every field of the returned event from data
 * they have authenticated. Where a delivery is established by reading the named
 * record back rather than by a signature over the body, that read authenticates
 * the record alone: `type`, the kind of record, and every field of `payment`,
 * `refund` or `dispute` come from the record, and the body is treated as a
 * pointer and nothing else. `docs/4.webhooks.md` covers what goes wrong
 * otherwise.
 *
 * @param request - The raw body and headers, unmodified
 * @param provider - Optional provider identifier for multi-account setups
 * @returns The normalised event, or undefined if it is not one this interface
 *   models
 * @throws WebhookVerificationError if the delivery cannot be established as
 *   genuine
 */
export const VerifyWebhook =
  InterfaceFunction<
    (
      request: WebhookRequest,
      provider?: string,
    ) => Promise<PaymentEvent | undefined>
  >();
