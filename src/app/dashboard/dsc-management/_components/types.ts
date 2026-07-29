export interface DSC {
    id: string;
    companyName: string; // Maps to Client / Applicant
    issueDate: string;
    validityYears: number;
    expiryDate: string;
    status: 'Not Started' | 'ACTIVE' | 'EXPIRED';
    remarks?: string;
    currentStatus?: 'IN' | 'OUT'; // Track physical location
    currentHolder?: {
        clientId: string;
        roleKey: string;
        memberId: string;
        memberName?: string; // Denormalized for display
    };
    // new fields to match image requirements
    type?: string;
    mobile?: string;
    email?: string;
    pan?: string;
    aadhar?: string;
    classId?: string;
    typeId?: string;
    validityId?: string;
    authorityId?: string;
    updatedAt?: any; // Firestore serverTimestamp

    // Application Details (Req 3)
    applicationDate?: string;
    expectedDeliveryDays?: number;

    // Workflow Tracking (Req 4 & 9)
    currentStageId?: string;
    stageHistory?: Record<string, {
        status: 'Pending' | 'Completed';
        updatedAt?: string;
        note?: string;
    }>;

    // Passwords (Req 6 & 7)
    dscPassword?: string;
    tokenDefaultPassword?: string;
    tokenChangedPassword?: string;
    tokenPasswordChangeDate?: string;

    // Member Details (Req 2 & 8)
    phone?: string;
    designation?: string;

    // Standard DSC Workflow Fields
    verificationStatus?: {
        mobile?: 'PENDING' | 'COMPLETED';
        email?: 'PENDING' | 'COMPLETED';
        video?: 'PENDING' | 'COMPLETED';
    };
    kycStatus?: {
        pan?: 'PENDING' | 'COMPLETED';
        aadhar?: 'PENDING' | 'COMPLETED';
        photo?: 'PENDING' | 'COMPLETED';
    };
    paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
    paymentAmount?: number;
    paidAmount?: number;

    courierPartner?: string;
    trackingId?: string;

    // Follow-up (Req 5)
    followups?: Array<{
        date: string;
        note: string;
    }>;
}

export interface DSCWorkflowStage {
    id: string;
    name: string;
    order: number;
    description?: string;
    completionPercentage?: number;
    checklistItems?: any[];
    requiredFields?: any[];
    documents?: any[];
    isDeleted?: boolean;
}

export interface DSCLink {
    id: string;
    dscId: string;
    clientId: string;
    roleKey: string;
    memberId: string;
    isActive: boolean;
    remarks?: string;
}

export interface DSCMovement {
    id: string;
    dscId: string;
    movementType: 'IN' | 'OUT';
    movementDate: string;
    clientId?: string;
    roleKey?: string;
    memberId?: string;
    remarks?: string;
    createdAt: number;
}

export interface Client {
    id: string;
    clientName: string;
    roles?: Record<string, {
        members?: Record<string, {
            details?: {
                name?: string;
                fullName?: string;
                email?: string;
            }
        }>
    }>;
}

export interface DSCClass {
    id: string;
    name: string;
    isDefault: boolean;
}

export interface DSCTypeConfig {
    id: string;
    name: string;
    isDefault: boolean;
}

export interface DSCValidity {
    id: string;
    name: string;
    years: number;
    isDefault: boolean;
}

export interface DSCAuthority {
    id: string;
    name: string;
    isDefault: boolean;
}

export interface DSCRate {
    id: string;
    classId: string;
    typeId: string;
    validityId: string;
    authorityId: string;
    baseAmount: number;
    gstPercentage: number;
    totalAmount: number;
    applicableFrom: string;
}

export interface DSCStageConfig {
    id: string;
    name: string;
    completionPercentage: number;
    order: number;
    checklistItems: { id: string; text: string }[];
    requiredFields: { id: string; label: string; type: string }[];
    documents: {
        id: string;
        name: string;
        isMandatory: boolean;
        allowedFormats: string; // e.g., ".pdf,.jpg,.png"
        allowMultiple: boolean;
    }[];
}

export interface DSCStageExecution {
    stageId: string;
    checklistStatus: Record<string, boolean>;
    fieldValues: Record<string, string>;
    uploadedDocuments: Record<string, string[]>; // docConfigId -> uploaded file URLs/IDs
    isCompleted: boolean;
    completedAt?: string;
}

export interface TokenMaster {
    id: string;
    type: 'TOKEN_NAME' | 'SUPPLIER' | 'CUSTOMER';
    name: string;
}

export interface TokenPurchase {
    id: string;
    supplierId: string;
    gstin: string;
    invoiceNumber: string;
    invoiceDate: string;
    address: string;
    ratePerToken: number;
    quantity: number;
    totalBeforeGst: number;
    gstAmount: number;
    totalInvoiceValue: number;
    inwardFreight: number;
    finalCostPerToken: number;
    createdAt: number;
}

export interface TokenSale {
    id: string;
    clientId: string;
    quantity: number;
    date: string;
    invoiceDetails: string;
    salesDetails: string;
    costPerToken: number; // based on FIFO/W-Avg
    createdAt: number;
}

export interface DSCMaster {
    id: string;
    type: string;
    validityYears: number;
    price: number;
    description?: string;
}

export interface TokenTransaction {
    id: string;
    type: 'STOCK_IN' | 'STOCK_OUT';
    quantity: number;
    date: string;
    remarks?: string;
    balanceAfter: number;
}

