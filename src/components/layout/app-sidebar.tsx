'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

import { useAttendance } from '@/contexts/AttendanceContext';
import { useToast } from '@/hooks/use-toast';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { mainNavLinks, type NavLink } from '@/components/navigation/main-nav-links';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useTaskReminder } from '@/components/providers/task-reminder-provider';
import { usePermissions } from '@/hooks/use-permissions';

const NavItem = React.memo(({ link, pathname, pendingCount }: { link: NavLink; pathname: string; pendingCount: number }) => {
  const isActive = (href: string) => {
    if (href === '/dashboard' && pathname === '/dashboard') return true;
    if (href === '/dashboard' && pathname !== '/dashboard') return false;
    return pathname.startsWith(href);
  };

  const isLinkActive = isActive(link.href);
  const hasSubLinks = link.subLinks && link.subLinks.length > 0;
  const isChildActive = hasSubLinks ? link.subLinks?.some(sub => isActive(sub.href)) : false;

  if (hasSubLinks) {
    return (
      <Collapsible
        key={link.href}
        asChild
        defaultOpen={isChildActive}
        className="group/collapsible"
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={link.label}
              isActive={isChildActive}
              className={cn(
                "hover:bg-sky-500 hover:text-white group/item dark:hover:bg-sky-600 transition-colors",
                isChildActive && "bg-slate-100 text-slate-900 font-medium dark:bg-slate-800 dark:text-white"
              )}
            >
              <link.icon className={cn("h-4 w-4 transition-colors", isChildActive ? "text-blue-600 dark:text-blue-400 group-hover/item:text-white" : "text-slate-500 dark:text-slate-400 group-hover/item:text-white")} />
              <span className="group-hover/item:text-white transition-colors truncate whitespace-nowrap">{link.label}</span>
              <ChevronRight className="ml-auto h-4 w-4 transition-all duration-200 group-data-[state=open]/collapsible:rotate-90 text-slate-400 group-hover/item:text-white" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {link.subLinks?.map((subLink) => (
                <SidebarMenuSubItem key={subLink.href}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isActive(subLink.href)}
                    className={cn(
                      "hover:bg-sky-500 hover:text-white group/sub dark:hover:bg-sky-600",
                      isActive(subLink.href) && "bg-blue-50 text-blue-700 font-medium dark:bg-blue-500/10 dark:text-blue-400"
                    )}
                  >
                    <Link href={subLink.href} prefetch={true} className="flex justify-between items-center w-full">
                      <span className="group-hover/sub:text-white transition-colors truncate whitespace-nowrap">{subLink.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem key={link.href}>
      <SidebarMenuButton
        asChild
        tooltip={link.label}
        isActive={isLinkActive}
        className={cn(
          "hover:bg-sky-500 hover:text-white group/item transition-colors dark:hover:bg-sky-600",
          isLinkActive && "bg-slate-100 text-slate-900 font-medium dark:bg-slate-800 dark:text-white"
        )}
      >
        <Link href={link.href} prefetch={true} className="flex items-center w-full">
          <link.icon className={cn("h-4 w-4 transition-colors", isLinkActive ? "text-blue-600 dark:text-blue-400 group-hover/item:text-white" : "text-slate-500 dark:text-slate-400 group-hover/item:text-white")} />
          <span className="group-hover/item:text-white transition-colors truncate whitespace-nowrap">{link.label}</span>
          {link.href === '/dashboard/work-register/my-tasks' && pendingCount > 0 && (
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white group-hover/item:bg-white group-hover/item:text-red-600 transition-colors">
              {pendingCount}
            </span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});

NavItem.displayName = 'NavItem';

export function AppSidebar() {
  const pathname = usePathname();
  const { pendingCount } = useTaskReminder();
  const { open, setOpen, isMobile } = useSidebar();
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const startTimer = React.useCallback(() => {
    if (!open || isMobile) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setOpen(false);
    }, 5000);
  }, [open, setOpen, isMobile]);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const { isSuperAdmin, highestPriority, hasPermission, isAdminLike, loading } = usePermissions();

  const filteredLinks = React.useMemo(() => {
    if (loading) return [];
    
    return mainNavLinks
      .filter(link => {
        // If highest priority is greater than 2, completely hide the Admin Panel
        if (link.label === 'Admin Panel' && highestPriority > 2) {
          return false;
        }

        // Check requiredPermissionAny
        if (link.requiredPermissionAny && link.requiredPermissionAny.length > 0) {
          if (!link.requiredPermissionAny.some(p => hasPermission(p))) {
            return false;
          }
        }

        // Check requiredPermission
        if (link.requiredPermission && !hasPermission(link.requiredPermission)) {
          // Special fallback for ADMIN panel to avoid hiding for legacy admins before migration finishes
          if (link.label === 'Admin Panel' && isAdminLike) return true;
          return false;
        }

        return true;
      })
      .map(link => {
        if (link.subLinks) {
          const filteredSubLinks = link.subLinks.filter(sub => {
            if (sub.requiredPermissionAny && sub.requiredPermissionAny.length > 0) {
              if (!sub.requiredPermissionAny.some(p => hasPermission(p))) return false;
            }
            if (sub.requiredPermission && !hasPermission(sub.requiredPermission)) {
              return false;
            }
            return true;
          });
          return { ...link, subLinks: filteredSubLinks };
        }
        return link;
      })
      .filter(link => {
        // Hide parent if it has no sublinks left but originally had sublinks
        if (mainNavLinks.find(l => l.label === link.label)?.subLinks && (!link.subLinks || link.subLinks.length === 0)) {
           // Allow Tasks to show if My Tasks is there but let's just filter out empty parents
           return false;
        }
        return true;
      });
  }, [highestPriority, hasPermission, isAdminLike, loading]);

  // Effect to handle timer when sidebar opens/closes manually
  React.useEffect(() => {
    if (open) {
      // Start timer if mouse is potentially already outside
      startTimer();
    } else {
      clearTimer();
    }
    return () => clearTimer();
  }, [open, startTimer, clearTimer]);

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 transition-all duration-300"
      onMouseEnter={() => {
        setOpen(true);
        clearTimer();
      }}
      onMouseLeave={startTimer}
    >
      <SidebarHeader className="h-16 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between bg-white dark:bg-slate-900">
        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary rounded-md group-data-[collapsible=icon]:justify-center">
          {/* Logo icon — themed border + bg */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 border-2 border-primary/30 shadow-sm ring-2 ring-primary/10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 transition-all overflow-hidden">
            <Image
              src="/imgfav.png"
              alt="D BIZ"
              width={56}
              height={56}
              className="h-full w-full object-cover rounded-lg"
              priority
            />
          </div>
          {/* Brand text — themed */}
          <div className="flex flex-col group-data-[collapsible=icon]:hidden transition-all duration-300 ease-in-out">
            <span className="font-black text-base tracking-tight text-primary leading-none whitespace-nowrap truncate">D BIZ OFFICE</span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-none mt-1 whitespace-nowrap truncate">Management System</span>
            {/* Accent underline that matches theme primary */}
            <div className="mt-1 h-0.5 w-full rounded-full bg-primary/40" />
          </div>
        </Link>
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 p-3">
        <SidebarMenu>
          {filteredLinks.map((link: NavLink) => (
            <NavItem key={link.href} link={link} pathname={pathname} pendingCount={pendingCount} />
          ))}
        </SidebarMenu>
      </SidebarContent>

    </Sidebar>
  );
}

