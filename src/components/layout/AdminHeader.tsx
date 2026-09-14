'use client'

import { Building2, Settings } from 'lucide-react'
import Link from 'next/link'

export default function AdminHeader({
  active,
}: {
  active: 'tenants' | 'master' | 'branding' | 'localization' | 'domains' | 'payments' | 'plans'
}): React.ReactElement {
  const links: Array<{
    href: string
    label: string
    key: 'tenants' | 'master' | 'branding' | 'localization' | 'domains' | 'payments' | 'plans'
  }> = [
    { href: '/admin/tenants', label: 'Platforms', key: 'tenants' },
    { href: '/admin/master', label: 'Master Config', key: 'master' },
    { href: '/admin/branding', label: 'Branding', key: 'branding' },
    { href: '/admin/localization', label: 'Localization', key: 'localization' },
    { href: '/admin/domains', label: 'Domains', key: 'domains' },
    { href: '/admin/payments', label: 'Payments', key: 'payments' },
    { href: '/admin/plans', label: 'Plans', key: 'plans' },
  ]
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-[var(--border)]/20">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Building2 className="w-6 h-6 text-[var(--primary-light)]" />
          <span className="font-bold gradient-text">Platform Admin</span>
        </Link>
        <div className="flex items-center gap-5 text-sm">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={
                active === l.key
                  ? 'text-white font-semibold'
                  : 'text-gray-300 hover:text-white transition'
              }
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/settings"
            className="text-gray-300 hover:text-white transition"
            aria-label="AI settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </nav>
  )
}
