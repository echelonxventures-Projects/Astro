export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { Sparkles, Check, Calendar, CreditCard } from 'lucide-react'

export default async function SubscriptionPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscriptions: { orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  })

  if (!user) {
    redirect('/signup')
  }

  const isPremium = user.subscriptionStatus === 'premium'
  const currentSubscription = user.subscriptions.find((s) => s.status === 'active')

  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <span className="text-xl font-bold gradient-text">StarPath Astrology</span>
            </Link>
            <Link href="/dashboard" className="text-purple-200 hover:text-white transition">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 gradient-text">Subscription</h1>

          {/* Current Plan */}
          <div className="glass rounded-3xl p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  {isPremium ? 'Premium Plan' : 'Free Plan'}
                </h2>
                <p className="text-purple-200">
                  {isPremium
                    ? `Next billing date: ${currentSubscription?.currentPeriodEnd ? new Date(currentSubscription.currentPeriodEnd).toLocaleDateString() : 'N/A'}`
                    : 'Upgrade to unlock all features'}
                </p>
              </div>
              <div
                className={`px-4 py-2 rounded-full font-semibold ${
                  isPremium
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black'
                    : 'bg-purple-600/30 text-purple-200'
                }`}
              >
                {isPremium ? 'Active' : 'Free'}
              </div>
            </div>

            {isPremium ? (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-purple-400" />
                      <span className="text-purple-200">Plan Type</span>
                    </div>
                    <div className="font-semibold capitalize">
                      {user.subscriptionPlan || 'Premium'}
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="w-5 h-5 text-purple-400" />
                      <span className="text-purple-200">Status</span>
                    </div>
                    <div className="font-semibold capitalize">
                      {currentSubscription?.status || 'Active'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <form action="/api/stripe/portal" method="POST">
                    <button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-semibold transition"
                    >
                      Manage Subscription
                    </button>
                  </form>
                  {currentSubscription?.cancelAtPeriodEnd && (
                    <div className="text-orange-400 flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Your subscription will end on{' '}
                      {currentSubscription.currentPeriodEnd
                        ? new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()
                        : 'N/A'}
                    </div>
                  )}
                </div>

                {/* Premium Features */}
                <div className="mt-6 p-6 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 rounded-xl">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-400" />
                    Your Premium Features
                  </h3>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    {[
                      'Unlimited AI readings',
                      'Detailed birth chart analysis',
                      'Compatibility readings',
                      'Love & career horoscopes',
                      'Chat with AI astrologer',
                      'Transit forecasts',
                      'Priority support',
                      'Ad-free experience',
                    ].map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-purple-200 mb-6">
                  Upgrade to Premium to unlock unlimited AI readings, detailed birth chart
                  analysis, compatibility reports, and more.
                </p>
                <Link
                  href="/pricing"
                  className="inline-block bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-semibold transition"
                >
                  View Pricing Plans
                </Link>
              </div>
            )}
          </div>

          {/* Payment History */}
          {user.payments.length > 0 && (
            <div className="glass rounded-3xl p-8">
              <h2 className="text-2xl font-bold mb-6">Payment History</h2>
              <div className="space-y-3">
                {user.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-xl"
                  >
                    <div>
                      <div className="font-medium">
                        {payment.status === 'succeeded' ? 'Payment Successful' : payment.status}
                      </div>
                      <div className="text-sm text-purple-300">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="font-semibold">
                      ${(payment.amount / 100).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
