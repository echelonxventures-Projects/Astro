import { describe, it, expect } from 'vitest'
import {
  UuidSchema,
  EmailSchema,
  PasswordSchema,
  SignupInputSchema,
  LoginInputSchema,
  ChartInputSchema,
  LocationSchema,
  ReadingInputSchema,
  ChatInputSchema,
  AdminUserSearchSchema,
  AdminUserUpdateSchema,
  validateInput,
  validatePartial,
  ValidationError,
  sanitizeString,
  validateQueryParams
} from '../validation'

describe('Validation Schemas', () => {
  describe('UUID Schema', () => {
    it('should validate valid UUID', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000'
      expect(() => UuidSchema.parse(validUuid)).not.toThrow()
    })

    it('should reject invalid UUID', () => {
      const invalidUuid = 'not-a-uuid'
      expect(() => UuidSchema.parse(invalidUuid)).toThrow()
    })

    it('should reject empty string', () => {
      expect(() => UuidSchema.parse('')).toThrow()
    })
  })

  describe('Email Schema', () => {
    it('should validate valid email', () => {
      const validEmails = [
        'user@example.com',
        'test.user@domain.co.uk',
        'user+tag@example.org'
      ]

      for (const email of validEmails) {
        expect(() => EmailSchema.parse(email)).not.toThrow()
      }
    })

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@.com',
        ''
      ]

      for (const email of invalidEmails) {
        expect(() => EmailSchema.parse(email)).toThrow()
      }
    })

    it('should reject too long emails', () => {
      const longEmail = 'a'.repeat(250) + '@example.com'
      expect(() => EmailSchema.parse(longEmail)).toThrow('Email too long')
    })
  })

  describe('Password Schema', () => {
    it('should validate strong passwords', () => {
      const validPasswords = [
        'Password123!',
        'MySecure@Pass1',
        'Complex$Pass9',
        'Test1234!@#$'
      ]

      for (const password of validPasswords) {
        expect(() => PasswordSchema.parse(password)).not.toThrow()
      }
    })

    it('should reject passwords without uppercase', () => {
      expect(() => PasswordSchema.parse('password123!')).toThrow('uppercase')
    })

    it('should reject passwords without lowercase', () => {
      expect(() => PasswordSchema.parse('PASSWORD123!')).toThrow('lowercase')
    })

    it('should reject passwords without numbers', () => {
      expect(() => PasswordSchema.parse('Password!@#')).toThrow('number')
    })

    it('should reject passwords without special characters', () => {
      expect(() => PasswordSchema.parse('Password123')).toThrow('special character')
    })

    it('should reject too short passwords', () => {
      expect(() => PasswordSchema.parse('Pass1!')).toThrow('at least 8 characters')
    })

    it('should reject too long passwords', () => {
      const longPassword = 'Password123!' + 'a'.repeat(120)
      expect(() => PasswordSchema.parse(longPassword)).toThrow('not exceed 128 characters')
    })
  })

  describe('Signup Input Schema', () => {
    it('should validate valid signup input', () => {
      const validInput = {
        email: 'user@example.com',
        password: 'Password123!',
        name: 'John Doe'
      }

      const result = SignupInputSchema.parse(validInput)
      expect(result.email).toBe(validInput.email)
      expect(result.name).toBe(validInput.name)
    })

    it('should reject missing required fields', () => {
      expect(() => SignupInputSchema.parse({})).toThrow()
      expect(() => SignupInputSchema.parse({ email: 'user@example.com' })).toThrow()
    })

    it('should reject invalid name', () => {
      const input = {
        email: 'user@example.com',
        password: 'Password123!',
        name: ''
      }
      expect(() => SignupInputSchema.parse(input)).toThrow('Name is required')
    })

    it('should reject too long name', () => {
      const input = {
        email: 'user@example.com',
        password: 'Password123!',
        name: 'a'.repeat(101)
      }
      expect(() => SignupInputSchema.parse(input)).toThrow('Name too long')
    })

    it('should validate optional birth data', () => {
      const validInput = {
        email: 'user@example.com',
        password: 'Password123!',
        name: 'John Doe',
        birthDate: '1990-01-01T00:00:00Z',
        birthTime: '12:30'
      }

      const result = SignupInputSchema.parse(validInput)
      expect(result.birthDate).toBe(validInput.birthDate)
      expect(result.birthTime).toBe(validInput.birthTime)
    })

    it('should reject invalid birthTime format', () => {
      const input = {
        email: 'user@example.com',
        password: 'Password123!',
        name: 'John Doe',
        birthTime: '25:00'
      }
      expect(() => SignupInputSchema.parse(input)).toThrow('Invalid time format')
    })
  })

  describe('Login Input Schema', () => {
    it('should validate valid login input', () => {
      const validInput = {
        email: 'user@example.com',
        password: 'password123',
        rememberMe: true
      }

      const result = LoginInputSchema.parse(validInput)
      expect(result.email).toBe(validInput.email)
      expect(result.rememberMe).toBe(true)
    })

    it('should default rememberMe to false', () => {
      const input = {
        email: 'user@example.com',
        password: 'password123'
      }

      const result = LoginInputSchema.parse(input)
      expect(result.rememberMe).toBe(false)
    })

    it('should reject empty password', () => {
      const input = {
        email: 'user@example.com',
        password: ''
      }
      expect(() => LoginInputSchema.parse(input)).toThrow('Password is required')
    })
  })

  describe('Location Schema', () => {
    it('should validate valid location', () => {
      const validLocation = {
        name: 'New York, USA',
        latitude: 40.7128,
        longitude: -74.0060,
        timezone: 'America/New_York'
      }

      const result = LocationSchema.parse(validLocation)
      expect(result.name).toBe(validLocation.name)
      expect(result.latitude).toBe(validLocation.latitude)
    })

    it('should reject invalid latitude', () => {
      const invalidLocation = {
        name: 'Invalid',
        latitude: 91,
        longitude: 0,
        timezone: 'UTC'
      }
      expect(() => LocationSchema.parse(invalidLocation)).toThrow()
    })

    it('should reject invalid longitude', () => {
      const invalidLocation = {
        name: 'Invalid',
        latitude: 0,
        longitude: 181,
        timezone: 'UTC'
      }
      expect(() => LocationSchema.parse(invalidLocation)).toThrow()
    })
  })

  describe('Chart Input Schema', () => {
    it('should validate valid chart input', () => {
      const validInput = {
        name: 'My Birth Chart',
        birthDate: '1990-01-01T00:00:00Z',
        birthTime: '12:30',
        location: {
          name: 'New York, USA',
          latitude: 40.7128,
          longitude: -74.0060,
          timezone: 'America/New_York'
        },
        type: 'natal'
      }

      const result = ChartInputSchema.parse(validInput)
      expect(result.name).toBe(validInput.name)
      expect(result.type).toBe('natal')
    })

    it('should validate chart types', () => {
      const validTypes = ['natal', 'transit', 'synastry', 'composite', 'progressed']

      for (const type of validTypes) {
        const input = {
          name: 'Chart',
          birthDate: '1990-01-01T00:00:00Z',
          birthTime: '12:30',
          location: {
            name: 'Test',
            latitude: 0,
            longitude: 0,
            timezone: 'UTC'
          },
          type
        }
        expect(() => ChartInputSchema.parse(input)).not.toThrow()
      }
    })

    it('should reject invalid chart type', () => {
      const input = {
        name: 'Chart',
        birthDate: '1990-01-01T00:00:00Z',
        birthTime: '12:30',
        location: {
          name: 'Test',
          latitude: 0,
          longitude: 0,
          timezone: 'UTC'
        },
        type: 'invalid'
      }
      expect(() => ChartInputSchema.parse(input)).toThrow()
    })
  })

  describe('Reading Input Schema', () => {
    it('should validate valid reading input', () => {
      const validInput = {
        type: 'birth_chart_analysis',
        chartId: '550e8400-e29b-41d4-a716-446655440000'
      }

      const result = ReadingInputSchema.parse(validInput)
      expect(result.type).toBe('birth_chart_analysis')
    })

    it('should validate optional questions', () => {
      const input = {
        type: 'birth_chart_analysis',
        chartId: '550e8400-e29b-41d4-a716-446655440000',
        questions: ['Question 1', 'Question 2']
      }

      const result = ReadingInputSchema.parse(input)
      expect(result.questions).toHaveLength(2)
    })

    it('should reject too many questions', () => {
      const input = {
        type: 'birth_chart_analysis',
        chartId: '550e8400-e29b-41d4-a716-446655440000',
        questions: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']
      }
      expect(() => ReadingInputSchema.parse(input)).toThrow()
    })
  })

  describe('Chat Input Schema', () => {
    it('should validate valid chat input', () => {
      const validInput = {
        message: 'Hello, this is a test message',
        conversationId: '550e8400-e29b-41d4-a716-446655440000'
      }

      const result = ChatInputSchema.parse(validInput)
      expect(result.message).toBe(validInput.message)
    })

    it('should reject empty message', () => {
      const input = { message: '' }
      expect(() => ChatInputSchema.parse(input)).toThrow('cannot be empty')
    })

    it('should reject too long message', () => {
      const input = { message: 'a'.repeat(4001) }
      expect(() => ChatInputSchema.parse(input)).toThrow('too long')
    })

    it('should validate context', () => {
      const input = {
        message: 'Hello',
        context: {
          chartId: '550e8400-e29b-41d4-a716-446655440000',
          readingId: '550e8400-e29b-41d4-a716-446655440001'
        }
      }

      const result = ChatInputSchema.parse(input)
      expect(result.context?.chartId).toBe(input.context.chartId)
    })
  })

  describe('Admin Schemas', () => {
    describe('Admin User Search Schema', () => {
      it('should validate with defaults', () => {
        const result = AdminUserSearchSchema.parse({})
        expect(result.status).toBe('all')
        expect(result.role).toBe('all')
        expect(result.page).toBe(1)
        expect(result.limit).toBe(20)
      })

      it('should validate custom values', () => {
        const input = {
          query: 'john',
          status: 'active',
          role: 'user',
          page: 2,
          limit: 50
        }

        const result = AdminUserSearchSchema.parse(input)
        expect(result.query).toBe('john')
        expect(result.status).toBe('active')
        expect(result.limit).toBe(50)
      })

      it('should reject invalid limit', () => {
        const input = { limit: 200 }
        expect(() => AdminUserSearchSchema.parse(input)).toThrow()
      })
    })

    describe('Admin User Update Schema', () => {
      it('should validate valid update', () => {
        const input = {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          status: 'suspended',
          role: 'moderator'
        }

        const result = AdminUserUpdateSchema.parse(input)
        expect(result.status).toBe('suspended')
        expect(result.role).toBe('moderator')
      })

      it('should validate partial update', () => {
        const input = {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          notes: 'Updated notes'
        }

        const result = AdminUserUpdateSchema.parse(input)
        expect(result.notes).toBe('Updated notes')
        expect(result.status).toBeUndefined()
      })
    })
  })

  describe('Validation Helpers', () => {
    describe('validateInput', () => {
      it('should return validated data', () => {
        const input = { email: 'test@example.com' }
        const result = validateInput(EmailSchema, input.email)
        expect(result).toBe('test@example.com')
      })

      it('should throw ValidationError on invalid input', () => {
        expect(() => validateInput(EmailSchema, 'invalid')).toThrow(ValidationError)
      })

      it('should include context in error message', () => {
        try {
          validateInput(EmailSchema, 'invalid', 'Email validation')
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError)
          expect(error.message).toContain('Email validation')
        }
      })
    })

    describe('validatePartial', () => {
      it('should validate partial data', () => {
        const input = { name: 'Updated Name' }
        const result = validatePartial(SignupInputSchema, input)
        expect(result.name).toBe('Updated Name')
      })

      it('should allow empty partial', () => {
        const result = validatePartial(SignupInputSchema, {})
        expect(Object.keys(result).length).toBe(0)
      })
    })

    describe('ValidationError', () => {
      it('should create error with details', () => {
        const errors = [{ path: ['email'], message: 'Invalid email' }]
        const error = new ValidationError('Validation failed', errors)

        expect(error.message).toBe('Validation failed')
        expect(error.errors).toEqual(errors)
        expect(error.statusCode).toBe(400)
        expect(error.name).toBe('ValidationError')
      })
    })

    describe('sanitizeString', () => {
      it('should remove angle brackets', () => {
        const input = 'Hello <script>alert("XSS")</script> World'
        const result = sanitizeString(input)
        expect(result).toBe('Hello scriptalert("XSS")/script World')
      })

      it('should trim whitespace', () => {
        const input = '  hello world  '
        const result = sanitizeString(input)
        expect(result).toBe('hello world')
      })

      it('should limit length', () => {
        const input = 'a'.repeat(20000)
        const result = sanitizeString(input)
        expect(result.length).toBe(10000)
      })

      it('should handle empty string', () => {
        const result = sanitizeString('')
        expect(result).toBe('')
      })
    })

    describe('validateQueryParams', () => {
      it('should validate and sanitize params', () => {
        const params = {
          search: 'hello',
          page: '1',
          malicious: '<script>alert(1)</script>'
        }

        const result = validateQueryParams(params)
        expect(result.search).toBe('hello')
        expect(result.page).toBe('1')
        expect(result.malicious).toBe('scriptalert(1)/script')
      })

      it('should filter invalid keys', () => {
        const params = {
          valid: 'value',
          'invalid-key': 'value',
          'another.invalid': 'value'
        }

        const result = validateQueryParams(params)
        expect(result.valid).toBe('value')
        expect(result['invalid-key']).toBeUndefined()
        expect(result['another.invalid']).toBeUndefined()
      })

      it('should skip null and undefined values', () => {
        const params = {
          valid: 'value',
          nullValue: null,
          undefinedValue: undefined
        }

        const result = validateQueryParams(params)
        expect(result.valid).toBe('value')
        expect(result.nullValue).toBeUndefined()
        expect(result.undefinedValue).toBeUndefined()
      })
    })
  })
})
