
/**
 * Unified Phone Number Utility System
 * Standardizes phone handling across the entire project:
 * - Country code (separate)
 * - Number (exactly 10 digits)
 */

export const PHONE_ERROR_MESSAGE = "Phone number must be exactly 10 digits";
export const PHONE_REGEX = /^\d{10}$/;

/**
 * Sanitize input to allow only digits and limit to 10 characters.
 */
export const sanitizePhoneInput = (value: string): string => {
    return value.replace(/\D/g, "").slice(0, 10);
};

/**
 * Validates if the local number is exactly 10 digits.
 */
export const isValidLocalPhone = (value: string): boolean => {
    return /^\d{10}$/.test(value);
};

/**
 * Formats country code and phone number for storage/payload.
 * Example: +91, 9876543210 => +919876543210
 */
export const formatPhoneForPayload = (countryCode: string, phone: string): string => {
    const code = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
    const cleanPhone = phone.replace(/\D/g, "");
    return `${code}${cleanPhone}`;
};

/**
 * Parses a full phone number string into country code and local number.
 * Example: +919876543210 => { countryCode: "+91", number: "9876543210" }
 */
export const parsePhoneFromPayload = (value: string | null | undefined, defaultCode = '+91') => {
    if (!value) return { countryCode: defaultCode, number: "" };
    
    // Assuming the local number is always the last 10 digits
    const clean = value.replace(/[^\d+]/g, "");
    if (clean.length > 10) {
        const number = clean.slice(-10);
        const countryCode = clean.slice(0, clean.length - 10);
        return { 
            countryCode: countryCode.startsWith('+') ? countryCode : `+${countryCode}`, 
            number 
        };
    }
    
    return { countryCode: defaultCode, number: clean };
};

// Legacy support / Compatibility aliases
export const normalizeToDigits = sanitizePhoneInput;
export const parsePhoneNumber = (val: string | null | undefined, defaultCode = '+91') => {
    return parsePhoneFromPayload(val, defaultCode);
};
export const formatPhoneNumber = (code: string, num: string) => formatPhoneForPayload(code, num);
export const phoneValidation = (val: string | null | undefined) => {
    if (!val) return true;
    const { number } = parsePhoneFromPayload(val);
    return isValidLocalPhone(number);
};
