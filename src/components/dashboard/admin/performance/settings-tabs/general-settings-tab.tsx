'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function GeneralSettingsTab() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState({
        evaluation_lock_period_days: 7,
        allow_self_review: false,
        allow_manager_override: true,
        allow_hr_override: true,
        enable_decimal_ratings: true,
        max_decimal_places: 1,
        auto_generate_reviews: true,
        reminder_days_before: 3,
        review_due_days: 14
    });

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('/api/performance/settings?keys=GENERAL_SETTINGS');
                const data = await res.json();
                if (data.success && data.data['GENERAL_SETTINGS']) {
                    setSettings(data.data['GENERAL_SETTINGS']);
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
                        setting_key: 'GENERAL_SETTINGS',
                        setting_value: settings
                    }]
                })
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: 'General Settings Saved Successfully.' });
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast({ title: 'Error saving settings', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div>Loading settings...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">General Settings</h3>
                <p className="text-sm text-muted-foreground">Configure global policies for the Performance Management System.</p>
            </div>

            <Card className="shadow-sm max-w-3xl">
                <CardContent className="pt-6 space-y-8">
                    
                    {/* Permissions & Overrides */}
                    <div className="space-y-4">
                        <h4 className="font-semibold border-b pb-2">Permissions & Overrides</h4>
                        <div className="flex items-center justify-between">
                            <Label>Allow Self Review</Label>
                            <Switch 
                                checked={settings.allow_self_review} 
                                onCheckedChange={(val) => setSettings({...settings, allow_self_review: val})}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Allow Manager Override on Auto-Calculated Scores</Label>
                            <Switch 
                                checked={settings.allow_manager_override} 
                                onCheckedChange={(val) => setSettings({...settings, allow_manager_override: val})}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Allow HR Override on Final Reviews</Label>
                            <Switch 
                                checked={settings.allow_hr_override} 
                                onCheckedChange={(val) => setSettings({...settings, allow_hr_override: val})}
                            />
                        </div>
                    </div>

                    {/* Rating Configurations */}
                    <div className="space-y-4">
                        <h4 className="font-semibold border-b pb-2">Rating Constraints</h4>
                        <div className="flex items-center justify-between">
                            <Label>Enable Decimal Ratings (e.g. 8.5/10)</Label>
                            <Switch 
                                checked={settings.enable_decimal_ratings} 
                                onCheckedChange={(val) => setSettings({...settings, enable_decimal_ratings: val})}
                            />
                        </div>
                        {settings.enable_decimal_ratings && (
                            <div className="flex items-center justify-between">
                                <Label>Maximum Decimal Places</Label>
                                <Input 
                                    type="number" 
                                    className="w-24" 
                                    value={settings.max_decimal_places}
                                    onChange={(e) => setSettings({...settings, max_decimal_places: Number(e.target.value)})}
                                />
                            </div>
                        )}
                    </div>

                    {/* Timeline & Automation */}
                    <div className="space-y-4">
                        <h4 className="font-semibold border-b pb-2">Timeline & Automation</h4>
                        <div className="flex items-center justify-between">
                            <Label>Auto Generate Reviews on Cycle Start</Label>
                            <Switch 
                                checked={settings.auto_generate_reviews} 
                                onCheckedChange={(val) => setSettings({...settings, auto_generate_reviews: val})}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Review Due Days (from cycle start)</Label>
                            <Input 
                                type="number" 
                                className="w-24" 
                                value={settings.review_due_days}
                                onChange={(e) => setSettings({...settings, review_due_days: Number(e.target.value)})}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Reminder Days Before Due</Label>
                            <Input 
                                type="number" 
                                className="w-24" 
                                value={settings.reminder_days_before}
                                onChange={(e) => setSettings({...settings, reminder_days_before: Number(e.target.value)})}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Evaluation Lock Period (Days after due date)</Label>
                            <Input 
                                type="number" 
                                className="w-24" 
                                value={settings.evaluation_lock_period_days}
                                onChange={(e) => setSettings({...settings, evaluation_lock_period_days: Number(e.target.value)})}
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save General Settings'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
