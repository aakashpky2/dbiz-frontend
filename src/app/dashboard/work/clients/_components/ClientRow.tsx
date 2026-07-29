'use client';

import React, { useMemo } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Edit, Trash2, User, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Client interface for strong typing
 */
export interface Client {
    id: string;
    clientName: string;
    changeStatus?: 'Pending' | 'Validated' | string;
    completionStatus?: 'Complete' | 'Incomplete' | string;
    reference?: 'Direct' | 'Associate' | string;
    associateId?: string | null;
    constitutionId?: string;
    contacts?: any[];
    fields?: any;
    roles?: any;
    [key: string]: any;
}

/**
 * Associate interface for lookup
 */
export interface Associate {
    id: string;
    name: string;
}

interface ClientRowProps {
    client: Client;
    currentTab: string;
    associates: Associate[];
    onValidate: (client: Client) => void;
    onEdit: (client: Client) => void;
    onView: (client: Client) => void;
    onDelete: (client: Client) => void;
    selected?: boolean;
    onSelect?: (client: Client, checked: boolean) => void;
    selectionDisabled?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canView?: boolean;
    // Props passed from virtualizer parent
    style?: React.CSSProperties;
    dataIndex?: number;
    measureRef?: (el: HTMLTableRowElement | null) => void;
}


/**
 * Enhanced ClientRow component
 * Refactored for professional UI, performance optimization, and structural integrity.
 */
export const ClientRow = React.memo(React.forwardRef<HTMLTableRowElement, ClientRowProps>(({
    client,
    currentTab,
    associates,
    onValidate,
    onEdit,
    onView,
    onDelete,
    selected,
    onSelect,
    selectionDisabled,
    canEdit,
    canDelete,
    canView,
    style,
    dataIndex,
    measureRef
}, ref) => {
    // STEP 3: Optimized Associate Lookup using useMemo
    const associateName = useMemo(() => {
        if (client?.reference !== 'Associate' || !client?.associateId) return 'N/A';
        return associates.find(a => a.id === client.associateId)?.name || 'N/A';
    }, [associates, client?.associateId, client?.reference]);

    // STEP 4: Clean conditional logic for status columns
    const showStatusColumns = ['all', 'pending', 'incomplete'].includes(currentTab);

    // STEP 2: Safe Data Handling with fallbacks
    const clientName = client?.clientName || '—';
    const normalizedChangeStatus = client?.changeStatus || 'Validated';
    const normalizedCompletionStatus = client?.completionStatus || 'Incomplete';

    return (
        // CRITICAL FIX 1: Returning a proper TableRow
        // STEP 5: Professional UI Improvements (hover effect, transitions)
        <TableRow 
            ref={(node) => {
                // Handle both the forwarded ref and the virtualizer's measureRef
                if (typeof ref === 'function') ref(node);
                else if (ref) (ref as React.MutableRefObject<HTMLTableRowElement | null>).current = node;
                if (measureRef) measureRef(node);
            }}
            style={style}
            data-index={dataIndex}
            className="absolute w-full flex border-b hover:bg-muted/40 transition-colors duration-200 group bg-card"
        >
            <TableCell className="w-[50px] py-4 flex items-center justify-center">
                <Checkbox 
                    checked={selected}
                    onCheckedChange={(checked) => onSelect?.(client, !!checked)}
                    disabled={selectionDisabled}
                    className="data-[state=checked]:bg-primary"
                />
            </TableCell>

            {/* STEP 5: Spacing and spacing improvements */}
            <TableCell className="flex-[3] min-w-[250px] py-4 flex items-center gap-3">

                <div className="bg-primary/5 p-2 rounded-lg group-hover:bg-primary/10 transition-colors hidden sm:flex">
                    <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm truncate max-w-[240px] text-slate-800" title={clientName}>
                        {clientName}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-tight font-medium">
                        ID: {client?.id?.substring(0, 8)}...
                    </span>
                </div>
            </TableCell>

            {showStatusColumns && (
                <>
                    <TableCell className="w-[140px] py-4 flex items-center justify-center">
                        <StatusBadge status={normalizedChangeStatus} />
                    </TableCell>
                    <TableCell className="w-[140px] py-4 flex items-center justify-center">
                        <StatusBadge status={normalizedCompletionStatus} />
                    </TableCell>
                </>
            )}

            <TableCell className="w-[200px] py-4 flex items-center gap-2 text-xs text-slate-500 font-semibold uppercase tracking-tight">
                {client?.reference === 'Associate' ? (
                    <>
                        <Users className="h-4 w-4 text-indigo-500" />
                        <span className="truncate" title={`Associate: ${associateName}`}>Associate • {associateName}</span>
                    </>
                ) : (
                    <span className="pl-6 text-slate-400">Direct</span>
                )}
            </TableCell>

            <TableCell className="w-[220px] py-4 flex items-center justify-end pr-6 gap-2">
                {client?.changeStatus === 'Pending' && canEdit && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => onValidate?.(client)}
                        className="h-8 px-2 text-[10px] font-black border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 transition-all flex items-center gap-1 shadow-sm uppercase tracking-wide"
                        aria-label="Validate client changes"
                        title="Approve Changes"
                    >
                        <CheckCircle className="h-3.5 w-3.5" /> 
                        Validate
                    </Button>
                )}
                
                {canView && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onView?.(client)}
                        className="h-8 w-8 hover:bg-slate-100 hover:text-slate-900 transition-all text-slate-400"
                        aria-label="View client"
                        title="View Details"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                    </Button>
                )}

                {canEdit && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onEdit?.(client)}
                        className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 transition-all text-slate-400"
                        aria-label="Edit client"
                        title="Edit Details"
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                )}

                {canDelete && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onDelete?.(client)}
                        className="h-8 w-8 hover:bg-red-50 hover:text-destructive transition-all text-slate-400"
                        aria-label="Delete client"
                        title="Delete Client"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );
}));

ClientRow.displayName = 'ClientRow';
