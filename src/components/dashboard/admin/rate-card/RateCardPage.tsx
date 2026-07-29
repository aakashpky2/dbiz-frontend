'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Search, AlertCircle, Calendar, Briefcase, User, Building, ChevronLeft, ChevronRight, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRateCards } from '@/hooks/useRateCards';
import { format } from 'date-fns';
import { useProfiles } from '@/hooks/use-profiles';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const RateCardForm = dynamic(() => import('./RateCardForm'), {
    ssr: false,
    loading: () => <div className="p-4 space-y-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-[400px] w-full" /></div>
});

const RateCardDetails = dynamic(() => import('./RateCardDetails'), {
    ssr: false,
    loading: () => <div className="p-4 space-y-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-[400px] w-full" /></div>
});
const PendingApprovalsTab = dynamic(() => import('./PendingApprovalsTab').then(mod => mod.PendingApprovalsTab), {
    ssr: false,
    loading: () => <div className="p-4 text-center text-muted-foreground animate-pulse">Loading pending approvals...</div>
});
import { usePermissions } from '@/hooks/use-permissions';
import { useDebounce } from '@/hooks/use-debounce';
import { getRateCardLiveStatus, getRateCardItemCount } from '@/lib/rate-card-utils';

export default function RateCardPage() {
    const [searchInput, setSearchInput] = useState('');
    const [businessProfileId, setBusinessProfileId] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [activeTab, setActiveTab] = useState('active');
    const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

    const handleToggleCard = (id: string) => {
        setExpandedCardId(prev => prev === id ? null : id);
    };

    const [selectedRateCardId, setSelectedRateCardId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const { hasPermission } = usePermissions();

    // Debounce search so we don't fire a request on every keystroke
    const debouncedSearch = useDebounce(searchInput, 350);

    // Build server-side filters per tab — no more limit:10000
    const filters = useMemo(() => {
        const f: Record<string, any> = {
            search: debouncedSearch,
            page,
            limit,
        };
        if (businessProfileId !== 'all') f.business_profile_id = businessProfileId;
        // Map tab to backend filter params
        if (activeTab === 'pending') {
            f.approval_status = 'pending_approval';
        } else if (activeTab === 'active') {
            f.status = 'active';
            f.approval_status = 'approved';
        } else if (activeTab === 'scheduled') {
            f.status = 'scheduled';
        } else if (activeTab === 'expired') {
            f.status = 'expired';
        }
        // 'all' tab: no status filter
        return f;
    }, [debouncedSearch, businessProfileId, activeTab, page, limit]);

    const { rateCards, loading, error, refresh, pagination } = useRateCards(filters);
    const { profiles: businessProfiles, loading: profilesLoading } = useProfiles();

    const handleAdd = () => {
        setSelectedRateCardId(null);
        setIsCreating(true);
        setIsEditing(false);
    };

    const handleSelect = (id: string) => {
        setSelectedRateCardId(id);
        setIsCreating(false);
        setIsEditing(false);
    };

    const handleSuccess = (newId?: string) => {
        refresh();
        if (newId && typeof newId === 'string') {
            setSelectedRateCardId(newId);
            setIsCreating(false);
            setIsEditing(false);
        } else if (isCreating) {
            setIsCreating(false);
        }
    };

    const handleCancel = () => {
        setIsCreating(false);
        setIsEditing(false);
    };

    const handleBackFromDetails = () => {
        setSelectedRateCardId(null);
        setIsCreating(false);
        setIsEditing(false);
        refresh();
    };

    const handleTabChange = (val: string) => {
        setActiveTab(val);
        setPage(1); // Reset page on tab change
    };

    const getStatusBadge = (status: string, approval_status?: string) => {
        if (approval_status === 'pending_approval') {
            return <Badge variant="secondary" className="bg-amber-500 text-white">Pending Approval</Badge>;
        }
        if (approval_status === 'draft') {
            return <Badge variant="outline">Draft</Badge>;
        }
        if (approval_status === 'rejected') {
            return <Badge variant="outline" className="border-red-500 text-red-500">Rejected</Badge>;
        }

        switch (status) {
            case 'active':
                return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Active</Badge>;
            case 'scheduled':
                return <Badge variant="secondary" className="bg-blue-500 text-white hover:bg-blue-600">Scheduled</Badge>;
            case 'expired':
                return <Badge variant="outline" className="text-red-500 border-red-500">Expired</Badge>;
            case 'superseded':
                return <Badge variant="outline" className="text-gray-500 border-gray-500">Superseded</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const renderListUI = () => (
        <div className="flex flex-col gap-4">
            <div className="flex gap-4 sm:flex-row flex-col">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search rate cards..."
                        className="pl-9 h-9"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </div>
                <div className="w-64">
                    <select
                        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        value={businessProfileId}
                        onChange={(e) => setBusinessProfileId(e.target.value)}
                        disabled={profilesLoading}
                    >
                        <option value="all">All Business Profiles</option>
                        {businessProfiles.map((p) => (
                            <option key={p.id} value={p.id}>{p.profileName}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="py-2">
                {loading ? (
                    <div className="flex h-32 items-center justify-center">
                        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                ) : error ? (
                    <div className="flex h-32 flex-col items-center justify-center text-destructive gap-2">
                        <AlertCircle className="h-6 w-6" />
                        <p>{error}</p>
                    </div>
                ) : rateCards.length === 0 ? (
                    <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                        <Briefcase className="h-10 w-10 mb-2 opacity-20" />
                        <p>No rate cards found.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
                        {rateCards.map((card: any) => {
                            const totalItems = getRateCardItemCount(card);
                            
                            const resolvedClients = card.clients || [];
                            const resolvedAssociates = card.associates || [];
                            const resolvedProfiles = card.business_profiles || [];

                            let forName = 'N/A';
                            if (resolvedClients.length > 0) {
                                if (resolvedClients.length === 1) {
                                    forName = resolvedClients[0].client_name || resolvedClients[0].name || resolvedClients[0].clientName || 'Unnamed Client';
                                } else {
                                    forName = `${resolvedClients.length} Clients Selected`;
                                }
                            } else if (resolvedAssociates.length > 0) {
                                if (resolvedAssociates.length === 1) {
                                    forName = resolvedAssociates[0].company_name || resolvedAssociates[0].name || 'Unnamed Associate';
                                } else {
                                    forName = `${resolvedAssociates.length} Associates Selected`;
                                }
                            } else if (resolvedProfiles.length > 0) {
                                if (resolvedProfiles.length === 1) {
                                    forName = resolvedProfiles[0].profile_name || resolvedProfiles[0].profileName || 'Unnamed Profile';
                                } else {
                                    forName = `${resolvedProfiles.length} Profiles Selected`;
                                }
                            } else {
                                forName = card.client_name || card.associate_name || card.business_profile_name || card.client?.name || card.associate?.name || card.business_profile?.name || 'N/A';
                            }

                            return (
                                <div
                                    key={card.id}
                                    className="group bg-background border rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden h-fit self-start"
                                >
                                    <div 
                                        onClick={() => handleToggleCard(card.id)}
                                        className="cursor-pointer p-4 flex flex-col hover:bg-muted/30 transition-all focus:outline-none"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex flex-col gap-2 flex-1">
                                                <h3 className="font-semibold text-base line-clamp-2">
                                                    {card.name || card.rate_card_name || 'Untitled Rate Card'}
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    {getStatusBadge(getRateCardLiveStatus(card.applicable_from, card.applicable_until, card.status), card.approval_status)}
                                                </div>
                                                <p className="text-sm font-medium text-muted-foreground">
                                                    Total Items: {totalItems}
                                                </p>
                                                <div className="sm:hidden mt-1 text-xs text-muted-foreground line-clamp-2">
                                                    For: {forName}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 shrink-0">
                                                {expandedCardId === card.id ? <ChevronUp className="h-5 w-5 text-muted-foreground transition-transform" /> : <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />}
                                                <div className="hidden sm:block text-xs text-muted-foreground text-right max-w-[150px] line-clamp-3">
                                                    For: {forName}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                {expandedCardId === card.id && (
                                <div className="border-t bg-muted/10 p-4 text-sm space-y-3">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Client Type</p>
                                        <p className="font-medium capitalize">{card.client_type || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Client / Associate</p>
                                        <div className="font-medium flex items-center gap-1 flex-wrap">
                                            {resolvedClients.length > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    {resolvedClients.map((c: any, idx: number) => (
                                                        <span key={idx} className="truncate">{c.client_name || c.name || c.clientName}</span>
                                                    ))}
                                                </div>
                                            ) : resolvedAssociates.length > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    {resolvedAssociates.map((a: any, idx: number) => (
                                                        <span key={idx} className="truncate">{a.company_name || a.name}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="truncate">N/A</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Business Profile</p>
                                        <div className="font-medium flex items-center gap-1 flex-wrap">
                                            {resolvedProfiles.length > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    {resolvedProfiles.map((bp: any, idx: number) => (
                                                        <span key={idx} className="truncate">{bp.profile_name || bp.profileName}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="truncate">N/A</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Created Date</p>
                                        <p className="font-medium">
                                            {card.created_at ? format(new Date(card.created_at), 'dd MMM yyyy') : 'No Date'}
                                        </p>
                                    </div>
                                    <div className="pt-2">
                                        <Button 
                                            variant="outline" 
                                            className="w-full"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleSelect(card.id);
                                            }}
                                        >
                                            View Details
                                        </Button>
                                    </div>
                                </div>
                                )}
                            </div>
                        )})}
                    </div>
                )}
            </div>

            <div className="border-t pt-4 pb-2 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Showing {rateCards.length} of {pagination.total} records
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rows per page</span>
                        <select 
                            className="h-8 rounded-md border bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            value={limit}
                            onChange={(e) => {
                                setLimit(Number(e.target.value));
                                setPage(1);
                            }}
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8" 
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm px-2">Page {page} of {pagination.totalPages}</span>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8" 
                            disabled={page >= pagination.totalPages}
                            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    if (isCreating) {
        return (
            <div className="flex flex-col bg-card rounded-lg border shadow-sm">
                <div className="flex items-center gap-4 border-b p-4">
                    <Button variant="ghost" size="icon" onClick={handleCancel}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="text-lg font-semibold">Create New Rate Card</h2>
                </div>
                <div className="p-4">
                    <RateCardForm onSuccess={handleSuccess} onCancel={handleCancel} />
                </div>
            </div>
        );
    }

    if (selectedRateCardId) {
        return (
            <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                <RateCardDetails 
                    rateCardId={selectedRateCardId} 
                    onBack={handleBackFromDetails}
                    isEditing={isEditing}
                    onEditDetails={() => setIsEditing(true)}
                    onCancelEdit={() => setIsEditing(false)}
                    onSuccess={handleSuccess}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Rate Cards</h1>
                    <p className="text-sm text-muted-foreground">Manage service fees, pricing, and approvals</p>
                </div>
                {hasPermission('rate_card.create') && (
                    <Button onClick={handleAdd}>
                        <Plus className="mr-2 h-4 w-4" /> Create Rate Card
                    </Button>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col">
                <TabsList className="shrink-0 max-w-max">
                    <TabsTrigger value="active">Active</TabsTrigger>
                    <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                    <TabsTrigger value="expired">Expired</TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                    {hasPermission('rate_card.approve') && (
                        <TabsTrigger value="pending">Pending for Approval</TabsTrigger>
                    )}
                </TabsList>
                
                <TabsContent value="active" className="m-0 mt-4">
                    {activeTab === 'active' && renderListUI()}
                </TabsContent>
                <TabsContent value="scheduled" className="m-0 mt-4">
                    {activeTab === 'scheduled' && renderListUI()}
                </TabsContent>
                <TabsContent value="expired" className="m-0 mt-4">
                    {activeTab === 'expired' && renderListUI()}
                </TabsContent>
                <TabsContent value="all" className="m-0 mt-4">
                    {activeTab === 'all' && renderListUI()}
                </TabsContent>
                
                <TabsContent value="pending" className="m-0 mt-4 flex flex-col gap-8">
                    {activeTab === 'pending' && (
                        <>
                            <div>
                                {renderListUI()}
                            </div>
                            {hasPermission('rate_card.approve') && (
                                <Card className="flex flex-col overflow-hidden shadow-sm">
                                    <div className="p-4 bg-muted/10 border-b flex justify-between items-center">
                                        <h3 className="font-semibold">Service Item Change Requests</h3>
                                    </div>
                                    <div className="p-4">
                                        <PendingApprovalsTab />
                                    </div>
                                </Card>
                            )}
                        </>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
