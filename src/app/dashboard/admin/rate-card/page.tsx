'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';

import { Suspense } from 'react';

const RateCardPage = dynamic(() => import('@/components/dashboard/admin/rate-card/RateCardPage'), { loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading Rate Card module...</div> });
const GovernmentFeeLibraryPage = dynamic(() => import('@/components/dashboard/admin/government-fee/GovernmentFeeLibraryPage'), { loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading Library...</div> });
const SourceMappingSettings = dynamic(() => import('@/components/dashboard/admin/government-fee/SourceMappingSettings'), { loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading Settings...</div> });

function UnifiedRateCardContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const { hasPermission } = usePermissions();
    
    const [isMounted, setIsMounted] = useState(false);
    
    const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
    const canViewGovtFees = hasPermission('government_fee.view') || isAdmin;
    const canViewRateCards = hasPermission('rate_card.view') || isAdmin;

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const tabParam = searchParams.get('tab') || 'rate-cards';
    
    const handleTabChange = (value: string) => {
        router.push(`/dashboard/admin/rate-card?tab=${value}`);
    };

    if (!isMounted) return null;

    if (!canViewRateCards && !canViewGovtFees) return <div className="p-8 text-center text-muted-foreground">Access Denied</div>;

    return (
        <div className="p-6 h-full flex flex-col space-y-6 max-w-[1600px] mx-auto w-full">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Rate Card & Government Fees</h1>
                <p className="text-muted-foreground text-sm mt-1">Manage professional fees, government fee rules, and source mappings.</p>
            </div>
            
            <Tabs value={tabParam} onValueChange={handleTabChange} className="w-full flex-1 flex flex-col min-h-0">
                <TabsList className="w-full justify-start border-b rounded-none px-0 bg-transparent h-auto p-0 mb-4">
                    <TabsTrigger value="rate-cards" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3">
                        Rate Cards
                    </TabsTrigger>
                    {canViewGovtFees && (
                        <TabsTrigger value="government-fees" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3">
                            Government Fee Library
                        </TabsTrigger>
                    )}
                    {isAdmin && (
                        <TabsTrigger value="source-mappings" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3">
                            Source Mapping Settings
                        </TabsTrigger>
                    )}
                </TabsList>
                
                <TabsContent value="rate-cards" className="flex-1 min-h-0 m-0">
                    {canViewRateCards ? <RateCardPage /> : <div className="p-8 text-center text-muted-foreground">You do not have permission to view Rate Cards.</div>}
                </TabsContent>
                
                {canViewGovtFees && (
                    <TabsContent value="government-fees" className="flex-1 min-h-0 m-0">
                        <GovernmentFeeLibraryPage />
                    </TabsContent>
                )}
                
                {isAdmin && (
                    <TabsContent value="source-mappings" className="flex-1 min-h-0 m-0">
                        <SourceMappingSettings />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}

export default function UnifiedRateCardPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground animate-pulse">Loading...</div>}>
            <UnifiedRateCardContent />
        </Suspense>
    );
}
