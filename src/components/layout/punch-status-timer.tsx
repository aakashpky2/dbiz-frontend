
'use client';

import { useState, useEffect } from 'react';
import { useAttendance } from '@/contexts/AttendanceContext';
import { differenceInSeconds } from 'date-fns';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Loader2, Circle, LogIn, LogOut, ChevronDown } from 'lucide-react';

export function PunchStatusTimer() {
  const { isPunchedIn, lastPunchInTime, isLoading, isSubmitting, punchIn, punchOut } = useAttendance();
  const [duration, setDuration] = useState('00:00:00');

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPunchedIn && lastPunchInTime) {
      interval = setInterval(() => {
        const now = new Date();
        const secondsDiff = differenceInSeconds(now, lastPunchInTime);
        
        const hours = Math.floor(secondsDiff / 3600);
        const minutes = Math.floor((secondsDiff % 3600) / 60);
        const seconds = secondsDiff % 60;

        const pad = (num: number) => num.toString().padStart(2, '0');
        setDuration(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      }, 1000);
    } else {
        setDuration('00:00:00'); // Reset duration if not punched in
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPunchedIn, lastPunchInTime]);

  if (isLoading) {
    return (
      <Button variant="outline" className="flex items-center justify-center gap-2 w-48 h-9 px-3 py-1 border-dashed" disabled>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">Loading...</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
            variant="outline" 
            className={`flex items-center justify-between w-48 h-9 px-3 py-1 transition-colors duration-300 ${isPunchedIn ? 'border-green-500/50 hover:bg-green-500/10 text-green-600' : 'border-red-500/50 hover:bg-red-500/10 text-red-600'}`}
        >
            <div className="flex items-center gap-1.5 overflow-hidden">
                <Circle className={`h-2.5 w-2.5 shrink-0 fill-current`} />
                <span className={`font-semibold text-xs truncate`}>
                    {isPunchedIn ? 'PUNCHED IN' : 'PUNCHED OUT'}
                </span>
            </div>

            <div className="flex items-center gap-1.5">
              {isPunchedIn && (
                  <span className="font-mono text-xs text-foreground/80">{duration}</span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {isPunchedIn ? (
          <DropdownMenuItem onClick={punchOut} disabled={isSubmitting}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Punch Out</span>
             {isSubmitting && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={punchIn} disabled={isSubmitting}>
            <LogIn className="mr-2 h-4 w-4" />
            <span>Punch In</span>
            {isSubmitting && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
