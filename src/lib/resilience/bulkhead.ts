import { logger } from '../logger';

export interface BulkheadOptions {
  maxConcurrent: number;
  maxQueue: number;
  queueTimeout: number;
}

export class BulkheadFullError extends Error {
  constructor(message = 'Bulkhead capacity exceeded') {
    super(message);
    this.name = 'BulkheadFullError';
  }
}

export class BulkheadTimeoutError extends Error {
  constructor(message = 'Bulkhead queue timeout exceeded') {
    super(message);
    this.name = 'BulkheadTimeoutError';
  }
}

interface QueuedOperation<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  startTime: number;
}

export class Bulkhead {
  private running = 0;
  private queue: QueuedOperation<any>[] = [];
  private options: BulkheadOptions;
  private name: string;

  constructor(name: string, options: BulkheadOptions) {
    this.name = name;
    this.options = options;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // If we have capacity, execute immediately
    if (this.running < this.options.maxConcurrent) {
      return this.runOperation(fn);
    }

    // Otherwise, queue the operation
    if (this.queue.length >= this.options.maxQueue) {
      logger.warn(`Bulkhead "${this.name}" queue full (${this.queue.length}/${this.options.maxQueue})`);
      throw new BulkheadFullError(
        `Bulkhead "${this.name}" is at capacity. Running: ${this.running}, Queued: ${this.queue.length}`
      );
    }

    return new Promise<T>((resolve, reject) => {
      const operation: QueuedOperation<T> = {
        fn,
        resolve,
        reject,
        startTime: Date.now()
      };

      this.queue.push(operation);
      logger.debug(`Bulkhead "${this.name}": queued operation. Queue size: ${this.queue.length}`);

      // Set up timeout for queued operation
      setTimeout(() => {
        const index = this.queue.indexOf(operation);
        if (index !== -1) {
          this.queue.splice(index, 1);
          operation.reject(new BulkheadTimeoutError(
            `Bulkhead "${this.name}" queue timeout after ${this.options.queueTimeout}ms`
          ));
        }
      }, this.options.queueTimeout);
    });
  }

  private async runOperation<T>(fn: () => Promise<T>): Promise<T> {
    this.running++;
    logger.debug(`Bulkhead "${this.name}": started operation. Running: ${this.running}/${this.options.maxConcurrent}`);

    try {
      const result = await fn();
      return result;
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.running >= this.options.maxConcurrent) {
      return;
    }

    const operation = this.queue.shift();
    if (!operation) return;

    // Check if operation timed out while waiting
    if (Date.now() - operation.startTime > this.options.queueTimeout) {
      operation.reject(new BulkheadTimeoutError());
      this.processQueue();
      return;
    }

    // Execute the queued operation
    this.runOperation(operation.fn)
      .then(operation.resolve)
      .catch(operation.reject);

    // Continue processing if we have more capacity
    if (this.running < this.options.maxConcurrent) {
      this.processQueue();
    }
  }

  getMetrics() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.options.maxConcurrent,
      maxQueue: this.options.maxQueue
    };
  }
}

// Bulkhead registry
const bulkheads = new Map<string, Bulkhead>();

export function getBulkhead(name: string, options?: BulkheadOptions): Bulkhead {
  if (!bulkheads.has(name)) {
    const defaultOptions: BulkheadOptions = {
      maxConcurrent: 10,
      maxQueue: 100,
      queueTimeout: 30000 // 30 seconds
    };
    bulkheads.set(name, new Bulkhead(name, options || defaultOptions));
  }
  return bulkheads.get(name)!;
}

export function getBulkheadForAI(provider: string): Bulkhead {
  return getBulkhead(`ai-${provider}`, {
    maxConcurrent: 5,
    maxQueue: 50,
    queueTimeout: 60000 // 1 minute for AI requests
  });
}

export function getBulkheadForPayment(gateway: string): Bulkhead {
  return getBulkhead(`payment-${gateway}`, {
    maxConcurrent: 20,
    maxQueue: 200,
    queueTimeout: 15000 // 15 seconds for payments
  });
}

export function resetAllBulkheads(): void {
  bulkheads.clear();
  logger.info('All bulkheads reset');
}
