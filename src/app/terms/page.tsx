import { Sparkles } from 'lucide-react'
import Link from 'next/link'
import { BrandName } from '@/components/BrandProvider'

export default function TermsPage() {
  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-[#7C3AED]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-[#A78BFA]" />
              <span className="text-xl font-bold gradient-text">
                <BrandName />
              </span>
            </Link>
            <Link href="/" className="text-gray-300 hover:text-white transition">
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 gradient-text">Terms of Service</h1>

          <div className="glass rounded-2xl p-8 space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3 text-[#A78BFA]">1. Acceptance of Terms</h2>
              <p className="text-gray-300">
                By accessing and using <BrandName />, you accept and agree to be bound by these
                Terms of Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-[#A78BFA]">
                2. No Professional Advice
              </h2>
              <p className="text-gray-300">
                <BrandName /> provides AI-powered astrology readings, birth chart interpretations,
                and cosmic guidance for entertainment and self-reflection purposes only. The content
                provided is not intended to be a substitute for professional advice, diagnosis, or
                treatment.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-[#A78BFA]">
                3. Accuracy of Information
              </h2>
              <p className="text-gray-300">
                While we strive to provide accurate astrological calculations and insightful
                interpretations, astrology is not a science. The readings and guidance provided
                should be used for entertainment and personal reflection purposes only.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-[#A78BFA]">
                4. User Responsibilities
              </h2>
              <p className="text-gray-300">
                You agree to use <BrandName /> responsibly and not to rely solely on astrological
                readings for important life decisions. Always seek professional advice for medical,
                legal, financial, or other significant matters.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-[#A78BFA]">
                5. Intellectual Property
              </h2>
              <p className="text-gray-300">
                All content, features, and functionality of <BrandName /> are owned by us and
                protected by copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-[#A78BFA]">
                6. Limitation of Liability
              </h2>
              <p className="text-gray-300">
                <BrandName /> is provided &quot;as is&quot; and &quot;as available&quot; without
                warranties of any kind. To the maximum extent permitted by law, <BrandName />
                Astrology shall not be liable for any damages arising from the use of our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-[#A78BFA]">7. Governing Law</h2>
              <p className="text-gray-300">
                These terms shall be governed by and construed in accordance with the laws of the
                jurisdiction where <BrandName /> operates, without regard to its conflict of law
                provisions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-[#A78BFA]">8. Changes to Terms</h2>
              <p className="text-gray-300">
                We reserve the right to modify these terms at any time. Continued use of the service
                after changes constitutes acceptance of the new terms.
              </p>
            </section>
          </div>

          <div className="mt-8 text-center">
            <Link href="/privacy" className="text-[#A78BFA] hover:text-[#C4B5FD] transition">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-[#7C3AED]/30 mt-16">
        <div className="max-w-7xl mx-auto text-center text-gray-400">
          <p>
            © {new Date().getFullYear()} <BrandName />. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  )
}
