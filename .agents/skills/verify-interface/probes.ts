const SHARED_TYPES = `
type _Amount = Assert<Identical<Api.Amount, { value: number; currency: string }>>;
type _Status = Assert<Identical<Api.PaymentStatus, "pending" | "requires_action" | "authorized" | "succeeded" | "failed" | "canceled">>;
type _FailureCode = Assert<Identical<Api.PaymentFailureCode, "declined" | "insufficient_funds" | "expired_card" | "incorrect_details" | "authentication_failed" | "canceled_by_payer" | "expired" | "processing_error">>;
type _Failure = Assert<Identical<Api.PaymentFailure, { code: Api.PaymentFailureCode; message: string; providerCode?: string }>>;
`;

export const CHECKOUT_TYPES = `
${SHARED_TYPES}
type _Request = Assert<Identical<Api.CheckoutSessionRequest, { amount: Api.Amount; reference: string; successUrl: string; cancelUrl: string; authorizeOnly?: boolean; customer?: string; savePaymentMethod?: boolean; description?: string; locale?: Api.PaymentLocale; metadata?: Record<string, string> }>>;
type _Session = Assert<Identical<Api.CheckoutSession, { id: string; redirectUrl: string; status: Api.PaymentStatus; payment?: string; expiresAt?: number }>>;
type _Create = Assert<Identical<Parameters<typeof Api.CreateCheckoutSession>, [request: Api.CheckoutSessionRequest, idempotencyKey: string, provider?: string]>>;
type _CreateAnswer = Assert<Identical<Answer<typeof Api.CreateCheckoutSession>, Api.CheckoutSession>>;
type _Get = Assert<Identical<Parameters<typeof Api.GetCheckoutSession>, [id: string, provider?: string]>>;
type _GetAnswer = Assert<Identical<Answer<typeof Api.GetCheckoutSession>, Api.CheckoutSession>>;
`;

export const PAYMENT_TYPES = `
${SHARED_TYPES}
type _Payment = Assert<Identical<Api.Payment, { id: string; amount: Api.Amount; amountCaptured: Api.Amount; amountRefunded: Api.Amount; status: Api.PaymentStatus; reference: string; customer?: string; paymentMethod?: string; redirectUrl?: string; createdAt: number; failure?: Api.PaymentFailure; metadata?: Record<string, string> }>>;
type _Request = Assert<Identical<Api.PaymentRequest, { amount: Api.Amount; reference: string; authorizeOnly?: boolean; paymentMethod?: string; customer?: string; offSession?: boolean; savePaymentMethod?: boolean; returnUrl?: string; description?: string; metadata?: Record<string, string> }>>;
type _Create = Assert<Identical<Parameters<typeof Api.CreatePayment>, [request: Api.PaymentRequest, idempotencyKey: string, provider?: string]>>;
type _CreateAnswer = Assert<Identical<Answer<typeof Api.CreatePayment>, Api.Payment>>;
type _Get = Assert<Identical<Parameters<typeof Api.GetPayment>, [id: string, provider?: string]>>;
type _GetAnswer = Assert<Identical<Answer<typeof Api.GetPayment>, Api.Payment>>;
type _Capture = Assert<Identical<Parameters<typeof Api.CapturePayment>, [id: string, idempotencyKey: string, amount?: Api.Amount, provider?: string]>>;
type _CaptureAnswer = Assert<Identical<Answer<typeof Api.CapturePayment>, Api.Payment>>;
type _Cancel = Assert<Identical<Parameters<typeof Api.CancelPayment>, [id: string, idempotencyKey: string, provider?: string]>>;
type _CancelAnswer = Assert<Identical<Answer<typeof Api.CancelPayment>, Api.Payment>>;
`;

export const REFUND_TYPES = `
${SHARED_TYPES}
type _RefundStatus = Assert<Identical<Api.RefundStatus, "pending" | "succeeded" | "failed">>;
type _RefundReason = Assert<Identical<Api.RefundReason, "duplicate" | "fraudulent" | "requested_by_customer" | "other">>;
type _Refund = Assert<Identical<Api.Refund, { id: string; payment: string; amount: Api.Amount; status: Api.RefundStatus; createdAt: number; failure?: Api.PaymentFailure; metadata?: Record<string, string> }>>;
type _Request = Assert<Identical<Api.RefundRequest, { payment: string; amount?: Api.Amount; reason?: Api.RefundReason; metadata?: Record<string, string> }>>;
type _Refunds = Assert<Identical<Parameters<typeof Api.RefundPayment>, [request: Api.RefundRequest, idempotencyKey: string, provider?: string]>>;
type _RefundsAnswer = Assert<Identical<Answer<typeof Api.RefundPayment>, Api.Refund>>;
type _Get = Assert<Identical<Parameters<typeof Api.GetRefund>, [id: string, provider?: string]>>;
type _GetAnswer = Assert<Identical<Answer<typeof Api.GetRefund>, Api.Refund>>;
`;

export const CUSTOMER_TYPES = `
type _MethodType = Assert<Identical<Api.PaymentMethodType, "card" | "wallet" | "bank_account" | "other">>;
type _Customer = Assert<Identical<Api.Customer, { id: string; email?: string; name?: string; metadata?: Record<string, string> }>>;
type _Request = Assert<Identical<Api.CustomerRequest, { email?: string; name?: string; metadata?: Record<string, string> }>>;
type _Card = Assert<Identical<Api.CardDetails, { brand: string; last4: string; expiryMonth: number; expiryYear: number }>>;
type _Method = Assert<Identical<Api.PaymentMethod, { id: string; type: Api.PaymentMethodType; customer: string; card?: Api.CardDetails; createdAt: number }>>;
type _Create = Assert<Identical<Parameters<typeof Api.CreateCustomer>, [request: Api.CustomerRequest, idempotencyKey: string, provider?: string]>>;
type _CreateAnswer = Assert<Identical<Answer<typeof Api.CreateCustomer>, Api.Customer>>;
type _Get = Assert<Identical<Parameters<typeof Api.GetCustomer>, [id: string, provider?: string]>>;
type _GetAnswer = Assert<Identical<Answer<typeof Api.GetCustomer>, Api.Customer>>;
type _Delete = Assert<Identical<Parameters<typeof Api.DeleteCustomer>, [id: string, idempotencyKey: string, provider?: string]>>;
type _DeleteAnswer = Assert<Identical<Answer<typeof Api.DeleteCustomer>, void>>;
type _List = Assert<Identical<Parameters<typeof Api.ListPaymentMethods>, [customer: string, provider?: string]>>;
type _ListAnswer = Assert<Identical<Answer<typeof Api.ListPaymentMethods>, Api.PaymentMethod[]>>;
type _Detach = Assert<Identical<Parameters<typeof Api.DetachPaymentMethod>, [id: string, idempotencyKey: string, provider?: string]>>;
type _DetachAnswer = Assert<Identical<Answer<typeof Api.DetachPaymentMethod>, void>>;
`;

export const WEBHOOK_TYPES = `
type _Dispute = Assert<Identical<Api.Dispute, { id: string; payment: string; amount: Api.Amount; reason?: string; createdAt: number }>>;
type _EventType = Assert<Identical<Api.PaymentEventType, "payment.pending" | "payment.authorized" | "payment.succeeded" | "payment.failed" | "payment.canceled" | "refund.succeeded" | "refund.failed" | "dispute.opened">>;
type _Event = Assert<Identical<Api.PaymentEvent, { id: string; type: Api.PaymentEventType; createdAt: number; payment?: Api.Payment; refund?: Api.Refund; dispute?: Api.Dispute }>>;
type _Request = Assert<Identical<Api.WebhookRequest, { body: Uint8Array; headers: Record<string, string | string[] | undefined> }>>;
type _Verify = Assert<Identical<Parameters<typeof Api.VerifyWebhook>, [request: Api.WebhookRequest, provider?: string]>>;
type _VerifyAnswer = Assert<Identical<Answer<typeof Api.VerifyWebhook>, Api.PaymentEvent | undefined>>;
`;

export const ERROR_TYPES = `
type _Entity = Assert<Identical<Api.PaymentEntity, "payment" | "refund" | "checkout session">>;
type _CustomerEntity = Assert<Identical<Api.CustomerEntity, "customer" | "payment method">>;
type _Base = Assert<Identical<ConstructorParameters<typeof Api.PaymentError>, [message: string, providerCode?: string]>>;
type _BaseCode = Assert<Identical<Api.PaymentError["providerCode"], string | undefined>>;
type _NotFound = Assert<Identical<ConstructorParameters<typeof Api.PaymentNotFoundError>, [id: string, entity?: Api.PaymentEntity, providerCode?: string]>>;
type _CustomerNotFound = Assert<Identical<ConstructorParameters<typeof Api.CustomerNotFoundError>, [id: string, entity?: Api.CustomerEntity, providerCode?: string]>>;
type _Webhook = Assert<Identical<ConstructorParameters<typeof Api.WebhookVerificationError>, [message: string, providerCode?: string]>>;
type _State = Assert<Identical<ConstructorParameters<typeof Api.InvalidPaymentStateError>, [message: string, status?: Api.PaymentStatus, providerCode?: string]>>;
type _StateStatus = Assert<Identical<Api.InvalidPaymentStateError["status"], Api.PaymentStatus | undefined>>;
type _Unsupported = Assert<Identical<ConstructorParameters<typeof Api.UnsupportedOperationError>, [operation: string, providerCode?: string]>>;
type _UnsupportedOperation = Assert<Identical<Api.UnsupportedOperationError["operation"], string>>;
type _Chain = Assert<Identical<Api.PaymentNotFoundError extends Api.PaymentError ? Api.CustomerNotFoundError extends Api.PaymentError ? Api.WebhookVerificationError extends Api.PaymentError ? Api.InvalidPaymentStateError extends Api.PaymentError ? Api.UnsupportedOperationError extends Api.PaymentError ? true : false : false : false : false : false, true>>;
`;

export const STATUS_TYPES = `
type _Statuses = Assert<Identical<typeof Api.PAYMENT_STATUSES, readonly ["pending", "requires_action", "authorized", "succeeded", "failed", "canceled"]>>;
type _Terminal = Assert<Identical<typeof Api.TERMINAL_PAYMENT_STATUSES, readonly Api.PaymentStatus[]>>;
type _FailureCodes = Assert<Identical<typeof Api.PAYMENT_FAILURE_CODES, readonly ["declined", "insufficient_funds", "expired_card", "incorrect_details", "authentication_failed", "canceled_by_payer", "expired", "processing_error"]>>;
type _RefundStatuses = Assert<Identical<typeof Api.REFUND_STATUSES, readonly ["pending", "succeeded", "failed"]>>;
type _RefundReasons = Assert<Identical<typeof Api.REFUND_REASONS, readonly ["duplicate", "fraudulent", "requested_by_customer", "other"]>>;
type _MethodTypes = Assert<Identical<typeof Api.PAYMENT_METHOD_TYPES, readonly ["card", "wallet", "bank_account", "other"]>>;
type _EventTypes = Assert<Identical<typeof Api.PAYMENT_EVENT_TYPES, readonly ["payment.pending", "payment.authorized", "payment.succeeded", "payment.failed", "payment.canceled", "refund.succeeded", "refund.failed", "dispute.opened"]>>;
type _Locales = Assert<Identical<typeof Api.PAYMENT_LOCALES, readonly ["auto", "bg", "cs", "da", "de", "el", "en", "en-GB", "es", "es-419", "et", "fi", "fil", "fr", "fr-CA", "hr", "hu", "id", "it", "ja", "ko", "lt", "lv", "ms", "mt", "nb", "nl", "pl", "pt", "pt-BR", "ro", "ru", "sk", "sl", "sv", "th", "tr", "vi", "zh", "zh-HK", "zh-TW"]>>;
type _Locale = Assert<Identical<Api.PaymentLocale, (typeof Api.PAYMENT_LOCALES)[number]>>;
type _IsTerminal = Assert<Identical<typeof Api.isTerminalPaymentStatus, (status: Api.PaymentStatus) => boolean>>;
`;
