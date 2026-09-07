export const dynamic = 'force-dynamic'

import {
  Star,
  Heart,
  Briefcase,
  MessageCircle,
  Sparkles,
  Users,
  ArrowRight,
  Hand,
  Eye,
} from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-[#A78BFA]" />
              <span className="text-xl font-bold gradient-text">StarPath Astrology</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/chart" className="text-gray-300 hover:text-white transition">
                Birth Chart
              </Link>
              <Link href="/horoscope/daily" className="text-gray-300 hover:text-white transition">
                Horoscopes
              </Link>
              <Link href="/compatibility" className="text-gray-300 hover:text-white transition">
                Compatibility
              </Link>
              <Link href="/chat/horoscope" className="text-gray-300 hover:text-white transition">
                AI Chat
              </Link>
              <Link href="/palmistry" className="text-gray-300 hover:text-white transition">
                Palmistry
              </Link>
              <Link href="/face-reading" className="text-gray-300 hover:text-white transition">
                Face Reading
              </Link>
              <Link href="/pricing" className="text-gray-300 hover:text-white transition">
                Pricing
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-gray-300 hover:text-white transition">
                Login
              </Link>
              <Link
                href="/signup"
                className="bg-[#7C3AED] hover:bg-[#5B21B6] text-white px-4 py-2 rounded-full transition pulse-glow"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center float pulse-glow">
                <Star className="w-16 h-16 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 yellow-400 twinkle">
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="gradient-text">Navigate Your Cosmic Journey</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-10">
            Discover personalized astrology readings, birth charts, and celestial guidance powered
            by advanced AI. Your trusted guide to cosmic wisdom.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-[#7C3AED] hover:bg-[#5B21B6] text-white px-8 py-4 rounded-full text-lg font-semibold transition flex items-center justify-center gap-2 pulse-glow"
            >
              Get Your Free Reading <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/chart"
              className="glass hover:bg-[#7C3AED]/30 text-white px-8 py-4 rounded-full text-lg font-semibold transition flex items-center justify-center gap-2"
            >
              Create Birth Chart
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-[#1A1025]/50 to-transparent">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4 gradient-text">
            Explore Your Cosmic Blueprint
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Discover what the stars have aligned for you with our comprehensive astrology services
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Birth Chart */}
            <Link href="/chart" className="glass p-6 rounded-2xl card-hover group">
              <div className="w-14 h-14 rounded-xl bg-[#7C3AED]/30 flex items-center justify-center mb-4">
                <Star className="w-8 h-8 text-[#A78BFA]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-[#C4B5FD] transition">
                Birth Chart Analysis
              </h3>
              <p className="text-gray-300">
                Discover your planetary positions, houses, and aspects. Understand your core
                personality and life path.
              </p>
            </Link>

            {/* Daily Horoscope */}
            <Link href="/horoscope/daily" className="glass p-6 rounded-2xl card-hover group">
              <div className="w-14 h-14 rounded-xl bg-[#7C3AED]/30 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-[#A78BFA]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-[#C4B5FD] transition">
                Daily Horoscope
              </h3>
              <p className="text-gray-300">
                AI-powered daily readings based on current transits and your unique birth chart.
              </p>
            </Link>

            {/* Love Horoscope */}
            <Link href="/horoscope/love" className="glass p-6 rounded-2xl card-hover group">
              <div className="w-14 h-14 rounded-xl bg-[#EC4899]/30 flex items-center justify-center mb-4">
                <Heart className="w-8 h-8 text-[#EC4899]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-[#F472B6] transition">
                Love & Relationships
              </h3>
              <p className="text-gray-300">
                Explore your romantic compatibility and discover what the stars say about your love
                life.
              </p>
            </Link>

            {/* Career Horoscope */}
            <Link href="/horoscope/career" className="glass p-6 rounded-2xl card-hover group">
              <div className="w-14 h-14 rounded-xl bg-[#06B6D4]/30 flex items-center justify-center mb-4">
                <Briefcase className="w-8 h-8 text-[#06B6D4]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-[#22D3EE] transition">
                Career Guidance
              </h3>
              <p className="text-gray-300">
                Find your professional strengths and ideal career paths through astrological
                insights.
              </p>
            </Link>

            {/* Compatibility */}
            <Link href="/compatibility" className="glass p-6 rounded-2xl card-hover group">
              <div className="w-14 h-14 rounded-xl bg-[#EC4899]/30 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-[#EC4899]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-[#F472B6] transition">
                Compatibility Reading
              </h3>
              <p className="text-gray-300">
                Compare birth charts with your partner to understand your cosmic connection.
              </p>
            </Link>

            {/* AI Chat */}
            <Link href="/chat/horoscope" className="glass p-6 rounded-2xl card-hover group">
              <div className="w-14 h-14 rounded-xl bg-[#06B6D4]/30 flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-[#06B6D4]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-[#22D3EE] transition">
                AI Astrologer Chat
              </h3>
              <p className="text-gray-300">
                Have a conversation with our AI astrologer for personalized guidance on any topic.
              </p>
            </Link>

            {/* Palmistry */}
            <Link href="/palmistry" className="glass p-6 rounded-2xl card-hover group">
              <div className="w-14 h-14 rounded-xl bg-[#F59E0B]/30 flex items-center justify-center mb-4">
                <Hand className="w-8 h-8 text-[#F59E0B]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-[#FBBF24] transition">
                Palm Reading
              </h3>
              <p className="text-gray-300">
                Upload your palm photo for AI analysis of life lines, heart line, and destiny
                insights.
              </p>
            </Link>

            {/* Face Reading */}
            <Link href="/face-reading" className="glass p-6 rounded-2xl card-hover group">
              <div className="w-14 h-14 rounded-xl bg-[#7C3AED]/30 flex items-center justify-center mb-4">
                <Eye className="w-8 h-8 text-[#A78BFA]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-[#C4B5FD] transition">
                Face Reading
              </h3>
              <p className="text-gray-300">
                Discover personality traits and destiny through ancient Chinese physiognomy and AI
                analysis.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4 gradient-text">How It Works</h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Get started with your personalized astrology reading in three simple steps
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#7C3AED] flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Create Your Profile</h3>
              <p className="text-gray-400">
                Sign up and enter your birth details - date, time, and location.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#7C3AED] flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Your Birth Chart</h3>
              <p className="text-gray-400">
                We calculate your planetary positions and generate your cosmic blueprint.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#7C3AED] flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Receive Insights</h3>
              <p className="text-gray-400">
                Our AI generates personalized readings based on your unique chart.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-[#7C3AED]/30 to-[#5B21B6]/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6 gradient-text">
            Ready to Navigate Your Cosmic Journey?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of seekers who trust StarPath Astrology for their daily cosmic guidance.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#7C3AED] hover:bg-[#5B21B6] text-white px-8 py-4 rounded-full text-lg font-semibold transition pulse-glow"
          >
            Start Your Free Journey <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-[#7C3AED]/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#A78BFA]" />
              <span className="font-bold gradient-text">StarPath Astrology</span>
            </Link>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-gray-400 hover:text-white transition">
                Privacy
              </Link>
              <Link href="/terms" className="text-gray-400 hover:text-white transition">
                Terms
              </Link>
              <Link href="/pricing" className="text-gray-400 hover:text-white transition">
                Pricing
              </Link>
            </div>
            <p className="text-purple-400 text-sm">
              © {new Date().getFullYear()} StarPath Astrology. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}
