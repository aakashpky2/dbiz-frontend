// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function proxyRequest(request: NextRequest, { params }: { params: { path?: string[] } }) {
    try {
        const backendUrl = process.env.BACKEND_URL;
        if (!backendUrl) {
            console.error('BACKEND_URL is not set');
            return NextResponse.json({ success: false, message: 'Backend URL not configured' }, { status: 500 });
        }

        const pathStr = params.path ? params.path.join('/') : '';
        const searchParams = request.nextUrl.searchParams.toString();
        const query = searchParams ? `?${searchParams}` : '';
        
        const targetUrl = `${backendUrl.replace(/\/$/, '')}/api/employees${pathStr ? '/' + pathStr : ''}${query}`;

        const headers = new Headers(request.headers);
        headers.set('host', new URL(targetUrl).host);
        
        // Remove Next.js specific headers that might interfere
        headers.delete('x-middleware-invoke');
        headers.delete('x-invoke-path');
        headers.delete('x-invoke-query');

        const fetchOptions: RequestInit = {
            method: request.method,
            headers,
            redirect: 'manual',
        };

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            const body = await request.text();
            if (body) {
                fetchOptions.body = body;
            }
        }

        const response = await fetch(targetUrl, fetchOptions);
        const responseBody = await response.text();

        const responseHeaders = new Headers(response.headers);
        responseHeaders.delete('content-encoding');

        return new NextResponse(responseBody, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });

    } catch (error: any) {
        console.error('[Employees Proxy Error]:', error);
        return NextResponse.json({ success: false, message: 'Proxy error', error: error.message }, { status: 500 });
    }
}

// @ts-ignore
export async function GET(request: NextRequest, context: any) {
  return proxyRequest(request, context);
}
// @ts-ignore
export async function POST(request: NextRequest, context: any) {
  return proxyRequest(request, context);
}
// @ts-ignore
export async function PUT(request: NextRequest, context: any) {
  return proxyRequest(request, context);
}
// @ts-ignore
export async function PATCH(request: NextRequest, context: any) {
  return proxyRequest(request, context);
}
// @ts-ignore
export async function DELETE(request: NextRequest, context: any) {
  return proxyRequest(request, context);
}
