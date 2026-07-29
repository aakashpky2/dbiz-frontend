import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Subscription } from '@supabase/supabase-js';

// Global shared states for auth singleton
let sharedUser: User | null = null;
let sharedLoading = true;
let sharedEmployeePhoto: string | null = null;
let sharedEmployeeName: string | null = null;
let isInitialized = false;
let authSubscription: Subscription | null = null;

// Set of state setters from all active useAuth hook instances
const listeners = new Set<(user: User | null, loading: boolean, photo: string | null, name: string | null) => void>();

function notifyListeners() {
    listeners.forEach(cb => cb(sharedUser, sharedLoading, sharedEmployeePhoto, sharedEmployeeName));
}

async function fetchEmployeeData(user: User) {
    try {
        // Try matching by employee_id_hash (may hold Firebase UID)
        let { data } = await supabase
            .from('employees')
            .select('photo_url, full_name')
            .eq('employee_id_hash', user.id)
            .maybeSingle();

        // Fallback: match by email
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

    // Safety timeout in case Supabase is slow or blocked
    const timeoutId = setTimeout(() => {
        if (sharedLoading) {
            sharedLoading = false;
            notifyListeners();
        }
    }, 10000);

    const checkSession = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.error("[Auth Singleton] Supabase getSession error:", error);
            }
            sharedUser = session?.user ?? null;
            if (sharedUser) {
                await fetchEmployeeData(sharedUser);
            }
        } catch (err) {
            console.error("[Auth Singleton] Error checking initial session:", err);
        } finally {
            sharedLoading = false;
            clearTimeout(timeoutId);
            notifyListeners();
        }
    };

    checkSession();

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        sharedUser = session?.user ?? null;
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
    const [employeePhoto, setEmployeePhoto] = useState<string | null>(sharedEmployeePhoto);
    const [employeeName, setEmployeeName] = useState<string | null>(sharedEmployeeName);

    useEffect(() => {
        // Ensure the single global listener is active
        initializeSharedAuth();

        const handleChange = (u: User | null, l: boolean, p: string | null, n: string | null) => {
            setUser(u);
            setLoading(l);
            setEmployeePhoto(p);
            setEmployeeName(n);
        };

        // Add this hook instance's state updater to our global set
        listeners.add(handleChange);

        // Sync immediate state in case updates happened before mounting
        setUser(sharedUser);
        setLoading(sharedLoading);
        setEmployeePhoto(sharedEmployeePhoto);
        setEmployeeName(sharedEmployeeName);

        return () => {
            listeners.delete(handleChange);
            cleanupSharedAuth();
        };
    }, []);

    // Map user metadata for consistent UI usage across the app (retained exactly identical)
    const mappedUser = useMemo(() => {
        if (!user) return null;
        return {
            ...user,
            uid: user.id, // Keep uid for legacy components that expect it
            displayName: employeeName || user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.displayName || user.email?.split('@')[0] || user.email,
            photoURL: employeePhoto || user.user_metadata?.avatar_url || user.user_metadata?.picture || user.user_metadata?.photoURL || null
        };
    }, [user, employeePhoto, employeeName]);

    return { user: mappedUser, loading };
}
