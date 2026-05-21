import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/marketing-nav'

export const metadata: Metadata = {
  title: {
    default: 'OccasionPro — The Complete Event Management Platform for India',
    template: '%s | OccasionPro',
  },
  description:
    'Run weddings, conferences, corporate events, and more from guest invitations to badge printing — all in one AI-powered platform.',
  openGraph: {
    type: 'website',
    siteName: 'OccasionPro',
    url: 'https://occasionpro.in',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <MarketingNav />
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#09090b]">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4 lg:grid-cols-5">
            {/* Brand */}
            <div className="col-span-2 lg:col-span-2">
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
                  <span className="text-sm font-black text-white">OP</span>
                </div>
                <span className="text-lg font-bold tracking-tight text-white">OccasionPro</span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
                The complete AI-powered event operating system for professional event companies across India.
              </p>
              <p className="mt-6 text-xs text-white/30">
                Built for India 🇮🇳 &middot; Powered by OccasionPro
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/40">
                Product
              </h4>
              <ul className="space-y-3 text-sm">
                {[
                  ['Features', '/#features'],
                  ['Pricing', '/pricing'],
                  ['Blog', '/blog'],
                  ['Changelog', '/changelog'],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-white/60 transition-colors hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/40">
                Company
              </h4>
              <ul className="space-y-3 text-sm">
                {[
                  ['About', '/about'],
                  ['Contact', '/contact'],
                  ['Privacy Policy', '/privacy'],
                  ['Terms of Service', '/terms'],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-white/60 transition-colors hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/40">
                Legal
              </h4>
              <ul className="space-y-3 text-sm">
                {[
                  ['Data Rights', '/data-request'],
                  ['Cookie Policy', '/cookies'],
                  ['Security', '/security'],
                  ['Refund Policy', '/refunds'],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-white/60 transition-colors hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
            <p className="text-xs text-white/30">
              © {new Date().getFullYear()} OccasionPro. All rights reserved.
            </p>
            <p className="text-xs text-white/30">
              CIN: U74999MH2024PTC000000 &middot; GST: 27XXXXX0000X1Z1
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
