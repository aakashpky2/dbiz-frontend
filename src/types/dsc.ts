export type MasterBase = {
    id: string;
    createdAt?: number;
    updatedAt?: number;
    isActive?: boolean;
};

export type DSCUsageType = MasterBase & {
    name: string;
    sortOrder?: number;
};

export type DSCPurposeType = MasterBase & {
    name: string;
    sortOrder?: number;
};

export type DSCValidity = MasterBase & {
    years: number;
    label: string;
    sortOrder?: number;
};

export type DSCFieldMaster = MasterBase & {
    fieldKey: string;
    label: string;
    fieldType: 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'file';
    requiredDefault?: boolean;
    dropdownOptions?: string[];
};

export type DSCFormTemplate = MasterBase & {
    usageTypeId: string;
    templateName: string;
    version: number;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    fields: {
        fieldId: string;
        required?: boolean;
        visible?: boolean;
        order?: number;
    }[];
};

export type DSCPricing = MasterBase & {
    usageTypeId: string;
    purposeTypeId: string;
    validityId: string;
    tokenIncluded?: boolean;
    basePrice: number;
    gstRate?: number;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
};

export type InventoryItem = MasterBase & {
    name: string;
    sku?: string | null;
    uom?: string | null;
    trackSerial?: boolean;
};

export type InventoryPurchase = {
    id: string;
    purchaseDate: string;
    supplierName?: string | null;
    itemId: string;
    quantity: number;
    purchaseRate?: number;
    batchNo?: string | null;
    serialNumbers?: string[] | null;
    createdAt?: number;
};

export type InventorySale = {
    id: string;
    saleDate: string;
    clientId?: string | null;
    itemId: string;
    quantity: number;
    saleRate?: number;
    serialNumbers?: string[] | null;
    createdAt?: number;
};

export type DSCStatus =
    | 'Ordered'
    | 'Issued'
    | 'Created'
    | 'Requested'
    | 'Applied'
    | 'Received'
    | 'InCustody'
    | 'Out'
    | 'Returned'
    | 'Expired'
    | 'Revoked'
    | 'Lost'
    | 'Damaged';

export type DSCIssued = {
    id: string;
    clientId?: string | null;
    clientNameSnapshot?: string | null;

    personName?: string | null;
    personRole?: string | null;

    dscCompanyName?: string | null;
    usageTypeId?: string | null;
    purposeTypeId?: string | null;

    validityId?: string | null;
    issueDate?: string | null;
    expiryDate?: string | null;

    providerName?: string | null;
    certificateSerialNo?: string | null;

    status: DSCStatus;
    remarks?: string | null;

    isDeleted?: boolean;
    createdAt?: number;
    updatedAt?: number;
};

export type DSCClientOwned = {
    id: string;
    clientId?: string | null;
    clientNameSnapshot?: string | null;

    personName?: string | null;
    personRole?: string | null;

    usageTypeId?: string | null;
    purposeTypeId?: string | null;

    validityId?: string | null;
    issueDate?: string | null;
    expiryDate?: string | null;

    providerName?: string | null;
    certificateSerialNo?: string | null;

    status: DSCStatus;
    remarks?: string | null;

    isDeleted?: boolean;
    createdAt?: number;
    updatedAt?: number;
};

export type DSCMovement = {
    id: string;
    dscRefType: 'ISSUED' | 'CLIENT_OWNED';
    dscId: string;
    movementType: 'IN' | 'OUT';
    movementAt: number;

    fromPartyType: 'Client' | 'Company' | 'Other';
    toPartyType: 'Client' | 'Company' | 'Other';
    fromName?: string | null;
    toName?: string | null;

    purpose: string;
    how: 'InPerson' | 'Courier' | 'Other';

    courier?: {
        courierName?: string | null;
        trackingNo?: string | null;
        dispatchDate?: string | null;
        expectedDeliveryDate?: string | null;
        deliveryStatus?: 'Dispatched' | 'InTransit' | 'Delivered' | 'Returned' | 'Lost';
        deliveryConfirmedBy?: string | null;
        deliveryConfirmedDate?: string | null;
    } | null;

    remarks?: string | null;
    createdAt?: number;
};

export type SalesOrder = {
    id: string;
    clientId?: string | null;
    clientNameSnapshot?: string | null;
    orderDate: string;
    status: 'Draft' | 'Confirmed' | 'Fulfilled' | 'Cancelled';
    lines: {
        lineType: 'DSC' | 'TOKEN';
        description: string;
        usageTypeId?: string | null;
        purposeTypeId?: string | null;
        validityId?: string | null;
        itemId?: string | null;
        qty: number;
        rate: number;
        amount: number;
    }[];
    total: number;
    createdAt?: number;
    updatedAt?: number;
};
