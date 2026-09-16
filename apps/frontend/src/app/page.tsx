'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/authClient';
import { CATEGORIES, MERCHANTS, Merchant } from '@/lib/dummyData';
import { CallButton, PhoneIcon } from '@/components/CallButton';
import { LocationBar } from '@/components/LocationBar';

function initials(name: string): string {
  const clean = name.trim();
  return clean.length ? clean[0] : '?';
}

function categoryIcon(categorySlug: string): string {
  return CATEGORIES.find((c) => c.slug === categorySlug)?.icon ?? '🏪';
}

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const toggleLike = (id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reorderMerchants = useMemo(() => MERCHANTS.filter((m) => m.recentlyOrdered), []);

  // Location is real now (see LocationBar / useDeviceLocation) but does not
  // drive this filtering — merchants have no coordinates yet. See the
  // "device location" note in apps/frontend/CLAUDE.md.
  const filteredMerchants = useMemo(() => {
    return MERCHANTS.filter((m) => {
      const matchesCategory = !activeCategory || m.categorySlug === activeCategory;
      const matchesQuery =
        !query.trim() || m.name.toLowerCase().includes(query.trim().toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query]);

  const handleCall = (merchant: Merchant) => {
    if (!merchant.isOpen) return;
    const session = getSession();
    if (!session) {
      router.push('/auth/phone');
      return;
    }
    router.push(`/call/${merchant.id}`);
  };

  const handleComingSoon = (label: string) => {
    setComingSoon(label);
    window.setTimeout(() => setComingSoon(null), 2000);
  };

  return (
    <main className="min-h-screen bg-white pb-24">
      <div className="max-w-md mx-auto">
        {/* Top bar */}
        <div className="px-5 pt-6 pb-4">
          <LocationBar />

          <div className="mt-4">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shops, items…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-base text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
              style={{ height: '48px' }}
            />
          </div>
        </div>

        {comingSoon && (
          <div className="mx-5 mb-4 rounded-lg bg-gray-100 px-4 py-3 text-sm text-ink/70">
            {comingSoon} isn&apos;t built yet.
          </div>
        )}

        {/* Categories */}
        <section className="px-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-ink">Categories</h2>
            {activeCategory && (
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className="text-sm font-semibold text-accent"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1 -mx-5 px-5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setActiveCategory((prev) => (prev === cat.slug ? null : cat.slug))}
                className="flex-none flex flex-col items-center gap-1.5 w-16"
              >
                <span
                  className={`flex items-center justify-center w-14 h-14 rounded-full text-2xl border-2 transition-colors ${
                    activeCategory === cat.slug
                      ? 'bg-brand border-brand'
                      : 'bg-accent/10 border-transparent'
                  }`}
                  aria-hidden="true"
                >
                  {cat.icon}
                </span>
                <span className="text-xs font-semibold text-ink text-center leading-tight">
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Reorder strip */}
        {reorderMerchants.length > 0 && (
          <section className="px-5 mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wide text-accent mb-2">
              Call again
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
              {reorderMerchants.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleCall(m)}
                  className="flex-none flex items-center gap-2 rounded-full border border-gray-200 pl-1.5 pr-4 py-1.5"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-accent text-white text-sm font-extrabold">
                    {initials(m.name)}
                  </span>
                  <span className="text-sm font-semibold text-ink whitespace-nowrap">{m.name}</span>
                  <span className="flex-none flex items-center justify-center w-7 h-7 rounded-full bg-brand">
                    <PhoneIcon className="text-white" size={13} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Value banner */}
        <section className="px-5 mb-6">
          <div className="rounded-2xl p-5 bg-gradient-to-br from-accent to-brand-strong text-white">
            <p className="text-lg font-extrabold leading-snug mb-1">
              Call the shop like always.
              <br />
              We&apos;ll get the order right.
            </p>
            <p className="text-sm text-white/85">
              An AI assistant listens in Hindi, Marathi or English and shows the shop exactly
              what you said.
            </p>
          </div>
        </section>

        {/* Merchant list */}
        <section className="px-5">
          <h2 className="text-lg font-bold text-ink mb-3">
            {activeCategory
              ? CATEGORIES.find((c) => c.slug === activeCategory)?.name
              : 'Nearby shops'}
          </h2>

          {filteredMerchants.length === 0 ? (
            <p className="text-sm text-ink/70 py-6 text-center">
              No shops here yet — try another category.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredMerchants.map((m) => {
                const liked = likedIds.has(m.id);
                return (
                  <div
                    key={m.id}
                    className="flex gap-3 rounded-2xl border border-gray-200 overflow-hidden p-2"
                  >
                    <div className="relative w-24 h-24 flex-none rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-accent/15 to-brand/25">
                      <span className="text-4xl" aria-hidden="true">
                        {categoryIcon(m.categorySlug)}
                      </span>

                      <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 shadow-sm">
                        <span aria-hidden="true" className="text-amber text-xs">
                          ★
                        </span>
                        <span className="text-xs font-bold text-ink">{m.rating.toFixed(1)}</span>
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-ink text-sm truncate">{m.name}</p>
                        <button
                          type="button"
                          onClick={() => toggleLike(m.id)}
                          aria-label={liked ? `Remove ${m.name} from saved shops` : `Save ${m.name}`}
                          aria-pressed={liked}
                          className="flex-none flex items-center justify-center w-7 h-7 rounded-full border border-gray-200"
                        >
                          <span aria-hidden="true" className={liked ? 'text-brand' : 'text-ink/40'}>
                            {liked ? '♥' : '♡'}
                          </span>
                        </button>
                      </div>
                      <p className="text-xs text-ink/60 mt-0.5 truncate">Category: {m.category}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs font-semibold text-accent flex items-center gap-1 min-w-0">
                          <span aria-hidden="true">📍</span>
                          <span className="truncate">
                            {m.distanceKm} km · {m.isOpen ? 'Open' : m.hours}
                          </span>
                        </p>
                        <CallButton
                          onClick={() => handleCall(m)}
                          disabled={!m.isOpen}
                          ariaLabel={m.isOpen ? `Call ${m.name}` : `${m.name} — ${m.hours}`}
                          title={m.isOpen ? `Call ${m.name}` : m.hours}
                          size={40}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Bottom nav — three tabs, not five (docs/shopassist-ui-plan.md §2) */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200">
        <div className="max-w-md mx-auto grid grid-cols-3">
          <button type="button" className="flex flex-col items-center gap-0.5 py-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-brand text-white">
              🏠
            </span>
            <span className="text-xs font-bold text-brand-strong">Home</span>
          </button>
          <button
            type="button"
            onClick={() => handleComingSoon('Orders')}
            className="flex flex-col items-center gap-0.5 py-2.5"
          >
            <span className="text-xl">📋</span>
            <span className="text-xs font-semibold text-ink/60">Orders</span>
          </button>
          <button
            type="button"
            onClick={() => handleComingSoon('Profile')}
            className="flex flex-col items-center gap-0.5 py-2.5"
          >
            <span className="text-xl">👤</span>
            <span className="text-xs font-semibold text-ink/60">Profile</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
