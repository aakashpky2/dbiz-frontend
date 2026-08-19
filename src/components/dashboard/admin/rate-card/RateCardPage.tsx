'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, AlertCircle, Briefcase, ChevronLeft, ChevronRight, ArrowLeft, ChevronDown, ChevronUp, Receipt } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRateCards } from '@/hooks/useRateCards';
import { format } from 'date-fns';
import { useProfiles } from '@/hooks/use-profiles';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/use-permissions';
import { useDebounce } from '@/hooks/use-debounce';
import { getRateCardLiveStatus, getRateCardItemCount } from '@/lib/rate-card-utils';

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

interface RateCardPageProps {
    createTrigger?: number;
}

export default function RateCardPage({ createTrigger }: RateCardPageProps) {
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

    // Trigger create when hero action button is clicked
    useEffect(() => {
        if (createTrigger && createTrigger > 0) {
            handleAdd();
        }
    }, [createTrigger]);

    useEffect(() => {
        const handleCreateEvent = () => handleAdd();
        window.addEventListener('dbiz:create-rate-card', handleCreateEvent);
        return () => window.removeEventListener('dbiz:create-rate-card', handleCreateEvent);
    }, []);

    // Debounce search so we don't fire a request on every keystroke
    const debouncedSearch = useDebounce(searchInput, 350);

    // Build server-side filters per tab
    const filters = useMemo(() => {
        const f: Record<string, any> = {
            search: debouncedSearch,
            page,
            limit,
        };
        if (businessProfileId !== 'all') f.business_profile_id = businessProfileId;
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
        setPage(1);
    };

    const getStatusBadge = (status: string, approval_status?: string) => {
        if (approval_status === 'pending_approval') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Pending Approval
                </span>
            );
        }
        if (approval_status === 'draft') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                    Draft
                </span>
            );
        }
        if (approval_status === 'rejected') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Rejected
                </span>
            );
        }

        switch (status) {
            case 'active':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                    </span>
                );
            case 'scheduled':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Scheduled
                    </span>
                );
            case 'expired':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        Expired
                    </span>
                );
            case 'superseded':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        Superseded
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                        {status}
                    </span>
                );
        }
    };

    const renderListUI = () => (
        <div className="flex flex-col gap-6">
            {/* Filter & Search Toolbar */}
            <div className="flex gap-3 sm:flex-row flex-col items-stretch sm:items-center">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Search rate cards..."
                        className="pl-10 h-11 rounded-xl border-border/70 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 text-sm transition-all duration-200 bg-card"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </div>
                <div className="w-full sm:w-64">
                    <select
                        className="flex h-11 w-full items-center justify-between rounded-xl border border-border/70 bg-card px-3.5 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 text-foreground"
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

            {/* Cards Grid */}
            <div>
                {loading ? (
                    <div className="flex h-44 items-center justify-center bg-card/50 rounded-2xl border border-border/60">
                        <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin h-7 w-7 border-2 border-primary border-t-transparent rounded-full" />
                            <span className="text-xs text-muted-foreground">Loading rate cards...</span>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex h-44 flex-col items-center justify-center text-destructive gap-2 bg-destructive/5 rounded-2xl border border-destructive/20 p-6 text-center">
                        <AlertCircle className="h-6 w-6" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                ) : rateCards.length === 0 ? (
                    <div className="flex h-44 flex-col items-center justify-center text-muted-foreground bg-card/40 rounded-2xl border border-border/60 p-6 text-center">
                        <Briefcase className="h-10 w-10 mb-2 opacity-25" />
                        <p className="text-sm font-medium text-foreground">No rate cards found</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Try adjusting your search or active filter</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
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
                                    className="group relative bg-card border border-border/70 rounded-2xl shadow-sm hover:shadow-[0_12px_28px_-6px_rgba(59,130,246,0.12),0_8px_12px_-4px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.4)] hover:border-primary/35 hover:-translate-y-0.5 active:scale-[0.985] transition-all duration-300 overflow-hidden h-fit self-start"
                                >
                                    {/* Soft circular hover glow reveal */}
                                    <div 
                                        className="absolute -right-36 -bottom-36 w-80 h-80 rounded-full pointer-events-none transition-all duration-500 ease-out opacity-0 group-hover:opacity-100 group-hover:-right-16 group-hover:-bottom-16"
                                        style={{
                                            background: "radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.03) 45%, transparent 70%)"
                                        }}
                                    />

                                    <div 
                                        onClick={() => handleToggleCard(card.id)}
                                        className="cursor-pointer p-5 flex flex-col relative z-10 focus:outline-none"
                                    >
                                        {/* Top Row: Name and Chevron */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                                                    <Receipt className="h-4.5 w-4.5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-base text-foreground tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                                                        {card.name || card.rate_card_name || 'Untitled Rate Card'}
                                                    </h3>
                                                    <div className="mt-1.5">
                                                        {getStatusBadge(getRateCardLiveStatus(card.applicable_from, card.applicable_until, card.status), card.approval_status)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/[0.08] transition-colors shrink-0">
                                                {expandedCardId === card.id ? (
                                                    <ChevronUp className="h-4.5 w-4.5 transition-transform duration-200" />
                                                ) : (
                                                    <ChevronDown className="h-4.5 w-4.5 transition-transform duration-200" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Divider */}
                                        <div className="border-t border-border/50 my-3.5" />

                                        {/* Metadata Footer */}
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div className="min-w-0">
                                                <span className="text-muted-foreground text-[11px] font-normal block mb-0.5">
                                                    {resolvedClients.length > 0 ? 'Client / Associate' : 'Business Profile'}
                                                </span>
                                                <span className="font-semibold text-foreground truncate block" title={forName}>
                                                    {forName}
                                                </span>
                                            </div>
                                            <div className="text-right sm:text-left">
                                                <span className="text-muted-foreground text-[11px] font-normal block mb-0.5">
                                                    Total Items
                                                </span>
                                                <span className="font-bold text-foreground text-sm block">
                                                    {totalItems}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedCardId === card.id && (
                                        <div className="border-t border-border/60 bg-muted/25 p-5 text-sm space-y-3.5 relative z-10 animate-in fade-in-50 duration-200">
                                            <div>
                                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Client Type</p>
                                                <p className="font-semibold capitalize text-foreground mt-0.5">{card.client_type || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Client / Associate</p>
                                                <div className="font-medium text-foreground mt-0.5 flex flex-col gap-1">
                                                    {resolvedClients.length > 0 ? (
                                                        resolvedClients.map((c: any, idx: number) => (
                                                            <span key={idx} className="truncate">{c.client_name || c.name || c.clientName}</span>
                                                        ))
                                                    ) : resolvedAssociates.length > 0 ? (
                                                        resolvedAssociates.map((a: any, idx: number) => (
                                                            <span key={idx} className="truncate">{a.company_name || a.name}</span>
                                                        ))
                                                    ) : (
                                                        <span className="text-muted-foreground">N/A</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Business Profile</p>
                                                <div className="font-medium text-foreground mt-0.5 flex flex-col gap-1">
                                                    {resolvedProfiles.length > 0 ? (
                                                        resolvedProfiles.map((bp: any, idx: number) => (
                                                            <span key={idx} className="truncate">{bp.profile_name || bp.profileName}</span>
                                                        ))
                                                    ) : (
                                                        <span className="text-muted-foreground">N/A</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Created Date</p>
                                                <p className="font-semibold text-foreground mt-0.5">
                                                    {card.created_at ? format(new Date(card.created_at), 'dd MMM yyyy') : 'No Date'}
                                                </p>
                                            </div>
                                            <div className="pt-2">
                                                <Button 
                                                    variant="outline" 
                                                    className="w-full rounded-xl h-10 font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 shadow-sm"
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
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            <div className="border-t border-border/60 pt-4 pb-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground order-2 sm:order-1">
                    Showing <span className="font-medium text-foreground">{rateCards.length}</span> of <span className="font-medium text-foreground">{pagination.total}</span> records
                </div>
                <div className="flex items-center gap-4 order-1 sm:order-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
                        <select 
                            className="h-9 rounded-lg border border-border/70 bg-card px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
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
                    <div className="flex items-center gap-1.5">
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-9 w-9 rounded-lg border-border/70 hover:bg-muted" 
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm px-2.5 font-medium text-foreground whitespace-nowrap">
                            Page {page} of {Math.max(1, pagination.totalPages)}
                        </span>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-9 w-9 rounded-lg border-border/70 hover:bg-muted" 
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
            <div className="flex flex-col bg-card rounded-2xl border border-border/70 shadow-sm overflow-hidden animate-in fade-in-50 duration-200">
                <div className="flex items-center gap-4 border-b border-border/70 p-5 bg-muted/10">
                    <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 hover:bg-muted" onClick={handleCancel}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-lg font-bold tracking-tight text-foreground">Create New Rate Card</h2>
                        <p className="text-xs text-muted-foreground">Configure service pricing, slabs, and eligibility rules</p>
                    </div>
                </div>
                <div className="p-6">
                    <RateCardForm onSuccess={handleSuccess} onCancel={handleCancel} />
                </div>
            </div>
        );
    }

    if (selectedRateCardId) {
        return (
            <div className="bg-card rounded-2xl border border-border/70 shadow-sm overflow-hidden animate-in fade-in-50 duration-200">
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
        <div className="flex flex-col gap-6">
            {/* Section Header without duplicate button */}
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Rate Cards</h2>
                <p className="text-sm text-muted-foreground">Manage service fees, pricing, and approvals</p>
            </div>

            {/* Status Filter Tabs */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col space-y-6">
                <div className="flex justify-start">
                    <TabsList className="inline-flex p-1.5 rounded-xl bg-muted/40 border border-border/60 gap-1 h-auto flex-wrap sm:flex-nowrap">
                        <TabsTrigger 
                            value="active" 
                            className="px-3.5 h-9 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=inactive]:text-muted-foreground hover:bg-primary/[0.05] hover:text-primary flex items-center gap-1.5"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                        </TabsTrigger>
                        <TabsTrigger 
                            value="scheduled" 
                            className="px-3.5 h-9 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=inactive]:text-muted-foreground hover:bg-primary/[0.05] hover:text-primary flex items-center gap-1.5"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Scheduled
                        </TabsTrigger>
                        <TabsTrigger 
                            value="expired" 
                            className="px-3.5 h-9 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=inactive]:text-muted-foreground hover:bg-primary/[0.05] hover:text-primary"
                        >
                            Expired
                        </TabsTrigger>
                        <TabsTrigger 
                            value="all" 
                            className="px-3.5 h-9 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=inactive]:text-muted-foreground hover:bg-primary/[0.05] hover:text-primary"
                        >
                            All
                        </TabsTrigger>
                        {hasPermission('rate_card.approve') && (
                            <TabsTrigger 
                                value="pending" 
                                className="px-3.5 h-9 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=inactive]:text-muted-foreground hover:bg-primary/[0.05] hover:text-primary flex items-center gap-1.5"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Pending for Approval
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>
                
                <TabsContent value="active" className="m-0">
                    {activeTab === 'active' && renderListUI()}
                </TabsContent>
                <TabsContent value="scheduled" className="m-0">
                    {activeTab === 'scheduled' && renderListUI()}
                </TabsContent>
                <TabsContent value="expired" className="m-0">
                    {activeTab === 'expired' && renderListUI()}
                </TabsContent>
                <TabsContent value="all" className="m-0">
                    {activeTab === 'all' && renderListUI()}
                </TabsContent>
                
                <TabsContent value="pending" className="m-0 flex flex-col gap-6">
                    {activeTab === 'pending' && (
                        <>
                            <div>
                                {renderListUI()}
                            </div>
                            {hasPermission('rate_card.approve') && (
                                <Card className="flex flex-col overflow-hidden shadow-sm rounded-2xl border-border/70">
                                    <div className="p-4 bg-muted/20 border-b border-border/70 flex justify-between items-center">
                                        <h3 className="font-semibold text-foreground">Service Item Change Requests</h3>
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
