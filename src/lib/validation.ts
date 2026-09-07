/**
 * Zod validation schemas for StarPath Astrology API inputs
 * Provides comprehensive input validation for all endpoints
 */

import { z } from 'zod'
import { PASSWORD_REQUIREMENTS } from './security'

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * UUID validation schema
 */
export const UuidSchema = z.string().uuid()

/**
 * Email validation schema
 */
export const EmailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .max(254, 'Email too long')

/**
 * Password validation schema
 */
export const PasswordSchema = z
  .string()
  .min(
    PASSWORD_REQUIREMENTS.minLength,
    `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`
  )
  .max(
    PASSWORD_REQUIREMENTS.maxLength,
    `Password must not exceed ${PASSWORD_REQUIREMENTS.maxLength} characters`
  )
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    'Password must contain at least one special character'
  )

/**
 * Generic ID parameter schema
 */
export const IdParamSchema = z.object({
  id: UuidSchema,
})

/**
 * Pagination schema
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ============================================================================
// Authentication Schemas
// ============================================================================

/**
 * Signup input validation
 */
export const SignupInputSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  birthDate: z.string().datetime().optional(),
  birthTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)')
    .optional(),
  location: z.string().max(200).optional(),
})

export type SignupInput = z.infer<typeof SignupInputSchema>

/**
 * Login input validation
 */
export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
})

export type LoginInput = z.infer<typeof LoginInputSchema>

/**
 * Password reset request schema
 */
export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
})

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>

/**
 * Password reset schema
 */
export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: PasswordSchema,
})

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>

/**
 * Change password schema
 */
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: PasswordSchema,
})

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>

// ============================================================================
// Chart Schemas
// ============================================================================

/**
 * Location validation
 */
export const LocationSchema = z.object({
  name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().max(50),
})

/**
 * Chart type enum
 */
const ChartTypes = ['natal', 'transit', 'synastry', 'composite', 'progressed'] as const

/**
 * Chart input validation
 */
export const ChartInputSchema = z.object({
  name: z.string().min(1, 'Chart name is required').max(100),
  birthDate: z.string().datetime('Invalid birth date format'),
  birthTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  location: LocationSchema,
  type: z.enum(ChartTypes),
  // For synastry/composite charts
  partnerBirthDate: z.string().datetime().optional(),
  partnerBirthTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  partnerLocation: LocationSchema.optional(),
})

export type ChartInput = z.infer<typeof ChartInputSchema>

/**
 * Chart update schema
 */
export const ChartUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
})

export type ChartUpdate = z.infer<typeof ChartUpdateSchema>

// ============================================================================
// Reading Schemas
// ============================================================================

/**
 * Reading types
 */
const ReadingTypes = [
  'birth_chart_analysis',
  'yearly_forecast',
  'career_guidance',
  'relationship_compatibility',
  'monthly_transit',
  'daily_horoscope',
  'life_path',
  'spiritual_growth',
] as const

/**
 * Reading input validation
 */
export const ReadingInputSchema = z.object({
  type: z.enum(ReadingTypes),
  chartId: UuidSchema,
  partnerChartId: UuidSchema.optional(),
  focusArea: z.string().max(200).optional(),
  questions: z.array(z.string().max(500)).max(5).optional(),
})

export type ReadingInput = z.infer<typeof ReadingInputSchema>

/**
 * Reading regeneration schema
 */
export const ReadingRegenerateSchema = z.object({
  readingId: UuidSchema,
  feedback: z.enum(['too_generic', 'too_complex', 'inaccurate', 'want_more', 'other']).optional(),
  additionalContext: z.string().max(1000).optional(),
})

export type ReadingRegenerate = z.infer<typeof ReadingRegenerateSchema>

// ============================================================================
// Chat Schemas
// ============================================================================

/**
 * Chat message validation
 */
export const ChatInputSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message too long (max 4000 characters)'),
  conversationId: UuidSchema.optional(),
  context: z
    .object({
      chartId: UuidSchema.optional(),
      readingId: UuidSchema.optional(),
    })
    .optional(),
})

export type ChatInput = z.infer<typeof ChatInputSchema>

/**
 * Chat feedback schema
 */
export const ChatFeedbackSchema = z.object({
  messageId: UuidSchema,
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(1000).optional(),
})

export type ChatFeedback = z.infer<typeof ChatFeedbackSchema>

// ============================================================================
// Payment Schemas
// ============================================================================

/**
 * Payment gateway types
 */
const PaymentGateways = ['stripe', 'razorpay', 'paypal'] as const

/**
 * Payment input validation
 */
export const PaymentInputSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  gateway: z.enum(PaymentGateways),
  couponCode: z.string().max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type PaymentInput = z.infer<typeof PaymentInputSchema>

/**
 * Payment confirmation schema
 */
export const PaymentConfirmSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  gateway: z.enum(PaymentGateways),
  signature: z.string().optional(), // For Razorpay
})

export type PaymentConfirm = z.infer<typeof PaymentConfirmSchema>

/**
 * Subscription change schema
 */
export const SubscriptionChangeSchema = z.object({
  newPlanId: z.string().min(1),
  immediate: z.boolean().default(false),
})

export type SubscriptionChange = z.infer<typeof SubscriptionChangeSchema>

// ============================================================================
// Admin Schemas
// ============================================================================

/**
 * Admin user search schema
 */
export const AdminUserSearchSchema = z.object({
  query: z.string().max(200).optional(),
  status: z.enum(['active', 'inactive', 'suspended', 'all']).default('all'),
  role: z.enum(['user', 'admin', 'moderator', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type AdminUserSearch = z.infer<typeof AdminUserSearchSchema>

/**
 * Admin user update schema
 */
export const AdminUserUpdateSchema = z.object({
  userId: UuidSchema,
  status: z.enum(['active', 'suspended', 'banned']).optional(),
  role: z.enum(['user', 'admin', 'moderator']).optional(),
  notes: z.string().max(1000).optional(),
})

export type AdminUserUpdate = z.infer<typeof AdminUserUpdateSchema>

/**
 * Admin plan management schema
 */
export const AdminPlanUpdateSchema = z.object({
  planId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  price: z.number().min(0).optional(),
  interval: z.enum(['month', 'year', 'lifetime']).optional(),
  features: z.array(z.string().max(200)).max(50).optional(),
  isActive: z.boolean().optional(),
})

export type AdminPlanUpdate = z.infer<typeof AdminPlanUpdateSchema>

/**
 * Admin refund schema
 */
export const AdminRefundSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().min(0).optional(), // Full refund if not specified
  reason: z.string().min(1).max(500),
})

export type AdminRefund = z.infer<typeof AdminRefundSchema>

/**
 * Admin announcement schema
 */
export const AdminAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  type: z.enum(['info', 'warning', 'critical', 'maintenance']).default('info'),
  targetAudience: z.enum(['all', 'free', 'premium', 'admins']).default('all'),
  expiresAt: z.string().datetime().optional(),
})

export type AdminAnnouncement = z.infer<typeof AdminAnnouncementSchema>

/**
 * Admin system settings schema
 */
export const AdminSystemSettingsSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  disableSignups: z.boolean().optional(),
  disablePayments: z.boolean().optional(),
  maxChartsPerUser: z.number().int().min(1).max(1000).optional(),
  maxReadingsPerDay: z.number().int().min(1).max(100).optional(),
  aiModel: z.enum(['claude', 'gpt4', 'local']).optional(),
  rateLimitMultiplier: z.number().min(0.1).max(10).optional(),
})

export type AdminSystemSettings = z.infer<typeof AdminSystemSettingsSchema>

// ============================================================================
// Profile Schemas
// ============================================================================

/**
 * Profile update schema
 */
export const ProfileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
  location: z.string().max(200).optional(),
  timezone: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
  avatarUrl: z.string().url().max(500).optional(),
})

export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>

/**
 * Preferences update schema
 */
export const PreferencesUpdateSchema = z.object({
  emailNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  readingReminders: z.boolean().optional(),
  darkMode: z.boolean().optional(),
  compactView: z.boolean().optional(),
  defaultChartType: z.enum(['natal', 'transit', 'progressed']).optional(),
})

export type PreferencesUpdate = z.infer<typeof PreferencesUpdateSchema>

// ============================================================================
// Webhook Schemas
// ============================================================================

/**
 * Stripe webhook schema
 */
export const StripeWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
  created: z.number(),
})

export type StripeWebhook = z.infer<typeof StripeWebhookSchema>

/**
 * Razorpay webhook schema
 */
export const RazorpayWebhookSchema = z.object({
  event: z.string(),
  payload: z.record(z.string(), z.unknown()),
  created_at: z.number(),
})

export type RazorpayWebhook = z.infer<typeof RazorpayWebhookSchema>

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validation error details
 */
export interface ValidationErrorDetails {
  path: (string | number)[]
  message: string
}

/**
 * Validate input against a schema
 * Returns validated data or throws validation error
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    const issues = (result.error.issues || []) as Array<{ path: PropertyKey[]; message: string }>
    const errorMessage = issues
      .map((e: { path: PropertyKey[]; message: string }) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')

    throw new ValidationError(
      context ? `${context}: ${errorMessage}` : errorMessage,
      issues.map((e: { path: PropertyKey[]; message: string }) => ({
        path: e.path as (string | number)[],
        message: e.message,
      }))
    )
  }

  return result.data
}

/**
 * Validate input partially (for PATCH requests)
 */
export function validatePartial<T>(
  schema: z.ZodObject<z.ZodRawShape>,
  data: unknown,
  context?: string
): Partial<T> {
  const partialSchema = schema.partial()
  const result = partialSchema.safeParse(data)

  if (!result.success) {
    const issues = (result.error.issues || []) as Array<{ path: PropertyKey[]; message: string }>
    const errorMessage = issues
      .map((e: { path: PropertyKey[]; message: string }) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')

    throw new ValidationError(
      context ? `${context}: ${errorMessage}` : errorMessage,
      issues.map((e: { path: PropertyKey[]; message: string }) => ({
        path: e.path as (string | number)[],
        message: e.message,
      }))
    )
  }

  return result.data as Partial<T>
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  public readonly errors: ValidationErrorDetails[]
  public readonly statusCode: number

  constructor(message: string, errors: ValidationErrorDetails[]) {
    super(message)
    this.name = 'ValidationError'
    this.errors = errors
    this.statusCode = 400
  }
}

/**
 * Sanitize string input
 * Removes potentially dangerous characters
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
    .slice(0, 10000) // Limit length
}

/**
 * Validate query parameters
 */
export function validateQueryParams(params: Record<string, unknown>): Record<string, string> {
  const validated: Record<string, string> = {}

  for (const [key, value] of Object.entries(params)) {
    // Only allow alphanumeric keys
    if (!/^[a-zA-Z0-9_]+$/.test(key)) {
      continue
    }

    // Convert to string and sanitize
    if (value !== undefined && value !== null) {
      validated[key] = sanitizeString(String(value))
    }
  }

  return validated
}
