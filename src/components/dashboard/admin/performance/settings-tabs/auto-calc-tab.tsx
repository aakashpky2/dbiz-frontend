'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function AutoCalcTab() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [mapping, setMapping] = useState({
        ATTENDANCE: 'attendance_table',
        PUNCTUALITY: 'attendance_table',
        WORK_REGISTER: 'work_register',
        TASKS: 'task_register',
        ACTIVITY_TRACKER: 'activity_tracker',
        CLIENT_FEEDBACK: 'proposal_feedback',
        MANUAL: 'manual'
    });

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('/api/performance/settings?keys=AUTO_CALC_MAPPING');
                const data = await res.json();
                if (data.success && data.data['AUTO_CALC_MAPPING']) {
                    setMapping(data.data['AUTO_CALC_MAPPING']);
                }
            } catch (err: any) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/performance/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: [{
                        setting_key: 'AUTO_CALC_MAPPING',
                        setting_value: mapping
                    }]
                })
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Calculation Mapping Saved Successfully.' });
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast({ title: 'Error saving settings', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div>Loading mapping configuration...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Auto Calculation Rules</h3>
                <p className="text-sm text-muted-foreground">Map evaluation source modules to the underlying database tables.</p>
            </div>

            <Card className="shadow-sm max-w-2xl">
                <CardContent className="pt-6 space-y-6">
                    {Object.entries(mapping).map(([moduleKey, dbTable]) => (
                        <div key={moduleKey} className="grid grid-cols-2 items-center gap-4 border-b pb-4 last:border-0 last:pb-0">
                            <Label className="font-semibold">{moduleKey}</Label>
                            <Select 
                                value={dbTable as string}
                                onValueChange={(val) => setMapping({ ...mapping, [moduleKey]: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="attendance_table">Attendance Table</SelectItem>
                                    <SelectItem value="work_register">Work Register</SelectItem>
                                    <SelectItem value="task_register">Tasks Table</SelectItem>
                                    <SelectItem value="activity_tracker">Activity Tracker</SelectItem>
                                    <SelectItem value="proposal_feedback">Proposal Feedback</SelectItem>
                                    <SelectItem value="manual">Manual Entry Only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                    <div className="pt-4 flex justify-end">
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Mapping Rules'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
