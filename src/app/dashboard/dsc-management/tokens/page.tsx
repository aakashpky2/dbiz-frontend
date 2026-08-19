import { TokenInventory } from '../_components/token-inventory';
import { Usb } from 'lucide-react';
import { PageHero } from '@/components/dashboard/page-hero';

export default function TokenInventoryPage() {
    return (
        <div className="space-y-6">
            <PageHero
                pattern="pattern-5"
                icon={Usb}
                badge="TOKEN MANAGEMENT"
                title="Token Inventory"
                description="Manage and monitor USB Token purchases, hardware dispatch sales, and ledger histories."
            />

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <TokenInventory />
            </div>
        </div>
    );
}
