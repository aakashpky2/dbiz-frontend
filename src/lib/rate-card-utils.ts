/**
 * Utility functions for Rate Card operations.
 */

/**
 * Safely extracts the YYYY-MM-DD portion from a date string or Date object.
 * Prevents timezone offset shifts when parsing UTC midnight timestamps.
 */
export function extractDateString(dateInput?: string | Date | null): string | null {
    if (!dateInput) return null;
    
    if (typeof dateInput === 'string') {
        // Strip out the time component directly to avoid JS Date parsing skew
        return dateInput.split('T')[0];
    }

    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Gets today's local date string in YYYY-MM-DD format.
 */
export function getTodayString(): string {
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', { 
            timeZone: 'Asia/Kolkata', 
            year: 'numeric', month: '2-digit', day: '2-digit' 
        });
        return formatter.format(new Date());
    } catch(e) {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

/**
 * Calculates the live status of a rate card based on its validity dates,
 * ignoring timezones and comparing local dates.
 * 
 * @param applicable_from The start date of the rate card.
 * @param applicable_until The end date of the rate card (can be null).
 * @param stored_status The status currently stored in the DB (for superseded check).
 * @returns 'active' | 'scheduled' | 'expired' | 'superseded' | stored_status
 */
export function getRateCardLiveStatus(
    applicable_from?: string | Date | null,
    applicable_until?: string | Date | null,
    stored_status?: string | null
): string {
    if (stored_status === 'superseded') {
        return 'superseded';
    }

    const todayStr = getTodayString();
    const fromStr = extractDateString(applicable_from);
    const untilStr = extractDateString(applicable_until);

    if (untilStr && todayStr > untilStr) {
        return 'expired';
    }

    if (fromStr && fromStr > todayStr) {
        return 'scheduled';
    }

    if (!fromStr && !untilStr && stored_status) {
        return stored_status; // fallback if dates are somehow missing
    }

    return 'active';
}

/**
 * Normalizes item count across different API shapes (list vs detail).
 */
export function getRateCardItemCount(rateCard: any): number {
    if (!rateCard) return 0;
    
    // Sometimes backend count query returns an array [{ count: N }]
    if (Array.isArray(rateCard.rate_card_items) && rateCard.rate_card_items.length > 0 && typeof rateCard.rate_card_items[0].count === 'number') {
        return rateCard.rate_card_items[0].count;
    }
    
    return (
        rateCard.rate_card_items?.length ||
        rateCard.items?.length ||
        rateCard.service_items?.length ||
        rateCard.work_items?.length ||
        rateCard.item_count ||
        rateCard.total_items ||
        0
    );
}
