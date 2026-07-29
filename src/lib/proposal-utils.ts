
export const calculateProposalFinancials = (items: any[]) => {
    let profSubtotal = 0;
    let govtSubtotal = 0;
    let totalGst = 0;
    let totalDiscount = 0;

    items.forEach((item: any) => {
        const pFee = Number(item.professionalFee) || 0;
        const gFee = Number(item.governmentFee) || 0;
        
        profSubtotal += pFee;
        govtSubtotal += gFee;

        // Calculate GST
        let itemGst = 0;
        if (item.isGstApplicable && !item.noInvoice) {
            const rate = (Number(item.gstPercentage) || 18) / 100;
            const on = item.gstAppliedOn || 'professional';
            if (on === 'professional') itemGst = pFee * rate;
            else if (on === 'government') itemGst = gFee * rate;
            else if (on === 'both') itemGst = (pFee + gFee) * rate;
        }
        totalGst += itemGst;

        // Calculate Item Discount
        const itemTotalBeforeDiscount = pFee + gFee + itemGst;
        let itemDiscount = 0;
        const dType = item.discountType || 'amount';
        const dValue = Number(item.discountValue) || 0;

        if (dType === 'percentage') {
            itemDiscount = itemTotalBeforeDiscount * Math.min(dValue, 100) / 100;
        } else {
            itemDiscount = Math.min(dValue, itemTotalBeforeDiscount);
        }
        totalDiscount += itemDiscount;
    });

    const totalBeforeDiscount = profSubtotal + govtSubtotal + totalGst;
    const finalTotal = Math.max(0, totalBeforeDiscount - totalDiscount);

    return {
        profSubtotal: Math.round(profSubtotal * 100) / 100,
        govtSubtotal: Math.round(govtSubtotal * 100) / 100,
        totalGst: Math.round(totalGst * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        totalBeforeDiscount: Math.round(totalBeforeDiscount * 100) / 100,
        finalTotal: Math.round(finalTotal * 100) / 100,
        // Net total alias
        netTotal: Math.round(finalTotal * 100) / 100
    };
};

export const normalizeStage = (stage: string): string => {
    if (!stage) return 'draft';
    const s = stage.toLowerCase().replace(/_/g, ' ').trim();
    if (s.includes('pending generation') || s === 'pending') return 'pending';
    if (s.includes('draft')) return 'draft';
    if (s.includes('pending approval')) return 'pending_approval';
    if (s.includes('approved') || s.includes('ready to send')) return 'approved';
    if (s.includes('sent')) return 'sent';
    if (s.includes('accepted')) return 'accepted';
    if (s.includes('closed') || s.includes('converted')) return 'closed';
    return s;
};

export const getStageColor = (stage: string) => {
    const s = normalizeStage(stage);
    switch (s) {
        case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'draft': return 'bg-slate-100 text-slate-700 border-slate-200';
        case 'pending_approval': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'approved': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        case 'sent': return 'bg-purple-100 text-purple-700 border-purple-200';
        case 'accepted': return 'bg-green-100 text-green-700 border-green-200';
        case 'closed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        default: return 'bg-slate-50 text-slate-500 border-slate-200';
    }
};
