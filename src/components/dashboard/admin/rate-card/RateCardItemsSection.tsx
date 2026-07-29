'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Trash2, Plus, Edit, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Department } from '@/lib/department-management';
import { rateCardService } from '@/services/rateCardService';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { getRateCardLiveStatus } from '@/lib/rate-card-utils';
import RateCardItemForm from './RateCardItemForm';

interface RateCardItemsSectionProps {
    rateCardId?: string;
    departments: Department[];
    onItemsChanged?: () => void;
}

export default function RateCardItemsSection({ rateCardId, departments, onItemsChanged }: RateCardItemsSectionProps) {
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const [items, setItems] = useState<any[]>([]);
    const [changeRequests, setChangeRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [constitutions, setConstitutions] = useState<any[]>([]);

    const [showForm, setShowForm] = useState(false);
    const [mainRateCard, setMainRateCard] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('active');
    const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
    const [itemToEdit, setItemToEdit] = useState<any | null>(null);

    // Delete confirmation state
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const handleToggle = (id: string) => {
        setExpandedCardId(prev => prev === id ? null : id);
    };

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await rateCardService.getById(rateCardId!);
            if (res.success && res.data) {
                setMainRateCard(res.data);
                setItems(res.data.items || []);
                setChangeRequests(res.data.change_requests || []);
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [rateCardId, toast]);

    const fetchConstitutions = useCallback(async () => {
        const { data, error } = await supabase.from('business_constitutions').select('id,business_type,business_sub_type');
        if (!error && data) {
            setConstitutions(data);
        }
    }, []);

    useEffect(() => {
        if (rateCardId) {
            fetchItems();
        }
        fetchConstitutions();
    }, [rateCardId, fetchItems, fetchConstitutions]);

    // Flatten Work Types for Smart Search
    const flatWorkTypes = useMemo(() => {
        const list: any[] = [];
        departments.forEach(d => {
            if (d.isDeleted || !d.isValidated) return;
            (d.workCategories || []).forEach(c => {
                if (c.isDeleted || !c.isValidated) return;
                (c.workTypes || []).forEach(t => {
                    if (t.isDeleted || !t.isValidated) return;
                    list.push({
                        ...t,
                        department_id: String(d.id),
                        category_id: String(c.id),
                        department_name: d.name,
                        category_name: c.name
                    });
                });
            });
        });
        return list;
    }, [departments]);

    const tabData = useMemo(() => {
        const active: any[] = [];
        const scheduled: any[] = [];
        const expired: any[] = [];
        
        const processedItems = items.map(item => {
            const from = item.applicable_from || mainRateCard?.applicable_from;
            const until = item.applicable_until || mainRateCard?.applicable_until;
            
            const status = getRateCardLiveStatus(from, until, item.status);
            const processedItem = { ...item, computed_status: status };

            if (status === 'expired') {
                expired.push(processedItem);
            } else if (status === 'scheduled') {
                scheduled.push(processedItem);
            } else {
                active.push(processedItem);
            }
            
            return processedItem;
        });

        const missing = flatWorkTypes.filter(wt => !items.some(i => String(i.work_item_id) === String(wt.id))).map(wt => ({
            id: `missing-${wt.id}`,
            work_item_id: wt.id,
            work_item_name: wt.name,
            professional_fee: 0,
            government_fee_total: 0,
            item_total: 0,
            isMissing: true,
            catText: `${wt.department_name} • ${wt.category_name}`,
            department_id: wt.department_id,
            category_id: wt.category_id
        }));

        return {
            active, scheduled, expired, all: processedItems, missing
        };
    }, [items, mainRateCard, flatWorkTypes]);

    const displayedItems = useMemo(() => {
        return activeTab === 'active' ? tabData.active :
               activeTab === 'scheduled' ? tabData.scheduled :
               activeTab === 'expired' ? tabData.expired :
               activeTab === 'missing' ? tabData.missing :
               tabData.all;
    }, [activeTab, tabData]);

    const handleOpenForm = (item?: any) => {
        setItemToEdit(item || null);
        setShowForm(true);
    };

    const handleDeleteItem = async () => {
        if (!rateCardId || !itemToDelete) return;
        if (deleteConfirmText.toLowerCase() !== 'delete') {
            toast({ title: 'Error', description: 'Please type "delete" to confirm.', variant: 'destructive' });
            return;
        }
        
        setIsDeleting(true);
        try {
            await rateCardService.deleteItem(rateCardId, itemToDelete);
            toast({ title: 'Success', description: 'Item deleted successfully.' });
            fetchItems();
            if (onItemsChanged) onItemsChanged();
            setItemToDelete(null);
            setDeleteConfirmText('');
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsDeleting(false);
        }
    };

    if (!rateCardId) {
        return <div className="text-center text-sm text-muted-foreground py-8">Please save the Rate Card details first before adding services.</div>;
    }

    return (
        <div className="space-y-4">
            {!showForm && hasPermission('rate_card.edit') && (
                <Button 
                    onClick={() => handleOpenForm()} 
                    className="w-full border-dashed h-10 bg-primary/5 hover:bg-primary/10 text-primary border-primary/30"
                >
                    <Plus className="mr-2 h-4 w-4" /> Add Service Item
                </Button>
            )}

            {showForm && (
                <RateCardItemForm
                    rateCardId={rateCardId}
                    mainRateCard={mainRateCard}
                    departments={departments}
                    constitutions={constitutions}
                    flatWorkTypes={flatWorkTypes}
                    initialItem={itemToEdit}
                    onSaveSuccess={() => {
                        setShowForm(false);
                        fetchItems();
                        if (onItemsChanged) onItemsChanged();
                    }}
                    onCancel={() => setShowForm(false)}
                />
            )}

            {loading ? (
                <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex items-center justify-between mb-4 border-b pb-2 overflow-x-auto">
                        <TabsList className="bg-transparent h-auto p-0 flex space-x-6 justify-start w-max">
                            <TabsTrigger value="active" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:text-primary">
                                Active <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-0">{tabData.active.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="scheduled" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:text-primary">
                                Scheduled <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-0">{tabData.scheduled.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="expired" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:text-primary">
                                Expired <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-0">{tabData.expired.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:text-primary">
                                All <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-0">{tabData.all.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="missing" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:text-primary">
                                Rate Yet to be Added <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-0">{tabData.missing.length}</Badge>
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayedItems.length === 0 && (
                            <div className="col-span-full py-8 text-center text-muted-foreground text-sm">
                                No service items found in this category.
                            </div>
                        )}
                        {displayedItems.map((baseItem: any, index: number) => {
                        // Check if there is a pending edit or delete for this item
                        const pendingReq = changeRequests.find(r => r.rate_card_item_id === baseItem.id && r.approval_status === 'pending_approval');
                        const isPendingDelete = pendingReq?.change_type === 'delete';
                        const isPendingEdit = pendingReq?.change_type === 'edit';
                        
                        // Use new_data if there is a pending edit, otherwise use baseItem
                        const item = isPendingEdit && pendingReq.new_data ? { ...baseItem, ...pendingReq.new_data } : baseItem;

                        let constText = '';
                        if (item.constitution_id) {
                            const c = constitutions.find(x => x.id === item.constitution_id);
                            if (c) {
                                constText = c.business_type;
                                if (item.constitution_scope === 'sub_constitution' && item.sub_constitution_ids && item.sub_constitution_ids.length > 0) {
                                    const subs = constitutions.filter(x => item.sub_constitution_ids.includes(x.id)).map(x => x.business_sub_type).filter(Boolean);
                                    if (subs.length > 0) {
                                        constText += ` • ${subs.join(', ')}`;
                                    }
                                }
                            }
                        }

                        const wt = flatWorkTypes.find(x => String(x.id) === String(item.work_item_id));
                        const catText = wt ? `${wt.department_name} • ${wt.category_name}` : '';

                        if (baseItem.isMissing) {
                            return (
                                <div 
                                    key={baseItem.id} 
                                    className="border border-dashed border-muted-foreground/30 bg-muted/5 rounded-xl p-4 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-all duration-200"
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="font-bold text-base text-foreground line-clamp-2">
                                            {baseItem.work_item_name}
                                        </div>
                                        {baseItem.catText && (
                                            <div className="text-xs text-muted-foreground">{baseItem.catText}</div>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2 pt-2 border-t border-dashed mt-auto">
                                        <div className="text-[10px] uppercase text-muted-foreground font-semibold">Rate Status</div>
                                        <div className="text-xs text-amber-600 font-medium bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 px-2 py-1 rounded w-max">
                                            Rate Yet to be Added
                                        </div>
                                    </div>
                                    {hasPermission('rate_card.edit') && (
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-9 w-full text-xs font-semibold border-primary/30 text-primary hover:bg-primary/5 mt-2" 
                                            onClick={() => handleOpenForm(baseItem)}
                                        >
                                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Rate
                                        </Button>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <details
                                key={item.id || index}
                                open={expandedCardId === item.id}
                                className={`group border rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${isPendingDelete ? 'bg-red-50/50 border-red-200' : isPendingEdit ? 'bg-amber-50/50 border-amber-200' : 'bg-card/50 hover:bg-card/80'}`}
                            >
                                <summary 
                                    onClick={(e) => { e.preventDefault(); handleToggle(item.id); }}
                                    className="list-none cursor-pointer p-4 hover:bg-muted/30 transition-all focus:outline-none"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col gap-3 flex-1">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className={`font-bold text-base line-clamp-2 ${isPendingDelete ? 'text-red-900 line-through opacity-70' : 'text-foreground'}`}>
                                                        {item.work_item_name}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {item.computed_status === 'active' && <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Active</Badge>}
                                                    {item.computed_status === 'scheduled' && <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">Scheduled</Badge>}
                                                    {item.computed_status === 'expired' && <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Expired</Badge>}
                                                    {isPendingDelete && <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Pending Delete</Badge>}
                                                    {isPendingEdit && <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Pending Edit</Badge>}
                                                </div>
                                                {catText && (
                                                    <div className={`text-xs mt-1 ${isPendingDelete ? 'text-red-700 opacity-70' : 'text-muted-foreground'}`}>{catText}</div>
                                                )}
                                            </div>
                                            
                                            <div className={`grid grid-cols-2 gap-4 mt-2 pt-3 border-t ${isPendingDelete ? 'opacity-70' : ''}`}>
                                                <div className="col-span-2 sm:col-span-1">
                                                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                                                        {item.professional_fee_type === 'range' ? 'Professional Fee Range' : 'Professional Fee'}
                                                    </div>
                                                    <div className="text-sm font-medium">
                                                        {item.professional_fee_type === 'range' 
                                                            ? `₹${parseFloat(item.professional_fee_min || 0).toLocaleString()} - ₹${parseFloat(item.professional_fee_max || 0).toLocaleString()}` 
                                                            : `₹${parseFloat(item.professional_fee || 0).toLocaleString()}`
                                                        }
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">Gov. Fees</div>
                                                    <div className="text-sm font-medium">₹{parseFloat(item.government_fee_total || 0).toLocaleString()}</div>
                                                </div>
                                                <div className="col-span-2 bg-primary/5 p-2 rounded-lg border border-primary/10 flex justify-between items-center">
                                                    <div className="text-[10px] uppercase text-primary font-bold">Total</div>
                                                    <div className="text-lg font-black text-primary">₹{parseFloat(item.item_total || 0).toLocaleString()}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ml-4 mt-1 shrink-0 text-muted-foreground">
                                            {expandedCardId === item.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                        </div>
                                    </div>
                                </summary>
                                
                                {expandedCardId === item.id && (
                                    <div className="border-t bg-muted/10 p-4 text-sm space-y-4">
                                        {constText && (
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-1">Constitution Rules</p>
                                                <p className="font-medium text-xs leading-relaxed">{constText}</p>
                                            </div>
                                        )}
                                        
                                        {item.government_fees && item.government_fees.length > 0 && (
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-2">Government Fee Breakdown</p>
                                                <div className="space-y-1">
                                                    {item.government_fees.map((fee: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between text-xs items-center bg-background border p-1.5 rounded">
                                                            <span className="truncate pr-2 font-medium">{fee.fee_name || 'Fee'}</span>
                                                            <span className="shrink-0 text-muted-foreground">₹{parseFloat(fee.amount || 0).toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {hasPermission('rate_card.edit') && (
                                            <div className="flex justify-end items-center gap-2 pt-2 border-t">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 text-xs hover:text-primary hover:bg-primary/10" 
                                                    onClick={() => handleOpenForm(item)} 
                                                    disabled={!!pendingReq}
                                                >
                                                    <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20" 
                                                    onClick={() => setItemToDelete(item.id)} 
                                                    disabled={!!pendingReq}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </details>
                        )
                    })}

                    {/* Pending Add Items */}
                    {changeRequests.filter(r => r.change_type === 'add' && r.approval_status === 'pending_approval').map((req, index) => {
                        const item = req.new_data;
                        let constText = '';
                        if (item.constitution_id) {
                            const c = constitutions.find(x => x.id === item.constitution_id);
                            if (c) {
                                constText = c.business_type;
                                if (item.constitution_scope === 'sub_constitution' && item.sub_constitution_ids && item.sub_constitution_ids.length > 0) {
                                    const subs = constitutions.filter(x => item.sub_constitution_ids.includes(x.id)).map(x => x.business_sub_type).filter(Boolean);
                                    if (subs.length > 0) {
                                        constText += ` • ${subs.join(', ')}`;
                                    }
                                }
                            }
                        }

                        const wt = flatWorkTypes.find(x => String(x.id) === String(item.work_item_id));
                        const catText = wt ? `${wt.department_name} • ${wt.category_name}` : '';

                        return (
                            <details
                                key={`pending-add-${req.id || index}`}
                                open={expandedCardId === `pending-add-${req.id || index}`}
                                className="group border rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden bg-blue-50/50 border-blue-200"
                            >
                                <summary 
                                    onClick={(e) => { e.preventDefault(); handleToggle(`pending-add-${req.id || index}`); }}
                                    className="list-none cursor-pointer p-4 hover:bg-blue-50 transition-all focus:outline-none"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col gap-3 flex-1">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="font-bold text-base text-foreground line-clamp-2">
                                                        {item.work_item_name}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Pending Add</Badge>
                                                </div>
                                                {catText && (
                                                    <div className="text-xs mt-1 text-muted-foreground">{catText}</div>
                                                )}
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4 mt-2 pt-3 border-t">
                                                <div className="col-span-2 sm:col-span-1">
                                                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                                                        {item.professional_fee_type === 'range' ? 'Professional Fee Range' : 'Professional Fee'}
                                                    </div>
                                                    <div className="text-sm font-medium">
                                                        {item.professional_fee_type === 'range' 
                                                            ? `₹${parseFloat(item.professional_fee_min || 0).toLocaleString()} - ₹${parseFloat(item.professional_fee_max || 0).toLocaleString()}` 
                                                            : `₹${parseFloat(item.professional_fee || 0).toLocaleString()}`
                                                        }
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">Gov. Fees</div>
                                                    <div className="text-sm font-medium">₹{parseFloat(item.government_fee_total || 0).toLocaleString()}</div>
                                                </div>
                                                <div className="col-span-2 bg-blue-500/5 p-2 rounded-lg border border-blue-500/10 flex justify-between items-center">
                                                    <div className="text-[10px] uppercase text-blue-700 font-bold">Total</div>
                                                    <div className="text-lg font-black text-blue-700">₹{parseFloat(item.item_total || 0).toLocaleString()}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ml-4 mt-1 shrink-0 text-blue-700/50">
                                            {expandedCardId === `pending-add-${req.id || index}` ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                        </div>
                                    </div>
                                </summary>
                                
                                {expandedCardId === `pending-add-${req.id || index}` && (
                                    <div className="border-t bg-blue-50/30 p-4 text-sm space-y-4">
                                    {constText && (
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Constitution Rules</p>
                                            <p className="font-medium text-xs leading-relaxed">{constText}</p>
                                    </div>
                                    )}
                                    
                                    {item.government_fees && item.government_fees.length > 0 && (
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-2">Government Fee Breakdown</p>
                                            <div className="space-y-1">
                                                {item.government_fees.map((fee: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between text-xs items-center bg-background border p-1.5 rounded">
                                                        <span className="truncate pr-2 font-medium">{fee.fee_name || 'Fee'}</span>
                                                        <span className="shrink-0 text-muted-foreground">₹{parseFloat(fee.amount || 0).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    </div>
                                )}
                            </details>
                        );
                    })}

                    {items.length === 0 && changeRequests.length === 0 && !showForm && activeTab === 'all' && (
                        <div className="col-span-full text-center p-8 border border-dashed rounded-lg text-muted-foreground text-sm">
                            No service items added yet. Click above to add one.
                        </div>
                    )}
                </div>
                </Tabs>
            )}

            <Dialog open={!!itemToDelete} onOpenChange={(open) => {
                if (!open) {
                    setItemToDelete(null);
                    setDeleteConfirmText('');
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. To permanently delete this item, please type <strong className="text-destructive">delete</strong> below.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            autoFocus
                            placeholder="Type 'delete' to confirm"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && deleteConfirmText.toLowerCase() === 'delete') {
                                    handleDeleteItem();
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setItemToDelete(null);
                            setDeleteConfirmText('');
                        }} disabled={isDeleting}>Cancel</Button>
                        <Button 
                            variant="destructive" 
                            disabled={deleteConfirmText.toLowerCase() !== 'delete' || isDeleting}
                            onClick={handleDeleteItem}
                        >
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete Item
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
