import { Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetadataPanelProps {
    createdBy?: string;
    createdOn?: string;
    updatedBy?: string;
    updatedOn?: string;
    className?: string;
}

export function MetadataPanel({
    createdBy,
    createdOn,
    updatedBy,
    updatedOn,
    className
}: MetadataPanelProps) {
    const isValid = (val?: string) => val && val.trim() !== "" && val !== "-" && val !== "N/A" && val !== "--";

    const renderField = (label: string, icon: React.ReactNode, value?: string) => {
        if (!isValid(value)) return null;
        
        return (
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    {icon} {label}
                </span>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {value}
                </span>
            </div>
        );
    };

    return (
        <div className={cn("mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-6", className)}>
            {renderField("Created By", <User className="h-3 w-3" />, createdBy)}
            {renderField("Created On", <Clock className="h-3 w-3" />, createdOn)}
            {renderField("Updated By", <User className="h-3 w-3" />, updatedBy)}
            {renderField("Updated On", <Clock className="h-3 w-3" />, updatedOn)}
        </div>
    );
}
