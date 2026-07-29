
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;

    if (obj1 && typeof obj1 === 'object' && obj2 && typeof obj2 === 'object') {
        if (Object.keys(obj1).length !== Object.keys(obj2).length) return false;

        for (const key in obj1) {
            if (Object.prototype.hasOwnProperty.call(obj1, key)) {
                if (!Object.prototype.hasOwnProperty.call(obj2, key)) return false;
                if (!deepEqual(obj1[key], obj2[key])) return false;
            }
        }
        return true;
    }
    return false;
}

export function getChangedFields(original: any, current: any, isNew = false): string[] {
    const changes: string[] = [];
    const source = original || {};
    const target = current || {};
    const allKeys = new Set([...Object.keys(source), ...Object.keys(target)]);

    if (isNew) {
        // For new clients, consider all fields with a value as "changed"
        for (const key of allKeys) {
            if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
                const subChanges = getChangedFields({}, target[key], true);
                subChanges.forEach(sc => changes.push(`${key}.${sc}`));
            } else if (target[key] !== undefined && target[key] !== null && target[key] !== '') {
                changes.push(key);
            }
        }
        return changes;
    }

    for (const key of allKeys) {
        if (!deepEqual(source[key], target[key])) {
            changes.push(key);
        }
    }

    return changes;
}

// --- Completion Percentage Logic Moved to lib/employee-completion.ts ---

/**
 * Transforms section-based nested fields into a flat structure for UI usage.
 * Handles backward compatibility by returning the input if it's already flat.
 */
export function flattenFields(fields: any): Record<string, any> {
    if (!fields || typeof fields !== 'object') return {};

    const values = Object.values(fields);
    const hasNestedObjects = values.some(val => val && typeof val === 'object' && !Array.isArray(val) && !(val as any)._isProof);
    
    if (!hasNestedObjects) {
        return fields; // already flat
    }

    const flat: Record<string, any> = {};
    Object.keys(fields).forEach(sectionKey => {
        const section = fields[sectionKey];
        if (section && typeof section === 'object') {
            Object.keys(section).forEach(fieldKey => {
                flat[fieldKey] = section[fieldKey];
            });
        }
    });

    return flat;
}

/**
 * Converts flat UI fields back into a section-based structure using the constitution config.
 */
export function groupFieldsBySection(fields: any, constitution: any): Record<string, any> {
    if (!constitution || !fields) return fields;

    const sections = constitution.requiredSections || constitution.requiredFields || [];
    const hasSections = Array.isArray(sections) && sections.some((s: any) => s && s.sectionKey && Array.isArray(s.fields));
    
    if (!hasSections) return fields;

    const grouped: Record<string, any> = {};
    const processedFieldKeys = new Set<string>();

    sections.forEach((section: any) => {
        // Strict check for sectionKey to avoid 'undefined' property
        if (!section || !section.sectionKey || typeof section.sectionKey !== 'string' || !Array.isArray(section.fields)) return;
        
        const sectionContent: Record<string, any> = {};
        section.fields.forEach((field: any) => {
            if (field && field.fieldKey && fields[field.fieldKey] !== undefined) {
                sectionContent[field.fieldKey] = fields[field.fieldKey];
                processedFieldKeys.add(field.fieldKey);
            }
        });

        // Only add section if it contains fields
        if (Object.keys(sectionContent).length > 0) {
            grouped[section.sectionKey] = sectionContent;
        }
    });

    // Handle any leftover fields (metadata, manually added fields like country/pincode)
    // to ensure NO DATA IS LOST. We put them in a 'general' section or keep them top-level.
    // For this architecture, we'll use a 'general' key if they are lost otherwise.
    const leftover: Record<string, any> = {};
    Object.keys(fields).forEach(key => {
        if (!processedFieldKeys.has(key)) {
            leftover[key] = fields[key];
        }
    });

    if (Object.keys(leftover).length > 0) {
        // If we already have sections, put leftovers in 'general' to maintain structure
        // unless they were already part of a section in the input (unlikely for flat fields)
        grouped['general'] = { ...(grouped['general'] || {}), ...leftover };
    }

    return grouped;
}
