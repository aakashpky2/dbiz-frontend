import { PageSkeleton } from '@/components/ui/page-skeleton';
export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import { Loader2, ArrowRight, ShieldCheck, CalendarDays, Users, ListChecks, CheckCircle, Clock, AlertCircle, Activity } from "lucide-react";
import { getDashboardSummary } from "@/actions/dashboard";
import { AutoPunchIn } from "@/components/dashboard/auto-punch-in";
import { dashboardWidgets, DashboardWidget } from "@/features/dashboard/dashboard-widgets";
import * as AllCharts from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { AdminOverview } from "@/components/dashboard/admin-overview";
import { RecentActivity } from "@/components/dashboard/recent-activity";
function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className="p-6"><PageSkeleton /></div>
  );
}

function DynamicWidgetRenderer({ widget, data }: { widget: DashboardWidget; data: any }) {
    if (widget.type === 'chart') {
        const ChartComponent = (AllCharts as any)[widget.component as string];
        if (!ChartComponent) return <div className="text-red-500">Component {widget.component as string} not found</div>;
        
        return (
            <Card className="shadow-sm border-none bg-card/60 backdrop-blur-sm h-[450px] flex flex-col">
                <CardHeader className="flex-none">
                    <CardTitle>{widget.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-[350px] w-full p-4 relative">
                    <ChartComponent data={data[widget.key] || []} />
                </CardContent>
            </Card>
        );
    }
    return <div>Unsupported widget type: {widget.type}</div>;
}

import { redirect } from 'next/navigation';
import { DashboardHero } from '@/components/dashboard/dashboard-hero';

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  if ((summary as any)._error) {
      return (
        <div className="flex flex-col space-y-10 pb-10">
          <AutoPunchIn />
          <div className="p-8 m-8 border border-red-200 bg-red-50 text-red-600 rounded-xl flex items-center justify-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <p className="font-medium">Failed to load dashboard data: {(summary as any)._error}</p>
          </div>
        </div>
      );
  }
  if ((summary as any)._redirect) {
      redirect('/login?loggedOut=true');
  }
  
  const profile = summary.profile as any;
  
  // Filter widgets by profile
  const activeWidgets = dashboardWidgets.filter(w => w.dashboardProfiles.includes(profile));
  const activeCharts = activeWidgets.filter(w => w.type === 'chart').sort((a,b) => a.sortOrder - b.sortOrder);
  
  const quickAccessLinks = [
    { label: "Add Employee", href: "/dashboard/employee-directory/add", icon: Users, description: "Onboard new team member" },
    { label: "Attendance Rules", href: "/dashboard/employee-management/attendance", icon: CalendarDays, description: "Configure policies" },
    { label: "Compliance Checks", href: "/dashboard/admin/compliance-rules", icon: ShieldCheck, description: "Review standard rules" },
    { label: "Task Board", href: "/dashboard/work-register/my-tasks", icon: ListChecks, description: "Manage team workload" },
  ];

  return (
    <div className="flex flex-col space-y-10 pb-10 animate-in fade-in duration-300">
      <AutoPunchIn />

      <DashboardHero />

      {/* KPI Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Key Metrics</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.keys(summary.kpis || {}).map((kpiKey, index) => {
                // Determine a nice color/icon mapping for KPIs
                const colors = ["text-blue-500", "text-green-500", "text-amber-500", "text-indigo-500", "text-purple-500", "text-pink-500"];
                const bgs = ["bg-blue-500/10", "bg-green-500/10", "bg-amber-500/10", "bg-indigo-500/10", "bg-purple-500/10", "bg-pink-500/10"];
                const colorIndex = index % colors.length;
                const Icon = [Users, Clock, AlertCircle, CheckCircle, Activity][colorIndex % 5];
                
                return (
                    <Card key={kpiKey} className="relative overflow-hidden group rounded-2xl border border-slate-200/60 bg-white dark:bg-slate-900 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300">
                        <div className={`absolute -right-6 -top-6 h-32 w-32 rounded-full ${bgs[colorIndex]} blur-3xl opacity-40 group-hover:opacity-70 transition-opacity duration-500`} />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-6 px-6 relative z-10">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">{kpiKey.replace(/([A-Z])/g, ' $1').trim()}</CardTitle>
                            <div className={`p-2 rounded-lg ${bgs[colorIndex]} shadow-sm group-hover:scale-105 transition-transform duration-300`}>
                                <Icon className={`h-4 w-4 ${colors[colorIndex]}`} />
                            </div>
                        </CardHeader>
                        <CardContent className="px-6 pb-6 relative z-10">
                            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{summary.kpis[kpiKey]}</div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                                <span className={`h-1.5 w-1.5 rounded-full ${bgs[colorIndex].replace('/10', '')}`} />
                                Current Count
                            </p>
                        </CardContent>
                    </Card>
                );
            })}
            {Object.keys(summary.kpis || {}).length === 0 && (
                 <div className="col-span-full p-4 border border-dashed rounded-xl flex justify-center text-muted-foreground">No KPIs available</div>
            )}
        </div>
      </div>

      {/* Chart Section */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center gap-2 px-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Performance Insights</h3>
        </div>
        
        {activeCharts.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
              {activeCharts.map(widget => (
                  <Suspense key={widget.key} fallback={<LoadingSkeleton className="h-[450px] w-full rounded-3xl" />}>
                      <DynamicWidgetRenderer widget={widget} data={summary.charts || {}} />
                  </Suspense>
              ))}
            </div>
        ) : (
            <div className="p-8 border border-dashed rounded-xl flex justify-center text-muted-foreground bg-slate-50/50 dark:bg-slate-900/50">
                No dashboard widgets assigned to your role
            </div>
        )}
      </div>

      {/* Tables Section */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center gap-2 px-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Detailed Records</h3>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
             {Object.keys(summary.tables || {}).map(tableKey => {
                 const rows = summary.tables[tableKey] || [];
                 return (
                     <Card key={tableKey} className="border-none shadow-sm bg-white dark:bg-slate-900 h-[400px] overflow-hidden flex flex-col">
                         <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-800/50">
                             <CardTitle className="capitalize tracking-tight font-bold">{tableKey.replace(/_/g, ' ')}</CardTitle>
                         </CardHeader>
                         <CardContent className="flex-1 overflow-auto p-0">
                             {rows.length > 0 ? (
                                 tableKey === 'recent_activities' ? (
                                     <div className="p-4"><RecentActivity activities={rows} /></div>
                                 ) : (
                                     <div className="p-4 overflow-x-auto">
                                         <table className="w-full text-sm text-left">
                                             <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
                                                 <tr>
                                                     {Object.keys(rows[0] || {}).map(key => (
                                                         key !== 'id' && <th key={key} className="px-4 py-3">{key.replace(/_/g, ' ')}</th>
                                                     ))}
                                                 </tr>
                                             </thead>
                                             <tbody>
                                                 {rows.map((row: any, idx: number) => (
                                                     <tr key={row.id || idx} className="border-b dark:border-slate-800">
                                                         {Object.entries(row).map(([k, v]) => {
                                                             if (k === 'id') return null;
                                                             return <td key={k} className="px-4 py-3">{String(v || '-')}</td>;
                                                         })}
                                                     </tr>
                                                 ))}
                                             </tbody>
                                         </table>
                                     </div>
                                 )
                             ) : (
                                 <div className="h-full flex items-center justify-center p-8 text-muted-foreground">
                                     <p>No data available yet</p>
                                 </div>
                             )}
                         </CardContent>
                     </Card>
                 );
             })}
             {Object.keys(summary.tables || {}).length === 0 && (
                 <div className="col-span-full p-8 border border-dashed rounded-xl flex justify-center text-muted-foreground bg-slate-50/50 dark:bg-slate-900/50">
                     No tables available
                 </div>
             )}
        </div>
      </div>
      
      {/* Bottom Section: Quick Access */}
      {(profile === 'super_admin' || profile === 'admin') && (
          <div className="grid gap-8 grid-cols-1 mt-10">
              <Card className="border-none shadow-xl bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-xl">
                  <CardHeader className="pb-6">
                      <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/20">
                              <ShieldCheck className="h-6 w-6 text-white" />
                          </div>
                          <div>
                              <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Workspace Tools</CardTitle>
                              <CardDescription className="text-sm font-semibold text-slate-500">Streamline your daily operations</CardDescription>
                          </div>
                      </div>
                  </CardHeader>
                  <CardContent className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
                      {quickAccessLinks.map((link) => (
                          <Link
                              key={link.label}
                              href={link.href}
                              className="group relative overflow-hidden p-6 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 hover:border-indigo-500/50 shadow-sm hover:shadow-xl transition-all duration-500"
                          >
                              <div className="relative z-10 flex flex-col mb-4 gap-4">
                                  <div className="p-3.5 rounded-2xl w-fit bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                                      <link.icon className="h-6 w-6" />
                                  </div>
                                  <div>
                                      <div className="font-extrabold text-lg text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 transition-colors duration-300">
                                          {link.label}
                                      </div>
                                      <div className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                          {link.description}
                                      </div>
                                  </div>
                              </div>
                          </Link>
                      ))}
                  </CardContent>
              </Card>
              
              {/* Keep AdminOverview for backwards compatibility if needed */}
              <AdminOverview kpis={summary.kpis || {}} />
          </div>
      )}
    </div>
  );
}