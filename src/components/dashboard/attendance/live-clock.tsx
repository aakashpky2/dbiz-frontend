
'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const INDIAN_TIME_ZONE = 'Asia/Kolkata';

interface LiveClockProps {
  timeOffset: number;
  isTimeSynced: boolean;
  className?: string;
}

export function LiveClock({ timeOffset, isTimeSynced, className }: LiveClockProps) {
  const [currentTime, setCurrentTime] = useState(new Date(Date.now() + timeOffset));

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date(Date.now() + timeOffset));
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeOffset]);
  
  const displayedTime = toZonedTime(currentTime, INDIAN_TIME_ZONE);

  return (
    <Card className={cn("overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm relative", className)}>
      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
      <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center relative">
        
        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          {!isTimeSynced ? (
            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50 flex items-center gap-1.5 px-2 py-0.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[10px] uppercase tracking-wider font-semibold">Syncing</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50 flex items-center gap-1 px-2 py-0.5">
              <CheckCircle2 className="h-3 w-3" />
              <span className="text-[10px] uppercase tracking-wider font-semibold">Synced</span>
            </Badge>
          )}
        </div>

        {/* Time Display */}
        <div className="text-center mt-2 mb-1">
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 tabular-nums">
            {format(displayedTime, 'hh:mm:ss a')}
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
            {format(displayedTime, 'EEEE, dd MMMM yyyy')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
