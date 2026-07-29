import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity } from "lucide-react";

interface RecentActivityProps {
    activities: {
        id: string;
        action: string;
        target: string;
        by: string;
        time: string;
    }[];
}

export function RecentActivity({ activities }: RecentActivityProps) {
    if (activities.length === 0) {
        return (
            <EmptyState 
                icon={<Activity className="h-8 w-8 text-slate-300" />}
                title="No recent activity"
                description="Activity logs will appear here once actions are performed on the platform."
                className="py-8"
            />
        );
    }

    return (
        <div className="relative space-y-6 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
            {activities.map((activity, idx) => (
                <div key={activity.id} className="relative flex items-center gap-6 group">
                    {/* Activity Indicator / Indicator Dot */}
                    <div className="relative z-10 flex-shrink-0">
                        <div className="h-9 w-9 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 flex items-center justify-center font-black text-indigo-600 dark:text-indigo-400 text-sm shadow-sm group-hover:border-indigo-500 group-hover:scale-110 transition-all duration-300">
                            {activity.by.charAt(0).toUpperCase()}
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 min-w-0 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 p-4 rounded-2xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-xl hover:shadow-slate-200/20 transition-all duration-300">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                                <span className="font-bold text-slate-900 dark:text-white">{activity.by}</span>
                                {' '}
                                <span className="font-medium">{activity.action.toLowerCase()}</span>
                                {' '}
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{activity.target}</span>
                            </p>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {activity.time}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
