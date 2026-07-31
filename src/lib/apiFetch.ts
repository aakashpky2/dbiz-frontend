import { supabase } from './supabase';

export interface ApiFetchOptions extends RequestInit {
    authMode?: 'cookie' | 'bearer';
}

/**
 * A centralized fetch wrapper that automatically handles:
 * 1. Attaching `credentials: 'include'` for cookies (default 'cookie' mode)
 * 2. Attaching the Authorization Bearer token from Supabase only if authMode='bearer'
 * 3. NO automatic token refresh or getSession calls for cookie-authenticated routes 
 *    to prevent Supabase auth lock contention.
 */
export async function apiFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
    const { authMode = 'cookie', ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers || {});

    // Ensure we send cookies for internal routes
    if (authMode === 'cookie') {
        fetchOptions.credentials = 'include';
    }

    // Only fetch session if explicitly requested (e.g. external API or specific backend requirement)
    if (authMode === 'bearer') {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (token && !headers.has('Authorization')) {
                headers.set('Authorization', `Bearer ${token}`);
            }
        } catch (err) {
            console.error('[apiFetch] Error getting session for bearer auth:', err);
        }
    }

    const plainHeaders: Record<string, string> = {};
    headers.forEach((value, key) => {
        plainHeaders[key] = value;
    });

    fetchOptions.headers = plainHeaders;

    // Make the initial request
    const response = await fetch(url, fetchOptions);

    // We do NOT manually call supabase.auth.refreshSession() here on 401.
    // Calling refreshSession concurrently causes lock contention and AbortErrors.
    // The backend uses session cookies, so standard expiry/login mechanisms should handle 401s centrally.

    return response;
}
