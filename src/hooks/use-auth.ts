import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Subscription } from '@supabase/supabase-js';

// Global shared states for auth singleton
let sharedUser: User | null = null;
let sharedLoading = true;
let sharedServerSessionReady = false;
let sharedServerSessionError: Error | null = null;
let sharedEmployeePhoto: string | null = null;
let sharedEmployeeName: string | null = null;
let isInitialized = false;
let authSubscription: Subscription | null = null;
let lastSyncedToken: string | null = null;

let sessionSyncPromise: Promise<boolean> | null = null;
let sessionSyncToken: string | null = null;

type Listener = (
    user: User | null, 
    loading: boolean, 
    ready: boolean, 
    error: Error | null, 
    photo: string | null, 
    name: string | null
) => void;

const listeners = new Set<Listener>();

function notifyListeners() {
    listeners.forEach(cb => cb(
        sharedUser, 
        sharedLoading, 
        sharedServerSessionReady, 
        sharedServerSessionError, 
        sharedEmployeePhoto, 
        sharedEmployeeName
    ));
}

async function syncServerSession(accessToken: string): Promise<boolean> {
    if (sessionSyncPromise && sessionSyncToken === accessToken) {
        return sessionSyncPromise;
    }
    
    sessionSyncToken = accessToken;
    sessionSyncPromise = (async () => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_token: accessToken })
            });
            
            if (!response.ok) {
                console.error('[Auth] Failed to synchronize server session cookie', { status: response.status });
                return false;
            }
            return true;
        } catch (err) {
            console.error('[Auth] Error during session synchronization:', err);
            return false;
        } finally {
            if (sessionSyncToken === accessToken) {
                sessionSyncPromise = null;
            }
        }
    })();
    return sessionSyncPromise;
}

async function fetchEmployeeData(user: User) {
    try {
        let { data } = await supabase
            .from('employees')
            .select('photo_url, full_name')
            .eq('employee_id_hash', user.id)
            .maybeSingle();

        if (!data && user.email) {
            const { data: byEmail } = await supabase
                .from('employees')
                .select('photo_url, full_name')
                .eq('email', user.email)
                .maybeSingle();
            data = byEmail;
        }

        if (data) {
            sharedEmployeePhoto = data.photo_url || null;
            sharedEmployeeName = data.full_name || null;
        } else {
            sharedEmployeePhoto = null;
            sharedEmployeeName = null;
        }
    } catch (err) {
        console.error("[Auth Singleton] Failed to fetch employee data:", err);
    }
}

function initializeSharedAuth() {
    if (isInitialized) return;
    isInitialized = true;

    const timeoutId = setTimeout(() => {
        if (sharedLoading) {
            sharedLoading = false;
            sharedServerSessionReady = false;
            sharedServerSessionError = new Error("Auth initialization timed out");
            notifyListeners();
        }
    }, 10000);

    const checkSession = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.error("[Auth Singleton] Supabase getSession error:", error);
            }
            if (session?.access_token) {
                const success = await syncServerSession(session.access_token);
                if (success) {
                    lastSyncedToken = session.access_token;
                    sharedServerSessionReady = true;
                    sharedServerSessionError = null;
                } else {
                    sharedServerSessionReady = false;
                    sharedServerSessionError = new Error("Failed to synchronize session");
                }
            } else {
                sharedServerSessionReady = false;
            }
            sharedUser = session?.user ?? null;
            if (sharedUser) {
                await fetchEmployeeData(sharedUser);
            }
        } catch (err) {
            console.error("[Auth Singleton] Error checking initial session:", err);
            sharedServerSessionReady = false;
            sharedServerSessionError = err instanceof Error ? err : new Error(String(err));
        } finally {
            sharedLoading = false;
            clearTimeout(timeoutId);
            notifyListeners();
        }
    };

    checkSession();

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        sharedUser = session?.user ?? null;

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session?.access_token) {
                const shouldSync = event === 'INITIAL_SESSION' || session.access_token !== lastSyncedToken;
                if (shouldSync) {
                    const success = await syncServerSession(session.access_token);
                    if (success) {
                        lastSyncedToken = session.access_token;
                        sharedServerSessionReady = true;
                        sharedServerSessionError = null;
                    } else {
                        sharedServerSessionReady = false;
                        sharedServerSessionError = new Error("Failed to synchronize session");
                    }
                } else {
                    sharedServerSessionReady = true;
                    sharedServerSessionError = null;
                }
            } else {
                sharedServerSessionReady = false;
            }
        } else if (event === 'SIGNED_OUT') {
            sharedUser = null;
            sharedServerSessionReady = false;
            sharedServerSessionError = null;
            lastSyncedToken = null;
            sessionSyncPromise = null;
            sessionSyncToken = null;
            // Notify immediately to stop polling
            notifyListeners();

            try {
                const response = await fetch('/api/auth/logout', { 
                    method: 'POST',
                    credentials: 'include'
                });
                if (!response.ok) {
                    console.error('[Auth] Failed to clear server session cookie', { status: response.status });
                }
            } catch (err) {
                console.error('[Auth] Error during logout synchronization:', err);
            }
        }

        if (sharedUser) {
            await fetchEmployeeData(sharedUser);
        } else {
            sharedEmployeePhoto = null;
            sharedEmployeeName = null;
        }
        sharedLoading = false;
        clearTimeout(timeoutId);
        notifyListeners();
    });

    authSubscription = data.subscription;
}

function cleanupSharedAuth() {
    if (listeners.size === 0) {
        if (authSubscription) {
            authSubscription.unsubscribe();
            authSubscription = null;
        }
        isInitialized = false;
    }
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(sharedUser);
    const [loading, setLoading] = useState(sharedLoading);
    const [serverSessionReady, setServerSessionReady] = useState(sharedServerSessionReady);
    const [serverSessionError, setServerSessionError] = useState<Error | null>(sharedServerSessionError);
    const [employeePhoto, setEmployeePhoto] = useState<string | null>(sharedEmployeePhoto);
    const [employeeName, setEmployeeName] = useState<string | null>(sharedEmployeeName);

    useEffect(() => {
        initializeSharedAuth();

        const handleChange: Listener = (u, l, r, e, p, n) => {
            setUser(u);
            setLoading(l);
            setServerSessionReady(r);
            setServerSessionError(e);
            setEmployeePhoto(p);
            setEmployeeName(n);
        };

        listeners.add(handleChange);

        setUser(sharedUser);
        setLoading(sharedLoading);
        setServerSessionReady(sharedServerSessionReady);
        setServerSessionError(sharedServerSessionError);
        setEmployeePhoto(sharedEmployeePhoto);
        setEmployeeName(sharedEmployeeName);

        return () => {
            listeners.delete(handleChange);
            cleanupSharedAuth();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const mappedUser = useMemo(() => {
        if (!user) return null;
        return {
            ...user,
            uid: user.id,
            displayName: employeeName || user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.displayName || user.email?.split('@')[0] || user.email,
            photoURL: employeePhoto || user.user_metadata?.avatar_url || user.user_metadata?.picture || user.user_metadata?.photoURL || null
        };
    }, [user, employeePhoto, employeeName]);

    return { 
        user: mappedUser, 
        loading, 
        serverSessionReady,
        serverSessionError,
        signOut
    };
}

