'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';

interface TaskReminderContextType {
    pendingCount: number;
}

const TaskReminderContext = createContext<TaskReminderContextType>({ pendingCount: 0 });

export const useTaskReminder = () => useContext(TaskReminderContext);

// Increase fetch interval to 30 minutes to reduce reads
const FETCH_INTERVAL_MS = 30 * 60 * 1000;
// Notify the user every 15 minutes if they have pending tasks
const REMINDER_INTERVAL_MS = 15 * 60 * 1000;

export function TaskReminderProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [pendingCount, setPendingCount] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const toastRef = useRef(toast);
    const routerRef = useRef(router);

    // Keep refs up to date so they can be used inside intervals without restarts
    toastRef.current = toast;
    routerRef.current = router;

    const fetchTasks = useCallback(async (uid: string) => {
        // Skip fetching if the tab is hidden (user is away) to save bandwidth
        if (typeof document !== 'undefined' && document.hidden) return;

        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('id, assigned_to, status')
                .neq('status', 'Completed');

            if (error) {
                console.error('Error fetching tasks for reminder:', error);
                return;
            }

            if (data) {
                const myPendingTasks = data.filter((task: any) =>
                    task.assigned_to &&
                    (Array.isArray(task.assigned_to)
                        ? task.assigned_to.includes(uid)
                        : task.assigned_to === uid)
                );
                setPendingCount(myPendingTasks.length);
            } else {
                setPendingCount(0);
            }
        } catch (err) {
            console.error('Error fetching tasks for reminder:', err);
        }
    }, []);

    // Fetch Tasks and Update Pending Count (every 30 mins, skip if tab hidden)
    useEffect(() => {
        if (!user) {
            setPendingCount(0);
            return;
        }

        fetchTasks(user.uid);
        const interval = setInterval(() => fetchTasks(user.uid), FETCH_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [user, fetchTasks]);

    // Reminder toast interval — uses refs so it never needs to restart when those change
    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (pendingCount > 0) {
            intervalRef.current = setInterval(() => {
                toastRef.current({
                    title: 'Pending Tasks Reminder',
                    description: `You have ${pendingCount} incomplete task${pendingCount === 1 ? '' : 's'} waiting.`,
                    action: (
                        <ToastAction altText="View Tasks" onClick={() => routerRef.current.push('/dashboard/work-register/my-tasks')}>
                            View
                        </ToastAction>
                    ),
                });
            }, REMINDER_INTERVAL_MS);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [pendingCount]); // Stable: only restart when actual count changes

    const contextValue = React.useMemo(() => ({ pendingCount }), [pendingCount]);

    return (
        <TaskReminderContext.Provider value={contextValue}>
            {children}
        </TaskReminderContext.Provider>
    );
}
