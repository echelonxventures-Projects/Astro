export const dynamic = 'force-dynamic'

import {
  Star,
  Heart,
  Briefcase,
  MessageCircle,
  Sparkles,
  Calendar,
  Clock,
  MapPin,
} from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BrandName } from '@/components/BrandProvider'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getScopedDb } from '@/lib/tenant'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      birthCharts: { orderBy: { createdAt: 'desc' }, take: 3 },
      readings: { orderBy: { createdAt: 'desc' }, take: 5 },
      chatSessions: { orderBy: { lastActiveAt: 'desc' }, take: 3 },
    },
  })

  if (!user) {
    redirect('/signup')
  }

  const db = getScopedDb(user.tenantId)
  const activePlans = await db.subscriptionPlan.findMany({ where: { isActive: true } })
  const currentPlan =
    activePlans.find(p => p.key === user.subscriptionPlan && p.tier !== 'free') ??
    activePlans.find(p => p.tier !== 'free') ??
    null

  const hasChart = user.birthCharts.length > 0

  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <span className="text-xl font-bold gradient-text">
                <BrandName />
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-purple-200 hover:text-white transition">
                Dashboard
              </Link>
              <Link href="/chart" className="text-purple-200 hover:text-white transition">
                Birth Chart
              </Link>
              <Link href="/horoscope/daily" className="text-purple-200 hover:text-white transition">
                Horoscopes
              </Link>
              <Link href="/compatibility" className="text-purple-200 hover:text-white transition">
                Compatibility
              </Link>
              <Link href="/chat/horoscope" className="text-purple-200 hover:text-white transition">
                AI Chat
              </Link>
              <Link href="/palmistry" className="text-purple-200 hover:text-white transition">
                Palmistry
              </Link>
              <Link href="/face-reading" className="text-purple-200 hover:text-white transition">
                Face Reading
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSwitcher compact />
              {(user.role === 'admin' || user.role === 'superadmin') && (
                <>
                  <Link href="/settings" className="text-purple-300 hover:text-white transition">
                    Settings
                  </Link>
                  <Link
                    href="/admin/branding"
                    className="text-purple-300 hover:text-white transition"
                  >
                    Branding
                  </Link>
                  <Link
                    href="/admin/localization"
                    className="text-purple-300 hover:text-white transition"
                  >
                    Localization
                  </Link>
                </>
              )}
              {user.role === 'superadmin' && (
                <Link href="/admin/tenants" className="text-purple-300 hover:text-white transition">
                  Tenants
                </Link>
              )}
              <Link
                href="/subscription"
                className={`px-4 py-2 rounded-full transition ${
                  user.subscriptionStatus === 'premium'
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-semibold'
                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                }`}
              >
                {user.subscriptionStatus === 'premium'
                  ? (currentPlan?.name ?? 'Premium')
                  : 'Upgrade'}
              </Link>
              <Link href="/profile" className="text-purple-200 hover:text-white transition">
                {user.name || 'Profile'}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-2 gradient-text">
              Welcome back, {user.name || 'Seeker'}
            </h1>
            <p className="text-purple-200">The stars have insights for you today</p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-12">
            <Link
              href="/horoscope/daily"
              className="glass p-4 rounded-xl text-center card-hover group"
            >
              <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <span className="text-sm font-medium group-hover:text-purple-300">Daily Reading</span>
            </Link>
            <Link href="/chart" className="glass p-4 rounded-xl text-center card-hover group">
              <Star className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
              <span className="text-sm font-medium group-hover:text-purple-300">Birth Chart</span>
            </Link>
            <Link
              href="/horoscope/love"
              className="glass p-4 rounded-xl text-center card-hover group"
            >
              <Heart className="w-8 h-8 text-pink-400 mx-auto mb-2" />
              <span className="text-sm font-medium group-hover:text-purple-300">Love</span>
            </Link>
            <Link
              href="/chat/horoscope"
              className="glass p-4 rounded-xl text-center card-hover group"
            >
              <MessageCircle className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <span className="text-sm font-medium group-hover:text-purple-300">AI Chat</span>
            </Link>
            <Link href="/palmistry" className="glass p-4 rounded-xl text-center card-hover group">
              <svg
                className="w-8 h-8 text-amber-400 mx-auto mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
                />
              </svg>
              <span className="text-sm font-medium group-hover:text-purple-300">Palmistry</span>
            </Link>
            <Link
              href="/face-reading"
              className="glass p-4 rounded-xl text-center card-hover group"
            >
              <svg
                className="w-8 h-8 text-violet-400 mx-auto mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span className="text-sm font-medium group-hover:text-purple-300">Face Reading</span>
            </Link>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Birth Charts */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Your Birth Charts</h2>
                <Link href="/chart" className="text-purple-400 hover:text-purple-300 text-sm">
                  Create New →
                </Link>
              </div>
              {hasChart ? (
                <div className="space-y-3">
                  {user.birthCharts.map(chart => (
                    <Link
                      key={chart.id}
                      href={`/chart/${chart.id}`}
                      className="block p-4 bg-white/5 rounded-xl hover:bg-white/10 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{chart.name}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-purple-300">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(chart.birthDate).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {chart.birthTime}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-sm text-purple-300">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {chart.birthPlace}
                          </div>
                          <div className="text-purple-400">
                            {(chart as any).ascendant?.sign || 'Check your chart'} Rising
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Star className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                  <p className="text-purple-300 mb-4">
                    Create your birth chart to unlock personalized readings
                  </p>
                  <Link
                    href="/chart"
                    className="inline-block bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-full transition"
                  >
                    Create Birth Chart
                  </Link>
                </div>
              )}
            </div>

            {/* Recent Readings */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Recent Readings</h2>
                <Link
                  href="/horoscope/daily"
                  className="text-purple-400 hover:text-purple-300 text-sm"
                >
                  View All →
                </Link>
              </div>
              {user.readings.length > 0 ? (
                <div className="space-y-3">
                  {user.readings.map(reading => (
                    <div key={reading.id} className="p-4 bg-white/5 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        {reading.type === 'daily' && (
                          <Sparkles className="w-4 h-4 text-purple-400" />
                        )}
                        {reading.type === 'love' && <Heart className="w-4 h-4 text-pink-400" />}
                        {reading.type === 'career' && (
                          <Briefcase className="w-4 h-4 text-indigo-400" />
                        )}
                        <span className="text-sm font-medium capitalize">{reading.type}</span>
                        <span className="text-xs text-purple-400">
                          {new Date(reading.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-purple-200 line-clamp-2">{reading.title}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                  <p className="text-purple-300">No readings yet</p>
                  <Link
                    href="/horoscope/daily"
                    className="inline-block mt-4 bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-full transition"
                  >
                    Get Your First Reading
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Premium Upsell */}
          {user.subscriptionStatus !== 'premium' && (
            <div className="mt-8 glass rounded-2xl p-8 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border border-purple-500/30">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2 gradient-text">Unlock Premium Features</h2>
                <p className="text-purple-200 mb-6 max-w-2xl mx-auto">
                  Get unlimited AI readings, detailed compatibility reports, priority chat access,
                  and more.
                </p>
                <Link
                  href="/pricing"
                  className="inline-block bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-full font-semibold transition pulse-glow"
                >
                  View Pricing Plans
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
