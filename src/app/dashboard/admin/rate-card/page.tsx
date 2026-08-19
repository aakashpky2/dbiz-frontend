'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';

import { PageHero } from '@/components/dashboard/page-hero';
import { Receipt, Landmark, SlidersHorizontal, Plus } from 'lucide-react';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const RateCardPage = dynamic(() => import('@/components/dashboard/admin/rate-card/RateCardPage'), { loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading Rate Card module...</div> });
const GovernmentFeeLibraryPage = dynamic(() => import('@/components/dashboard/admin/government-fee/GovernmentFeeLibraryPage'), { loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading Library...</div> });
const SourceMappingSettings = dynamic(() => import('@/components/dashboard/admin/government-fee/SourceMappingSettings'), { loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading Settings...</div> });

function UnifiedRateCardContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const { hasPermission } = usePermissions();
    
    const [isMounted, setIsMounted] = useState(false);
    const [createTrigger, setCreateTrigger] = useState(0);
    
    const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
    const canViewGovtFees = hasPermission('government_fee.view') || isAdmin;
    const canViewRateCards = hasPermission('rate_card.view') || isAdmin;
    const canCreateRateCard = hasPermission('rate_card.create') || isAdmin;

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
        <div className="p-6 h-full flex flex-col space-y-6 max-w-[1600px] mx-auto w-full animate-in fade-in duration-300">
            <PageHero 
                pattern="pattern-1"
                icon={Receipt}
                badge="FINANCIAL CONFIGURATION"
                title="Rate Card & Government Fees"
                description="Manage professional fees, government fee rules, and source mappings."
                className="min-h-[170px] sm:min-h-[195px] flex flex-col justify-center py-6 sm:py-8"
                contentClassName="items-center"
            >
                {canViewRateCards && canCreateRateCard && tabParam === 'rate-cards' && (
                    <Button 
                        onClick={() => {
                            setCreateTrigger(prev => prev + 1);
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('dbiz:create-rate-card'));
                            }
                        }}
                        className="h-11 px-5 rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:brightness-105 active:scale-[0.98] font-medium relative z-20 flex items-center gap-2 bg-primary text-primary-foreground shrink-0"
                    >
                        <Plus className="h-4 w-4" />
                        Create Rate Card
                    </Button>
                )}
            </PageHero>
            
            <Tabs value={tabParam} onValueChange={handleTabChange} className="w-full flex-1 flex flex-col min-h-0 space-y-6">
                <div className="w-full flex justify-start">
                    <TabsList className="inline-flex p-1.5 rounded-xl border border-border/70 bg-muted/40 backdrop-blur-sm shadow-sm gap-1 h-auto flex-wrap sm:flex-nowrap">
                        <TabsTrigger 
                            value="rate-cards" 
                            className="relative px-5 h-10 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/40 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-primary/[0.04] flex items-center gap-2"
                        >
                            <Receipt className="h-4 w-4 text-primary" />
                            Rate Cards
                        </TabsTrigger>
                        {canViewGovtFees && (
                            <TabsTrigger 
                                value="government-fees" 
                                className="relative px-5 h-10 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/40 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-primary/[0.04] flex items-center gap-2"
                            >
                                <Landmark className="h-4 w-4 text-primary" />
                                Government Fee Library
                            </TabsTrigger>
                        )}
                        {isAdmin && (
                            <TabsTrigger 
                                value="source-mappings" 
                                className="relative px-5 h-10 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/40 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-primary/[0.04] flex items-center gap-2"
                            >
                                <SlidersHorizontal className="h-4 w-4 text-primary" />
                                Source Mapping Settings
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>
                
                <TabsContent value="rate-cards" className="flex-1 min-h-0 m-0">
                    {canViewRateCards ? <RateCardPage createTrigger={createTrigger} /> : <div className="p-8 text-center text-muted-foreground">You do not have permission to view Rate Cards.</div>}
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
