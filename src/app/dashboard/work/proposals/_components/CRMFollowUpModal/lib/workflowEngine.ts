'use client';

/**
 * PROPOSAL LIFECYCLE SINGLE SOURCE OF TRUTH
 * 
 * Target Model:
 * drafted -> sent -> client_reviewing -> revision_required_client -> client_reviewing -> accepted -> closed
 */

export type ProposalStage =
    | 'pending'                    // 0. Pending Generation
    | 'draft'                      // 1. Initial State
    | 'approved'                   // 2. Ready to Send
    | 'sent'                       // 3. Sent to Client
    | 'client_reviewing'           // 4. Active Engagement (via Follow-up)
    | 'accepted'                   // 5. Success
    | 'closed'                     // 6. Finalized (Closed/Converted)
    | 'revision_pending_approval'  // 7. Reopened from Terminal
    | 'revision_required';         // 8. Requested by Client

// Stages where internal approval is required before sending
export const INTERNAL_APPROVAL_STAGES: ProposalStage[] = [
    'draft',
    'revision_pending_approval'
];

// Stages where editing / restructuring is allowed
export const EDITABLE_STAGES: ProposalStage[] = [
    'draft',
    'revision_pending_approval',
    'revision_required'
];

// Final states
export const TERMINAL_STAGES: ProposalStage[] = ['closed'];

/**
 * Display labels for UI
 */
export const STAGE_LABELS: Record<string, string> = {
    pending: 'Pending Generation',
    draft: 'Draft',
    approved: 'Approved / Ready to Send',
    sent: 'Sent to Client',
    client_reviewing: 'Client Reviewing',
    accepted: 'Accepted',
    closed: 'Closed',
    revision_pending_approval: 'Revision (Pending Approval)',
    revision_required: 'Revision Required (Client)',
};

/**
 * Normalize and map legacy stages to the new strict model.
 * Handles: undefined, null, spaces, hyphens, diverse casing.
 */
export function normalizeStage(raw: string | undefined | null): ProposalStage {
    if (!raw) return 'draft';
    
    const s = String(raw).toLowerCase().trim()
        .replace(/-/g, '_')
        .replace(/\s+/g, '_');
    
    // Core Mappings
    if (s === 'pending' || s === 'pending_generation') return 'pending';
    if (s === 'drafted' || s === 'draft') return 'draft';
    if (s === 'approved' || s === 'ready_to_send' || s === 'approved_internally') return 'approved';
    if (s === 'sent' || s === 'sent_to_client') return 'sent';
    if (s === 'client_reviewing' || s === 'resent_to_client' || s === 'reviewing') return 'client_reviewing';
    if (s === 'accepted' || s === 'mark_as_accepted') return 'accepted';
    if (s === 'closed' || s === 'converted' || s === 'finalized') return 'closed';
    if (s === 'revision_pending_approval' || s === 'revision_required_internal' || s === 'internal_revision') return 'revision_pending_approval';
    if (s === 'revision_required' || s === 'revision_required_client' || s === 'client_revision' || s === 'revision_requested') return 'revision_required';
    if (s === 'lost') return 'closed'; 

    return 'draft';
}

/**
 * Requirement: Safe helper to identify pending proposals
 * Pending = explicit current_stage/status "Pending" or "Pending Generation"
 * Generated = everything else starting from Draft onward.
 */
export function isPendingProposal(proposal: any): boolean {
    if (!proposal) return false;
    const stage = normalizeStage(proposal.currentStage || proposal.current_stage);
    const status = String(proposal.status || '').toLowerCase().trim();
    
    return stage === 'pending' || status === 'pending' || status === 'pending_generation';
}

/**
 * Checks if a proposal is in the "Sent to Client" stage.
 */
export function isSentToClientStage(proposal: any): boolean {
    if (!proposal) return false;
    const stage = normalizeStage(proposal.currentStage || proposal.current_stage);
    return stage === 'sent' || stage === 'client_reviewing';
}

/**
 * Checks if a proposal is in the "Revision Required (Client)" stage.
 */
export function isRevisionRequiredClientStage(proposal: any): boolean {
    if (!proposal) return false;
    const stage = normalizeStage(proposal.currentStage || proposal.current_stage);
    return stage === 'revision_required';
}

/**
 * Checks if a proposal is in the "Accepted" stage.
 */
export function isAcceptedStage(proposal: any): boolean {
    if (!proposal) return false;
    const stage = normalizeStage(proposal.currentStage || proposal.current_stage);
    return stage === 'accepted';
}

/**
 * Checks if a proposal is in a Draft or Approved stage (Internal states).
 */
export function isDraftOrApprovedStage(proposal: any): boolean {
    if (!proposal) return false;
    const stage = normalizeStage(proposal.currentStage || proposal.current_stage);
    return stage === 'draft' || stage === 'approved' || stage === 'revision_pending_approval';
}

/**
 * Logic to determine if a proposal in revision can be approved internally.
 */
export function canApproveRevision(proposal: any): boolean {
    return isRevisionRequiredClientStage(proposal);
}

/**
 * Logic to determine if a proposal can be sent to a client.
 */
export function canSendToClient(proposal: any): boolean {
    const stage = normalizeStage(proposal?.currentStage || proposal?.current_stage);
    // Project standard: Can only send from Draft or Approved
    return stage === 'approved' || stage === 'draft' || stage === 'revision_pending_approval';
}

/**
 * Increments the version string (e.g., v1.0 -> v1.1).
 */
export function incrementVersion(currentVersion: string = '1.0'): string {
    // Remove 'v' if present
    const v = currentVersion.toLowerCase().startsWith('v') ? currentVersion.substring(1) : currentVersion;
    const parts = v.split('.');
    if (parts.length === 0) return 'v1.1';
    
    const major = parseInt(parts[0], 10) || 1;
    const minor = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;
    
    return `v${major}.${minor + 1}`;
}

/**
 * CORE TRANSITION LOGIC
 * Determines the next stage based on the current state and interaction outcome.
 */
export function resolveNextStage(
    current: ProposalStage | string,
    outcome: string
): ProposalStage {
    const s = normalizeStage(String(current));
    
    // Normalize outcome for logic comparison
    const o = String(outcome || '').toLowerCase().trim().replace(/\s+/g, '_');

    // Terminal states stay fixed unless explicitly reopened (handled elsewhere)
    if (TERMINAL_STAGES.includes(s)) return s;

    switch (s) {
        case 'draft':
        case 'revision_pending_approval':
            if (o === 'approved_internally' || o === 'approve') return 'approved';
            return s;

        case 'approved':
            if (o === 'sent_to_client' || o === 'send') return 'sent';
            if (o === 'reject' || o === 'needs_revision') return 'draft';
            return 'approved';

        case 'sent':
            if (o === 'client_received' || o === 'contacted_client') return 'client_reviewing';
            if (o === 'accepted_by_client' || o === 'accept') return 'accepted';
            return 'sent';

        case 'client_reviewing':
            if (o === 'accepted_by_client' || o === 'accept') return 'accepted';
            if (o === 'closed' || o === 'lost') return 'closed';
            return 'client_reviewing';

        case 'accepted':
            if (o === 'closed' || o === 'converted') return 'closed';
            return 'accepted';

        default:
            return s;
    }
}

/**
 * Suggests the most likely next action for defaults.
 */
export function suggestNextAction(stage: ProposalStage | string): string {
    const s = normalizeStage(String(stage));

    switch (s) {
        case 'draft': return 'obtain_internal_approval';
        case 'approved': return 'send_to_client';
        case 'sent': return 'confirm_receipt';
        case 'client_reviewing': return 'follow_up_for_decision';
        case 'accepted': return 'initiate_project';
        default: return 'follow_up';
    }
}

/**
 * Styling helpers for UI badges
 */
export function getStageBadgeStyle(stage: string): string {
    const s = normalizeStage(stage);
    switch (s) {
        case 'pending': return 'bg-rose-50 text-rose-700 border-rose-200';
        case 'draft': return 'bg-slate-50 text-slate-600 border-slate-200';
        case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'sent': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'client_reviewing': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        case 'accepted': return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'closed': return 'bg-slate-900 text-white border-slate-800';
        case 'revision_pending_approval': return 'bg-orange-50 text-orange-700 border-orange-200';
        case 'revision_required': return 'bg-rose-50 text-rose-700 border-rose-200';
        default: return 'bg-slate-100 text-slate-600';
    }
}

