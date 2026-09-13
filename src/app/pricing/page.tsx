'use client'

import { Check, Sparkles, Star } from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { BrandLogo, BrandName } from '@/components/BrandProvider'
import { logger } from '@/lib/logger'
import { CURRENCY_CONFIG, formatPrice } from '@/lib/plans'

interface Plan {
  id: string
  name: string
  key: string
  description: string | null
  price: number
  currency: string
  interval: string | null
  isActive: boolean
  isPopular: boolean
  sortOrder: number
  features: string[]
  regionalPricing?: Record<string, { price: number; currency: string; displayPrice?: string }>
  featureAccess?: Array<{
    feature: { key: string; name: string }
    enabled: boolean
    value: string | null
  }>
}

interface Feature {
  id: string
  name: string
  key: string
  category: string | null
  sortOrder: number
  isActive: boolean
}

interface Region {
  id: string
  name: string
  key: string
  code: string
  currency: string
  isActive: boolean
  isDefault: boolean
  priceMultiplier: number
}

export default function PricingPage() {
  const { data: _session, status } = useSession()
  const [plans, setPlans] = useState<Plan[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [selectedRegion, setSelectedRegion] = useState<string>('us')
  const [_accessMatrix, setAccessMatrix] = useState<
    Record<string, Record<string, { enabled: boolean; value: string | null }>>
  >({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [plansRes, featuresRes, regionsRes] = await Promise.all([
        fetch('/api/plans'),
        fetch('/api/plans?type=features'),
        fetch('/api/plans?type=regions'),
      ])

      const [plansData, featuresData, regionsData] = await Promise.all([
        plansRes.json(),
        featuresRes.json(),
        regionsRes.json(),
      ])

      setPlans(plansData.plans || [])
      setFeatures(featuresData.features || [])
      setRegions(regionsData.regions || [])

      // Set default region
      const defaultRegion = regionsData.regions?.find((r: Region) => r.isDefault)
      if (defaultRegion) {
        setSelectedRegion(defaultRegion.key)
      }

      // Build feature access matrix from plans data
      // The API now includes featureAccess in each plan
      const matrix: Record<string, Record<string, { enabled: boolean; value: string | null }>> = {}
      for (const plan of plansData.plans || []) {
        matrix[plan.key] = {}
        for (const access of plan.featureAccess || []) {
          if (access?.feature?.key) {
            matrix[plan.key][access.feature.key] = {
              enabled: Boolean(access.enabled),
              value: access.value ?? null,
            }
          }
        }
      }
      setAccessMatrix(matrix)
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch pricing data')
    } finally {
      setLoading(false)
    }
  }

  const getPlanPrice = (plan: Plan) => {
    const region = regions.find(r => r.key === selectedRegion)
    if (!region) {
      return { price: plan.price, currency: plan.currency }
    }

    // Check if plan has regional pricing for this region
    if (plan.regionalPricing && plan.regionalPricing[selectedRegion]) {
      const regional = plan.regionalPricing[selectedRegion]
      return { price: regional.price, currency: regional.currency }
    }

    // Apply price multiplier as fallback
    if (region.priceMultiplier !== 1.0 && plan.price > 0) {
      const adjustedPrice = Math.round(plan.price * region.priceMultiplier)
      return { price: adjustedPrice, currency: region.currency }
    }

    return { price: plan.price, currency: plan.currency }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-purple-400 animate-pulse mx-auto mb-4" />
          <p className="text-purple-200">Loading pricing...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <BrandLogo className="w-8 h-8 text-[var(--primary-light)]" />
              <span className="text-xl font-bold gradient-text">
                <BrandName />
              </span>
            </Link>
            <div className="flex items-center gap-4">
              {status === 'authenticated' ? (
                <>
                  <Link href="/dashboard" className="text-purple-200 hover:text-white transition">
                    Dashboard
                  </Link>
                  <Link
                    href="/subscription"
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full transition"
                  >
                    My Subscription
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-purple-200 hover:text-white transition">
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full transition"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/30 rounded-full mb-4">
              <Star className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-medium">Pricing Plans</span>
            </div>
            <h1 className="text-5xl font-bold mb-4 gradient-text">Choose Your Cosmic Path</h1>
            <p className="text-xl text-purple-200 max-w-2xl mx-auto mb-6">
              Start with free readings, or unlock unlimited access to all astrology features
            </p>

            {/* Region Selector */}
            {regions.length > 0 && (
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-purple-600/20 rounded-xl border border-purple-500/30">
                <span className="text-purple-200 text-sm">Region:</span>
                <select
                  data-testid="region-select"
                  value={selectedRegion}
                  onChange={e => setSelectedRegion(e.target.value)}
                  className="bg-purple-600/30 border border-purple-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {regions.map(region => (
                    <option key={region.id} value={region.key}>
                      {region.name} (
                      {CURRENCY_CONFIG[region.currency]?.symbol || region.currency.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map(plan => {
              const { price, currency } = getPlanPrice(plan)
              const formattedPrice = formatPrice(price, currency)
              const isPopular = plan.isPopular
              const isFree = plan.price === 0

              return (
                <div
                  key={plan.id}
                  data-testid="plan-card"
                  className={`glass rounded-3xl p-8 ${
                    isPopular
                      ? 'border-2 border-purple-500 relative'
                      : 'border border-purple-500/20'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-purple-600 rounded-full text-sm font-semibold">
                      Most Popular
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <div className="text-4xl font-bold mb-2">
                      {isFree ? 'Free' : formattedPrice}
                    </div>
                    <p className="text-purple-300">
                      {plan.interval === 'monthly' && 'per month'}
                      {plan.interval === 'yearly' && 'per year (save 17%)'}
                      {!plan.interval && 'Forever'}
                    </p>
                  </div>

                  <ul className="space-y-4 mb-8">
                    {plan.features.map(feature => (
                      <li key={feature} className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-purple-400 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {status === 'authenticated' ? (
                    plan.price === 0 ? (
                      <Link
                        href="/dashboard"
                        className="block w-full text-center bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-semibold transition"
                      >
                        Go to Dashboard
                      </Link>
                    ) : (
                      <form action="/api/stripe/checkout" method="POST">
                        <input type="hidden" name="plan" value={plan.key} />
                        <button
                          type="submit"
                          data-testid="plan-cta"
                          className={`w-full py-3 rounded-xl font-semibold transition ${
                            isPopular
                              ? 'bg-purple-600 hover:bg-purple-500 text-white pulse-glow'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          Subscribe{' '}
                          {plan.interval === 'monthly'
                            ? 'Monthly'
                            : plan.interval === 'yearly'
                              ? 'Yearly'
                              : ''}
                        </button>
                      </form>
                    )
                  ) : (
                    <Link
                      href="/signup"
                      data-testid="plan-cta"
                      className={`block w-full text-center py-3 rounded-xl font-semibold transition ${
                        isPopular
                          ? 'bg-purple-600 hover:bg-purple-500 text-white pulse-glow'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      {isFree ? 'Get Started' : 'Start Free Trial'}
                    </Link>
                  )}
                </div>
              )
            })}
          </div>

          {/* Features Comparison */}
          <div className="mt-16 glass rounded-3xl p-8">
            <h2 className="text-3xl font-bold text-center mb-8 gradient-text">Compare Features</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-purple-500/20">
                    <th className="text-left py-4 px-4">Feature</th>
                    {plans.map(plan => (
                      <th
                        key={plan.id}
                        className={`text-center py-4 px-4 ${
                          plan.isPopular ? 'bg-purple-600/20 rounded-t-xl' : ''
                        }`}
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.map(feature => (
                    <tr key={feature.id} className="border-b border-purple-500/10">
                      <td className="py-4 px-4">{feature.name}</td>
                      {plans.map(plan => {
                        const access = plan.featureAccess?.find(
                          fa => fa.feature.key === feature.key
                        )
                        const hasAccess = access?.enabled
                        const value = access?.value

                        return (
                          <td
                            key={plan.id}
                            className={`text-center py-4 px-4 ${
                              plan.isPopular ? 'bg-purple-600/10' : ''
                            }`}
                          >
                            {hasAccess ? (
                              <span className="text-green-400 font-medium">
                                {value || <Check className="w-5 h-5 mx-auto" />}
                              </span>
                            ) : (
                              <span className="text-purple-400">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-16 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8 gradient-text">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {[
                {
                  q: 'Can I cancel my subscription anytime?',
                  a: 'Yes, you can cancel your subscription at any time from your account settings. Your premium access will continue until the end of your billing period.',
                },
                {
                  q: 'What payment methods do you accept?',
                  a: 'We accept all major credit cards, debit cards, and digital wallets through our secure Stripe payment processor.',
                },
                {
                  q: 'Is there a free trial?',
                  a: 'Yes! All new users get free access to basic features including daily horoscopes and a basic birth chart. Premium features require a subscription.',
                },
                {
                  q: 'How accurate are the readings?',
                  a: 'Our AI uses established astrological calculations combined with advanced language models. While astrology is not a science, many users find our readings insightful and accurate.',
                },
              ].map((faq, i) => (
                <div key={i} className="glass rounded-2xl p-6">
                  <h3 className="font-semibold mb-2">{faq.q}</h3>
                  <p className="text-purple-200">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-purple-500/20 mt-16">
        <div className="max-w-7xl mx-auto text-center text-purple-400">
          <p>
            © {new Date().getFullYear()} <BrandName />. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  )
}
