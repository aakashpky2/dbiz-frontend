'use server';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { API_ENDPOINTS } from '@/lib/api-config';

export interface DashboardStats {
    totalEmployees: number;
    attendanceToday: {
        present: number;
        absent: number;
        late: number;
        percentage: number;
    };
    pendingTasks: number;
    complianceScore: number;
}

export interface DashboardChartsData {
    weeklyOutput: { day: string; value: number }[];
    attendanceBreakdown: { name: string; value: number; color?: string }[];
}

export interface DashboardSummaryData {
    profile: string;
    kpis: Record<string, number>;
    charts: Record<string, any[]>;
    tables: Record<string, any[]>;
    _error?: string;
    _redirect?: boolean;
}


export interface DashboardActivity {
    id: string;
    action: string;
    target: string;
    by: string;
    time: string;
}

// Helper to safely get cookie string
async function getCookieHeader(): Promise<string> {
    try {
        const cookieStore = await cookies();
        return cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
    } catch (e) {
        return '';
    }
}

const fetchDashboardStats = async (): Promise<DashboardStats> => {
    try {
        const cookieHeader = await getCookieHeader();
        const response = await fetch(API_ENDPOINTS.DASHBOARD_STATS, {
            headers: { Cookie: cookieHeader },
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch stats from backend: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('[Dashboard] Stats Error:', error);
        return {
            totalEmployees: 0,
            attendanceToday: { present: 0, absent: 0, late: 0, percentage: 0 },
            pendingTasks: 0,
            complianceScore: 0
        };
    }
};

const fetchDashboardCharts = async (): Promise<DashboardChartsData> => {
    try {
        const cookieHeader = await getCookieHeader();
        const response = await fetch(API_ENDPOINTS.DASHBOARD_CHARTS, {
            headers: { Cookie: cookieHeader },
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch charts from backend: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('[Dashboard] Charts Error:', error);
        return {
            weeklyOutput: [],
            attendanceBreakdown: []
        };
    }
};

const fetchRecentActivity = async (): Promise<DashboardActivity[]> => {
    try {
        const cookieHeader = await getCookieHeader();
        const response = await fetch(API_ENDPOINTS.DASHBOARD_ACTIVITY, {
            headers: { Cookie: cookieHeader },
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch activity from backend: ${response.status}`);
        }
        
        const rawData = await response.json();

        // Map back to expected format with localized time
        return rawData.map((log: any) => ({
            ...log,
            time: new Date(log.time).toLocaleString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                day: 'numeric',
                month: 'short'
            })
        }));
    } catch (error) {
        console.error('[Dashboard] Activity Error:', error);
        return [];
    }
};

const fetchDashboardSummary = async (): Promise<DashboardSummaryData> => {
    try {
        const cookieHeader = await getCookieHeader();
        console.log('[Dashboard Action] Fetching:', API_ENDPOINTS.DASHBOARD_SUMMARY);
        console.log('[Dashboard Action] Cookie Header Length:', cookieHeader?.length, 'Has Session:', cookieHeader.includes('session='));

        const response = await fetch(API_ENDPOINTS.DASHBOARD_SUMMARY, {
            headers: { Cookie: cookieHeader },
            cache: 'no-store'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                console.warn('[Dashboard] 401 Unauthorized, redirecting to login to refresh session');
                return { _redirect: true } as any;
            }
            throw new Error(`Failed to fetch dashboard summary from backend: ${response.status}`);
        }
        
        let json;
        try {
            json = await response.json();
        } catch (parseError) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('[Dashboard] JSON Parse Error:', parseError);
            }
            throw new Error('Invalid JSON response from server');
        }
        
        if (!json || !json.data) {
            throw new Error('API response missing expected data object');
        }
        
        return json.data as DashboardSummaryData;
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('[Dashboard] Summary Fetch Error:', error);
        }
        return {
            _error: (error as Error).message || 'Failed to fetch dashboard data',
            profile: 'staff',
            kpis: {},
            charts: {},
            tables: {}
        };
    }
};


// Exported Actions
export const getDashboardStats = fetchDashboardStats;
export const getDashboardCharts = fetchDashboardCharts;
export const getRecentActivity = fetchRecentActivity;
export const getDashboardSummary = fetchDashboardSummary;

// Unified data fetcher with deduplication
export const getDashboardData = cache(async () => {
    // Fetch stats/charts/activity once per dashboard load concurrently
    const [statsResult, chartsResult, activityResult] = await Promise.allSettled([
        getDashboardStats(),
        getDashboardCharts(),
        getRecentActivity()
    ]);

    const stats = statsResult.status === 'fulfilled' ? statsResult.value : {
        totalEmployees: 0,
        attendanceToday: { present: 0, absent: 0, late: 0, percentage: 0 },
        pendingTasks: 0,
        complianceScore: 0
    };

    const charts = chartsResult.status === 'fulfilled' ? chartsResult.value : {
        weeklyOutput: [],
        attendanceBreakdown: []
    };

    const activity = activityResult.status === 'fulfilled' ? activityResult.value : [];

    return {
        stats,
        charts,
        recentActivity: activity
    };
});
