

// For client-side, we use relative paths to leverage Next.js rewrites and avoid CORS/PNA issues.
// For server-side, we use the absolute URL to reach the backend directly.
const IS_SERVER = typeof window === 'undefined';
export const BACKEND_URL = process.env.BACKEND_URL || '';

const BASE_PATH = IS_SERVER ? BACKEND_URL : '';

export const API_ENDPOINTS = {
    TEMPLATES: `${BASE_PATH}/api/templates`,
    TEMPLATE_CONFIGS: `${BASE_PATH}/api/template-configurations`,
    ADMIN_SCHEMA: `${BASE_PATH}/api/admin/schema`,
    DASHBOARD_STATS: `${BASE_PATH}/api/dashboard/stats`,
    DASHBOARD_CHARTS: `${BASE_PATH}/api/dashboard/charts`,
    DASHBOARD_ACTIVITY: `${BASE_PATH}/api/dashboard/activity`,
    DASHBOARD_SUMMARY: `${BASE_PATH}/api/dashboard/summary`,
};
