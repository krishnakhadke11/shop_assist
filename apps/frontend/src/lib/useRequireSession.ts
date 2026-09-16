'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, Session } from '@/lib/authClient';

// Route guard for client components: redirects to /auth/phone when no
// verified session exists. Renders nothing until the check resolves, so
// protected content never flashes before the redirect fires.
export function useRequireSession(): { session: Session | null; checking: boolean } {
  const router = useRouter();
  const [session, setSessionState] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const existing = getSession();
    if (!existing) {
      router.replace('/auth/phone');
      return;
    }
    setSessionState(existing);
    setChecking(false);
  }, [router]);

  return { session, checking };
}
