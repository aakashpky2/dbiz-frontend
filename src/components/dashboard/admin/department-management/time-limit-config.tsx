'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Department, WorkType, updateWorkType } from '@/lib/department-management';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Save, Clock, Search, Calendar, Repeat, TrendingUp, Plus, LayoutGrid, Layers, Pencil, Trash2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelect } from '@/components/ui/multi-select';
import { Switch } from '@/components/ui/switch';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription 
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { addDays } from 'date-fns';
import { addMonths } from 'date-fns';
import { startOfMonth } from 'date-fns';
import { startOfQuarter } from 'date-fns';
import { endOfMonth } from 'date-fns';
import { endOfQuarter } from 'date-fns';
import { format } from 'date-fns';

const blockInvalidNumberKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) {
        e.preventDefault();
    }
};

interface TimeLimitConfigProps {
    departments: Department[];
}

type Frequency = 'monthly' | 'quarterly' | 'half-yearly' | 'annually' | 'event_based';

const frequencyOptions = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'half-yearly', label: 'Half-Yearly' },
    { value: 'annually', label: 'Annually' },
    { value: 'event_based', label: 'Event Based' }
];

interface FrequencyConfig {
    frequency: Frequency;
    mode: 'days' | 'month' | 'fixed';
    daysAfter?: number;
    monthOffset?: number;
    dayOfMonth?: number;
    fixedMonth?: number; // 1-12
    fixedDay?: number;
    eventTrigger?: string;
    periodPosition?: 'beginning' | 'end';
}

export function TimeLimitConfig({ departments }: TimeLimitConfigProps) {
    const { user } = useAuth();
    const { toast } = useToast();

    const [selectedWorkTypeName, setSelectedWorkTypeName] = useState<string>('');
    const [selectedDeptId, setSelectedDeptId] = useState<string>('');
    const [selectedCatId, setSelectedCatId] = useState<string>('');
    const [timeLimit, setTimeLimit] = useState<number | ''>('');
    const [timeLimitHours, setTimeLimitHours] = useState<number | ''>('');
    const [selectedFrequencies, setSelectedFrequencies] = useState<Frequency[]>([]);

    const [freqConfigs, setFreqConfigs] = useState<Record<Frequency, FrequencyConfig>>({
        'monthly': { frequency: 'monthly', mode: 'days', daysAfter: 11, periodPosition: 'end' },
        'quarterly': { frequency: 'quarterly', mode: 'days', daysAfter: 11, periodPosition: 'end' },
        'half-yearly': { frequency: 'half-yearly', mode: 'days', daysAfter: 11, periodPosition: 'end' },
        'annually': { frequency: 'annually', mode: 'days', daysAfter: 11, periodPosition: 'end' },
        'event_based': { frequency: 'event_based', mode: 'days', daysAfter: 11, eventTrigger: 'Work Completion' }
    });

    const [configName, setConfigName] = useState<string>('');
    const [allowOccurrenceOverride, setAllowOccurrenceOverride] = useState<boolean>(false);
    const [allowDueDateOverride, setAllowDueDateOverride] = useState<boolean>(false);
    const [allowFinishByOverride, setAllowFinishByOverride] = useState<boolean>(false);

    const [finishByEnabled, setFinishByEnabled] = useState<boolean>(false);
    const [finishByMode, setFinishByMode] = useState<'days_based' | 'event_based'>('days_based');
    const [finishByDays, setFinishByDays] = useState<number | ''>('');
    const [finishByEvent, setFinishByEvent] = useState<'work_start_date' | 'due_date' | 'period_start' | 'period_end'>('work_start_date');
    const [finishByDirection, setFinishByDirection] = useState<'before' | 'after'>('after');
    const [editingConfigIndex, setEditingConfigIndex] = useState<number | null>(null);

    const [loading, setLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const deptList = useMemo(() => {
        return departments.filter(d => !d.isDeleted && d.status === 'ACTIVE');
    }, [departments]);

    const catList = useMemo(() => {
        if (!selectedDeptId) return [];
        const dept = deptList.find(d => d.id === selectedDeptId);
        return dept?.workCategories?.filter(c => !c.isDeleted && c.status === 'ACTIVE') || [];
    }, [deptList, selectedDeptId]);

    const workTypesInCategory = useMemo(() => {
        if (!selectedCatId) return [];
        const cat = catList.find(c => c.id === selectedCatId);
        return cat?.workTypes?.filter(wt => !wt.isDeleted && wt.status === 'ACTIVE') || [];
    }, [catList, selectedCatId]);

    const workTypeOptions = useMemo(() => {
        return workTypesInCategory.map(wt => ({ value: wt.id, label: wt.name }));
    }, [workTypesInCategory]);

    // Handle single work type selection in modal
    const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string>('');
    
    // Auto-select first cat if only one
    useEffect(() => {
        if (catList.length === 1 && !selectedCatId) {
            setSelectedCatId(catList[0].id);
        }
    }, [catList, selectedCatId]);


    // Fetch existing config when work type is selected
    useEffect(() => {
        if (selectedWorkTypeId) {
            const wt = workTypesInCategory.find(w => w.id === selectedWorkTypeId);
            if (wt) {
                // If editing a specific config, load it
                const dtc = wt.dueTimeConfig;
                const configs = dtc?.configs || [];
                
                if (editingConfigIndex !== null && configs[editingConfigIndex]) {
                    const c = configs[editingConfigIndex];
                    setConfigName(c.configName || '');
                    setAllowOccurrenceOverride(!!c.allowOccurrenceOverride);
                    setAllowDueDateOverride(!!c.allowDueDateOverride);
                    setAllowFinishByOverride(!!c.allowFinishByOverride);
                    setFinishByEnabled(!!c.finishByEnabled);
                    setFinishByMode(c.finishByMode || 'days_based');
                    setFinishByDays(c.finishByDays ?? '');
                    setFinishByEvent(c.finishByEvent || 'work_start_date');
                    setFinishByDirection(c.finishByDirection || 'after');

                    setTimeLimit(c.timeToFinish?.days || '');
                    setTimeLimitHours(c.timeToFinish?.hours || '');
                    
                    const freqs = c.dueTimeConfigurations?.map((f: any) => f.frequency as Frequency) || [];
                    setSelectedFrequencies(freqs);

                    setFreqConfigs(prev => {
                        const newFreqConfigs = { ...prev };
                        c.dueTimeConfigurations?.forEach((f: any) => {
                            const freq = f.frequency as Frequency;
                            newFreqConfigs[freq] = {
                                frequency: freq,
                                mode: f.mode || 'days',
                                daysAfter: f.daysAfter ?? f.value ?? 11,
                                monthOffset: f.monthOffset,
                                dayOfMonth: f.dayOfMonth,
                                fixedMonth: f.fixedMonth,
                                fixedDay: f.fixedDay,
                                eventTrigger: f.eventTrigger,
                                periodPosition: f.periodPosition || 'end'
                            };
                        });
                        return newFreqConfigs;
                    });
                } else if (!dtc || (!dtc.configs && !dtc.dueTimeConfigurations)) {
                    // New setup
                    setConfigName(wt.name || '');
                    setAllowOccurrenceOverride(false);
                    setAllowDueDateOverride(false);
                    setAllowFinishByOverride(false);
                    setFinishByEnabled(false);
                    setFinishByMode('days_based');
                    setFinishByDays('');
                    setFinishByEvent('work_start_date');
                    setFinishByDirection('after');

                    setTimeLimit(wt.timeLimit || '');
                    setTimeLimitHours(wt.timeLimitHours || '');
                    setSelectedFrequencies([]);
                    setEditingConfigIndex(null);
                } else if (editingConfigIndex === null) {
                    // Fallback for old single-config format if not in configs array
                    if (dtc.dueTimeConfigurations) {
                        setConfigName(wt.name || '');
                        setAllowOccurrenceOverride(false);
                        setAllowDueDateOverride(false);
                        setAllowFinishByOverride(false);
                        setTimeLimit(wt.timeLimit || '');
                        setTimeLimitHours(wt.timeLimitHours || '');
                        const freqs = dtc.dueTimeConfigurations.map((c: any) => c.frequency as Frequency) || [];
                        setSelectedFrequencies(freqs);
                        // map other fields too if needed...
                    }
                }
            }
        }
    }, [selectedWorkTypeId, editingConfigIndex, workTypesInCategory]);



    const updateFreqConfig = (f: Frequency, updates: Partial<FrequencyConfig>) => {
        setFreqConfigs(prev => ({
            ...prev,
            [f]: { ...prev[f], ...updates }
        }));
    };

    const configuredWorkTypes = useMemo(() => {
        const rawList: any[] = [];
        deptList.forEach(dept => {
            dept.workCategories?.forEach(cat => {
                cat.workTypes?.forEach(wt => {
                    const dtc = wt.dueTimeConfig;
                    if (!dtc) return;

                    // Handle legacy format (object) or new format (with configs array)
                    const configs = dtc.configs || [];
                    if (configs.length > 0) {
                        configs.forEach((c: any, idx: number) => {
                            rawList.push({
                                ...wt,
                                configIndex: idx,
                                configName: c.configName || wt.name,
                                allowOccurrenceOverride: !!c.allowOccurrenceOverride,
                                allowDueDateOverride: !!c.allowDueDateOverride,
                                allowFinishByOverride: !!c.allowFinishByOverride,
                                finishByEnabled: !!c.finishByEnabled,
                                finishByMode: c.finishByMode,
                                finishByDays: c.finishByDays,
                                finishByEvent: c.finishByEvent,
                                finishByDirection: c.finishByDirection,
                                timeToFinish: c.timeToFinish || { days: wt.timeLimit, hours: wt.timeLimitHours },
                                displayDueConfigs: c.dueTimeConfigurations || [],
                                deptName: dept.name,
                                catName: cat.name,
                                deptId: dept.id,
                                catId: cat.id
                            });
                        });
                    } else if (dtc.dueTimeConfigurations?.length > 0) {
                        // Legacy single config
                            rawList.push({
                                ...wt,
                                configIndex: 0,
                                configName: wt.name,
                                allowOccurrenceOverride: false,
                                allowDueDateOverride: false,
                                allowFinishByOverride: false,
                                timeToFinish: { days: wt.timeLimit, hours: wt.timeLimitHours },
                                displayDueConfigs: dtc.dueTimeConfigurations,
                                deptName: dept.name,
                                catName: cat.name,
                                deptId: dept.id,
                                catId: cat.id
                            });
                    }
                });
            });
        });

        // Deduplicate to ensure unique rows based on ID + Config
        const map = new Map();
        rawList.forEach((item) => {
            const uniqueKey = `${item.id}-${item.configName || item.config_name || item.configIndex || 'default'}`;
            if (!map.has(uniqueKey)) {
                map.set(uniqueKey, item);
            }
        });

        const deduplicated = Array.from(map.values());
        
        console.log("[Configured Work Types]", {
            total: rawList.length,
            unique: deduplicated.length,
            data: deduplicated
        });

        return deduplicated;
    }, [deptList]);

    const unconfiguredWorkTypes = useMemo(() => {
        const list: any[] = [];
        deptList.forEach(dept => {
            dept.workCategories?.forEach(cat => {
                cat.workTypes?.forEach(wt => {
                    const hasConfig = wt.dueTimeConfig && wt.dueTimeConfig.dueTimeConfigurations?.length > 0;
                    if (!hasConfig && !wt.isDeleted && wt.status === 'ACTIVE') {
                        list.push({
                            ...wt,
                            deptName: dept.name,
                            catName: cat.name,
                            deptId: dept.id,
                            catId: cat.id
                        });
                    }
                });
            });
        });
        return list;
    }, [deptList]);

    const handleEditItem = (item: any) => {
        setSelectedDeptId(item.deptId);
        setSelectedCatId(item.catId);
        setSelectedWorkTypeId(item.id);
        setEditingConfigIndex(item.configIndex ?? 0);
        setIsDialogOpen(true);
    };

    const handleDeleteItem = async (item: any) => {
        const msg = item.configIndex !== undefined 
            ? `Are you sure you want to remove the config "${item.configName}" for ${item.name}?`
            : `Are you sure you want to remove all time limits for ${item.name}?`;

        if (!confirm(`${msg} This action cannot be undone.`)) return;
        try {
            setLoading(true);
            const wt = workTypesInCategory.find(w => w.id === item.id) || item;
            let newDueTimeConfig = wt.dueTimeConfig;

            if (item.configIndex !== undefined && newDueTimeConfig?.configs) {
                const newConfigs = [...newDueTimeConfig.configs];
                newConfigs.splice(item.configIndex, 1);
                newDueTimeConfig = { ...newDueTimeConfig, configs: newConfigs };
                if (newConfigs.length === 0) newDueTimeConfig = null;
            } else {
                newDueTimeConfig = null;
            }

            await updateWorkType(
                item.deptId,
                item.catId,
                item.id,
                {
                    name: item.name,
                    description: item.description,
                    constitutionRule: item.constitutionRule,
                    timeLimit: item.timeLimit,
                    timeLimitHours: item.timeLimitHours,
                    dueTimeConfig: newDueTimeConfig
                },
                user?.uid || '',
                user?.displayName || 'Unknown'
            );
            toast({ title: "Configuration Removed", description: "The selected time limit has been deleted." });
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Error", description: "Failed to remove configuration." });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user || !selectedWorkTypeId || !selectedDeptId || !selectedCatId) return;
        if (selectedFrequencies.length === 0) {
            toast({ variant: "destructive", title: "Config Required", description: "Select at least one frequency." });
            return;
        }
        if (!configName.trim()) {
            toast({ variant: "destructive", title: "Name Required", description: "Please enter a Configuration Name." });
            return;
        }

        const wt = workTypesInCategory.find(w => w.id === selectedWorkTypeId);
        if (!wt) return;

        const dueTimeConfigurations = selectedFrequencies.map(f => {
            const cfg = freqConfigs[f];
            const base: any = { frequency: f, mode: cfg.mode };
            if (cfg.mode === 'days') {
                base.value = cfg.daysAfter;
                base.daysAfter = cfg.daysAfter;
                base.periodPosition = cfg.periodPosition || 'end';
            } else if (cfg.mode === 'month') {
                base.monthOffset = cfg.monthOffset;
                base.periodPosition = cfg.periodPosition || 'end';
            } else if (cfg.mode === 'fixed') {
                base.fixedMonth = cfg.fixedMonth;
                base.fixedDay = cfg.fixedDay;
            }
            if (f === 'event_based') base.eventTrigger = cfg.eventTrigger;
            return base;
        });

        const singleConfig = {
            configName: configName.trim(),
            allowOccurrenceOverride,
            allowDueDateOverride,
            allowFinishByOverride,
            finishByEnabled,
            finishByMode,
            finishByDays: finishByDays === '' ? 0 : Number(finishByDays),
            finishByEvent,
            finishByDirection,
            dueTimeConfigurations,
            timeToFinish: {
                days: timeLimit === '' ? 0 : Number(timeLimit),
                hours: timeLimitHours === '' ? 0 : Number(timeLimitHours)
            }
        };

        // Update or Add to the configs array
        let existingConfig = wt.dueTimeConfig || {};
        let newConfigs = existingConfig.configs || [];

        // Backward compatibility: if we have old format, convert it
        if (newConfigs.length === 0 && existingConfig.dueTimeConfigurations) {
            newConfigs = [{
                configName: wt.name,
                allowOverride: false,
                dueTimeConfigurations: existingConfig.dueTimeConfigurations,
                timeToFinish: {
                    days: wt.timeLimit || 0,
                    hours: wt.timeLimitHours || 0
                }
            }];
        }

        if (editingConfigIndex !== null && newConfigs[editingConfigIndex]) {
            newConfigs[editingConfigIndex] = singleConfig;
        } else {
            newConfigs.push(singleConfig);
        }

        const dueTimeConfig = {
            workTypeId: wt.id,
            departmentId: selectedDeptId,
            categoryId: selectedCatId,
            configs: newConfigs
        };

        const firstFreq = selectedFrequencies[0];
        const defaultOccurrence = firstFreq ? (
            firstFreq === 'monthly' ? 'Monthly' :
            firstFreq === 'quarterly' ? 'Quarterly' :
            firstFreq === 'half-yearly' ? 'Half-yearly' :
            firstFreq === 'annually' ? 'Yearly' : 'Often'
        ) : 'Monthly';

        try {
            setLoading(true);
            await updateWorkType(
                selectedDeptId,
                selectedCatId,
                wt.id,
                {
                    name: wt.name,
                    description: wt.description,
                    constitutionRule: wt.constitutionRule,
                    timeLimit: singleConfig.timeToFinish.days,
                    timeLimitHours: singleConfig.timeToFinish.hours,
                    dueTimeConfig: dueTimeConfig,
                    defaultOccurrence: defaultOccurrence,
                    durationDays: singleConfig.timeToFinish.days,
                    durationHours: singleConfig.timeToFinish.hours,
                    allowOccurrenceOverride: singleConfig.allowOccurrenceOverride,
                    allowDueDateOverride: singleConfig.allowDueDateOverride,
                    allowFinishByOverride: singleConfig.allowFinishByOverride,
                    finishByEnabled: singleConfig.finishByEnabled,
                    finishByMode: singleConfig.finishByMode,
                    finishByDays: singleConfig.finishByDays,
                    finishByEvent: singleConfig.finishByEvent,
                    finishByDirection: singleConfig.finishByDirection,
                    configName: singleConfig.configName
                },
                user.uid,
                user.displayName || 'Unknown'
            );
            toast({ title: "Configuration Saved", description: "Pending validation." });
            setIsDialogOpen(false);
            setEditingConfigIndex(null);
            setConfigName('');
            setAllowOccurrenceOverride(false);
            setAllowDueDateOverride(false);
            setAllowFinishByOverride(false);
            setFinishByEnabled(false);
            setFinishByMode('days_based');
            setFinishByDays('');
            setFinishByEvent('work_start_date');
            setFinishByDirection('after');
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Error", description: "Failed to save configuration." });
        } finally {
            setLoading(false);
        }
    };

    const renderExample = (f: Frequency) => {
        const cfg = freqConfigs[f];
        if (f === 'event_based') return null;

        const isMonthMode = cfg.mode === 'month';

        // Use 3 specific months for example if we are dealing with monthly frequency.
        // This helps visualize different month lengths (28/29, 30, 31 days).
        const refDates = f === 'monthly'
            ? [
                new Date(new Date().getFullYear(), 1, 10), // Feb (28/29 days)
                new Date(new Date().getFullYear(), 3, 10), // Apr (30 days)
                new Date(new Date().getFullYear(), 4, 10)  // May (31 days)
            ]
            : [new Date(new Date().getFullYear(), 3, 10)]; // Default Apr

        const examples = refDates.map((refDate) => {
            let periodStart, periodEnd;
            let periodName = "";

            if (f === 'monthly') {
                periodStart = startOfMonth(refDate);
                periodEnd = endOfMonth(refDate);
                periodName = format(periodStart, 'MMMM yyyy');
            } else if (f === 'quarterly') {
                periodStart = startOfQuarter(refDate);
                periodEnd = endOfQuarter(refDate);
                periodName = `${format(periodStart, 'MMM')} - ${format(periodEnd, 'MMM')} ${format(periodStart, 'yyyy')}`;
            } else if (f === 'half-yearly') {
                periodStart = new Date(refDate.getFullYear(), 3, 1);
                periodEnd = new Date(refDate.getFullYear(), 8, 30);
                periodName = `Apr - Sep ${refDate.getFullYear()}`;
            } else if (f === 'annually') {
                periodStart = new Date(refDate.getFullYear(), 3, 1);
                periodEnd = new Date(refDate.getFullYear() + 1, 2, 31);
                periodName = `FY ${refDate.getFullYear()}-${(refDate.getFullYear() + 1).toString().slice(2)}`;
            } else return null;

            let dueDate = null;
            let baseDate = cfg.periodPosition === 'beginning' ? periodStart : periodEnd;

            if (cfg.mode === 'days' && cfg.daysAfter !== undefined && !isNaN(cfg.daysAfter)) {
                const daysToAdd = cfg.periodPosition === 'beginning' ? cfg.daysAfter - 1 : cfg.daysAfter;
                dueDate = addDays(baseDate, daysToAdd);
            } else if (cfg.mode === 'month' && cfg.monthOffset !== undefined && !isNaN(cfg.monthOffset)) {
                // Ensure proper month end calculation (i.e. Apr 30 + 1 month -> May 31, not May 30)
                const offsetDate = addMonths(baseDate, cfg.monthOffset);
                dueDate = cfg.periodPosition === 'end' ? endOfMonth(offsetDate) : offsetDate;
            } else if (cfg.mode === 'fixed' && cfg.fixedMonth && cfg.fixedDay) {
                try {
                    dueDate = new Date(refDate.getFullYear(), cfg.fixedMonth - 1, cfg.fixedDay);
                    if (dueDate < periodEnd) {
                        dueDate = new Date(refDate.getFullYear() + 1, cfg.fixedMonth - 1, cfg.fixedDay);
                    }
                } catch (e) { }
            }

            if (!dueDate || isNaN(dueDate.getTime())) return null;

            return { periodName, dueDate, position: cfg.periodPosition };
        }).filter(Boolean);

        if (examples.length === 0) return null;

        return (
            <div className="mt-6 space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 duration-300" style={{ animationDelay: '120ms', animationFillMode: 'both' }}>
                {examples.map((ex: any, i) => (
                    <div key={i} className="p-5 bg-primary/[0.035] border border-primary/15 rounded-xl text-sm">
                        <div className="mb-2">
                            <strong className="text-foreground uppercase tracking-widest text-[10px] font-bold">How it works</strong>
                        </div>
                        <p className="text-muted-foreground leading-relaxed text-xs mb-4">
                            For <strong>{ex.periodName}</strong>, calculating from the <strong>{ex.position === 'beginning' ? 'start' : 'end'}</strong>...
                        </p>
                        <div className="flex flex-col gap-0.5 bg-background border border-border/50 px-4 py-2.5 rounded-lg w-fit shadow-sm">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target Due Date</span>
                            <span className="text-base font-semibold text-foreground">{format(ex.dueDate, 'dd MMM yyyy')}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderFreqInputs = (f: Frequency) => {
        const cfg = freqConfigs[f];

        if (f === 'event_based') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in zoom-in-95 duration-200">
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Start Action</Label>
                        <Select value={cfg.eventTrigger} onValueChange={(v) => updateFreqConfig(f, { eventTrigger: v })}>
                            <SelectTrigger className="h-9 px-3 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Work Completion">Work Completion</SelectItem>
                                <SelectItem value="Client Approval">Client Approval</SelectItem>
                                <SelectItem value="Notice Receipt">Notice Receipt</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Days From Action</Label>
                        <Input
                            type="number"
                            className="h-9 text-sm"
                            value={cfg.daysAfter || ''}
                            onChange={(e) => updateFreqConfig(f, { daysAfter: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-5 animate-in zoom-in-95 duration-200">
                <RadioGroup value={cfg.mode} onValueChange={(v: any) => updateFreqConfig(f, { mode: v })} className="flex gap-3">
                    <div className={cn("flex-1 flex items-center space-x-2 border rounded-lg p-2.5 cursor-pointer transition-colors", cfg.mode === 'days' ? 'bg-primary/[0.06] border-primary' : 'bg-transparent border-border/50 hover:bg-muted/50')}>
                        <RadioGroupItem value="days" id={`${f}-days`} className="h-4 w-4" />
                        <Label htmlFor={`${f}-days`} className="text-xs font-medium cursor-pointer w-full">By Days</Label>
                    </div>
                    <div className={cn("flex-1 flex items-center space-x-2 border rounded-lg p-2.5 cursor-pointer transition-colors", cfg.mode === 'month' ? 'bg-primary/[0.06] border-primary' : 'bg-transparent border-border/50 hover:bg-muted/50')}>
                        <RadioGroupItem value="month" id={`${f}-month`} className="h-4 w-4" />
                        <Label htmlFor={`${f}-month`} className="text-xs font-medium cursor-pointer w-full">By Month</Label>
                    </div>
                    <div className={cn("flex-1 flex items-center space-x-2 border rounded-lg p-2.5 cursor-pointer transition-colors", cfg.mode === 'fixed' ? 'bg-primary/[0.06] border-primary' : 'bg-transparent border-border/50 hover:bg-muted/50')}>
                        <RadioGroupItem value="fixed" id={`${f}-fixed`} className="h-4 w-4" />
                        <Label htmlFor={`${f}-fixed`} className="text-xs font-medium cursor-pointer w-full">Fixed Date</Label>
                    </div>
                </RadioGroup>

                {(cfg.mode === 'days' || cfg.mode === 'month') && (
                    <div className="space-y-3">
                        <Label className="text-xs font-semibold text-foreground">Start Counting From</Label>
                        <RadioGroup value={cfg.periodPosition || 'end'} onValueChange={(v: any) => updateFreqConfig(f, { periodPosition: v })} className="flex gap-6 items-center">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="beginning" id={`${f}-pos-beg`} className="h-4 w-4" />
                                <Label htmlFor={`${f}-pos-beg`} className="text-sm cursor-pointer">Start of Period</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="end" id={`${f}-pos-end`} className="h-4 w-4" />
                                <Label htmlFor={`${f}-pos-end`} className="text-sm cursor-pointer">End of Period</Label>
                            </div>
                        </RadioGroup>
                    </div>
                )}

                {cfg.mode === 'days' ? (
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-foreground">
                            Days from {f === 'monthly' ? 'Period End' : f === 'quarterly' ? 'Quarter End' : f === 'half-yearly' ? 'Half-Year End' : 'Year End'}
                        </Label>
                        <div className="flex items-center w-full max-w-[160px] h-11 border border-border/70 rounded-lg overflow-hidden bg-background focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                            <Input
                                type="number"
                                className="h-full border-none focus-visible:ring-0 rounded-none w-full font-medium"
                                value={cfg.daysAfter || ''}
                                onChange={(e) => updateFreqConfig(f, { daysAfter: parseInt(e.target.value) || 0 })}
                            />
                            <div className="h-full px-3 bg-muted/30 border-l border-border/50 flex items-center justify-center text-xs text-muted-foreground font-medium shrink-0">
                                Days
                            </div>
                        </div>
                    </div>
                ) : cfg.mode === 'month' ? (
                    <div className="space-y-1.5 pt-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Months Offset</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                className="w-24 h-9 text-sm"
                                value={cfg.monthOffset || ''}
                                onChange={(e) => updateFreqConfig(f, { monthOffset: parseInt(e.target.value) || 0 })}
                                placeholder="e.g. 1"
                            />
                            <span className="text-xs text-muted-foreground">Months</span>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Specific Month</Label>
                            <Input
                                type="number"
                                min="1" max="12"
                                className="h-9 text-sm"
                                value={cfg.fixedMonth || ''}
                                onChange={(e) => updateFreqConfig(f, { fixedMonth: parseInt(e.target.value) || 0 })}
                                placeholder="e.g. 1"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Specific Day</Label>
                            <Input
                                type="number"
                                min="1" max="31"
                                className="h-9 text-sm"
                                value={cfg.fixedDay || ''}
                                onChange={(e) => updateFreqConfig(f, { fixedDay: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                    </div>
                )}
                {renderExample(f)}
            </div>
        );
    };

    const renderFinishByExample = () => {
        if (!finishByEnabled) return null;

        let baseDate = new Date(2026, 1, 1); // 01 Feb 2026
        let baseDateLabel = "01 Feb 2026 (Work Start)";

        if (finishByMode === 'event_based') {
            if (finishByEvent === 'due_date') {
                baseDate = new Date(2026, 1, 11); // 11 Feb 2026
                baseDateLabel = "11 Feb 2026 (Due Date)";
            } else if (finishByEvent === 'period_start') {
                baseDate = new Date(2026, 3, 1); // 01 Apr 2026
                baseDateLabel = "01 Apr 2026 (Period Start)";
            } else if (finishByEvent === 'period_end') {
                baseDate = new Date(2026, 3, 30); // 30 Apr 2026
                baseDateLabel = "30 Apr 2026 (Period End)";
            }
        }

        let resultDate = new Date(baseDate);
        const days = Number(finishByDays || 0);

        if (finishByMode === 'days_based') {
            resultDate.setDate(resultDate.getDate() + days);
        } else {
            if (finishByDirection === 'before') {
                resultDate.setDate(resultDate.getDate() - days);
            } else {
                resultDate.setDate(resultDate.getDate() + days);
            }
        }

        return (
            <div className="mt-4 space-y-3">
                <div className="p-4 bg-primary/[0.035] border border-primary/15 rounded-xl text-sm">
                    <div className="mb-2">
                        <strong className="text-foreground uppercase tracking-widest text-[10px] font-bold">How it works</strong>
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-xs mb-3">
                        If {baseDateLabel.toLowerCase()} is the reference, {finishByMode === 'days_based' ? 'adding' : finishByDirection} <strong>{days} days</strong> result in:
                    </p>
                    <div className="flex flex-col gap-0.5 bg-background border border-border/50 px-3 py-2 rounded-lg w-fit shadow-sm">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Finish By</span>
                        <span className="text-sm font-semibold text-foreground">{format(resultDate, 'dd MMM yyyy')}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full pb-8">
            <Tabs defaultValue="overview" className="space-y-8">
                <div className="flex items-center justify-between">
                    <TabsList className="bg-blue-100/50 p-1 rounded-xl h-auto border border-blue-200/50">
                        <TabsTrigger value="overview" className="flex items-center gap-2 px-6 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all text-xs font-bold uppercase tracking-widest text-slate-500">
                            <TrendingUp className="h-3.5 w-3.5" />
                            Active Settings
                        </TabsTrigger>
                        <TabsTrigger value="pending" className="flex items-center gap-2 px-6 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all text-xs font-bold uppercase tracking-widest text-slate-500">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                            Pending Setup
                            {unconfiguredWorkTypes.length > 0 && (
                                <Badge variant="destructive" className="ml-1 h-5 min-w-[1.25rem] px-1 flex items-center justify-center rounded-full text-[10px] bg-amber-500">
                                    {unconfiguredWorkTypes.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview" className="m-0 focus-visible:outline-none animate-in fade-in duration-500">
                    <Card className="w-full rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden">
                        <CardHeader className="px-6 py-5 md:px-8 border-b border-border/50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 rounded-xl shadow-inner ring-1 ring-primary/20">
                                    <TrendingUp className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold tracking-tight mb-1">Due Date Settings</CardTitle>
                                    <CardDescription className="text-muted-foreground font-medium text-sm">
                                        Set how many days you have to finish the work and when the deadlines are.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 md:p-8 space-y-8">
                            <div className="bg-slate-50/50 p-6 rounded-xl border border-border/60 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_0.85fr] gap-4 items-end">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 px-1">
                                            <LayoutGrid className="h-3.5 w-3.5 text-primary/60" />
                                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Main Department</Label>
                                        </div>
                                        <Select value={selectedDeptId} onValueChange={(val) => {
                                            setSelectedDeptId(val);
                                            setSelectedCatId('');
                                            setSelectedWorkTypeId('');
                                        }}>
                                            <SelectTrigger className="h-[46px] bg-background border focus:ring-primary rounded-lg text-sm font-semibold px-4 transition-all shadow-sm">
                                                <SelectValue placeholder="Choose Department" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-lg">
                                                {deptList.map(d => <SelectItem key={d.id} value={d.id} className="py-2.5 rounded-lg font-medium">{d.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 px-1">
                                            <Layers className="h-3.5 w-3.5 text-primary/60" />
                                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Work Category</Label>
                                        </div>
                                        <Select 
                                            value={selectedCatId} 
                                            onValueChange={(val) => {
                                                setSelectedCatId(val);
                                                setSelectedWorkTypeId('');
                                            }} 
                                            disabled={!selectedDeptId}
                                        >
                                            <SelectTrigger className="h-[46px] bg-background border focus:ring-primary rounded-lg text-sm font-semibold px-4 disabled:opacity-50 transition-all shadow-sm">
                                                <SelectValue placeholder={selectedDeptId ? "Choose Category" : "Waiting for Dept..."} />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-lg">
                                                {catList.map(c => <SelectItem key={c.id} value={c.id} className="py-2.5 rounded-lg font-medium">{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="pb-[1px]">
                                        <Button 
                                            disabled={!selectedCatId}
                                            onClick={() => setIsDialogOpen(true)}
                                            className="w-full h-[46px] bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold text-xs uppercase tracking-widest shadow-sm transition-all hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0"
                                        >
                                            <Plus className="mr-2 h-4 w-4" /> Add Due Date
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {configuredWorkTypes.length > 0 ? (
                                <div className="space-y-6 pt-4">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                                                <Layers className="h-4 w-4 text-primary" />
                                                Existing Due Dates
                                            </h3>
                                            <span className="text-[11px] font-medium text-muted-foreground">List of work already having deadline rules</span>
                                        </div>
                                        <Badge variant="secondary" className="h-[22px] px-2.5 bg-primary/10 text-primary hover:bg-primary/20 border-none rounded-md font-bold text-[10px]">
                                            {configuredWorkTypes.length} ITEMS
                                        </Badge>
                                    </div>

                                    <div className="rounded-xl border border-border/60 overflow-hidden bg-card animate-in fade-in slide-in-from-bottom-1 duration-200">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-muted/20 border-b border-border/50">
                                                        <th className="w-[22%] px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap align-middle">Name of Work</th>
                                                        <th className="w-[18%] px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap align-middle">Config Name</th>
                                                        <th className="w-[10%] px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap align-middle">Override</th>
                                                        <th className="w-[10%] px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap align-middle">Time Limit</th>
                                                        <th className="w-[13%] px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap align-middle">Finish By</th>
                                                        <th className="w-[15%] px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap align-middle">Rules</th>
                                                        <th className="w-[12%] px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap align-middle text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/50">
                                                    {configuredWorkTypes.map((item) => (
                                                        <tr key={`${item.id}-${item.configName || item.configIndex || 'default'}`} className="group hover:bg-primary/[0.018] transition-colors duration-150 h-[76px]">
                                                            <td className="px-5 py-3 align-middle">
                                                                <div className="font-semibold text-sm text-foreground line-clamp-2">{item.name}</div>
                                                                <div className="text-[10px] text-muted-foreground font-medium mt-0.5 line-clamp-1">{item.deptName} • {item.catName}</div>
                                                            </td>
                                                            <td className="px-5 py-3 align-middle">
                                                                <div className="inline-flex items-center max-w-full rounded-lg px-3 py-1.5 bg-muted/30 border border-border/50 text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                                                                    {item.configName}
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-3 align-middle">
                                                                {item.allowOccurrenceOverride || item.allowDueDateOverride || item.allowFinishByOverride ? (
                                                                    <div className="flex flex-col gap-1">
                                                                        {item.allowOccurrenceOverride && <Badge variant="outline" className="text-[9px] font-bold bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20 w-fit whitespace-nowrap">OCCURRENCE</Badge>}
                                                                        {item.allowDueDateOverride && <Badge variant="outline" className="text-[9px] font-bold bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20 w-fit whitespace-nowrap">DUE DATE</Badge>}
                                                                        {item.allowFinishByOverride && <Badge variant="outline" className="text-[9px] font-bold bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20 w-fit whitespace-nowrap">FINISH BY</Badge>}
                                                                    </div>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-[10px] font-semibold bg-muted/30 text-muted-foreground border-border/50 w-fit whitespace-nowrap">NO</Badge>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-3 align-middle">
                                                                <div className="inline-flex gap-1.5 whitespace-nowrap text-[11px] font-bold uppercase text-foreground/80">
                                                                    {(item.timeToFinish?.days > 0) && <span className="bg-muted/40 px-2 py-1 rounded-md">{item.timeToFinish.days}D</span>}
                                                                    {(item.timeToFinish?.hours > 0) && <span className="bg-muted/40 px-2 py-1 rounded-md">{item.timeToFinish.hours}H</span>}
                                                                    {(!item.timeToFinish?.days && !item.timeToFinish?.hours) && <span className="text-muted-foreground/40">-</span>}
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-3 align-middle">
                                                                {item.finishByEnabled ? (
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-[11px] font-bold text-primary uppercase whitespace-nowrap">{item.finishByMode === 'days_based' ? 'Days Based' : 'Event Based'}</span>
                                                                        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{item.finishByDays} Days</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-muted-foreground/40 font-bold">-</span>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-3 align-middle">
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {item.displayDueConfigs?.map((c: any, i: number) => (
                                                                        <Badge key={i} variant="outline" className="text-[10px] font-semibold uppercase whitespace-nowrap bg-background border-border/80 text-foreground/80">
                                                                            {c.frequency}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-3 align-middle text-right">
                                                                <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleEditItem(item)}
                                                                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleDeleteItem(item)}
                                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : !selectedCatId && (
                                <div className="flex flex-col items-center justify-center py-16 px-10 border-2 border-dashed rounded-2xl border-muted bg-muted/5 opacity-50">
                                    <Clock className="h-10 w-10 text-muted-foreground/30 mb-4" />
                                    <h3 className="text-lg font-bold text-muted-foreground uppercase tracking-widest mb-1">Waiting for Selection</h3>
                                    <p className="text-xs font-medium text-muted-foreground/60 text-center max-sm">
                                        Choose a department and category above to start setting due dates.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="pending" className="m-0 focus-visible:outline-none animate-in fade-in duration-500">
                    <Card className="w-full rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden">
                        <CardHeader className="px-6 py-5 md:px-8 border-b border-border/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-amber-500/10 rounded-xl shadow-inner ring-1 ring-amber-500/20">
                                        <AlertCircle className="h-6 w-6 text-amber-500" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl font-bold tracking-tight mb-1">Pending Setup</CardTitle>
                                        <CardDescription className="text-muted-foreground font-medium text-sm">
                                            List of work that doesn't have any repeat rules yet
                                        </CardDescription>
                                    </div>
                                </div>
                                <Badge variant="outline" className="h-[26px] px-3 font-semibold text-xs bg-amber-500/10 text-amber-600 border-amber-500/20 rounded-md">
                                    {unconfiguredWorkTypes.length} WORKS REMAINING
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-muted/20 border-b border-border/50">
                                            <th className="w-[50%] px-6 py-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap align-middle">Details of Work</th>
                                            <th className="w-[35%] px-6 py-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap align-middle">Placement</th>
                                            <th className="w-[15%] px-6 py-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap align-middle text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {unconfiguredWorkTypes.map((item, index) => (
                                            <tr key={`${item.id}-unconfigured`} className="hover:bg-primary/[0.018] transition-colors duration-150 h-[76px]">
                                                <td className="px-6 py-3 align-middle">
                                                    <div className="font-semibold text-sm text-foreground line-clamp-2">{item.name}</div>
                                                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5 line-clamp-1">Row #{index + 1}</div>
                                                </td>
                                                <td className="px-6 py-3 align-middle">
                                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                                        <span className="text-[10px] font-bold text-primary uppercase bg-primary/10 px-2.5 py-1 rounded-full">{item.deptName}</span>
                                                        <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.catName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 align-middle text-right">
                                                    <Button 
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleEditItem(item)}
                                                        className="h-9 px-4 border-border/80 text-foreground font-semibold text-xs shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95 whitespace-nowrap"
                                                    >
                                                        Set Rules
                                                        <Plus className="ml-2 h-3.5 w-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {unconfiguredWorkTypes.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="py-20 text-center">
                                                    <ShieldCheck className="h-12 w-12 text-primary/30 mx-auto mb-4" />
                                                    <p className="text-muted-foreground font-semibold text-sm">Great! All work has rules set up.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-[1140px] h-[88vh] p-0 overflow-hidden border border-border/70 shadow-2xl rounded-2xl bg-card flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-[0.99] motion-safe:slide-in-from-bottom-2 duration-200">
                    {isDialogOpen && (
                        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ zIndex: 50, overflow: 'visible' }}>
                            <defs>
                                <linearGradient id="modalBorderGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="transparent" />
                                    <stop offset="25%" stopColor="rgba(220, 38, 38, 0.4)" />
                                    <stop offset="50%" stopColor="rgba(239, 68, 68, 0.9)" />
                                    <stop offset="75%" stopColor="rgba(244, 63, 94, 1)" />
                                    <stop offset="95%" stopColor="rgba(251, 113, 133, 0.8)" />
                                    <stop offset="100%" stopColor="transparent" />
                                </linearGradient>
                                <style>
                                    {`
                                        @keyframes modal-border-trace {
                                            0% { stroke-dashoffset: 1400; opacity: 0; }
                                            5% { opacity: 1; }
                                            82% { opacity: 1; }
                                            100% { stroke-dashoffset: 0; opacity: 0; }
                                        }
                                        @media (prefers-reduced-motion: reduce) {
                                            .modal-trace-path { display: none !important; }
                                        }
                                    `}
                                </style>
                            </defs>
                            <path 
                                className="modal-trace-path"
                                d="M 0,500 L 0,16 Q 0,0 16,0 L 750,0" 
                                fill="none"
                                stroke="url(#modalBorderGradient)"
                                strokeWidth="4.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                    strokeDasharray: '1400',
                                    strokeDashoffset: '1400',
                                    filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.55)) drop-shadow(0 0 8px rgba(244,63,94,0.25))',
                                    animation: 'modal-border-trace 1300ms cubic-bezier(0.22, 1, 0.36, 1) 120ms forwards'
                                }}
                            />
                        </svg>
                    )}
                    
                    <DialogHeader className="shrink-0 px-7 py-6 border-b border-border/70 relative z-10 bg-card" style={{ backgroundImage: 'linear-gradient(110deg, hsl(var(--primary) / 0.04), transparent 55%)' }}>
                        <div className="flex items-start gap-4">
                            <div className="p-2.5 bg-background rounded-xl text-primary border border-border/60 shadow-sm mt-0.5">
                                <Clock className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-none rounded-md font-bold text-[9px] uppercase tracking-widest px-2 py-0.5 mb-1.5">
                                    DEADLINE RULES
                                </Badge>
                                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Due Dates Configuration</DialogTitle>
                                <DialogDescription className="text-sm font-medium text-muted-foreground">
                                    Configure repeat cycles, completion time, and due-date calculation.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar bg-primary/[0.012] dark:bg-muted/[0.08]">
                        <div className="p-6 md:p-8 space-y-6">
                            {/* Work Type Selection */}
                            <div className="bg-card p-5 rounded-xl border border-border/70 shadow-sm space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-primary/70">
                                        <Search className="h-4 w-4" />
                                        Select Work Type
                                    </div>
                                    <div className="h-px flex-1 bg-border/50" />
                                </div>
                                <div className="max-w-md mx-auto space-y-2">
                                    <Label className="text-xs font-semibold text-foreground ml-1">Name of Work</Label>
                                    <Combobox
                                        options={workTypeOptions}
                                        value={selectedWorkTypeId}
                                        onChange={setSelectedWorkTypeId}
                                        placeholder="Search or Choose Work..."
                                    />
                                </div>
                            </div>

                            {!selectedWorkTypeId ? (
                                <div className="flex flex-col items-center justify-center py-20 border border-border/50 border-dashed rounded-xl bg-card shadow-sm opacity-80">
                                    <Calendar className="h-12 w-12 text-muted-foreground/40 mb-4" />
                                    <div className="text-sm font-semibold text-foreground/80">Choose work to start</div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-[0.85fr_1.15fr] gap-6 animate-in fade-in duration-300">
                                    <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-300" style={{ animationDelay: '40ms', animationFillMode: 'both' }}>
                                        <div className="rounded-xl border border-border/70 bg-card p-5 space-y-6 shadow-sm">
                                            <div className="space-y-3">
                                                <Label className="text-sm font-semibold text-foreground">Configuration Name</Label>
                                                <Input 
                                                    value={configName}
                                                    onChange={(e) => setConfigName(e.target.value)}
                                                    placeholder="e.g. Common Task April"
                                                    className="h-10 border-border/70 text-sm"
                                                />
                                            </div>

                                            <div className="h-px bg-border/50" />

                                            <div className="space-y-3">
                                                <div className="space-y-1">
                                                    <h3 className="text-sm font-semibold text-foreground">Repeat Cycle</h3>
                                                    <p className="text-xs text-muted-foreground">How often does this work repeat?</p>
                                                </div>
                                                <MultiSelect
                                                    options={frequencyOptions}
                                                    selected={selectedFrequencies}
                                                    onChange={(vals) => setSelectedFrequencies(vals as Frequency[])}
                                                    className="text-sm bg-background border-border/70 rounded-lg px-3"
                                                    placeholder="Choose Repeat Cycle..."
                                                />
                                            </div>

                                            <div className="flex items-center justify-between p-3.5 bg-muted/20 rounded-lg border border-border/50">
                                                <div className="space-y-1 pr-4">
                                                    <Label className="text-sm font-medium text-foreground">Allow Occurrence Override</Label>
                                                    <p className="text-[11px] text-muted-foreground leading-snug">Users can change the repeat cycle when adding work.</p>
                                                </div>
                                                <Switch 
                                                    checked={allowOccurrenceOverride}
                                                    onCheckedChange={setAllowOccurrenceOverride}
                                                />
                                            </div>

                                            <div className="h-px bg-border/50" />

                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold text-foreground">Time to Finish</h3>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="flex items-center h-11 border border-border/70 rounded-lg overflow-hidden bg-background focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                                                        <Input
                                                            type="number"
                                                            className="h-full border-none focus-visible:ring-0 rounded-none w-full font-medium"
                                                            value={timeLimit}
                                                            onChange={(e) => setTimeLimit(e.target.value ? parseInt(e.target.value) : '')}
                                                            placeholder="0"
                                                        />
                                                        <div className="h-full px-3 bg-muted/30 border-l border-border/50 flex items-center justify-center text-xs text-muted-foreground font-medium shrink-0">
                                                            Days
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center h-11 border border-border/70 rounded-lg overflow-hidden bg-background focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                                                        <Input
                                                            type="number"
                                                            className="h-full border-none focus-visible:ring-0 rounded-none w-full font-medium"
                                                            value={timeLimitHours}
                                                            onChange={(e) => setTimeLimitHours(e.target.value ? parseInt(e.target.value) : '')}
                                                            placeholder="0"
                                                        />
                                                        <div className="h-full px-3 bg-muted/30 border-l border-border/50 flex items-center justify-center text-xs text-muted-foreground font-medium shrink-0">
                                                            Hours
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-px bg-border/50" />

                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-sm font-semibold text-foreground">Finish By Date</h3>
                                                    <Switch 
                                                        checked={finishByEnabled}
                                                        onCheckedChange={setFinishByEnabled}
                                                    />
                                                </div>
                                                
                                                {finishByEnabled && (
                                                    <div className="space-y-4 animate-in fade-in duration-300">
                                                        <RadioGroup value={finishByMode} onValueChange={(v: any) => setFinishByMode(v)} className="flex gap-4">
                                                            <div className="flex items-center space-x-2">
                                                                <RadioGroupItem value="days_based" id="fb-days" className="h-4 w-4" />
                                                                <Label htmlFor="fb-days" className="text-xs cursor-pointer">Days Based</Label>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <RadioGroupItem value="event_based" id="fb-event" className="h-4 w-4" />
                                                                <Label htmlFor="fb-event" className="text-xs cursor-pointer">Event Based</Label>
                                                            </div>
                                                        </RadioGroup>

                                                        {finishByMode === 'days_based' ? (
                                                            <div className="space-y-2">
                                                                <Label className="text-xs font-semibold text-foreground">Number of Days</Label>
                                                                <div className="flex items-center w-full max-w-[160px] h-11 border border-border/70 rounded-lg overflow-hidden bg-background focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                                                                    <Input
                                                                        type="number"
                                                                        className="h-full border-none focus-visible:ring-0 rounded-none w-full font-medium"
                                                                        value={finishByDays}
                                                                        onChange={(e) => setFinishByDays(e.target.value ? parseInt(e.target.value) : '')}
                                                                        onKeyDown={blockInvalidNumberKeys}
                                                                    />
                                                                    <div className="h-full px-3 bg-muted/30 border-l border-border/50 flex items-center justify-center text-xs text-muted-foreground font-medium shrink-0">
                                                                        Days
                                                                    </div>
                                                                </div>
                                                                <p className="text-[10px] text-muted-foreground italic">Calculated from work start date.</p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-xs font-semibold text-foreground">Days</Label>
                                                                        <Input
                                                                            type="number"
                                                                            className="h-9 font-medium"
                                                                            value={finishByDays}
                                                                            onChange={(e) => setFinishByDays(e.target.value ? parseInt(e.target.value) : '')}
                                                                            onKeyDown={blockInvalidNumberKeys}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-xs font-semibold text-foreground">Direction</Label>
                                                                        <Select value={finishByDirection} onValueChange={(v: any) => setFinishByDirection(v)}>
                                                                            <SelectTrigger className="h-9 text-xs">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="before">Before</SelectItem>
                                                                                <SelectItem value="after">After</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label className="text-xs font-semibold text-foreground">Trigger Event</Label>
                                                                    <Select value={finishByEvent} onValueChange={(v: any) => setFinishByEvent(v)}>
                                                                        <SelectTrigger className="h-9 text-xs">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="work_start_date">From Work Start Date</SelectItem>
                                                                            <SelectItem value="due_date">From Due Date</SelectItem>
                                                                            <SelectItem value="period_start">From Filing Period Start</SelectItem>
                                                                            <SelectItem value="period_end">From Filing Period End</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between p-3.5 bg-muted/20 rounded-lg border border-border/50">
                                                            <div className="space-y-1 pr-4">
                                                                <Label className="text-sm font-medium text-foreground">Allow Finish-By Override</Label>
                                                                <p className="text-[11px] text-muted-foreground leading-snug">Users can change the finish-by date.</p>
                                                            </div>
                                                            <Switch 
                                                                checked={allowFinishByOverride}
                                                                onCheckedChange={setAllowFinishByOverride}
                                                            />
                                                        </div>

                                                        {renderFinishByExample()}
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                    </div>

                                    <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-300" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
                                        {selectedFrequencies.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center p-16 border border-border/50 rounded-xl bg-card shadow-sm">
                                                <Repeat className="h-10 w-10 text-muted-foreground/30 mb-4" />
                                                <h3 className="text-sm font-semibold text-foreground mb-1">No Cycle Selected</h3>
                                                <p className="text-xs text-muted-foreground text-center max-w-[200px]">Choose a cycle to set the due date rules.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-5">
                                                {selectedFrequencies.map(f => (
                                                    <div key={f} className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-sm">
                                                        <div className="px-5 py-4 bg-card flex items-center justify-between border-b border-border/50">
                                                            <span className="text-sm font-bold uppercase tracking-wide text-foreground">
                                                                {frequencyOptions.find(o => o.value === f)?.label} Rules
                                                            </span>
                                                            <Badge variant="outline" className="h-5 px-2 text-[10px] font-semibold tracking-wider bg-green-50 text-green-700 border-green-200 pointer-events-none dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20">READY</Badge>
                                                        </div>
                                                        <div className="p-5 space-y-6">
                                                            {renderFreqInputs(f)}
                                                            <div className="h-px bg-border/50" />
                                                            <div className="flex items-center justify-between pt-1">
                                                                <div className="space-y-1">
                                                                    <Label className="text-sm font-medium text-foreground">Allow Due Date Override</Label>
                                                                    <p className="text-[11px] text-muted-foreground leading-snug">Users can change the calculated due date.</p>
                                                                </div>
                                                                <Switch 
                                                                    checked={allowDueDateOverride}
                                                                    onCheckedChange={setAllowDueDateOverride}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 px-6 py-4 border-t border-border/70 bg-background/95 backdrop-blur-sm flex justify-end gap-3 rounded-b-2xl shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.05)]">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsDialogOpen(false);
                                setEditingConfigIndex(null);
                                setConfigName('');
                                setAllowOccurrenceOverride(false);
                                setAllowDueDateOverride(false);
                                setAllowFinishByOverride(false);
                                setFinishByEnabled(false);
                                setFinishByMode('days_based');
                                setFinishByDays('');
                                setFinishByEvent('work_start_date');
                                setFinishByDirection('after');
                            }}
                            className="h-[44px] min-w-[120px] rounded-[10px] font-semibold text-[13px] border-border/80 text-foreground hover:bg-muted"
                        >
                            Cancel
                        </Button>
                        <Button
                            className="h-[44px] min-w-[120px] rounded-[10px] font-semibold text-[13px] shadow-sm hover:shadow-md transition-all hover:-translate-y-px active:translate-y-0"
                            disabled={loading || selectedFrequencies.length === 0 || !selectedWorkTypeId}
                            onClick={handleSave}
                        >
                            {loading ? "Saving..." : "Save Settings"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
