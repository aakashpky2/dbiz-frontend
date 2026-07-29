import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { AttendanceProvider } from '@/contexts/AttendanceContext';
import AuthGuard from '@/components/layout/auth-guard';
import dynamic from 'next/dynamic';
import { RoutePrefetcher } from '@/components/common/RoutePrefetcher';
import { TaskReminderProvider } from '@/components/providers/task-reminder-provider';
import { NavigationProgressBar } from '@/components/layout/navigation-progress-bar';

import IdleTimer from '@/components/layout/idle-timer';
import { GlobalCommand } from '@/components/layout/global-command';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { ActiveWorkProvider } from '@/contexts/ActiveWorkContext';
import { GlobalActiveWorkBar } from '@/components/dashboard/work/GlobalActiveWorkBar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get('session');
  const hasSession = !!session;

  return (
    <AuthGuard initialSession={hasSession}>
      <Suspense fallback={null}>
        <NavigationProgressBar />
      </Suspense>
      <IdleTimer />
      <RoutePrefetcher />
      <AttendanceProvider>
        <TaskReminderProvider>
          <ActiveWorkProvider>
            <div className="flex h-screen w-full overflow-hidden bg-background">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <AppHeader />
                <SidebarInset className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-background/50 overflow-x-hidden backdrop-blur-3xl">
                  {children}
                </SidebarInset>
              </div>
              <GlobalCommand />
            </div>
          </ActiveWorkProvider>
        </TaskReminderProvider>
      </AttendanceProvider>
    </AuthGuard>
  );
}
