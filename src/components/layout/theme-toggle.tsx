'use client';

import React from 'react';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';
import { useTheme, type ThemeMode, type AppTheme, THEMES } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

export function ThemeToggle() {
    const { mode, setMode, theme, setTheme } = useTheme();

    const modes: { id: ThemeMode; label: string; icon: React.ElementType }[] = [
        { id: 'light', label: 'Light Mode', icon: Sun },
        { id: 'dark', label: 'Dark Mode', icon: Moon },
        { id: 'dark-grey', label: 'Dark Grey', icon: Monitor },
    ];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                    {mode === 'light' ? (
                        <Sun className="h-4 w-4" />
                    ) : mode === 'dark' ? (
                        <Moon className="h-4 w-4" />
                    ) : (
                        <Monitor className="h-4 w-4" />
                    )}
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    <span>Appearance</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    {modes.map((m) => (
                        <DropdownMenuItem
                            key={m.id}
                            onClick={() => setMode(m.id)}
                            className={cn(
                                "flex items-center gap-2 cursor-pointer",
                                mode === m.id && "bg-accent text-accent-foreground font-medium"
                            )}
                        >
                            <m.icon className="h-4 w-4" />
                            <span>{m.label}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    <span>Accent Colors</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="grid grid-cols-3 gap-2 p-2">
                    {THEMES.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTheme(t.id)}
                            className={cn(
                                "group relative flex flex-col items-center gap-1 rounded-md p-2 hover:bg-accent/50 transition-all",
                                theme === t.id && "bg-accent/80 shadow-sm ring-1 ring-primary/20"
                            )}
                            title={t.name}
                        >
                            <div 
                                className="h-6 w-6 rounded-full border border-white/20 shadow-inner"
                                style={{ backgroundColor: `hsl(${t.primary})` }}
                            />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                                {t.id}
                            </span>
                            {theme === t.id && (
                                <div className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[6px] text-white">
                                    ✓
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
