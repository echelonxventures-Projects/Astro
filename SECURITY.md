<!--
  HISTORY NOTE (documentation consolidation): this file describes an earlier
  implementation phase (pre multi-tenancy / pre PostgreSQL migration).
  Canonical current docs: README.md, PROJECT_DOCUMENTATION.md, docs/MULTI_TENANCY.md.
-->

# Security Documentation - StarPath Astrology

## Security Measures Implemented

### 1. Authentication & Authorization

#### Admin Page Protection

- **Server-Side Authentication**: All admin routes now use server components that check authentication before rendering
- **Role-Based Access Control (RBAC)**: Admin pages require `user.role === 'admin'`
- **Protected Routes**:
  - `/admin/plans` - Subscription plan management
  - `/settings` - AI and system settings

#### Implementation Pattern

```typescript
// Server-side check in page.tsx
const session = await auth()
if (!session?.user) redirect('/login')

const user = await prisma.user.findUnique({ where: { id: session.user.id } })
if (user?.role !== 'admin') redirect('/dashboard?error=Admin access required')
```

#### API Route Protection

All admin API endpoints include server-side validation:

```typescript
async function checkAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (user?.role !== 'admin') throw new Error('Admin access required')

  return session
}
```

**Protected API Endpoints:**

- `GET/POST /api/admin/plans` - Plan management
- `GET/POST /api/settings` - System settings
- `GET/POST /api/settings/plans` - AI plan configuration

### 2. Payment Security

#### API Key Encryption

- Sensitive data (API keys, secrets) encrypted before database storage
- Uses XOR encryption with configurable `ENCRYPTION_KEY` environment variable
- **Recommendation**: Use AWS KMS or HashiCorp Vault in production

```typescript
// src/lib/payment/gateway-registry.ts
export async function encryptSensitiveData(data: string): Promise<string> {
  const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production'
  // XOR encryption
}
```

#### Webhook Security

- **Stripe**: Signature verification using `stripe.webhooks.constructEvent()`
- **Razorpay**: HMAC SHA256 signature verification
- All webhook endpoints validate signatures before processing

```typescript
// Stripe webhook verification
const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)

// Razorpay webhook verification
const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex')
```

#### Payment Gateway Isolation

- Each gateway (Stripe, Razorpay, PayPal) implemented separately
- Gateway instances loaded dynamically from database configuration
- Failed gateway validation returns null, preventing unauthorized access

### 3. Database Security

#### SQLite Configuration

- Database file stored outside public web root
- File permissions should restrict access to application user only
- **Recommendation**: Use parameterized queries (Prisma ORM provides this by default)

#### Schema Security

- User passwords hashed with bcrypt before storage
- Session tokens use NextAuth's secure cookie handling
- Sensitive fields (API keys) stored encrypted

### 4. Session Security

#### NextAuth Configuration

```typescript
// src/lib/auth.ts
cookies: {
  sessionToken: {
    name: 'next-auth.session-token',
    options: {
      httpOnly: true,
      secure: true, // HTTPS only
      sameSite: 'lax',
      path: '/',
      domain: 'astro.echelonxventures.org'
    }
  }
}
```

**Security Features:**

- HTTP-only cookies (prevents XSS token theft)
- Secure flag (HTTPS only)
- SameSite protection (CSRF mitigation)
- Configurable domain scoping

### 5. Input Validation

#### API Route Validation

- All POST endpoints validate required fields
- Type checking with TypeScript
- JSON parsing with error handling

```typescript
const { action, subscriptionId, gateway } = body
if (!subscriptionId || !gateway) {
  return NextResponse.json({ error: 'Subscription ID and gateway required' }, { status: 400 })
}
```

### 6. Security Checklist for Deployment

#### Environment Variables (Required)

```bash
# Authentication
NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"
NEXTAUTH_URL="https://astro.echelonxventures.org"

# Encryption
ENCRYPTION_KEY="<random-32-character-string>"

# Payment Gateways
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
RAZORPAY_KEY_ID="rzp_live_..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_WEBHOOK_SECRET="..."

# AI Provider
OPENROUTER_API_KEY="..."

# OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

#### Generate Secure Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_KEY
openssl rand -base64 32
```

#### Server Hardening

1. **SSH Security**:
   - Use SSH keys only (disable password auth)
   - Change default SSH port
   - Use fail2ban

2. **Firewall Rules**:

   ```bash
   # Allow only necessary ports
   sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT  # SSH
   sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT # App
   sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
   sudo iptables -A INPUT -j DROP
   ```

3. **File Permissions**:

   ```bash
   # Restrict database access
   chmod 600 prisma/prod.db
   chown opc:opc prisma/prod.db

   # Restrict .env access
   chmod 600 .env.production
   ```

4. **HTTPS/SSL**:
   - Use Cloudflare SSL proxy (recommended)
   - Or install Let's Encrypt certificate
   - Force HTTPS redirects

#### Database User Setup

```bash
# Set first user as admin (run after deployment)
sqlite3 prisma/prod.db

UPDATE "User" SET role = 'admin' WHERE email = 'your-email@example.com';

# Verify
SELECT email, role FROM "User";
```

### 7. Security Best Practices

#### DO's

- ✅ Always use environment variables for secrets
- ✅ Enable HTTPS in production
- ✅ Rotate API keys regularly
- ✅ Monitor webhook logs for anomalies
- ✅ Keep dependencies updated
- ✅ Use strong, unique passwords
- ✅ Enable rate limiting on API endpoints
- ✅ Backup database regularly

#### DON'Ts

- ❌ Never commit `.env` files to git
- ❌ Never expose API keys in client-side code
- ❌ Never disable CSRF protection
- ❌ Never store raw credit card data
- ❌ Never use HTTP in production
- ❌ Never share database credentials
- ❌ Never skip webhook signature verification

### 8. Monitoring & Logging

#### What to Monitor

- Failed login attempts
- Admin access patterns
- Payment webhook failures
- API rate limit violations
- Database errors

#### PM2 Log Management

```bash
# View logs
pm2 logs starpath-astrology

# Real-time monitoring
pm2 monit

# Log rotation (add to ecosystem.config.js)
max_size: "10M",
max_files: 10,
```

### 9. Incident Response

#### If Compromised

1. Rotate all API keys immediately
2. Change all user passwords
3. Review admin user list
4. Check payment transaction logs
5. Review server access logs
6. Update all secrets in environment

#### Contact Information

- Document your security contact procedure
- Have incident response plan ready

### 10. Compliance Considerations

#### GDPR (if serving EU users)

- Implement data export functionality
- Add right to be forgotten
- Document data processing activities
- Add cookie consent banner

#### PCI-DSS (for payment processing)

- Never store raw card data (use Stripe/Razorpay tokens)
- Use HTTPS everywhere
- Regular security assessments
- Maintain secure network

#### CCPA (if serving California users)

- Add "Do Not Sell My Info" option
- Disclose data collection practices
- Honor deletion requests

### 11. Security Testing

#### Recommended Tests

1. **Penetration Testing**: Hire security professionals annually
2. **Dependency Scanning**: `npm audit` regularly
3. **Code Review**: Security-focused code reviews
4. **Vulnerability Scanning**: Use tools like Snyk, Dependabot

#### Automated Scanning

```bash
# Check for vulnerable dependencies
npm audit

# Check for known vulnerabilities in Docker images (if using)
docker scout cve <image>
```

### 12. Future Security Enhancements

#### Recommended Additions

1. **Rate Limiting**: Implement using `next-rate-limiter`
2. **CSP Headers**: Add Content-Security-Policy headers
3. **2FA**: Add two-factor authentication for admin users
4. **Audit Logging**: Log all admin actions
5. **Session Management**: Add session timeout, concurrent session limits
6. **Input Sanitization**: Add XSS protection library
7. **Security Headers**: Add helmet.js for security headers

---

## Document Version

- **Last Updated**: 2026-04-15
- **Version**: 1.0
- **Author**: Development Team
