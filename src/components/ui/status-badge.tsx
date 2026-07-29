import { Badge, BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps extends BadgeProps {
  status: string;
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  let colorClass = "bg-muted text-foreground hover:bg-muted border-border"; // default

  const lowerStatus = status?.toLowerCase() || '';

  if (['pending', 'in progress', 'waiting', 'open', 'ongoing'].includes(lowerStatus)) {
    colorClass = "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200";
  } else if (['completed', 'approved', 'active', 'validated', 'resolved', 'success', 'done'].includes(lowerStatus)) {
    colorClass = "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200";
  } else if (['rejected', 'failed', 'error', 'cancelled', 'overdue', 'incomplete'].includes(lowerStatus)) {
    colorClass = "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200";
  } else if (['draft', 'new', 'unassigned', 'generated'].includes(lowerStatus)) {
    colorClass = "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200";
  } else if (['flow work'].includes(lowerStatus)) {
    colorClass = "bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200";
  } else if (['no flow work'].includes(lowerStatus)) {
    colorClass = "bg-muted/50 text-foreground hover:bg-muted border-border";
  } else if (['high', 'urgent'].includes(lowerStatus)) {
    colorClass = "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200";
  } else if (['medium', 'normal'].includes(lowerStatus)) {
    colorClass = "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200";
  } else if (['low'].includes(lowerStatus)) {
    colorClass = "bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200";
  }

  return (
    <Badge 
      variant="outline" 
      className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5", colorClass, className)} 
      {...props}
    >
      {status}
    </Badge>
  );
}
