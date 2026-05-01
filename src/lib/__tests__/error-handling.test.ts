import { describe, it, expect, vi } from 'vitest'
import {
  AppError,
  ValidationError,
  AuthError,
  NotFoundError,
  RateLimitError,
  DatabaseError,
  AIServiceError,
  PaymentError,
  getErrorResponse,
  logError,
  reportError,
  getUserErrorMessage,
  isOperationalError,
  asyncHandler,
  safeJsonParse,
  withRetry
} from '../error-handling'

describe('Error Handling', () => {
  describe('AppError', () => {
    it('should create basic AppError', () => {
      const error = new AppError('Test error')

      expect(error.message).toBe('Test error')
      expect(error.statusCode).toBe(500)
      expect(error.severity).toBe('medium')
      expect(error.isOperational).toBe(true)
      expect(error.name).toBe('AppError')
      expect(error.timestamp).toBeDefined()
    })

    it('should create AppError with custom status code', () => {
      const error = new AppError('Not found', 404)
      expect(error.statusCode).toBe(404)
    })

    it('should create AppError with custom severity', () => {
      const error = new AppError('Critical', 500, 'critical')
      expect(error.severity).toBe('critical')
    })

    it('should create AppError with context', () => {
      const context = { userId: '123', path: '/api/test' }
      const error = new AppError('Test', 500, 'medium', true, context)
      expect(error.context).toEqual(context)
    })

    it('should capture stack trace', () => {
      const error = new AppError('Test')
      expect(error.stack).toBeDefined()
    })
  })

  describe('ValidationError', () => {
    it('should create ValidationError with default message', () => {
      const error = new ValidationError()
      expect(error.message).toBe('Validation failed')
      expect(error.statusCode).toBe(400)
    })

    it('should create ValidationError with field errors', () => {
      const fieldErrors = { email: ['Invalid email'] }
      const error = new ValidationError('Validation failed', fieldErrors)
      expect(error.fieldErrors).toEqual(fieldErrors)
    })

    it('should create ValidationError with context', () => {
      const context = { userId: '123' }
      const error = new ValidationError('Validation failed', {}, context)
      expect(error.context).toEqual(context)
    })
  })

  describe('AuthError', () => {
    it('should create AuthError with default values', () => {
      const error = new AuthError()
      expect(error.message).toBe('Authentication failed')
      expect(error.statusCode).toBe(401)
      expect(error.authType).toBe('login')
    })

    it('should create AuthError with custom type', () => {
      const error = new AuthError('Session expired', 'session')
      expect(error.message).toBe('Session expired')
      expect(error.authType).toBe('session')
    })

    it('should create AuthError with all auth types', () => {
      const types: ('login' | 'session' | 'permission' | 'token')[] = ['login', 'session', 'permission', 'token']
      for (const type of types) {
        const error = new AuthError('Test', type)
        expect(error.authType).toBe(type)
      }
    })
  })

  describe('NotFoundError', () => {
    it('should create NotFoundError with default values', () => {
      const error = new NotFoundError()
      expect(error.message).toBe('Resource not found')
      expect(error.statusCode).toBe(404)
    })

    it('should create NotFoundError with resource type and ID', () => {
      const error = new NotFoundError('User not found', 'User', 'user-123')
      expect(error.resourceType).toBe('User')
      expect(error.resourceId).toBe('user-123')
    })
  })

  describe('RateLimitError', () => {
    it('should create RateLimitError with default values', () => {
      const error = new RateLimitError()
      expect(error.message).toBe('Rate limit exceeded')
      expect(error.statusCode).toBe(429)
      expect(error.retryAfter).toBe(60)
    })

    it('should create RateLimitError with custom retry after', () => {
      const error = new RateLimitError('Too many requests', 120)
      expect(error.retryAfter).toBe(120)
    })
  })

  describe('DatabaseError', () => {
    it('should create DatabaseError with default values', () => {
      const error = new DatabaseError()
      expect(error.message).toBe('Database operation failed')
      expect(error.statusCode).toBe(500)
      expect(error.operation).toBe('unknown')
      expect(error.isOperational).toBe(false)
    })

    it('should create DatabaseError with custom operation', () => {
      const error = new DatabaseError('Query failed', 'findUser')
      expect(error.operation).toBe('findUser')
    })
  })

  describe('AIServiceError', () => {
    it('should create AIServiceError with default values', () => {
      const error = new AIServiceError()
      expect(error.message).toBe('AI service error')
      expect(error.statusCode).toBe(503)
      expect(error.service).toBe('unknown')
      expect(error.isOperational).toBe(false)
    })

    it('should create AIServiceError with custom service', () => {
      const error = new AIServiceError('Claude unavailable', 'anthropic')
      expect(error.service).toBe('anthropic')
    })
  })

  describe('PaymentError', () => {
    it('should create PaymentError with default values', () => {
      const error = new PaymentError()
      expect(error.message).toBe('Payment processing failed')
      expect(error.statusCode).toBe(402)
      expect(error.gateway).toBe('unknown')
    })

    it('should create PaymentError with custom gateway and payment ID', () => {
      const error = new PaymentError('Card declined', 'stripe', 'pi_123')
      expect(error.gateway).toBe('stripe')
      expect(error.paymentId).toBe('pi_123')
    })
  })

  describe('getErrorResponse', () => {
    it('should return error response for AppError', () => {
      const error = new AppError('Test error', 404)
      const response = getErrorResponse(error)

      expect(response.status).toBe(404)
      expect(response.message).toBe('Test error')
      expect(response.code).toBe('AppError')
    })

    it('should return field errors for ValidationError', () => {
      const fieldErrors = { email: ['Invalid format'] }
      const error = new ValidationError('Validation failed', fieldErrors)
      const response = getErrorResponse(error)

      expect(response.status).toBe(400)
      expect(response.code).toBe('ValidationError')
      expect(response.details).toEqual(fieldErrors)
    })

    it('should handle generic Error', () => {
      const error = new Error('Generic error')
      const response = getErrorResponse(error)

      expect(response.status).toBe(500)
      expect(response.code).toBe('InternalError')
    })
  })

  describe('logError', () => {
    it('should log error without throwing', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const error = new Error('Test error')
      const context = { userId: '123', password: 'secret123', token: 'abc' }

      // Should not throw
      expect(() => logError(error, context)).not.toThrow()

      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should include error name and message', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const error = new AppError('Test error', 500)
      logError(error)

      expect(consoleSpy).toHaveBeenCalled()
      const logOutput = JSON.parse((consoleSpy.mock.calls[0] as any[])[0])
      expect(logOutput.name).toBe('AppError')
      expect(logOutput.message).toBe('Test error')

      consoleSpy.mockRestore()
    })
  })

  describe('reportError', () => {
    it('should return success and reportId', async () => {
      const error = new Error('User reported error')
      const result = await reportError(error, 'Something went wrong')

      expect(result.success).toBe(true)
      expect(result.reportId).toBeDefined()
      expect(result.reportId?.startsWith('ERR-')).toBe(true)
    })

    it('should include error details in report', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const error = new Error('Test error')
      await reportError(error, 'User description')

      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('getUserErrorMessage', () => {
    it('should return custom message for ValidationError', () => {
      const error = new ValidationError('Please check your input')
      const message = getUserErrorMessage(error)
      expect(message).toBe('Please check your input')
    })

    it('should return login message for login auth error', () => {
      const error = new AuthError('Auth failed', 'login')
      const message = getUserErrorMessage(error)
      expect(message).toBe('Invalid email or password. Please try again.')
    })

    it('should return session message for session auth error', () => {
      const error = new AuthError('Session expired', 'session')
      const message = getUserErrorMessage(error)
      expect(message).toBe('Your session has expired. Please sign in again.')
    })

    it('should return permission message for permission auth error', () => {
      const error = new AuthError('No permission', 'permission')
      const message = getUserErrorMessage(error)
      expect(message).toBe('You do not have permission to access this resource.')
    })

    it('should return token message for token auth error', () => {
      const error = new AuthError('Token invalid', 'token')
      const message = getUserErrorMessage(error)
      expect(message).toBe('Authentication token is invalid or expired.')
    })

    it('should return resource type message for NotFoundError', () => {
      const error = new NotFoundError('User not found', 'User', 'user-123')
      const message = getUserErrorMessage(error)
      expect(message).toBe('The requested User could not be found.')
    })

    it('should return generic not found message for NotFoundError without type', () => {
      const error = new NotFoundError()
      const message = getUserErrorMessage(error)
      expect(message).toBe('The requested resource could not be found.')
    })

    it('should return rate limit message with retry after', () => {
      const error = new RateLimitError('Too many requests', 120)
      const message = getUserErrorMessage(error)
      expect(message).toBe('Too many requests. Please try again in 120 seconds.')
    })

    it('should return payment message for PaymentError', () => {
      const error = new PaymentError('Card declined')
      const message = getUserErrorMessage(error)
      expect(message).toBe('Payment processing failed. Please check your payment details and try again.')
    })

    it('should return database message for DatabaseError', () => {
      const error = new DatabaseError()
      const message = getUserErrorMessage(error)
      expect(message).toBe('We encountered a database error. Please try again later.')
    })

    it('should return AI service message for AIServiceError', () => {
      const error = new AIServiceError()
      const message = getUserErrorMessage(error)
      expect(message).toBe('Our AI service is temporarily unavailable. Please try again in a moment.')
    })

    it('should return generic message for unknown errors', () => {
      const error = new Error('Unknown error')
      const message = getUserErrorMessage(error)
      expect(message).toBe('Something went wrong. Please try again or contact support if the problem persists.')
    })
  })

  describe('isOperationalError', () => {
    it('should return true for operational AppError', () => {
      const error = new AppError('Test', 500, 'medium', true)
      expect(isOperationalError(error)).toBe(true)
    })

    it('should return false for non-operational AppError', () => {
      const error = new AppError('Test', 500, 'medium', false)
      expect(isOperationalError(error)).toBe(false)
    })

    it('should return false for generic Error', () => {
      const error = new Error('Test')
      expect(isOperationalError(error)).toBe(false)
    })
  })

  describe('asyncHandler', () => {
    it('should wrap async function and return result', async () => {
      const fn = async () => 'success'
      const wrapped = asyncHandler(fn)
      const result = await wrapped()
      expect(result).toBe('success')
    })

    it('should catch and rethrow errors', async () => {
      const fn = async () => { throw new Error('Failed') }
      const wrapped = asyncHandler(fn)
      await expect(wrapped()).rejects.toThrow('Failed')
    })
  })

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"key": "value"}', {})
      expect(result).toEqual({ key: 'value' })
    })

    it('should return default value for invalid JSON', () => {
      const defaultValue = { fallback: true }
      const result = safeJsonParse('invalid json', defaultValue)
      expect(result).toBe(defaultValue)
    })

    it('should return default value for empty string', () => {
      const defaultValue = { empty: true }
      const result = safeJsonParse('', defaultValue)
      expect(result).toBe(defaultValue)
    })
  })

  describe('withRetry', () => {
    it('should return result on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      const result = await withRetry(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable error', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new DatabaseError('First failure'))
        .mockResolvedValueOnce('success')

      const result = await withRetry(operation, { maxRetries: 2, baseDelay: 10 })

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should throw after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new DatabaseError('Always fails'))

      await expect(
        withRetry(operation, { maxRetries: 2, baseDelay: 10 })
      ).rejects.toThrow('Always fails')

      expect(operation).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new ValidationError('Invalid input'))

      await expect(
        withRetry(operation, { maxRetries: 3, baseDelay: 10 })
      ).rejects.toThrow('Invalid input')

      expect(operation).toHaveBeenCalledTimes(1)
    })
  })
})
