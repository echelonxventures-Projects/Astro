import { Search, Home, Star, Sparkles, Compass, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { BrandName } from '@/components/BrandProvider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata = {
  title: '404 - Page Not Found',
  description: 'The page you are looking for could not be found. Explore our astrology services.',
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-[#0F0A1F] via-[#1A1025] to-[#0F0A1F]">
      <Card className="w-full max-w-2xl glass border-purple-500/30">
        <CardHeader className="text-center pb-2">
          {/* Cosmic 404 Illustration */}
          <div className="relative mx-auto mb-6 w-32 h-32">
            {/* Outer ring */}
            <div
              className="absolute inset-0 rounded-full border-2 border-dashed border-purple-500/30 animate-spin"
              style={{ animationDuration: '20s' }}
            />
            {/* Middle ring */}
            <div className="absolute inset-4 rounded-full border border-[#A78BFA]/40" />
            {/* Inner content */}
            <div className="absolute inset-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] flex items-center justify-center pulse-glow">
              <span className="text-4xl font-bold text-white">404</span>
            </div>
            {/* Floating stars */}
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 twinkle" />
            <Star
              className="absolute -bottom-1 -left-1 w-5 h-5 text-[#C4B5FD] twinkle"
              style={{ animationDelay: '0.5s' }}
            />
            <Compass
              className="absolute top-1/2 -right-4 w-5 h-5 text-[#A78BFA] twinkle"
              style={{ animationDelay: '1s' }}
            />
          </div>

          <CardTitle className="text-3xl font-bold gradient-text-purple">
            Lost in the Cosmos
          </CardTitle>
          <CardDescription className="text-gray-400 mt-2 text-lg">
            The stars couldn&apos;t find the page you&apos;re looking for
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center space-y-6">
          <p className="text-gray-300 max-w-md mx-auto">
            It seems this page has drifted into another dimension. Don&apos;t worry - we can help
            you navigate back to familiar territory.
          </p>

          {/* Quick Links Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
            <Link
              href="/"
              className="group flex flex-col items-center gap-2 p-4 rounded-lg bg-[#0F0A1F]/50 border border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all"
            >
              <Home className="w-6 h-6 text-[#A78BFA] group-hover:text-[#C4B5FD]" />
              <span className="text-sm text-gray-300 group-hover:text-white">Home</span>
            </Link>
            <Link
              href="/chart"
              className="group flex flex-col items-center gap-2 p-4 rounded-lg bg-[#0F0A1F]/50 border border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all"
            >
              <Star className="w-6 h-6 text-[#A78BFA] group-hover:text-[#C4B5FD]" />
              <span className="text-sm text-gray-300 group-hover:text-white">Birth Chart</span>
            </Link>
            <Link
              href="/dashboard"
              className="group flex flex-col items-center gap-2 p-4 rounded-lg bg-[#0F0A1F]/50 border border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all"
            >
              <Compass className="w-6 h-6 text-[#A78BFA] group-hover:text-[#C4B5FD]" />
              <span className="text-sm text-gray-300 group-hover:text-white">Dashboard</span>
            </Link>
            <Link
              href="/horoscope/daily"
              className="group flex flex-col items-center gap-2 p-4 rounded-lg bg-[#0F0A1F]/50 border border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all"
            >
              <Sparkles className="w-6 h-6 text-[#A78BFA] group-hover:text-[#C4B5FD]" />
              <span className="text-sm text-gray-300 group-hover:text-white">Daily Horoscope</span>
            </Link>
          </div>

          {/* Search Suggestion */}
          <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-4 h-4 text-[#A78BFA]" />
              <span className="text-sm font-medium text-gray-300">
                Looking for something specific?
              </span>
            </div>
            <p className="text-sm text-gray-400">
              Try exploring our{' '}
              <Link href="/pricing" className="text-[#A78BFA] hover:text-[#C4B5FD] underline">
                pricing plans
              </Link>
              ,{' '}
              <Link href="/compatibility" className="text-[#A78BFA] hover:text-[#C4B5FD] underline">
                compatibility checker
              </Link>
              , or{' '}
              <Link
                href="/chat/horoscope"
                className="text-[#A78BFA] hover:text-[#C4B5FD] underline"
              >
                AI astrology chat
              </Link>
              .
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full bg-[#7C3AED] hover:bg-[#5B21B6] text-white pulse-glow">
            <Link href="/">
              <ArrowRight className="w-4 h-4 mr-2" />
              Return to <BrandName short /> Home
            </Link>
          </Button>

          <p className="text-xs text-gray-500 text-center">
            Error Code: 404_NOT_FOUND | If you believe this is a mistake, please{' '}
            <Link href="/support" className="text-[#A78BFA] hover:text-[#C4B5FD] underline">
              contact support
            </Link>
            .
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
