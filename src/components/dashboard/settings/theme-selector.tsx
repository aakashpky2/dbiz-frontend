'use client';

import { useTheme, THEMES, type AppTheme } from '@/components/providers/theme-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeSelector() {
    const { theme: activeTheme, setTheme } = useTheme();

    return (
        <Card className="shadow-sm border-none bg-white/80 backdrop-blur-md">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Palette className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Accent Theme</CardTitle>
                        <CardDescription>Choose a colour palette for the entire application.</CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {THEMES.map((t) => {
                        const isActive = activeTheme === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => setTheme(t.id as AppTheme)}
                                className={cn(
                                    'group relative flex flex-col items-center gap-2 rounded-2xl p-3 border-2 transition-all duration-200 cursor-pointer text-left',
                                    isActive
                                        ? 'border-slate-900 shadow-lg scale-105'
                                        : 'border-transparent hover:border-slate-200 hover:shadow-md hover:scale-102'
                                )}
                            >
                                {/* Colour swatch */}
                                <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-inner">
                                    {/* Primary segment */}
                                    <div
                                        className="absolute inset-0"
                                        style={{ backgroundColor: `hsl(${t.primary})` }}
                                    />
                                    {/* Secondary strip */}
                                    <div
                                        className="absolute bottom-0 left-0 right-0 h-1/3"
                                        style={{ backgroundColor: `hsl(${t.secondary})` }}
                                    />
                                    {/* Accent dot */}
                                    <div
                                        className="absolute top-2 right-2 h-4 w-4 rounded-full border-2 border-white shadow"
                                        style={{ backgroundColor: `hsl(${t.accent})` }}
                                    />
                                    {/* Active checkmark */}
                                    {isActive && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                                            <div className="h-7 w-7 rounded-full bg-white flex items-center justify-center shadow-md">
                                                <Check className="h-4 w-4 text-slate-900" strokeWidth={3} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Label */}
                                <div className="text-center w-full">
                                    <p className={cn('text-xs font-bold leading-tight', isActive ? 'text-slate-900' : 'text-slate-700')}>
                                        {t.name}
                                    </p>
                                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5 hidden sm:block">{t.description}</p>
                                </div>

                                {/* Active badge */}
                                {isActive && (
                                    <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center">
                                        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <p className="text-[11px] text-slate-400 mt-4 text-center">
                    Theme is saved and applied automatically on every visit.
                </p>
            </CardContent>
        </Card>
    );
}
