'use client';
import { apiFetch } from '@/lib/apiFetch';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useAttendance } from '@/contexts/AttendanceContext';

const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const IDLE_THRESHOLD = 15 * 60 * 1000; // 15 minutes to become idle
const ACTIVITY_STORAGE_KEY = 'last_activity_timestamp';

export default function IdleTimer() {
    const { user, loading } = useAuth();
    const { isPunchedIn } = useAttendance();
    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const updateActivity = () => {
        localStorage.setItem(ACTIVITY_STORAGE_KEY, Date.now().toString());
    };

    const sendHeartbeat = async (state: 'ACTIVE' | 'IDLE') => {
        try {
            await apiFetch('/api/attendance/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state }),
            });
        } catch (err) {
            console.error('Heartbeat ping failed:', err);
        }
    };

    useEffect(() => {
        if (loading || !user || !isPunchedIn) {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
                checkIntervalRef.current = null;
            }
            return;
        }

        updateActivity();

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        let lastUpdate = 0;
        const activityHandler = () => {
            const now = Date.now();
            if (now - lastUpdate > 5000) {
                updateActivity();
                lastUpdate = now;
            }
        };

        events.forEach(event => {
            window.addEventListener(event, activityHandler, { passive: true });
        });

        // Setup ping interval
        checkIntervalRef.current = setInterval(() => {
            const lastActivityStr = localStorage.getItem(ACTIVITY_STORAGE_KEY);
            if (!lastActivityStr) return;

            const lastActivity = parseInt(lastActivityStr, 10);
            const now = Date.now();
            const diff = now - lastActivity;

            if (diff < CHECK_INTERVAL) {
                // User has been active in the last minute
                sendHeartbeat('ACTIVE');
            } else if (diff >= IDLE_THRESHOLD) {
                // User has been idle for 15+ minutes
                sendHeartbeat('IDLE');
            }
            // If diff is between 1 minute and 15 minutes, we do not ping.
            // This freezes the backend 'ACTIVE' ended_at timestamp at the exact minute activity stopped.
            // When diff reaches 15 minutes, the next IDLE ping will retroactively treat the gap as IDLE.
            
        }, CHECK_INTERVAL);

        return () => {
            if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
            events.forEach(event => {
                window.removeEventListener(event, activityHandler);
            });
        };
    }, [user, loading]);

    return null;
}
