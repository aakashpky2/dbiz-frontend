'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';

const PUNCH_FLAG_KEY = 'auto_punch_in_done';

/**
 * AutoPunchIn — fires a punch-in request exactly once per fresh login session.
 * It runs after the dashboard is mounted (client-side), so the dashboard page
 * loads immediately without waiting for the attendance API.
 *
 * Uses sessionStorage so it only runs on the first dashboard visit after login,
 * not on every page navigation.
 */
export function AutoPunchIn() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;

    // 'is_logged_in' is set in sessionStorage by the login page on fresh login.
    // 'auto_punch_in_done' is set here after punching in, so we don't re-punch
    // if the user navigates away and back to the dashboard.
    const isFreshLogin = sessionStorage.getItem('is_logged_in') === 'true';
    const alreadyPunched = sessionStorage.getItem(PUNCH_FLAG_KEY) === 'true';

    if (!isFreshLogin || alreadyPunched) return;

    // Mark as done immediately to prevent double-fire
    sessionStorage.setItem(PUNCH_FLAG_KEY, 'true');

    fetch('/api/attendance/punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.uid, type: 'punchIn' }),
    }).catch((err) => {
      console.error('Auto punch-in failed:', err);
      // Unmark on failure so it can retry next time
      sessionStorage.removeItem(PUNCH_FLAG_KEY);
    });
  }, [user, loading]);

  return null;
}
