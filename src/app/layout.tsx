import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import MonitoringProvider from "@/components/MonitoringProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:6677'),
  title: "StarPath Astrology - Navigate Your Cosmic Journey",
  description: "Discover personalized astrology readings, birth charts, daily horoscopes, and celestial guidance powered by AI. Your trusted guide to cosmic wisdom.",
  keywords: "Astrology, Horoscope, Birth Chart, Natal Chart, AI Astrology, Daily Horoscope, Love Horoscope, Career Horoscope, Compatibility, Zodiac Signs, StarPath",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StarPath Astrology",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "StarPath Astrology - Navigate Your Cosmic Journey",
    description: "Personalized AI-powered astrology readings based on your birth chart",
    url: "https://starpathastrology.com",
    siteName: "StarPath Astrology",
    images: [
      {
        url: "/og-image.jpeg",
        width: 1200,
        height: 630,
        alt: "StarPath Astrology - Your Cosmic Guide",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StarPath Astrology - Navigate Your Cosmic Journey",
    description: "Personalized AI-powered astrology readings based on your birth chart",
    images: ["/og-image.jpeg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gradient-to-b from-[#0F0A1F] via-[#1A1025] to-[#0F0A1F] text-white">
        <AuthProvider>
          <MonitoringProvider>
            {children}
          </MonitoringProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
