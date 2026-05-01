// Social Auth Providers Configuration
// Add credentials for each social provider in .env

export const SOCIAL_PROVIDERS = [
  {
    name: 'Google',
    key: 'google',
    icon: 'google',
    color: '#4285F4',
    requiredEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    callbackUrl: '/api/auth/callback/google',
  },
  {
    name: 'Facebook',
    key: 'facebook',
    icon: 'facebook',
    color: '#1877F2',
    requiredEnvVars: ['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET'],
    callbackUrl: '/api/auth/callback/facebook',
    setupUrl: 'https://developers.facebook.com/apps/',
  },
  {
    name: 'Apple',
    key: 'apple',
    icon: 'apple',
    color: '#000000',
    requiredEnvVars: ['APPLE_CLIENT_ID', 'APPLE_CLIENT_SECRET'],
    callbackUrl: '/api/auth/callback/apple',
    setupUrl: 'https://developer.apple.com/',
  },
  {
    name: 'GitHub',
    key: 'github',
    icon: 'github',
    color: '#333',
    requiredEnvVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
    callbackUrl: '/api/auth/callback/github',
    setupUrl: 'https://github.com/settings/developers',
  },
  {
    name: 'Discord',
    key: 'discord',
    icon: 'discord',
    color: '#5865F2',
    requiredEnvVars: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'],
    callbackUrl: '/api/auth/callback/discord',
    setupUrl: 'https://discord.com/developers/applications',
  },
  {
    name: 'Twitter/X',
    key: 'twitter',
    icon: 'twitter',
    color: '#1DA1F2',
    requiredEnvVars: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'],
    callbackUrl: '/api/auth/callback/twitter',
    setupUrl: 'https://developer.twitter.com/',
  },
] as const

export type SocialProviderKey = typeof SOCIAL_PROVIDERS[number]['key']

/**
 * Check if a social provider is configured
 */
export function isProviderConfigured(providerKey: SocialProviderKey): boolean {
  const provider = SOCIAL_PROVIDERS.find(p => p.key === providerKey)
  if (!provider) return false

  return provider.requiredEnvVars.every(envVar => {
    const value = process.env[envVar]
    return value && value.length > 0
  })
}

/**
 * Get all configured social providers
 */
export function getConfiguredProviders() {
  return SOCIAL_PROVIDERS.filter(p => isProviderConfigured(p.key))
}

/**
 * Get provider setup instructions
 */
export function getProviderSetupInstructions(providerKey: SocialProviderKey): string {
  const provider = SOCIAL_PROVIDERS.find(p => p.key === providerKey)
  if (!provider) return 'Provider not found'

  const setupUrl = (provider as any).setupUrl || 'https://console.cloud.google.com/apis/credentials'

  return `
To configure ${provider.name}:

1. Go to ${setupUrl}
2. Create a new OAuth application
3. Add the callback URL: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${provider.callbackUrl}
4. Copy the Client ID and Client Secret
5. Add to your .env file:
   ${provider.requiredEnvVars[0]}="your-client-id"
   ${provider.requiredEnvVars[1]}="your-client-secret"
`
}