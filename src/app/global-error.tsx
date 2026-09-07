'use client'

import { AlertTriangle, RefreshCw, Home, LifeBuoy, Mail } from 'lucide-react'
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
import { logError, reportError } from '@/lib/error-handling'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log critical error
    logError(error, {
      digest: error.digest,
      severity: 'critical',
      component: 'GlobalError',
    })
  }, [error])

  const handleReportError = async () => {
    const { success, reportId } = await reportError(
      error,
      'User reported from global error handler'
    )
    if (success && reportId) {
      alert(`Error reported successfully. Report ID: ${reportId}`)
    }
  }

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#0F0A1F]">
        <Card className="w-full max-w-2xl border-red-500/30 bg-[#1A1025]/90 backdrop-blur-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center animate-pulse">
              <AlertTriangle className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold text-white">Critical Error</CardTitle>
            <CardDescription className="text-gray-400 mt-2 text-lg">
              A serious error has occurred
            </CardDescription>
          </CardHeader>

          <CardContent className="text-center space-y-6">
            <div className="p-6 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-gray-300 text-lg">
                We&apos;re sorry, but a critical error has prevented the application from loading.
              </p>
              <p className="text-gray-400 mt-2">
                This could be due to a temporary issue or a problem with your connection.
              </p>
            </div>

            {error.digest && (
              <div className="p-4 rounded-lg bg-[#0F0A1F]/50 border border-purple-500/20">
                <p className="text-sm text-gray-500">
                  Error Reference: <code className="font-mono text-[#A78BFA]">{error.digest}</code>
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Please include this ID when contacting support
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-[#0F0A1F]/50 border border-purple-500/20">
                <LifeBuoy className="w-5 h-5 text-[#A78BFA] mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Need Help?</p>
                  <p className="text-xs text-gray-400">Contact our support team for assistance</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-[#0F0A1F]/50 border border-purple-500/20">
                <Mail className="w-5 h-5 text-[#A78BFA] mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Email Support</p>
                  <p className="text-xs text-gray-400">support@starpathastrology.com</p>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <div className="flex gap-3 w-full">
              <Button
                onClick={reset}
                className="flex-1 bg-[#7C3AED] hover:bg-[#5B21B6] text-white h-12 text-lg"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Reload Application
              </Button>
              <Button
                variant="outline"
                asChild
                className="flex-1 border-purple-500/30 hover:bg-purple-500/10 h-12 text-lg"
              >
                <Link href="/">
                  <Home className="w-5 h-5 mr-2" />
                  Return Home
                </Link>
              </Button>
            </div>

            <Button
              variant="ghost"
              onClick={handleReportError}
              className="w-full text-gray-400 hover:text-white hover:bg-white/5 h-12"
            >
              <AlertTriangle className="w-5 h-5 mr-2" />
              Report This Critical Error
            </Button>
          </CardFooter>
        </Card>
      </body>
    </html>
  )
}
