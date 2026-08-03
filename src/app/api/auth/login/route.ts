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
            return NextResponse.json({ error: 'Service Unavailable: Missing configuration' }, { status: 503 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: { user }, error } = await supabase.auth.getUser(access_token);

        if (error || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        let exp = 0;
        try {
            const tokenParts = access_token.split('.');
            if (tokenParts.length === 3) {
                const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString('utf-8'));
                exp = payload.exp;
            }
        } catch (e) {
            return NextResponse.json({ error: 'Malformed token' }, { status: 401 });
        }

        if (!exp || !Number.isFinite(exp)) {
            return NextResponse.json({ error: 'Missing or malformed expiry in token' }, { status: 401 });
        }

        const now = Math.floor(Date.now() / 1000);
        const remainingSeconds = exp - now;

        if (remainingSeconds <= 0) {
            return NextResponse.json({ error: 'Token has expired' }, { status: 401 });
        }

        const maxAge = remainingSeconds;

        const response = NextResponse.json({ status: 'success' });

        response.cookies.set({
            name: 'session',
            value: access_token,
            maxAge: maxAge,
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
