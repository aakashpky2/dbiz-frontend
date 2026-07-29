import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Native Next.js App Router login handler 
// Used to securely set the session cookie on the exact same origin domain.
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const access_token = body.access_token;

        if (!access_token) {
            return NextResponse.json({ error: 'Missing access token' }, { status: 400 });
        }

        // Validate the token to ensure nobody sets fake sessions
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            const response = NextResponse.json({ status: 'success' });
            const expiresIn = 24 * 60 * 60;
            response.cookies.set({
                name: 'session',
                value: access_token,
                maxAge: expiresIn,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                sameSite: 'lax',
            });
            return response;
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: { user }, error } = await supabase.auth.getUser(access_token);

        if (error || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const expiresIn = 24 * 60 * 60; // 24 hours

        const response = NextResponse.json({ status: 'success' });

        // Setting the session cookie locally means Vercel won't strip
        // it from cross-origin API headers.
        response.cookies.set({
            name: 'session',
            value: access_token,
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
        });

        return response;
    } catch (e: any) {
        console.error('Login Error:', e);
        return NextResponse.json({ error: 'Internal Server Error', details: e.message }, { status: 500 });
    }
}
