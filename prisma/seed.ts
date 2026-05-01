import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { initializeDefaultPlans } from '../src/lib/plans'

const prisma = new PrismaClient()

async function main() {
  // Create a test admin user
  const password = 'admin123'
  const passwordHash = await bcrypt.hash(password, 12)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@localhost' },
    update: {
      passwordHash,
      name: 'Admin User',
      emailVerified: new Date(),
      role: 'admin',
    },
    create: {
      email: 'admin@localhost',
      passwordHash,
      name: 'Admin User',
      emailVerified: new Date(),
      role: 'admin',
    },
  })

  console.log('Created/updated admin user:', adminUser.email, '(role:', adminUser.role + ')')
  console.log('Password: admin123')

  // Create default app settings
  const defaultSettings = [
    { key: 'AI_PROVIDER', value: 'ollama', description: 'AI provider: anthropic, ollama, or gemini' },
    { key: 'OLLAMA_URL', value: 'http://localhost:5566', description: 'Ollama server URL' },
    { key: 'AI_MODEL', value: 'llama3.2', description: 'Model name to use' },
    { key: 'ANTHROPIC_API_KEY', value: '', description: 'Anthropic API key (required if using Anthropic)' },
    { key: 'GEMINI_API_KEY', value: '', description: 'Google Gemini API key (required if using Gemini)' },
  ]

  for (const setting of defaultSettings) {
    await prisma.appSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    })
  }

  console.log('Created default app settings')

  // Create AI provider configs for each subscription plan
  const aiConfigs = [
    {
      id: 'free',
      name: 'Free Plan AI',
      plan: 'free',
      provider: 'ollama',
      model: 'llama3.2',
      ollamaUrl: 'http://localhost:5566',
      maxTokens: 512,
      enabled: true,
      isDefault: true,
      description: 'Free tier - Uses local Ollama with llama3.2',
    },
    {
      id: 'monthly',
      name: 'Premium Monthly AI',
      plan: 'monthly',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 2048,
      enabled: true,
      isDefault: false,
      description: 'Premium Monthly - Uses Claude Sonnet',
    },
    {
      id: 'yearly',
      name: 'Premium Yearly AI',
      plan: 'yearly',
      provider: 'anthropic',
      model: 'claude-opus-4-20250514',
      maxTokens: 4096,
      enabled: true,
      isDefault: false,
      description: 'Premium Yearly - Uses Claude Opus (most powerful)',
    },
  ]

  for (const config of aiConfigs) {
    await prisma.aIProviderConfig.upsert({
      where: { id: config.id },
      update: config,
      create: config,
    })
    console.log(`Created AI config for: ${config.plan}`)
  }

  // Initialize default subscription plans and features
  await initializeDefaultPlans()
  console.log('Created default subscription plans and features')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
