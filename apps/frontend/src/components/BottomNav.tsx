'use client';

import { useState } from 'react';
import Link from 'next/navigation';
import { useRouter } from 'next/navigation';

interface BottomNavProps {
  activeTab: 'home' | 'orders' | 'profile';
  activeOrdersCount?: number;
}

export function BottomNav({ activeTab, activeOrdersCount }: BottomNavProps) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  };

  return (
    <>
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-ink text-white text-xs px-4 py-2.5 shadow-lg">
          {toast}
        </div>
      )}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200">
        <div className="max-w-md mx-auto grid grid-cols-3">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="flex flex-col items-center gap-0.5 py-2.5 focus:outline-none"
          >
            <span
              className={`flex items-center justify-center w-8 h-8 rounded-full text-lg ${
                activeTab === 'home' ? 'bg-brand text-white font-bold' : 'text-ink/60'
              }`}
            >
              🏠
            </span>
            <span
              className={`text-xs ${
                activeTab === 'home' ? 'font-bold text-brand-strong' : 'font-semibold text-ink/60'
              }`}
            >
              Home
            </span>
          </button>

          <button
            type="button"
            onClick={() => router.push('/orders')}
            className="flex flex-col items-center gap-0.5 py-2.5 relative focus:outline-none"
          >
            <span
              className={`flex items-center justify-center w-8 h-8 rounded-full text-lg relative ${
                activeTab === 'orders' ? 'bg-brand text-white font-bold' : 'text-ink/60'
              }`}
            >
              📋
              {activeOrdersCount !== undefined && activeOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-amber text-white text-[10px] font-bold">
                  {activeOrdersCount}
                </span>
              )}
            </span>
            <span
              className={`text-xs ${
                activeTab === 'orders' ? 'font-bold text-brand-strong' : 'font-semibold text-ink/60'
              }`}
            >
              Orders
            </span>
          </button>

          <button
            type="button"
            onClick={() => showToast('Profile is coming soon')}
            className="flex flex-col items-center gap-0.5 py-2.5 focus:outline-none"
          >
            <span
              className={`flex items-center justify-center w-8 h-8 rounded-full text-lg ${
                activeTab === 'profile' ? 'bg-brand text-white font-bold' : 'text-ink/60'
              }`}
            >
              👤
            </span>
            <span
              className={`text-xs ${
                activeTab === 'profile' ? 'font-bold text-brand-strong' : 'font-semibold text-ink/60'
              }`}
            >
              Profile
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
