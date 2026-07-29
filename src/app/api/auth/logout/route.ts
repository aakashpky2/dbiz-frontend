import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const response = NextResponse.json({ status: 'success' });

    // Explicitly destroy the cookie
    response.cookies.set({
        name: 'session',
        value: '',
        maxAge: 0,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });

    return response;
}
