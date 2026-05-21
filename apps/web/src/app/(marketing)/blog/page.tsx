'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Clock, ArrowRight, Search, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Mock blog data ─────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Product', 'Operations', 'AI & Tech', 'Case Studies', 'Industry']

const POSTS = [
  {
    slug: 'ai-event-risk-prediction',
    category: 'AI & Tech',
    title: 'How AI predicts event risks before they become disasters',
    excerpt: 'OccasionPro\'s risk engine analyses weather, vendor reliability, budget burn-rate, and guest no-show patterns to surface warnings 48 hours before your event.',
    author: 'Priya Chandran',
    date: 'May 15, 2026',
    readTime: '7 min',
    featured: true,
    gradient: 'from-violet-600/30 to-indigo-600/20',
  },
  {
    slug: 'wedding-operations-scale',
    category: 'Operations',
    title: 'Running a 2,000-person destination wedding: an operational deep-dive',
    excerpt: 'How Celebration Masters used OccasionPro to coordinate 80 vendors, 200 staff, and 2,000 guests across a 4-day resort wedding.',
    author: 'Sneha Iyer',
    date: 'May 8, 2026',
    readTime: '12 min',
    featured: true,
    gradient: 'from-pink-600/30 to-rose-600/20',
  },
  {
    slug: 'f-b-token-system-guide',
    category: 'Product',
    title: 'The complete guide to OccasionPro\'s F&B token system',
    excerpt: 'From setting up menu categories and dietary flags to scanning QR codes at stations and real-time consumption analytics — everything you need to know.',
    author: 'Rohan Sharma',
    date: 'Apr 28, 2026',
    readTime: '9 min',
    featured: false,
    gradient: 'from-orange-600/30 to-amber-600/20',
  },
  {
    slug: 'dpdp-event-companies',
    category: 'Industry',
    title: 'DPDP Act 2023: What event companies must know about guest data',
    excerpt: 'India\'s Digital Personal Data Protection Act has specific implications for event companies collecting guest information. Here\'s your compliance checklist.',
    author: 'Meera Pillai',
    date: 'Apr 20, 2026',
    readTime: '8 min',
    featured: false,
    gradient: 'from-blue-600/30 to-cyan-600/20',
  },
  {
    slug: 'floor-plan-collaboration',
    category: 'Product',
    title: 'Real-time floor plan collaboration: how it works under the hood',
    excerpt: 'We built OccasionPro\'s live floor plan editor with CRDT-based conflict resolution so 10 people can edit the same layout simultaneously without chaos.',
    author: 'Karan Joshi',
    date: 'Apr 12, 2026',
    readTime: '10 min',
    featured: false,
    gradient: 'from-emerald-600/30 to-green-600/20',
  },
  {
    slug: 'enterprise-event-crm',
    category: 'Case Studies',
    title: 'How EventEdge closed 40% more proposals after switching to OccasionPro CRM',
    excerpt: 'EventEdge went from managing proposals in email threads to a structured CRM pipeline with AI-assisted proposal drafting. Here\'s their story.',
    author: 'Sneha Iyer',
    date: 'Apr 5, 2026',
    readTime: '6 min',
    featured: false,
    gradient: 'from-indigo-600/30 to-purple-600/20',
  },
]

// ── Components ─────────────────────────────────────────────────────────────────

function PostCard({ post, large = false }: { post: (typeof POSTS)[0]; large?: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article className={cn(
        'h-full rounded-2xl border border-white/10 overflow-hidden hover:border-white/20 transition-all',
        `bg-gradient-to-br ${post.gradient}`,
      )}>
        <div className={cn('p-6', large && 'lg:p-8')}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-white/20 bg-white/10 text-white/70">
              {post.category}
            </span>
          </div>

          <h2 className={cn(
            'font-bold text-white group-hover:text-white/90 transition-colors mb-3 leading-snug',
            large ? 'text-xl lg:text-2xl' : 'text-lg',
          )}>
            {post.title}
          </h2>
          <p className="text-sm text-white/55 leading-relaxed mb-6 line-clamp-3">
            {post.excerpt}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span>{post.author}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {post.date}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {post.readTime}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </article>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')

  const featured = POSTS.filter((p) => p.featured)
  const rest = POSTS.filter((p) => !p.featured)

  const filtered = rest.filter((p) => {
    const matchCat = activeCategory === 'All' || p.category === activeCategory
    const matchSearch = !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.excerpt.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="bg-[#09090b] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-16 lg:pt-32 text-center">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[800px] rounded-full bg-gradient-to-b from-indigo-600/15 to-transparent blur-3xl" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          The OccasionPro Blog
        </h1>
        <p className="mt-4 text-lg text-white/60 max-w-xl mx-auto">
          Operational guides, product deep-dives, and stories from the event industry.
        </p>

        {/* Search */}
        <div className="mt-8 mx-auto max-w-sm">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles…"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Category filter */}
      <section className="px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-all',
                  activeCategory === cat
                    ? 'bg-white text-black'
                    : 'border border-white/15 text-white/60 hover:border-white/30 hover:text-white',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured posts */}
      {activeCategory === 'All' && !search && (
        <section className="px-6 pb-12 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-5 lg:grid-cols-2">
              {featured.map((post) => (
                <PostCard key={post.slug} post={post} large />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All posts */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {filtered.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Search className="w-10 h-10 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">No articles found matching your search.</p>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="px-6 py-16 lg:px-8 border-t border-white/10">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Get articles in your inbox</h2>
          <p className="text-white/55 mb-6 text-sm">Weekly insights on event operations, product updates, and industry trends.</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="email"
              placeholder="you@eventcompany.in"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-violet-500/40 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Subscribe
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
