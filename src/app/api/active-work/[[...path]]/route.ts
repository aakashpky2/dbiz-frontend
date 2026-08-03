import { NextRequest, NextResponse } from 'next/server';

async function proxyRequest(req: NextRequest, moduleName: string) {
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
        const reqBody = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer();
        
        const fetchOptions: RequestInit = {
            method: req.method,
            headers,
            body: reqBody,
            redirect: 'manual', // DO NOT follow redirects automatically to prevent exposing them to browser
        };

        const response = await fetch(targetUrl, fetchOptions);

        // If the backend returns a redirect, do not pass the Location header back as a redirect
        // to the client. The client should not follow it directly to api.dbiz.online.
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location) {
                // Follow it on the server
                const redirectUrl = new URL(location, targetUrl).toString();
                const redirectedResponse = await fetch(redirectUrl, {
                    method: req.method, 
                    headers,
                    body: reqBody,
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

export const GET = (req: NextRequest) => proxyRequest(req, 'active-work');
export const POST = (req: NextRequest) => proxyRequest(req, 'active-work');
export const PUT = (req: NextRequest) => proxyRequest(req, 'active-work');
export const PATCH = (req: NextRequest) => proxyRequest(req, 'active-work');
export const DELETE = (req: NextRequest) => proxyRequest(req, 'active-work');
