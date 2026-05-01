export const dynamic = 'force-dynamic'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 gradient-text">Privacy Policy</h1>

        <div className="glass rounded-3xl p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Information We Collect</h2>
            <p className="text-purple-200">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-purple-200 mt-2 space-y-1">
              <li>Email address and account credentials</li>
              <li>Name and profile information</li>
              <li>Birth date, time, and location for astrology calculations</li>
              <li>Payment information processed through Stripe</li>
              <li>Usage data and preferences</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. How We Use Your Information</h2>
            <p className="text-purple-200">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-purple-200 mt-2 space-y-1">
              <li>Provide, maintain, and improve our services</li>
              <li>Generate personalized astrology readings</li>
              <li>Process transactions and send related information</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Data Sharing</h2>
            <p className="text-purple-200">
              We do not sell your personal information. We may share your information with:
            </p>
            <ul className="list-disc list-inside text-purple-200 mt-2 space-y-1">
              <li>Service providers who perform services on our behalf</li>
              <li>Payment processors (Stripe) to process transactions</li>
              <li>Legal authorities when required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Data Security</h2>
            <p className="text-purple-200">
              We implement appropriate technical and organizational measures to protect your
              personal information against unauthorized access, alteration, disclosure, or
              destruction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Your Rights</h2>
            <p className="text-purple-200">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-purple-200 mt-2 space-y-1">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Export your data</li>
              <li>Opt-out of marketing communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Cookies</h2>
            <p className="text-purple-200">
              We use cookies and similar tracking technologies to improve your experience.
              You can control cookies through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Changes to This Policy</h2>
            <p className="text-purple-200">
              We may update this privacy policy from time to time. We will notify you of
              any changes by posting the new policy on this page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Contact Us</h2>
            <p className="text-purple-200">
              If you have questions about this Privacy Policy, please contact us at:
              privacy@starpathastrology.com
            </p>
          </section>

          <p className="text-sm text-purple-400 pt-4">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  )
}
