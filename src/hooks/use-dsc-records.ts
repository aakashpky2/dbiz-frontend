'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type {
    DSCIssued,
    DSCClientOwned,
    DSCMovement,
    InventoryPurchase,
    InventorySale,
    SalesOrder,
} from '@/types/dsc';

export function useDSCRecords() {
    const [issued, setIssued] = useState<DSCIssued[]>([]);
    const [clientOwned, setClientOwned] = useState<DSCClientOwned[]>([]);
    const [movements, setMovements] = useState<DSCMovement[]>([]);
    const [purchases, setPurchases] = useState<InventoryPurchase[]>([]);
    const [sales, setSales] = useState<InventorySale[]>([]);
    const [orders, setOrders] = useState<SalesOrder[]>([]);

    const fetchRecords = useCallback(async () => {
        try {
                const [
                    { data: dscData },
                    { data: movementData },
                    { data: purchaseData },
                    { data: salesData },
                    { data: queryData }
                ] = await Promise.all([
                    supabase.from('dscs').select('*, dsc_links(*)'), // issued/clientOwned are mixed in dscs/dsc_links
                    supabase.from('dsc_movements').select('*'),
                    supabase.from('token_purchases').select('*'),
                    supabase.from('token_sales').select('*'),
                    supabase.from('queries').select('*')
                ]);

                const mappedIssued = (dscData || []).map((d: any) => {
                    const latestLink = d.dsc_links?.[0] || {};
                    return {
                        id: d.id,
                        clientId: latestLink.client_id,
                        clientNameSnapshot: d.company_name,
                        personName: latestLink.member_id,
                        personRole: latestLink.role_key,
                        usageTypeId: d.type_id,
                        purposeTypeId: d.authority_id,
                        validityId: d.validity_id,
                        issueDate: d.issue_date,
                        expiryDate: d.expiry_date,
                        status: d.status,
                        remarks: d.remarks,
                        createdAt: new Date(d.created_at).getTime()
                    };
                });

                setIssued(mappedIssued as any);
                setClientOwned([]);

                setMovements((movementData || []).map((d: any) => ({
                    id: d.id,
                    dscId: d.dsc_id,
                    movementType: d.movement_type,
                    movementAt: new Date(d.movement_date || d.created_at).getTime(),
                    toName: d.member_id || d.client_id,
                    how: 'InPerson',
                    purpose: 'Unknown',
                    remarks: d.remarks,
                    createdAt: new Date(d.created_at).getTime()
                })) as any);
                setPurchases((purchaseData || []).map(d => ({
                    id: d.id,
                    purchaseDate: d.invoice_date || d.created_at,
                    itemId: d.token_id,
                    supplierName: d.supplier_name,
                    quantity: d.quantity,
                    purchaseRate: d.rate_per_token,
                    batchNo: d.batch_no || d.invoice_number,
                    createdAt: new Date(d.created_at).getTime()
                })) as any);
                setSales((salesData || []).map(d => ({
                    id: d.id,
                    saleDate: d.date || d.created_at,
                    itemId: d.token_id,
                    clientId: d.client_id,
                    quantity: d.quantity,
                    saleRate: d.cost_per_token,
                    createdAt: new Date(d.created_at).getTime()
                })) as any);
                setOrders((queryData || []).map(d => ({ id: d.id, ...d })) as any);
        } catch (error) {
            console.error("Error fetching DSC records from Supabase:", error);
        }
    }, []);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const movementByDscKey = useMemo(() => {
        const map: Record<string, DSCMovement[]> = {};
        for (const m of movements) {
            // Key must match the lookup pattern used in MovementDialog:
            // `${dscType}:${dsc.id}` — e.g. "ISSUED:abc123" or "CLIENT_OWNED:abc123"
            // Since all movements in use-dsc-records come from the dscs table (no dscType),
            // we index under both keys so either lookup works.
            const issuedKey = `ISSUED:${m.dscId}`;
            const clientOwnedKey = `CLIENT_OWNED:${m.dscId}`;
            map[issuedKey] = map[issuedKey] || [];
            map[issuedKey].push(m);
            map[clientOwnedKey] = map[clientOwnedKey] || [];
            map[clientOwnedKey].push(m);
        }
        return map;
    }, [movements]);

    return { issued, clientOwned, movements, movementByDscKey, purchases, sales, orders, refetch: fetchRecords };
}

