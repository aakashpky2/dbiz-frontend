'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/apiFetch';

import { useToast } from '@/hooks/use-toast';

export type ActiveWorkStatus = 'in_progress' | 'paused' | 'completed';

export interface ActiveWork {
    id: string;
    task_id: string | null;
    title: string;
    status: ActiveWorkStatus;
    started_at: string;
    last_activity_at: string;
    elapsed_seconds: number;
    due_date?: string | null;
    priority?: string | null;
}

interface ActiveWorkContextType {
    activeWork: ActiveWork | null;
    loading: boolean;
    error: Error | null;
    refreshActiveWork: () => Promise<void>;
    startWork: (taskId: string) => Promise<void>;
    resumeWork: (activeWorkId: string) => Promise<void>;
    pauseWork: () => Promise<void>;
    completeWork: () => Promise<void>;
    clearActiveWorkLocal: (taskId: string) => void;
    localElapsed: number;
}

const ActiveWorkContext = createContext<ActiveWorkContextType | undefined>(undefined);

export function ActiveWorkProvider({ children }: { children: React.ReactNode }) {
    const [activeWork, setActiveWork] = useState<ActiveWork | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();

    // Local ticker for real-time counter
    const [localElapsed, setLocalElapsed] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Concurrency guards
    const inFlightPromiseRef = useRef<Promise<void> | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const applyActiveWork = useCallback((data: ActiveWork | null) => {
        setActiveWork(data);
    }, []);

    const fetchActiveWork = useCallback(async (signal: AbortSignal) => {
        if (!user) {
            setActiveWork(null);
            setLoading(false);
            return;
        }
        try {
            const res = await apiFetch(`/api/active-work/current`, { signal });
            if (res.ok) {
                const json = await res.json();
                applyActiveWork(json.data || null);
            } else {
                applyActiveWork(null);
            }
        } catch (err: any) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                return; // Ignore expected cancellation
            }
            console.error('[ActiveWork] refresh error', err);
            setError(err);
        } finally {
            if (!signal.aborted) {
                setLoading(false);
            }
        }
    }, [user, applyActiveWork]);

    const refreshActiveWork = useCallback(async () => {
        // Concurrency Strategy: If a refresh is already running, return the existing promise
        if (inFlightPromiseRef.current) {
            return inFlightPromiseRef.current;
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const promise = fetchActiveWork(controller.signal).finally(() => {
            // Clean up the in-flight ref only if it still refers to this request
            if (inFlightPromiseRef.current === promise) {
                inFlightPromiseRef.current = null;
            }
        });

        inFlightPromiseRef.current = promise;
        return promise;
    }, [fetchActiveWork]);

    // Initial fetch + poll every 30s
    useEffect(() => {
        refreshActiveWork();
        const interval = setInterval(refreshActiveWork, 30000);
        return () => {
            clearInterval(interval);
            // Cancel any ongoing fetch on unmount
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [refreshActiveWork]);

    // --- Timer ---
    useEffect(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (!activeWork) {
            setLocalElapsed(0);
            return;
        }

        if (activeWork.status === 'in_progress') {
            // Calculate how many seconds have elapsed since last_activity_at (or started_at as fallback)
            const resumeRef = activeWork.last_activity_at || activeWork.started_at;
            const resumeRefMs = new Date(resumeRef).getTime();
            const baseSecs = activeWork.elapsed_seconds ?? 0;

            const calcElapsed = () => baseSecs + Math.floor((Date.now() - resumeRefMs) / 1000);

            setLocalElapsed(calcElapsed());

            timerRef.current = setInterval(() => {
                setLocalElapsed(calcElapsed());
            }, 1000);
        } else if (activeWork.status === 'paused') {
            setLocalElapsed(activeWork.elapsed_seconds ?? 0);
        } else {
            setLocalElapsed(0);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [activeWork]);

    const startWork = async (taskId: string) => {
        try {
            const res = await apiFetch(`/api/active-work/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId })
            });

            if (!res.ok) {
                let errMessage = `Server Error (${res.status})`;
                try {
                    const errData = await res.json();
                    errMessage = errData.message || errData.error || errMessage;
                } catch {
                    errMessage = await res.text() || errMessage;
                }
                throw new Error(errMessage);
            }

            const json = await res.json();
            
            if (json.success === false) {
                throw new Error(json.message || 'Failed to start work');
            }

            // Immediately apply response data so the timer starts without waiting for refresh
            if (json.data) {
                applyActiveWork(json.data);
            }
            toast({ title: 'Work Started', description: 'Your time is now being tracked.' });
        } catch (err: any) {
            toast({ title: 'Error Starting Work', description: err.message || 'Failed to start work.', variant: 'destructive' });
            throw err;
        }
    };

    const resumeWork = async (activeWorkId: string) => {
        try {
            const res = await apiFetch(`/api/active-work/resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activeWorkId })
            });
            if (!res.ok) {
                let errMessage = `Server Error (${res.status})`;
                try {
                    const errData = await res.json();
                    errMessage = errData.message || errData.error || errMessage;
                } catch {
                    errMessage = await res.text() || errMessage;
                }
                throw new Error(errMessage);
            }
            const json = await res.json();
            if (json.success === false) {
                throw new Error(json.message || 'Failed to resume work');
            }
            if (json.data) {
                applyActiveWork(json.data);
            }
            toast({ title: 'Work Resumed', description: 'Your time is now being tracked.' });
        } catch (err: any) {
            toast({ title: 'Error Resuming Work', description: err.message || 'Failed to resume work.', variant: 'destructive' });
            throw err;
        }
    };

    const pauseWork = async () => {
        if (!activeWork) return;
        try {
            const res = await apiFetch(`/api/active-work/pause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activeWorkId: activeWork.id })
            });
            if (!res.ok) throw new Error('Failed to pause work');
            const json = await res.json();
            if (json.success === false) {
                throw new Error(json.message || 'Failed to pause work');
            }
            if (json.data) {
                applyActiveWork(json.data);
            }
            toast({ title: 'Work Paused', description: 'Your time tracking has been paused.' });
        } catch (err: any) {
            toast({ title: 'Error', description: 'Failed to pause work.', variant: 'destructive' });
        }
    };

    const completeWork = async () => {
        if (!activeWork) return;
        try {
            const res = await apiFetch(`/api/active-work/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activeWorkId: activeWork.id })
            });
            const json = await res.json();
            if (json.success === false) {
                throw new Error(json.message || 'Failed to complete work');
            }
            applyActiveWork(null);
            toast({ title: 'Work Completed', description: 'Your work has been marked as completed.' });
        } catch (err: any) {
            toast({ title: 'Error', description: 'Failed to complete work.', variant: 'destructive' });
        }
    };

    const clearActiveWorkLocal = useCallback((taskId: string) => {
        if (activeWork && activeWork.task_id === taskId) {
            applyActiveWork(null);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            setLocalElapsed(0);
        }
    }, [activeWork, applyActiveWork]);

    return (
        <ActiveWorkContext.Provider value={{
            activeWork,
            loading,
            error,
            refreshActiveWork,
            startWork,
            resumeWork,
            pauseWork,
            completeWork,
            clearActiveWorkLocal,
            localElapsed
        }}>
            {children}
        </ActiveWorkContext.Provider>
    );
}

export function useActiveWork() {
    const context = useContext(ActiveWorkContext);
    if (context === undefined) {
        throw new Error('useActiveWork must be used within an ActiveWorkProvider');
    }
    return context;
}
