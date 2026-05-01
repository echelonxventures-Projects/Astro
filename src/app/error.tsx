'use client'

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
import { AlertCircle, RefreshCw, Home, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { logError, getUserErrorMessage, reportError } from '@/lib/error-handling'

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Log error details (not exposed to user in production)
    logError(error, {
      digest: error.digest,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      component: 'RootErrorBoundary',
    })
  }, [error])

  const userMessage = getUserErrorMessage(error)

  const handleReportError = async () => {
    const { success, reportId } = await reportError(
      error,
      'User reported from error boundary'
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
          <CardTitle className="text-2xl font-bold gradient-text">
            Something Went Wrong
          </CardTitle>
          <CardDescription className="text-gray-400 mt-2">
            We encountered an unexpected issue
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
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <div className="flex gap-3 w-full">
            <Button
              onClick={reset}
              className="flex-1 bg-[#7C3AED] hover:bg-[#5B21B6] text-white pulse-glow"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button
              variant="outline"
              asChild
              className="flex-1 border-purple-500/30 hover:bg-purple-500/10"
            >
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Link>
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={handleReportError}
            className="w-full text-gray-400 hover:text-white hover:bg-white/5"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Report This Issue
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
