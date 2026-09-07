/**
 * Payment Gateway Module
 * Universal payment system supporting multiple gateways
 */

// Core interfaces
export type {
  IPaymentGateway,
  PaymentGatewayConfig,
  CheckoutSessionOptions,
  CheckoutSessionResult,
  SubscriptionOptions,
  SubscriptionResult,
  WebhookEvent,
  RefundResult,
  CustomerResult,
  PaymentMethodResult,
  GatewayFactory,
} from './gateway-interface'

// Registry and factory
export {
  registerGateway,
  getGateway,
  getDefaultGateway,
  getEnabledGateways,
  getAvailableGateways,
  getGatewayByTransaction,
  getPaymentMethods,
  encryptSensitiveData,
  decryptSensitiveData,
} from './gateway-registry'

// Gateway implementations
export { StripeGateway } from './stripe-gateway'
export { RazorpayGateway } from './razorpay-gateway'
export { PaypalGateway } from './paypal-gateway'

// Security utilities
export {
  maskCardNumber,
  maskCVV,
  validateWebhookSignature,
  verifyPayPalWebhookSignature,
  requires3DSecure,
  sanitizeForLogging,
  hashSensitiveData,
  encryptData,
  decryptData,
  checkPCICompliance,
} from './security'

// Fraud detection
export {
  checkTransaction,
  isCardFlagged,
  isEmailFlagged,
  flagForReview,
  reportToFraudService,
  getVelocityData,
  checkDeviceReputation,
  type FraudCheck,
  type FraudCheckParams,
} from './fraud-detection'

// Audit logging
export {
  logPaymentAudit,
  logWebhookEvent,
  logTransaction,
  logFraudCheck,
  logRefund,
  logSubscription,
  logSecurityAlert,
  logAdminAction,
  getUserAuditTrail,
  getTransactionAuditTrail,
  getRecentSuspiciousActivity,
  type AuditEntry,
  type AuditAction,
  type AuditStatus,
} from './audit'

// Initialize default gateways
import { registerGateway } from './gateway-registry'
import { PaypalGateway } from './paypal-gateway'
import { RazorpayGateway } from './razorpay-gateway'
import { StripeGateway } from './stripe-gateway'

// Register all available gateways
registerGateway('stripe', StripeGateway)
registerGateway('razorpay', RazorpayGateway)
registerGateway('paypal', PaypalGateway)
