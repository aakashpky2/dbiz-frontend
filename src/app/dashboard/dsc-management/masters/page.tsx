import { DSCMasters } from '../_components/dsc-masters';
import { Settings } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';

export default function DSCMastersPage() {
    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Masters Configuration"
                description="Manage DSC classes, validities, authorities, token pricing formulas, and workflow execution stages."
            />

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <DSCMasters />
            </div>
        </div>
    );
}
