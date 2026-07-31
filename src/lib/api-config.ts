export function getApiBaseUrl() {
    if (typeof window === "undefined") {
        return (process.env.BACKEND_URL ?? "http://localhost:3001").trim().replace(/\/$/, "");
    }
    return "";
}

export const API_ENDPOINTS = {
    TEMPLATES: `${getApiBaseUrl()}/api/templates`,
    TEMPLATE_CONFIGS: `${getApiBaseUrl()}/api/template-configurations`,
    ADMIN_SCHEMA: `${getApiBaseUrl()}/api/admin/schema`,
    DASHBOARD_STATS: `${getApiBaseUrl()}/api/dashboard/stats`,
    DASHBOARD_CHARTS: `${getApiBaseUrl()}/api/dashboard/charts`,
    DASHBOARD_ACTIVITY: `${getApiBaseUrl()}/api/dashboard/activity`,
    DASHBOARD_SUMMARY: `${getApiBaseUrl()}/api/dashboard/summary`,
};
