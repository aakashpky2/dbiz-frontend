'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Database } from 'lucide-react';

const indianStates = [
    { value: 'andaman-nicobar-islands', label: 'Andaman and Nicobar Islands' },
    { value: 'andhra-pradesh', label: 'Andhra Pradesh' },
    { value: 'arunachal-pradesh', label: 'Arunachal Pradesh' },
    { value: 'assam', label: 'Assam' },
    { value: 'bihar', label: 'Bihar' },
    { value: 'chandigarh', label: 'Chandigarh' }, { value: 'chhattisgarh', label: 'Chhattisgarh' },
    { value: 'dadra-nagar-haveli-daman-diu', label: 'Dadra and Nagar Haveli and Daman and Diu' },
    { value: 'delhi', label: 'Delhi' },
    { value: 'goa', label: 'Goa' },
    { value: 'gujarat', label: 'Gujarat' },
    { value: 'haryana', label: 'Haryana' },
    { value: 'himachal-pradesh', label: 'Himachal Pradesh' },
    { value: 'jammu-kashmir', label: 'Jammu and Kashmir' },
    { value: 'jharkhand', label: 'Jharkhand' },
    { value: 'karnataka', label: 'Karnataka' },
    { value: 'kerala', label: 'Kerala' },
    { value: 'ladakh', label: 'Ladakh' },
    { value: 'lakshadweep', label: 'Lakshadweep' },
    { value: 'madhya-pradesh', label: 'Madhya Pradesh' },
    { value: 'maharashtra', label: 'Maharashtra' },
    { value: 'manipur', label: 'Manipur' },
    { value: 'meghalaya', label: 'Meghalaya' },
    { value: 'mizoram', label: 'Mizoram' },
    { value: 'nagaland', label: 'Nagaland' },
    { value: 'odisha', label: 'Odisha' },
    { value: 'puducherry', label: 'Puducherry' },
    { value: 'punjab', label: 'Punjab' },
    { value: 'rajasthan', label: 'Rajasthan' },
    { value: 'sikkim', label: 'Sikkim' },
    { value: 'tamil-nadu', label: 'Tamil Nadu' },
    { value: 'telangana', label: 'Telangana' },
    { value: 'tripura', label: 'Tripura' },
    { value: 'uttar-pradesh', label: 'Uttar Pradesh' },
    { value: 'uttarakhand', label: 'Uttarakhand' },
    { value: 'west-bengal', label: 'West Bengal' },
];

export function StatesSeeder() {
    const [isSeeding, setIsSeeding] = useState(false);
    const { toast } = useToast();

    const handleSeed = async () => {
        setIsSeeding(true);
        try {
            const rows = indianStates.map(s => ({
                value: s.value,
                label: s.label,
            }));
            const { error } = await supabase
                .from('states')
                .upsert(rows, { onConflict: 'value' });
            if (error) throw error;

            toast({
                title: "Success",
                description: "Indian states data has been seeded to the database.",
            });
        } catch (error) {
            console.error("Error seeding states:", error);
            toast({
                title: "Error",
                description: "Failed to seed states data.",
                variant: "destructive",
            });
        } finally {
            setIsSeeding(false);
        }
    };

    return (
        <div className="p-4 border rounded-lg bg-muted/50 my-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Database Seeder
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Upload Indian states data to Supabase. Run this once.
                    </p>
                </div>
                <Button onClick={handleSeed} disabled={isSeeding} variant="secondary" className="min-w-[120px] rounded-xl font-bold border border-slate-200 shadow-sm">
                    {isSeeding ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Seeding...
                        </>
                    ) : (
                        'Seed States'
                    )}
                </Button>
            </div>
        </div>
    );
}
