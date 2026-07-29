import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface GenerateReviewsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onGenerated: () => void;
}

export function GenerateReviewsDialog({ isOpen, onOpenChange, onGenerated }: GenerateReviewsDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);
    
    const [formData, setFormData] = useState({
        template_id: '',
        period: format(new Date(), 'yyyy-MM'),
        department_id: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchTemplates();
        }
    }, [isOpen]);

    const fetchTemplates = async () => {
        try {
            const res = await fetch('/api/performance/templates?status=active');
            const data = await res.json();
            if (data.success) {
                setTemplates(data.data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleGenerate = async () => {
        if (!formData.template_id || !formData.period) {
            toast({ title: 'Validation Error', description: 'Template and Period are required.', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/performance/reviews/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (data.success) {
                toast({
                    title: 'Success',
                    description: `Generated reviews successfully.`,
                });
                onGenerated();
                onOpenChange(false);
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast({
                title: 'Error generating reviews',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Generate Reviews</DialogTitle>
                    <DialogDescription>
                        Auto-calculate scores based on the selected template and period. Manual scores will be preserved.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Template</Label>
                        <Select 
                            value={formData.template_id} 
                            onValueChange={(val) => setFormData({...formData, template_id: val})}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select active template" />
                            </SelectTrigger>
                            <SelectContent>
                                {templates.map(t => (
                                    <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Evaluation Period (Month)</Label>
                        <Select 
                            value={formData.period} 
                            onValueChange={(val) => setFormData({...formData, period: val})}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={format(new Date(), 'yyyy-MM')}>Current Month ({format(new Date(), 'MMM yyyy')})</SelectItem>
                                <SelectItem value={format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'yyyy-MM')}>Last Month</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleGenerate} disabled={isLoading || !formData.template_id}>
                        {isLoading ? 'Generating...' : 'Generate'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
