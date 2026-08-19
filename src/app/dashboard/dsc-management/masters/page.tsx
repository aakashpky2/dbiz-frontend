import { DSCMasters } from '../_components/dsc-masters';
import { Settings2 } from 'lucide-react';
import { PageHero } from '@/components/dashboard/page-hero';

export default function DSCMastersPage() {
    return (
        <div className="space-y-6">
            <PageHero
                pattern="pattern-4"
                icon={Settings2}
                badge="DSC CONFIGURATION"
                title="Masters Configuration"
                description="Manage DSC classes, validities, authorities, token pricing formulas, and workflow execution stages."
            />

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <DSCMasters />
            </div>
        </div>
    );
}
