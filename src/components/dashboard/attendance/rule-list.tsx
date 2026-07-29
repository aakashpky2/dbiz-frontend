'use client';

import React from 'react';
import { AttendanceRule } from './rule-form';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Calendar, Users, Building2, Globe, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RuleListProps {
    rules: AttendanceRule[];
    onEdit: (rule: AttendanceRule) => void;
    onDelete: (ruleId: string) => void;
}

export function RuleList({ rules, onEdit, onDelete }: RuleListProps) {

    const getScopeIcon = (type: string) => {
        switch (type) {
            case 'global': return <Globe className="h-4 w-4 text-blue-500" />;
            case 'department': return <Building2 className="h-4 w-4 text-orange-500" />;
            case 'employee': return <Users className="h-4 w-4 text-emerald-500" />;
            default: return <Clock className="h-4 w-4" />;
        }
    };

    const getScopeLabel = (rule: AttendanceRule) => {
        if (rule.scope.type === 'global') return 'Global Rule';
        if (rule.scope.type === 'department') return `${rule.scope.entityIds.length} Department(s)`;
        if (rule.scope.type === 'employee') return `${rule.scope.entityIds.length} Employee(s)`;
        return 'Unknown';
    };

    // Sort rules by Priority (Descending)
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    if (sortedRules.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg border-slate-200 dark:border-slate-800">
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-full mb-4">
                    <Clock className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No Rules Configured</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    Create granular attendance rules to manage shifts and grace periods for different teams.
                </p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
                {sortedRules.map((rule) => {
                    const isExpired = rule.effectiveTo && rule.effectiveTo < Date.now();
                    const isActive = rule.isActive && !isExpired;

                    return (
                        <Card key={rule.id} className={`group hover:shadow-md transition-all border-slate-200 dark:border-slate-800 ${!isActive ? 'opacity-70 bg-slate-50 dark:bg-slate-900/20' : ''}`}>
                            <CardContent className="p-4 flex items-center gap-4">
                                {/* Status Indicator */}
                                <div className={`w-1 self-stretch rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate">{rule.name}</h4>
                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 font-normal bg-white dark:bg-slate-900">
                                            {getScopeIcon(rule.scope.type)}
                                            {getScopeLabel(rule)}
                                        </Badge>
                                        {!rule.isActive && <Badge variant="secondary" className="text-[10px] h-5">Inactive</Badge>}
                                        {isExpired && <Badge variant="destructive" className="text-[10px] h-5">Expired</Badge>}
                                    </div>

                                    <div className="flex items-center gap-4 text-xs text-slate-500 max-w-full overflow-hidden">
                                        <span className="flex items-center gap-1 min-w-0 truncate">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(rule.effectiveFrom), 'MMM dd, yyyy')}
                                            {rule.effectiveTo ? ` - ${format(new Date(rule.effectiveTo), 'MMM dd, yyyy')}` : ' - Forever'}
                                        </span>
                                        <span className="flex items-center gap-1 min-w-0">
                                            <Clock className="h-3 w-3" />
                                            {rule.config.shift.startTime} - {rule.config.shift.endTime}
                                        </span>
                                        <span title="Priority Score">★ {rule.priority}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onEdit(rule)}>Edit Rule</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => onDelete(rule.id!)}>
                                            Delete Rule
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </ScrollArea>
    );
}
