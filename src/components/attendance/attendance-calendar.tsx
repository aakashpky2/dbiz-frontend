'use client';

import React, { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format } from 'date-fns';
import { parse } from 'date-fns';
import { startOfWeek } from 'date-fns';
import { getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Calculator, CheckCircle2, XCircle, Timer, Calendar as CalendarIcon, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

const locales = {
    'en-US': enUS,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

export interface MultiSelectEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resource?: any;
    status: 'Present' | 'Absent' | 'Half Day' | 'Leave' | 'Holiday' | 'Weekend' | 'Future';
    color?: string;
}

interface AttendanceCalendarProps {
    events: MultiSelectEvent[];
    onSelectEvent: (event: MultiSelectEvent) => void;
    date: Date;
    onNavigate: (newDate: Date) => void;
    onSelectSlot?: (slotInfo: { start: Date; end: Date; action: 'select' | 'click' | 'doubleClick' }) => void;
}

const eventStyleGetter = (event: MultiSelectEvent, start: Date, end: Date, isSelected: boolean) => {
    let backgroundColor = '#3b82f6'; // blue default
    let color = '#ffffff';

    switch (event.status) {
        case 'Present': backgroundColor = '#10b981'; break; // emerald-500
        case 'Absent': backgroundColor = '#ef4444'; break; // red-500
        case 'Half Day': backgroundColor = '#f97316'; break; // orange-500
        case 'Leave': backgroundColor = '#3b82f6'; break; // blue-500
        case 'Holiday': backgroundColor = '#a855f7'; break; // purple-500
        case 'Weekend': backgroundColor = '#9ca3af'; break; // gray-400
        case 'Future': backgroundColor = '#e5e7eb'; color = '#9ca3af'; break; // gray-200
    }

    if (isSelected) {
        backgroundColor = '#1e293b'; // slate-800 for selection
    }

    return {
        style: {
            backgroundColor,
            color,
            borderRadius: '4px',
            border: 'none',
            display: 'block',
            fontSize: '0.75rem',
        }
    };
};

export function AttendanceCalendar({ events, onSelectEvent, onSelectSlot, date, onNavigate }: AttendanceCalendarProps) {

    const CustomToolbar = (toolbar: any) => {
        const goToBack = () => {
            toolbar.onNavigate('PREV');
        };

        const goToNext = () => {
            toolbar.onNavigate('NEXT');
        };

        const goToCurrent = () => {
            toolbar.onNavigate('TODAY');
        };

        const label = () => {
            const date = toolbar.date;
            return (
                <span className="text-lg font-semibold capitalize">
                    {format(date, 'MMMM yyyy')}
                </span>
            );
        };

        return (
            <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4 p-2 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={goToBack}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" onClick={goToCurrent}>Today</Button>
                    <Button variant="outline" size="icon" onClick={goToNext}><ChevronRight className="h-4 w-4" /></Button>
                    <div className="ml-4">{label()}</div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-[700px] bg-white p-4 rounded-xl shadow-sm border">
            <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                onSelectEvent={onSelectEvent}
                onSelectSlot={onSelectSlot}
                selectable
                date={date}
                onNavigate={onNavigate}
                view={Views.MONTH}
                views={[Views.MONTH]}
                eventPropGetter={eventStyleGetter}
                components={{
                    toolbar: CustomToolbar,
                }}
            />
        </div>
    );
}
