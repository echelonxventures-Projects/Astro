// Resilience patterns index
// Circuit breaker, retry logic, fallback strategies, bulkhead pattern, timeout wrapper

export {
  CircuitBreaker,
  CircuitOpenError,
  getCircuitBreaker,
  getCircuitBreakerForGateway,
  getCircuitBreakerForAI,
  resetAllCircuitBreakers,
  type CircuitBreakerOptions
} from './circuit-breaker';

export {
  withRetry,
  withDefaultRetry,
  withImmediateRetry,
  RetryPresets,
  RetryExhaustedError,
  type RetryOptions
} from './retry';

export {
  withFallback,
  withChainedFallback,
  withGracefulDegradation,
  withCacheFallback,
  FallbackValues,
  FallbackError,
  type FallbackOptions
} from './fallback';

export {
  Bulkhead,
  BulkheadFullError,
  BulkheadTimeoutError,
  getBulkhead,
  getBulkheadForAI,
  getBulkheadForPayment,
  resetAllBulkheads,
  type BulkheadOptions
} from './bulkhead';

export {
  withTimeout,
  withTimeoutMs,
  withCancellableTimeout,
  TimeoutPresets,
  executeWithTimeout,
  createTimeoutWrapper,
  isTimeoutError,
  logTimeoutError,
  TimeoutError,
  type TimeoutOptions,
  type CancellableOperation
} from './timeout';
