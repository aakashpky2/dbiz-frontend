export function sanitizeErrorMessage(error: any, defaultMessage: string = "An unexpected error occurred. Please try again later."): string {
    if (!error) return defaultMessage;
    
    let msg = '';
    if (typeof error === 'string') msg = error;
    else if (error.message) msg = error.message;
    else if (error.error) msg = error.error;
    
    // Check if it's a raw database error or UUID exposure
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes('uuid') || lowerMsg.includes('column') || lowerMsg.includes('relation') || lowerMsg.includes('syntax') || lowerMsg.includes('sql') || lowerMsg.includes('database')) {
        return "A system operation failed. Please try again or contact support if this persists.";
    }
    if (lowerMsg.includes('network') || lowerMsg.includes('fetch')) {
        return "Network connection issue. Please check your internet connection.";
    }
    
    // Return sanitized message if it looks clean, else default
    return msg && msg.length < 150 ? msg : defaultMessage;
}
