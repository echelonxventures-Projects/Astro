'use client'

import { AlertCircle, RefreshCw, LayoutDashboard, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { logError, getUserErrorMessage, reportError } from '@/lib/error-handling'

interface DashboardErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    // Log error with dashboard context
    logError(error, {
      digest: error.digest,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      component: 'DashboardErrorBoundary',
      section: 'dashboard',
    })
  }, [error])

  const userMessage = getUserErrorMessage(error)

  const handleReportError = async () => {
    const { success, reportId } = await reportError(
      error,
      'User reported from dashboard error boundary'
    )
    if (success && reportId) {
      alert(`Error reported successfully. Report ID: ${reportId}`)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-[#0F0A1F] via-[#1A1025] to-[#0F0A1F]">
      <Card className="w-full max-w-lg glass border-purple-500/30">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] flex items-center justify-center pulse-glow">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold gradient-text">Dashboard Error</CardTitle>
          <CardDescription className="text-gray-400 mt-2">
            Something went wrong in your dashboard
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center space-y-4">
          <div className="p-4 rounded-lg bg-[#1A1025]/50 border border-purple-500/20">
            <p className="text-gray-300">{userMessage}</p>
          </div>

          {error.digest && (
            <p className="text-xs text-gray-500">
              Error ID: <code className="font-mono">{error.digest}</code>
            </p>
          )}

          <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
            <LayoutDashboard className="w-4 h-4 text-[#A78BFA]" />
            <span className="text-sm text-gray-400">Your data is safe and secure</span>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <div className="flex gap-3 w-full">
            <Button
              onClick={reset}
              className="flex-1 bg-[#7C3AED] hover:bg-[#5B21B6] text-white pulse-glow"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Loading
            </Button>
            <Button
              variant="outline"
              asChild
              className="flex-1 border-purple-500/30 hover:bg-purple-500/10"
            >
              <Link href="/dashboard">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
            </Button>
          </div>

          <Button
            variant="ghost"
            asChild
            className="w-full text-gray-400 hover:text-white hover:bg-white/5"
          >
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>

          <Button
            variant="ghost"
            onClick={handleReportError}
            className="w-full text-gray-400 hover:text-white hover:bg-white/5"
          >
            Report This Issue
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
