import { TokenInventory } from '../_components/token-inventory';
import { KeyRound } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';

export default function TokenInventoryPage() {
    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Token Inventory"
                description="Manage and monitor USB Token purchases, hardware dispatch sales, and ledger histories."
            />

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <TokenInventory />
            </div>
        </div>
    );
}
