import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface DashboardStatsProps {
    stats: {
        totalEmployees: number;
        attendanceToday: {
            percentage: number;
            present: number;
            absent: number;
        };
        pendingTasks: number;
        complianceScore: number;
    };
}

export function DashboardStats({ stats }: DashboardStatsProps) {
    const statItems = [
        {
            title: "Total Employees",
            value: stats.totalEmployees > 0 ? stats.totalEmployees.toString() : "My Stats",
            description: stats.totalEmployees > 0 ? "Active in directory" : "Personal overview",
            icon: Users,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
        },
        {
            title: "Attendance Today",
            value: `${stats.attendanceToday.percentage}%`,
            description: `${stats.attendanceToday.present} present, ${stats.attendanceToday.absent} absent`,
            icon: Clock,
            color: "text-green-500",
            bg: "bg-green-500/10",
        },
        {
            title: "Pending Tasks",
            value: stats.pendingTasks.toString(),
            description: "Active workflows",
            icon: AlertCircle,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
        },
        {
            title: "Compliance Score",
            value: stats.complianceScore === -1 ? "N/A" : `${stats.complianceScore}%`,
            description: stats.complianceScore === -1 ? "Coming Soon" : "All departments verified",
            icon: CheckCircle,
            color: "text-indigo-500",
            bg: "bg-indigo-500/10",
        },
    ];

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {statItems.map((stat) => (
                <Card key={stat.title} className="relative overflow-hidden group rounded-2xl border border-slate-200/60 bg-white dark:bg-slate-900 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300">
                    {/* Background accent */}
                    <div className={`absolute -right-6 -top-6 h-32 w-32 rounded-full ${stat.bg} blur-3xl opacity-40 group-hover:opacity-70 transition-opacity duration-500`} />

                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-6 px-6 relative z-10">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">{stat.title}</CardTitle>
                        <div className={`p-2 rounded-lg ${stat.bg} shadow-sm group-hover:scale-105 transition-transform duration-300`}>
                            <stat.icon className={`h-4 w-4 ${stat.color}`} />
                        </div>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 relative z-10">
                        <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stat.value}</div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${stat.bg.replace('/10', '')}`} />
                            {stat.description}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
