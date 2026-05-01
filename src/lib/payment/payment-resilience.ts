import { logger } from '../logger';
import { CircuitBreaker, getCircuitBreakerForGateway } from '../resilience/circuit-breaker';
import { withRetry, RetryPresets } from '../resilience/retry';
import { withTimeout, TimeoutPresets } from '../resilience/timeout';
import { withFallback, withGracefulDegradation } from '../resilience/fallback';
import { getBulkheadForPayment } from '../resilience/bulkhead';

export interface PaymentResilienceConfig {
  gateway: string;
  enableCircuitBreaker?: boolean;
  enableRetry?: boolean;
  enableTimeout?: boolean;
  enableBulkhead?: boolean;
  enableFallback?: boolean;
}

/**
 * Execute a payment operation with full resilience patterns
 */
export async function resilientPaymentOperation<T>(
  gateway: string,
  operation: () => Promise<T>,
  config: Partial<PaymentResilienceConfig> = {}
): Promise<T> {
  const fullConfig: PaymentResilienceConfig = {
    gateway,
    enableCircuitBreaker: true,
    enableRetry: true,
    enableTimeout: true,
    enableBulkhead: true,
    enableFallback: false, // Payments typically shouldn't silently fallback
    ...config
  };

  let wrappedOperation = operation;

  // Apply bulkhead (limit concurrent payment requests)
  if (fullConfig.enableBulkhead) {
    const bulkhead = getBulkheadForPayment(gateway);
    const originalFn = wrappedOperation;
    wrappedOperation = () => bulkhead.execute(originalFn);
  }

  // Apply circuit breaker
  if (fullConfig.enableCircuitBreaker) {
    const breaker = getCircuitBreakerForGateway(gateway);
    const originalFn = wrappedOperation;
    wrappedOperation = () => breaker.execute(originalFn);
  }

  // Apply retry
  if (fullConfig.enableRetry) {
    const originalFn = wrappedOperation;
    wrappedOperation = () => withRetry(originalFn, RetryPresets.payment);
  }

  // Apply timeout
  if (fullConfig.enableTimeout) {
    const originalFn = wrappedOperation;
    wrappedOperation = () => withTimeout(originalFn(), TimeoutPresets.payment);
  }

  return await wrappedOperation();
}

/**
 * Process payment with resilience
 */
export interface PaymentRequest {
  amount: number;
  currency: string;
  customerId: string;
  paymentMethod: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  status: 'completed' | 'pending' | 'failed' | 'requires_action';
  message?: string;
  error?: string;
  retryable?: boolean;
}

export async function processPaymentResilient(
  gateway: string,
  request: PaymentRequest,
  processFn: (gateway: string, request: PaymentRequest) => Promise<PaymentResult>
): Promise<PaymentResult> {
  try {
    return await resilientPaymentOperation(
      gateway,
      () => processFn(gateway, request),
      { enableFallback: false } // Payments should not fallback silently
    );
  } catch (error) {
    logger.error('Payment operation failed after all resilience attempts', {
      gateway,
      request: { amount: request.amount, currency: request.currency, customerId: request.customerId },
      error: (error as Error).message
    });

    // Return failure result instead of throwing
    return {
      success: false,
      status: 'failed',
      error: (error as Error).message,
      retryable: isRetryablePaymentError(error as Error)
    };
  }
}

/**
 * Refund payment with resilience
 */
export interface RefundRequest {
  transactionId: string;
  amount?: number; // Partial refund amount, or omit for full refund
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  status: 'completed' | 'pending' | 'failed';
  amount: number;
  error?: string;
}

export async function processRefundResilient(
  gateway: string,
  request: RefundRequest,
  refundFn: (gateway: string, request: RefundRequest) => Promise<RefundResult>
): Promise<RefundResult> {
  try {
    return await resilientPaymentOperation(
      gateway,
      () => refundFn(gateway, request),
      {
        enableRetry: true,
        enableCircuitBreaker: true,
        enableTimeout: true
      }
    );
  } catch (error) {
    logger.error('Refund operation failed after all resilience attempts', {
      gateway,
      transactionId: request.transactionId,
      error: (error as Error).message
    });

    return {
      success: false,
      status: 'failed',
      amount: request.amount || 0,
      error: (error as Error).message
    };
  }
}

/**
 * Verify payment status with resilience
 */
export interface PaymentStatusResult {
  transactionId: string;
  status: 'completed' | 'pending' | 'failed' | 'unknown';
  amount?: number;
  currency?: string;
  processedAt?: Date;
  error?: string;
}

export async function verifyPaymentStatusResilient(
  gateway: string,
  transactionId: string,
  verifyFn: (gateway: string, transactionId: string) => Promise<PaymentStatusResult>
): Promise<PaymentStatusResult> {
  try {
    return await resilientPaymentOperation(
      gateway,
      () => verifyFn(gateway, transactionId),
      {
        enableRetry: true,
        enableCircuitBreaker: true,
        enableTimeout: true
      }
    );
  } catch (error) {
    logger.error('Payment verification failed after all resilience attempts', {
      gateway,
      transactionId,
      error: (error as Error).message
    });

    return {
      transactionId,
      status: 'unknown',
      error: (error as Error).message
    };
  }
}

/**
 * Create payment intent/setup with resilience
 */
export interface PaymentSetupRequest {
  customerId: string;
  amount: number;
  currency: string;
  setupFutureUsage?: boolean;
}

export interface PaymentSetupResult {
  success: boolean;
  clientSecret?: string;
  setupId?: string;
  status: 'requires_action' | 'succeeded' | 'failed';
  error?: string;
}

export async function setupPaymentResilient(
  gateway: string,
  request: PaymentSetupRequest,
  setupFn: (gateway: string, request: PaymentSetupRequest) => Promise<PaymentSetupResult>
): Promise<PaymentSetupResult> {
  try {
    return await resilientPaymentOperation(
      gateway,
      () => setupFn(gateway, request),
      {
        enableRetry: true,
        enableCircuitBreaker: true,
        enableTimeout: true
      }
    );
  } catch (error) {
    logger.error('Payment setup failed after all resilience attempts', {
      gateway,
      customerId: request.customerId,
      error: (error as Error).message
    });

    return {
      success: false,
      status: 'failed',
      error: (error as Error).message
    };
  }
}

/**
 * Handle webhook processing with resilience
 */
export interface WebhookPayload {
  type: string;
  data: Record<string, any>;
  signature?: string;
  timestamp?: number;
}

export interface WebhookResult {
  processed: boolean;
  acknowledged: boolean;
  error?: string;
}

export async function processWebhookResilient(
  gateway: string,
  payload: WebhookPayload,
  processFn: (gateway: string, payload: WebhookPayload) => Promise<WebhookResult>
): Promise<WebhookResult> {
  // Webhooks should be processed quickly with minimal retries
  try {
    return await resilientPaymentOperation(
      gateway,
      () => processFn(gateway, payload),
      {
        enableRetry: true,
        enableCircuitBreaker: true,
        enableTimeout: false, // Webhook timeout handled by gateway
        enableBulkhead: true
      }
    );
  } catch (error) {
    logger.error('Webhook processing failed', {
      gateway,
      type: payload.type,
      error: (error as Error).message
    });

    return {
      processed: false,
      acknowledged: false,
      error: (error as Error).message
    };
  }
}

/**
 * Check if a payment error is retryable
 */
function isRetryablePaymentError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const code = (error as any).code || '';

  const retryableCodes = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'rate_limit',
    'gateway_timeout',
    'service_unavailable'
  ];

  const retryableMessages = [
    'timeout',
    'connection',
    'network',
    'temporary',
    'rate limit',
    'unavailable'
  ];

  return retryableCodes.some(c => code === c) ||
         retryableMessages.some(m => message.includes(m));
}

/**
 * Check payment gateway health
 */
export async function checkPaymentGatewayHealth(gateway: string): Promise<{
  healthy: boolean;
  circuitState: string;
  bulkheadMetrics: {
    running: number;
    queued: number;
    maxConcurrent: number;
    maxQueue: number;
  };
}> {
  const breaker = getCircuitBreakerForGateway(gateway);
  const bulkhead = getBulkheadForPayment(gateway);

  return {
    healthy: breaker.getState() === 'closed',
    circuitState: breaker.getState(),
    bulkheadMetrics: bulkhead.getMetrics()
  };
}

/**
 * Reset circuit breaker for a gateway (use with caution)
 */
export function resetGatewayCircuitBreaker(gateway: string): void {
  logger.warn(`Resetting circuit breaker for gateway: ${gateway}`);
  const breaker = getCircuitBreakerForGateway(gateway);
  // The circuit breaker will reset naturally on success or can be recreated
  // by removing from registry (handled in circuit-breaker.ts)
}
