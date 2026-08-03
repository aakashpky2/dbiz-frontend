import { NextRequest, NextResponse } from 'next/server';

export async function proxyRequest(req: NextRequest, moduleName: string) {
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) {
        return NextResponse.json({ error: 'BACKEND_URL is not set' }, { status: 500 });
    }

    // Extract the path from the original URL
    const url = new URL(req.url);
    const apiPath = url.pathname; // Should be /api/...
    const query = url.search; // Includes ?...

    const targetUrl = `${backendUrl.replace(/\/+$/, '')}${apiPath}${query}`;

    const headers = new Headers();
    const sessionCookie = req.cookies.get('session')?.value;
    if (sessionCookie) {
        headers.set('Cookie', `session=${sessionCookie}`);
    }

    // Copy allowed headers
    const allowedHeaders = ['content-type', 'accept', 'user-agent', 'x-requested-with'];
    req.headers.forEach((value, key) => {
        if (allowedHeaders.includes(key.toLowerCase())) {
            headers.set(key, value);
        }
    });

    try {
        const fetchOptions: RequestInit = {
            method: req.method,
            headers,
            // Only set body for methods that allow it
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(),
            redirect: 'manual', // DO NOT follow redirects automatically to prevent exposing them to browser
        };

        const response = await fetch(targetUrl, fetchOptions);

        // If the backend returns a redirect, do not pass the Location header back as a redirect
        // to the client. The client should not follow it directly to api.dbiz.online.
        if (response.status >= 300 && response.status < 400) {
            // We intercept the redirect and just fetch the redirected URL if it's relative
            // But usually this means trailing slash issue.
            // A simple fix: if it's a 301/302/307/308, we could fetch it again.
            // Or simply return the body with a 200, but let's try to follow it server-side.
            const location = response.headers.get('location');
            if (location) {
                // Follow it on the server
                const redirectUrl = new URL(location, targetUrl).toString();
                const redirectedResponse = await fetch(redirectUrl, {
                    method: req.method, // Follow with same method (307/308 preserve method)
                    headers,
                    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.clone().arrayBuffer(),
                    redirect: 'manual'
                });
                
                // Return the resolved response
                const resBody = await redirectedResponse.arrayBuffer();
                const responseHeaders = new Headers();
                redirectedResponse.headers.forEach((value, key) => {
                    if (key.toLowerCase() !== 'set-cookie' && key.toLowerCase() !== 'content-encoding') {
                        responseHeaders.set(key, value);
                    }
                });

                return new NextResponse(resBody, {
                    status: redirectedResponse.status,
                    headers: responseHeaders,
                });
            }
        }

        const resBody = await response.arrayBuffer();
        const responseHeaders = new Headers();
        
        // Pass through headers except set-cookie which might be domain-bound incorrectly
        response.headers.forEach((value, key) => {
            if (key.toLowerCase() !== 'set-cookie' && key.toLowerCase() !== 'content-encoding') {
                responseHeaders.set(key, value);
            }
        });

        return new NextResponse(resBody, {
            status: response.status,
            headers: responseHeaders,
        });

    } catch (err: any) {
        console.error(`[Next.js Proxy Error] ${moduleName}:`, err);
        return NextResponse.json({ error: 'Internal Server Proxy Error' }, { status: 500 });
    }
}

export const GET = (req: NextRequest) => proxyRequest(req, 'attendance');
export const POST = (req: NextRequest) => proxyRequest(req, 'attendance');
export const PUT = (req: NextRequest) => proxyRequest(req, 'attendance');
export const PATCH = (req: NextRequest) => proxyRequest(req, 'attendance');
export const DELETE = (req: NextRequest) => proxyRequest(req, 'attendance');
