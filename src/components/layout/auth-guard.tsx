'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children, initialSession }: { children: React.ReactNode; initialSession?: boolean }) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const loading = authLoading;

    useEffect(() => {
        // Prevent redirects while loading
        if (loading) return;

        // AUTH LOCK: Only allow access if client-side auth confirms a user
        if (!user && !initialSession) {
            console.log("No authenticated user found for protected route:", pathname);
            router.push('/login');
            return;
        }

        if (user) {
            if (pathname === '/change-password') {
                console.log("Redirecting /change-password to /dashboard/profile");
                router.push('/dashboard/profile');
            }
        }
    }, [user, loading, router, pathname, initialSession]);

    // Optimize SSR and Navigation: Trust the server-side cookie presence for immediate rendering.
    if (loading && !initialSession) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background z-50 fixed inset-0">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-semibold text-muted-foreground animate-pulse">Verifying secure session...</p>
                </div>
            </div>
        );
    }

    // If finished loading and no valid user is found, render nothing while useEffect redirects
    if (!user) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background z-50 fixed inset-0">
                {/* Empty container while redirecting */}
            </div>
        );
    }

    // Strict Guard: Redirect away from unused /change-password page
    if (pathname === '/change-password') {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background z-50 fixed inset-0">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-semibold text-muted-foreground">Redirecting to profile...</p>
                </div>
            </div>
        );
    }

    // Render protected content instantly using optimistic SSR rendering.
    return <>{children}</>;
}
