import Link from 'next/link'

export const metadata = { title: 'Forgot Password' }

export default function ForgotPasswordPage(): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold gradient-text">Password Reset</h1>
      <p className="max-w-md text-gray-400">
        Self-service password reset isn&apos;t enabled on this platform yet. Contact your platform
        administrator (or your provider&apos;s support team) and they can set a new password for you
        from the admin console.
      </p>
      <Link
        href="/login"
        className="px-5 py-2.5 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-semibold transition"
      >
        Back to Login
      </Link>
    </main>
  )
}
