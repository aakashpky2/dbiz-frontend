/**
 * Validation utilities for Work module forms
 */

export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

import { parsePhoneNumber } from './phone-utils';

export const isValidPhone = (phone: string): boolean => {
    if (!phone) return false;
    // Extract the local 10-digit number safely ignoring the country code
    const { number } = parsePhoneNumber(phone);
    return number.length === 10;
};

export const isNonNegativeNumber = (val: any): boolean => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
};

export const isEmptyValue = (val: any): boolean => {
    if (val === null || val === undefined) return true;
    if (typeof val === 'string') return val.trim().length === 0;
    if (Array.isArray(val)) return val.length === 0;
    return false;
};

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    isReady: boolean; // For disabling/enabling the submit button
}

/**
 * Mapping of internal keys to user-friendly labels
 */
export const fieldLabels: Record<string, string> = {
    clientName: 'Client Name',
    contactPerson: 'Contact Person',
    contactNumber: 'Contact Number',
    contactCountryCode: 'Country Code',
    emailId: 'Email Address',
    profileId: 'Profile / Branch',
    workItems: 'Work Items',
    proposedWork: 'Proposed Services',
    enquiryContacts: 'Enquiry Contacts',
    clientId: 'Client',
    temporaryClientId: 'New Lead',
    currentStage: 'Proposal Stage',
    address: 'Address',
    position: 'Position / Designation',
    remarks: 'Remarks',
    queryDetails: 'Enquiry Details',
    clientType: 'Client Type',
    professionalFee: 'Professional Fee',
    governmentFee: 'Government Fee',
    totalAmount: 'Total Amount',
    companyPhone: 'Company Phone',
    companyEmail: 'Company Email'
};

export const getFieldLabel = (key: string): string => fieldLabels[key] || key;

export const buildValidationToastMessage = (errors: string[]): string => {
    if (errors.length === 0) return '';
    if (errors.length === 1) return errors[0];
    return `Missing Required Fields: \n- ${errors.join('\n- ')}`;
};

/**
 * QUERIES VALIDATION
 */
export const validateQueryForm = (data: any, clientType: string): ValidationResult => {
    const errors: string[] = [];
    const required: string[] = [];

    // Requirement 6: clientType selected
    if (isEmptyValue(clientType)) required.push(getFieldLabel('clientType'));

    // Requirement 6: profileId selected
    if (isEmptyValue(data.profileId)) required.push(getFieldLabel('profileId'));
    
    if (clientType === 'new') {
        // Requirement 2 & 6: at least one enquiryContacts item
        if (isEmptyValue(data.enquiryContacts)) {
            required.push(getFieldLabel('enquiryContacts'));
        } else {
            // Requirement 6: first contact has name
            const firstContact = data.enquiryContacts[0];
            if (isEmptyValue(firstContact.name)) required.push('First Contact Name');
            
            // Mandatory: Either Phone or Email must be present for the first contact
            const hasPhone = !isEmptyValue(firstContact.phone);
            const hasEmail = !isEmptyValue(firstContact.email);

            if (!hasPhone && !hasEmail) {
                required.push('Phone or Email (at least one contact method)');
            }

            // Format Validations (apply if value exists)
            if (hasPhone && !isValidPhone(firstContact.phone)) {
                errors.push("Phone number must be exactly 10 digits.");
            }
            if (hasEmail && !isValidEmail(firstContact.email)) {
                errors.push("Invalid Email format (e.g. name@domain.com).");
            }
        }
    } else if (clientType === 'existing') {
        if (isEmptyValue(data.clientId)) required.push(getFieldLabel('clientId'));
        
        // For existing client, we still need at least one contact method in the form or contacts
        const hasPhone = !isEmptyValue(data.contactNumber);
        const hasEmail = !isEmptyValue(data.emailId);
        const hasEnquiryContacts = !isEmptyValue(data.enquiryContacts);

        if (!hasPhone && !hasEmail && !hasEnquiryContacts) {
            required.push('Phone or Email (at least one contact method)');
        }

        // Format Validations (apply if value exists)
        if (hasPhone && !isValidPhone(data.contactNumber)) {
            errors.push("Contact Phone must be exactly 10 digits.");
        }
        if (hasEmail && !isValidEmail(data.emailId)) {
            errors.push("Invalid Email format.");
        }
    }

    // Company Format Validation
    if (!isEmptyValue(data.companyEmail) && !isValidEmail(data.companyEmail)) {
        errors.push("Invalid Company Email format.");
    }
    if (!isEmptyValue(data.companyPhone) && !isValidPhone(data.companyPhone)) {
        errors.push("Company Phone must be exactly 10 digits.");
    }

    const isReady = required.length === 0;

    return {
        isValid: isReady && errors.length === 0,
        errors: [...required.map(f => `${f} is required.`), ...errors],
        isReady
    };
};

/**
 * PROPOSALS VALIDATION
 */
export const validateProposalForm = (data: any): ValidationResult => {
    const errors: string[] = [];
    const required: string[] = [];

    if (isEmptyValue(data.profileId)) required.push(getFieldLabel('profileId'));
    
    if (data.flowType === 'new') {
        if (data.clientType === 'new') {
            if (isEmptyValue(data.clientName)) required.push(getFieldLabel('clientName'));
            if (isEmptyValue(data.phone) && isEmptyValue(data.email)) {
                required.push(getFieldLabel('contactNumber') + ' or ' + getFieldLabel('emailId'));
            }
            if (!isEmptyValue(data.phone) && !isValidPhone(data.phone)) errors.push("Phone Number must be 10 digits.");
            if (!isEmptyValue(data.email) && !isValidEmail(data.email)) errors.push("Invalid Email Address.");
        } else {
            if (isEmptyValue(data.existingClientId)) required.push(getFieldLabel('clientId'));
        }
    } else {
        if (isEmptyValue(data.selectedQueryId)) required.push(getFieldLabel('clientId'));
    }

    if (isEmptyValue(data.proposalItems)) {
        required.push(getFieldLabel('workItems'));
    } else {
        // If an item doesn't have noInvoice: true, ensure it has a professional fee > 0
        const hasInvalidItem = data.proposalItems.some((item: any) => !item.noInvoice && (Number(item.professionalFee) || 0) <= 0);
        if (hasInvalidItem) {
            errors.push("Professional fee is required unless No Invoice is selected.");
        }
    }
    
    if (isEmptyValue(data.contacts)) required.push('Contact Person');

    const isReady = required.length === 0;

    return {
        isValid: isReady && errors.length === 0,
        errors: [...required.map(f => `${f} is required.`), ...errors],
        isReady
    };
};
