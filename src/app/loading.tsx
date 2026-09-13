import { Sparkles } from 'lucide-react'
import { BrandName } from '@/components/BrandProvider'

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-[#0F0A1F] via-[#1A1025] to-[#0F0A1F]">
      {/* Animated loading spinner with cosmic theme */}
      <div className="relative">
        {/* Outer rotating ring */}
        <div className="w-24 h-24 rounded-full border-4 border-transparent border-t-[#7C3AED] border-r-[#A78BFA] animate-spin" />

        {/* Middle rotating ring */}
        <div
          className="absolute inset-2 rounded-full border-4 border-transparent border-b-[#C4B5FD] border-l-[#7C3AED] animate-spin"
          style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
        />

        {/* Inner pulsing center */}
        <div className="absolute inset-6 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] flex items-center justify-center pulse-glow">
          <Sparkles className="w-8 h-8 text-white" />
        </div>

        {/* Orbiting sparkles */}
        <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-yellow-400 twinkle" />
        <div
          className="absolute -bottom-2 -left-2 w-3 h-3 rounded-full bg-[#C4B5FD] twinkle"
          style={{ animationDelay: '0.5s' }}
        />
      </div>

      {/* Loading text */}
      <div className="mt-8 text-center space-y-2">
        <h2 className="text-xl font-semibold text-white">
          Loading <BrandName short />
          ...
        </h2>
        <p className="text-sm text-gray-400">Aligning the celestial bodies</p>
      </div>

      {/* Progress dots */}
      <div className="mt-6 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#7C3AED] animate-pulse" />
        <div
          className="w-2 h-2 rounded-full bg-[#A78BFA] animate-pulse"
          style={{ animationDelay: '0.2s' }}
        />
        <div
          className="w-2 h-2 rounded-full bg-[#C4B5FD] animate-pulse"
          style={{ animationDelay: '0.4s' }}
        />
      </div>
    </div>
  )
}
