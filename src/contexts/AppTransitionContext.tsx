'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

interface AppTransitionContextType {
    startTransition: () => void;
    completeTransition: () => void;
}

const AppTransitionContext = createContext<AppTransitionContextType>({
    startTransition: () => {},
    completeTransition: () => {},
});

export function AppTransitionProvider({ children }: { children: React.ReactNode }) {
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [isRendered, setIsRendered] = useState(false);

    useEffect(() => {
        if (isTransitioning) {
            setIsRendered(true);
        } else {
            const timer = setTimeout(() => setIsRendered(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isTransitioning]);

    const completeTransition = useCallback(() => {
        requestAnimationFrame(() => {
            setTimeout(() => setIsTransitioning(false), 50);
        });
    }, []);

    return (
        <AppTransitionContext.Provider value={{
            startTransition: () => setIsTransitioning(true),
            completeTransition
        }}>
            {children}
            {isRendered && (
                <div 
                    className={`fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center transition-opacity duration-300 ${isTransitioning ? 'opacity-100' : 'opacity-0'}`}
                >
                    <div className="flex flex-col items-center gap-6">
                        <div className="w-24 h-24 rounded-[2rem] overflow-hidden shadow-2xl border border-white/30 relative bg-white/5 animate-pulse">
                            <Image src="/imgfav.png" alt="Logo" width={96} height={96} className="object-cover w-full h-full" priority />
                        </div>
                        <div className="flex items-center gap-3 text-white/70">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="font-medium tracking-widest uppercase text-sm">Preparing Workspace...</span>
                        </div>
                    </div>
                </div>
            )}
        </AppTransitionContext.Provider>
    );
}

export const useAppTransition = () => useContext(AppTransitionContext);
