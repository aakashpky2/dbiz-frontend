import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FileKey, Clock, LayoutDashboard } from "lucide-react";
import { DSC, DSCWorkflowStage } from "./types";

interface DSCStatsProps {
    dscs: DSC[];
    stages: DSCWorkflowStage[];
    totalIssued: number;
    activeIssued: number;
    totalClient: number;
    activeClient: number;
    expiringCount: number;
}

export function DSCStats({
    dscs,
    stages,
    totalIssued,
    activeIssued,
    totalClient,
    activeClient,
    expiringCount,
}: DSCStatsProps) {
    const getStageCount = (stageId: string) => {
        return dscs.filter(d => d.currentStageId === stageId).length;
    };

    const pendingCount = dscs.filter(d => !d.currentStageId).length;

    return (
        <div className="flex flex-col gap-3 shrink-0">
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="relative overflow-hidden border-none shadow-sm bg-gradient-to-br from-indigo-500 to-purple-600 text-white min-h-[5rem]">
                    <div className="absolute top-0 right-0 p-2 opacity-20">
                        <FileKey className="w-16 h-16" />
                    </div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4 relative z-10">
                        <CardTitle className="text-xs font-medium text-white/90">Issued DSC</CardTitle>
                        <div className="bg-white/20 p-1.5 rounded-full"><FileKey className="h-3 w-3 text-white" /></div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0 relative z-10">
                        <div className="text-2xl font-extrabold mb-0.5">{totalIssued}</div>
                        <p className="text-[10px] text-indigo-100 font-medium tracking-wide">
                            Active (by expiry): {activeIssued}
                        </p>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-none shadow-sm bg-gradient-to-br from-blue-500 to-cyan-500 text-white min-h-[5rem]">
                    <div className="absolute top-0 right-0 p-2 opacity-20">
                        <Users className="w-16 h-16" />
                    </div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4 relative z-10">
                        <CardTitle className="text-xs font-medium text-white/90">Client DSC</CardTitle>
                        <div className="bg-white/20 p-1.5 rounded-full"><Users className="h-3 w-3 text-white" /></div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0 relative z-10">
                        <div className="text-2xl font-extrabold mb-0.5">{totalClient}</div>
                        <p className="text-[10px] text-blue-100 font-medium tracking-wide">
                            Active (by expiry): {activeClient}
                        </p>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-none shadow-sm bg-gradient-to-br from-rose-500 to-orange-500 text-white min-h-[5rem]">
                    <div className="absolute top-0 right-0 p-2 opacity-20">
                        <Clock className="w-16 h-16" />
                    </div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4 relative z-10">
                        <CardTitle className="text-xs font-medium text-white/90">Expiring in 30 days</CardTitle>
                        <div className="bg-white/20 p-1.5 rounded-full"><Clock className="h-3 w-3 text-white" /></div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0 relative z-10">
                        <div className="text-2xl font-extrabold mb-0.5">{expiringCount}</div>
                        <p className="text-[10px] text-rose-100 font-medium tracking-wide">DSCs expiring soon</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm border-slate-200/60 overflow-hidden shrink-0">
                <CardHeader className="bg-slate-50/50 border-b py-2 px-4 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-bold text-slate-800">Processing Status Workflow</CardTitle>
                    </div>
                    <div className="bg-blue-100 text-blue-600 p-1.5 rounded-full hidden sm:block">
                        <LayoutDashboard className="h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent className="p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2">
                        {pendingCount > 0 && (
                            <div className="flex flex-col group relative border border-slate-200 p-2 rounded-lg bg-gradient-to-b from-white to-slate-50 shadow-xs hover:shadow-sm transition-all duration-300">
                                <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Pending</span>
                                <span className="text-xl font-black text-slate-800 group-hover:text-slate-900 transition-colors">{pendingCount}</span>
                                <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-300 rounded-b-lg"></div>
                            </div>
                        )}
                        {stages.map((s, index) => {
                            const count = getStageCount(s.id);
                            // Generate a dynamic color class based on index to make stages look distinct
                            const colorClasses = [
                                'from-sky-50 to-white border-sky-200 text-sky-800 marker-sky',
                                'from-indigo-50 to-white border-indigo-200 text-indigo-800 marker-indigo',
                                'from-violet-50 to-white border-violet-200 text-violet-800 marker-violet',
                                'from-fuchsia-50 to-white border-fuchsia-200 text-fuchsia-800 marker-fuchsia',
                                'from-pink-50 to-white border-pink-200 text-pink-800 marker-pink',
                                'from-teal-50 to-white border-teal-200 text-teal-800 marker-teal',
                            ];
                            const theme = colorClasses[index % colorClasses.length];
                            const baseColor = theme.split(' ')[0].replace('from-', ''); // e.g. sky-50
                            const highlightColor = baseColor.replace('-50', '-500');

                            return (
                                <div key={s.id} className={`flex flex-col group relative border p-2 rounded-lg bg-gradient-to-b shadow-xs hover:shadow-sm transition-all duration-300 ${theme}`}>
                                    <span className="text-[9px] font-bold uppercase tracking-wider mb-1 truncate" title={s.name}>{s.name}</span>
                                    <span className="text-xl font-black">{count}</span>
                                    <div className={`absolute bottom-0 left-0 h-1 w-full rounded-b-lg opacity-80 ${theme.includes('marker-sky') ? 'bg-sky-400' : theme.includes('marker-indigo') ? 'bg-indigo-400' : theme.includes('marker-violet') ? 'bg-violet-400' : theme.includes('marker-fuchsia') ? 'bg-fuchsia-400' : theme.includes('marker-pink') ? 'bg-pink-400' : 'bg-teal-400'}`}></div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
