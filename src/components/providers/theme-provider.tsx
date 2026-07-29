'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type AppTheme =
    | 'blue'       // Default — professional blue
    | 'indigo'     // Rich indigo-violet
    | 'emerald'    // Fresh green
    | 'rose'       // Warm rose/pink
    | 'amber'      // Golden amber
    | 'slate';     // Neutral slate (dark-mode-friendly)

export type ThemeMode = 'light' | 'dark' | 'dark-grey';

export interface ThemeDefinition {
    id: AppTheme;
    name: string;
    description: string;
    primary: string;   // HSL values for preview swatch
    secondary: string;
    accent: string;
}

export const THEMES: ThemeDefinition[] = [
    {
        id: 'blue',
        name: 'Ocean Blue',
        description: 'Professional & clean',
        primary: '220 80% 60%',
        secondary: '220 50% 92%',
        accent: '210 90% 55%',
    },
    {
        id: 'indigo',
        name: 'Deep Indigo',
        description: 'Bold & creative',
        primary: '243 75% 59%',
        secondary: '243 50% 93%',
        accent: '263 70% 58%',
    },
    {
        id: 'emerald',
        name: 'Emerald',
        description: 'Fresh & vibrant',
        primary: '152 69% 42%',
        secondary: '152 50% 92%',
        accent: '168 76% 42%',
    },
    {
        id: 'rose',
        name: 'Rose',
        description: 'Warm & energetic',
        primary: '347 77% 55%',
        secondary: '347 60% 93%',
        accent: '328 72% 55%',
    },
    {
        id: 'amber',
        name: 'Amber Gold',
        description: 'Warm & sophisticated',
        primary: '38 92% 50%',
        secondary: '38 80% 93%',
        accent: '25 95% 53%',
    },
    {
        id: 'slate',
        name: 'Slate',
        description: 'Minimal & elegant',
        primary: '215 25% 27%',
        secondary: '215 20% 92%',
        accent: '215 30% 45%',
    },
];

interface ThemeContextValue {
    theme: AppTheme;
    mode: ThemeMode;
    setTheme: (theme: AppTheme) => void;
    setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'blue',
    mode: 'light',
    setTheme: () => { },
    setMode: () => { },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<AppTheme>('blue');
    const [mode, setModeState] = useState<ThemeMode>('light');

    // Load saved theme/mode on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem('app-theme') as AppTheme | null;
        const savedMode = localStorage.getItem('app-mode') as ThemeMode | null;

        if (savedTheme && THEMES.find(t => t.id === savedTheme)) {
            setThemeState(savedTheme);
            applyTheme(savedTheme, mode);
        }
        if (savedMode) {
            setModeState(savedMode);
            applyTheme(theme, savedMode);
        }
    }, [theme, mode]);

    const setTheme = (newTheme: AppTheme) => {
        setThemeState(newTheme);
        localStorage.setItem('app-theme', newTheme);
        applyTheme(newTheme, mode);
    };

    const setMode = (newMode: ThemeMode) => {
        setModeState(newMode);
        localStorage.setItem('app-mode', newMode);
        applyTheme(theme, newMode);
    };

    return (
        <ThemeContext.Provider value={{ theme, mode, setTheme, setMode }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}

function applyTheme(theme: AppTheme, mode: ThemeMode) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    
    // Apply Accent Theme
    root.setAttribute('data-theme', theme);
    
    // Apply Mode (Dark/Light/Grey)
    root.classList.remove('dark', 'dark-grey');
    if (mode === 'dark') {
        root.classList.add('dark');
    } else if (mode === 'dark-grey') {
        root.classList.add('dark', 'dark-grey');
    }
}
