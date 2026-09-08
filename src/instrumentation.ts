/**
 * Next.js Instrumentation Hook (runtime dispatcher)
 * Delegates to runtime-specific implementations
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-nodejs')
  }
}
