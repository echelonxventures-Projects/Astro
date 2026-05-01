import { logger } from '../logger';

export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

export interface CircuitBreakerOptions {
  failureThreshold: number; // Open after N failures
  successThreshold: number; // Close after N successes
  timeout: number; // Try half-open after ms
}

export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private successes = 0;
  private nextAttempt = Date.now();
  private options: CircuitBreakerOptions;
  private name: string;

  constructor(name: string, options: CircuitBreakerOptions) {
    this.name = name;
    this.options = options;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttempt) {
        throw new CircuitOpenError(`Circuit breaker "${this.name}" is open. Retry after ${new Date(this.nextAttempt).toISOString()}`);
      }
      this.state = 'half-open';
      logger.info(`Circuit breaker "${this.name}" entering half-open state`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.options.successThreshold) {
        this.reset();
      }
    } else {
      // Reset failures on success in closed state
      this.failures = 0;
    }
  }

  private onFailure() {
    this.failures++;
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
      this.nextAttempt = Date.now() + this.options.timeout;
      logger.warn(`Circuit breaker "${this.name}" opened due to ${this.failures} failures. Will retry after ${this.options.timeout}ms`);
    }
  }

  private reset() {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    logger.info(`Circuit breaker "${this.name}" reset to closed state`);
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      nextAttempt: this.nextAttempt
    };
  }
}

// Circuit breaker registry for managing multiple breakers
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    const defaultOptions: CircuitBreakerOptions = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000 // 1 minute
    };
    circuitBreakers.set(name, new CircuitBreaker(name, options || defaultOptions));
  }
  return circuitBreakers.get(name)!;
}

export function getCircuitBreakerForGateway(gateway: string): CircuitBreaker {
  return getCircuitBreaker(`payment-${gateway}`, {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000 // 30 seconds for payments
  });
}

export function getCircuitBreakerForAI(provider: string): CircuitBreaker {
  return getCircuitBreaker(`ai-${provider}`, {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000 // 1 minute
  });
}

export function resetAllCircuitBreakers(): void {
  circuitBreakers.clear();
  logger.info('All circuit breakers reset');
}
