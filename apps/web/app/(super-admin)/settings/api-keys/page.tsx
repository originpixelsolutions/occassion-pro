'use client';

import { useEffect, useState, useTransition } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Setting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  category: string;
  is_sensitive: boolean;
  has_value: boolean;
}

// ─── Category display helpers ─────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  payments: '💳 Payments (Razorpay)',
  email:    '📧 Email (Resend)',
  ai:       '🤖 AI (OpenAI)',
  auth:     '🔐 Auth',
  general:  '🌐 General',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const [settings, setSettings]     = useState<Setting[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [edits, setEdits]           = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState<Record<string, boolean>>({});
  const [saved, setSaved]           = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  // ─── Fetch all settings (masked) ──────────────────────────────────────────

  async function fetchSettings() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/system-settings', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data: Setting[] = await res.json();
      setSettings(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchSettings(); }, []);

  // ─── Save a single key ────────────────────────────────────────────────────

  async function save(key: string) {
    const value = edits[key];
    if (value === undefined || value.trim() === '') return;

    setSaving((s) => ({ ...s, [key]: true }));
    try {
      const res = await fetch(`/api/admin/system-settings/${encodeURIComponent(key)}`, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ value: value.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `${res.status} ${res.statusText}`);
      }
      // mark saved, clear edit buffer, refresh list
      setSaved((s) => ({ ...s, [key]: true }));
      setEdits((e) => { const n = { ...e }; delete n[key]; return n; });
      setTimeout(() => setSaved((s) => { const n = { ...s }; delete n[key]; return n; }), 2500);
      startTransition(() => { fetchSettings(); });
    } catch (e: unknown) {
      alert(`Failed to save ${key}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  // ─── Group by category ────────────────────────────────────────────────────

  const grouped = settings.reduce<Record<string, Setting[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  const categoryOrder = ['payments', 'email', 'ai', 'auth', 'general'];
  const orderedCategories = [
    ...categoryOrder.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !categoryOrder.includes(c)),
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-red-700">
        <strong>Error loading settings:</strong> {error}
        <button onClick={fetchSettings} className="ml-4 text-sm underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Key Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Update service credentials without redeploying. Sensitive values are never displayed after saving.
          Changes take effect within 5 minutes (cache TTL).
        </p>
      </div>

      {orderedCategories.map((cat) => (
        <section key={cat}>
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            {CATEGORY_LABELS[cat] ?? cat}
          </h2>

          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {grouped[cat].map((s) => (
              <div key={s.key} className="p-4 sm:flex sm:items-start sm:gap-4">
                {/* Key info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-semibold text-gray-800">{s.key}</code>
                    {s.is_sensitive && (
                      <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/20">
                        sensitive
                      </span>
                    )}
                    {s.has_value ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                        ✓ set
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        not set
                      </span>
                    )}
                  </div>
                  {s.description && (
                    <p className="mt-0.5 text-xs text-gray-500">{s.description}</p>
                  )}

                  {/* Show current value only if not sensitive */}
                  {!s.is_sensitive && s.value && (
                    <p className="mt-1 font-mono text-xs text-gray-600 break-all">{s.value}</p>
                  )}
                </div>

                {/* Edit field */}
                <div className="mt-3 sm:mt-0 sm:w-72 flex gap-2">
                  <input
                    type={s.is_sensitive ? 'password' : 'text'}
                    placeholder={s.has_value ? '••••••• (leave blank to keep)' : 'Enter value…'}
                    value={edits[s.key] ?? ''}
                    onChange={(e) =>
                      setEdits((prev) => ({ ...prev, [s.key]: e.target.value }))
                    }
                    className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm
                               focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
                               font-mono placeholder:font-sans placeholder:text-gray-400"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                  />
                  <button
                    onClick={() => save(s.key)}
                    disabled={!edits[s.key] || saving[s.key]}
                    className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white
                               hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed
                               focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1
                               transition-colors"
                  >
                    {saving[s.key] ? (
                      <span className="flex items-center gap-1">
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        Saving
                      </span>
                    ) : saved[s.key] ? (
                      '✓ Saved'
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-gray-400 text-center">
        Changes are encrypted in transit and stored in Supabase. The API caches values for up to 5 minutes.
      </p>
    </div>
  );
}
