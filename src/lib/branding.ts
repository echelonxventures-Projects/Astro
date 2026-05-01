/**
 * StarPath Astrology - Brand Configuration
 * Bold Contemporary style with Purple & Silver theme
 */

export const BRANDING = {
  // Brand Identity
  name: 'StarPath Astrology',
  shortName: 'StarPath',
  tagline: 'Navigate Your Cosmic Journey',
  description: 'Your trusted guide to celestial wisdom and personal discovery through astrology',

  // Brand Colors - Purple & Silver Theme
  colors: {
    // Primary - Bold Purple
    primary: '#7C3AED',        // vibrant-600
    primaryDark: '#5B21B6',    // vibrant-800
    primaryLight: '#A78BFA',   // vibrant-400
    primaryGlow: '#C4B5FD',    // vibrant-300

    // Secondary - Silver
    secondary: '#E5E7EB',      // gray-200
    secondaryDark: '#6B7280',  // gray-500
    secondaryLight: '#F9FAFB', // gray-50
    silver: '#C0C0C0',
    silverLight: '#E8E8E8',
    silverDark: '#9CA3AF',

    // Accent Colors - Bold & Vibrant
    accent1: '#EC4899',        // pink-500 - for love/romance
    accent2: '#06B6D4',        // cyan-500 - for career
    accent3: '#F59E0B',        // amber-500 - for wisdom
    accent4: '#10B981',        // emerald-500 - for growth

    // Background
    bgDark: '#0F0A1F',         // deep purple-black
    bgCard: '#1A1025',         // lighter purple-black
    bgGlass: 'rgba(26, 16, 37, 0.7)',

    // Text
    textPrimary: '#FFFFFF',
    textSecondary: '#D1D5DB',  // gray-300
    textMuted: '#9CA3AF',      // gray-400
  },

  // Typography - Bold Contemporary
  typography: {
    headingFont: 'font-bold tracking-tight',
    bodyFont: 'font-normal',
    headingScale: {
      h1: 'text-5xl md:text-6xl',
      h2: 'text-3xl md:text-4xl',
      h3: 'text-2xl md:text-3xl',
      h4: 'text-xl md:text-2xl',
    },
  },

  // Visual Elements
  visual: {
    gradient: 'bg-gradient-to-br from-[#7C3AED] via-[#5B21B6] to-[#0F0A1F]',
    gradientHorizontal: 'bg-gradient-to-r from-[#7C3AED] via-[#A78BFA] to-[#C4B5FD]',
    gradientText: 'bg-gradient-to-r from-[#E8E8E8] via-[#FFFFFF] to-[#C0C0C0] bg-clip-text text-transparent',
    gradientTextBold: 'bg-gradient-to-r from-[#A78BFA] via-[#FFFFFF] to-[#E5E7EB] bg-clip-text text-transparent',
    glass: 'backdrop-blur-xl bg-[#1A1025]/60 border border-[#7C3AED]/30',
    glassLight: 'backdrop-blur-lg bg-[#FFFFFF]/5 border border-[#E5E7EB]/20',
    glow: 'shadow-[0_0_40px_-10px_rgba(124,58,237,0.5)]',
    glowStrong: 'shadow-[0_0_60px_-15px_rgba(124,58,237,0.7)]',
  },

  // Logo Configuration
  logo: {
    icon: 'sparkles', // Options: sparkles, star, compass, constellation
    variant: 'horizontal', // horizontal, stacked, icon-only
  },

  // Metadata
  seo: {
    title: 'StarPath Astrology - Navigate Your Cosmic Journey',
    description: 'Discover personalized astrology readings, birth charts, daily horoscopes, and celestial guidance powered by AI.',
    keywords: ['astrology', 'horoscope', 'birth chart', 'zodiac', 'natal chart', 'astrology AI', 'cosmic guidance'],
    author: 'StarPath Astrology',
  },

  // Social Media
  social: {
    handle: '@starpathastro',
    platforms: ['instagram', 'twitter', 'tiktok', 'youtube'],
  },
}

export type BrandColors = typeof BRANDING.colors
