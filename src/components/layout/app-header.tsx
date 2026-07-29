'use client';

import React, { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Bell, Settings, Search, Command } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { mainNavLinks } from '@/components/navigation/main-nav-links';
import { PunchStatusTimer } from './punch-status-timer';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useAttendance } from '@/contexts/AttendanceContext';
import { useTaskReminder } from '@/components/providers/task-reminder-provider';
import { ThemeToggle } from './theme-toggle';
import { GlobalActiveWorkBar } from '@/components/dashboard/work/GlobalActiveWorkBar';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { User, LogOut, ChevronRight } from 'lucide-react';

export function AppHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isPunchedIn, punchOut } = useAttendance();
  const { pendingCount } = useTaskReminder();
  const [syncedPhoto, setSyncedPhoto] = React.useState<string | null>(null);

  // Memoized page title and breadcrumb logic
  const allLinks = React.useMemo(() => 
    mainNavLinks.flatMap(link => [
      { href: link.href, label: link.label },
      ...(link.subLinks || []).map(sub => ({ href: sub.href, label: sub.label }))
    ]).sort((a, b) => b.href.length - a.href.length),
  []);

  const pageTitle = React.useMemo(() => {
    const exactMatch = allLinks.find(link => pathname === link.href);
    if (exactMatch) return exactMatch.label;
    const matchedLink = allLinks.find(link => pathname.startsWith(link.href + '/'));
    return matchedLink ? matchedLink.label : "Dashboard";
  }, [pathname, allLinks]);

  // Build breadcrumb segments
  const breadcrumbs = React.useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length <= 1) return [];
    // Skip 'dashboard' prefix, capitalize remaining
    return segments.slice(1, -1).map(seg =>
      seg.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    );
  }, [pathname]);

  // Sync photo from Employee record if missing
  useEffect(() => {
    if (!user) return;
    const syncPhoto = async () => {
      try {
        // Try by employee_id_hash first
        let { data } = await supabase
          .from('employees')
          .select('photo_url')
          .eq('employee_id_hash', user.uid)
          .maybeSingle();

        // Fallback: match by email
        if (!data?.photo_url && user.email) {
          const { data: byEmail } = await supabase
            .from('employees')
            .select('photo_url')
            .eq('email', user.email)
            .maybeSingle();
          data = byEmail;
        }

        if (data?.photo_url) {
          setSyncedPhoto(data.photo_url);
        }
      } catch {
        // Employee record may not exist yet
      }
    };
    syncPhoto();
  }, [user]);

  const initials = user?.displayName
    ?.split(' ')
    .map((n: string) => n.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/40 bg-background/70 px-4 backdrop-blur-xl md:px-6">
      {/* Left section — Sidebar trigger + Breadcrumb + Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <SidebarTrigger className="h-8 w-8 shrink-0" />

        {/* Divider */}
        <div className="hidden md:block w-px h-5 bg-border/60" />

        {/* Breadcrumb + Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              <span className="hidden md:inline text-xs text-muted-foreground/70 font-medium">{crumb}</span>
              <ChevronRight className="hidden md:inline h-3 w-3 text-muted-foreground/40 shrink-0" />
            </React.Fragment>
          ))}
          <h1 className="text-sm font-semibold text-foreground truncate">{pageTitle}</h1>
        </div>
      </div>

      {/* Right section — Actions */}
      <div className="flex items-center gap-2">
        {/* Active Work Pill */}
        <GlobalActiveWorkBar />

        {/* Punch Timer — compact on mobile */}
        <div className="hidden sm:block">
          <PunchStatusTimer />
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          asChild
        >
          <Link href="/dashboard/notifications" prefetch={true}>
            <Bell className="h-4 w-4" />
            {pendingCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-1 ring-2 ring-background animate-in zoom-in">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </Link>
        </Button>

        {/* Divider */}
        <div className="w-px h-5 bg-border/60" />

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-7 w-7 ring-1 ring-border/50">
                <AvatarImage src={syncedPhoto || user?.photoURL || undefined} alt={user?.displayName || "User"} />
                <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-xs font-semibold text-foreground leading-tight truncate max-w-[120px]">
                  {user?.displayName || "User"}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight truncate max-w-[120px]">
                  {user?.email}
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={syncedPhoto || user?.photoURL || undefined} alt={user?.displayName || "User"} />
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-0.5">
                  <p className="text-sm font-semibold leading-none">{user?.displayName || "User"}</p>
                  <p className="text-[11px] leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile" className="cursor-pointer" prefetch={true}>
                  <User className="mr-2 h-4 w-4" />
                  <span>My Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="cursor-pointer" prefetch={true}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            {/* Mobile-only Punch Timer */}
            <div className="sm:hidden px-2 py-1.5">
              <PunchStatusTimer />
            </div>
            <div className="sm:hidden">
              <DropdownMenuSeparator />
            </div>

            <DropdownMenuItem onClick={async () => {
              // Auto punch out if currently punched in
              if (isPunchedIn) {
                try {
                  await punchOut();
                } catch (err) {
                  console.error("Auto punch-out on logout failed:", err);
                }
              }
              sessionStorage.removeItem('is_logged_in');
              sessionStorage.removeItem('auto_punch_in_done');
              await supabase.auth.signOut();
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login?loggedOut=true';
            }} className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
