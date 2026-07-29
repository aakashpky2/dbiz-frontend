import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get('session');

    // The user requested that the app should ALWAYS go to the login page first when opening the application link.
    if (request.nextUrl.pathname === '/') {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // Fast check: If there is no session cookie at all, redirect immediately.
    // NOTE: Heavy JWT validation via Supabase API is moved to the root layout and server actions 
    // to improve TTFB and Next.js navigation speed drastically.
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
        if (!sessionCookie) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - images (public images)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)',
    ],
};
