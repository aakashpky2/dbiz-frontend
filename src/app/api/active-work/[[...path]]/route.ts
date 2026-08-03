import { NextRequest, NextResponse } from 'next/server';

const SAFE_REQ_HEADERS = ['accept', 'content-type', 'user-agent', 'x-requested-with'];
const UNSAFE_RES_HEADERS = ['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive', 'upgrade', 'content-encoding', 'set-cookie'];

async function proxyRequest(req: NextRequest, moduleName: string) {
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) {
        return NextResponse.json({ error: 'BACKEND_URL is not set' }, { status: 500 });
    }

    const url = new URL(req.url);
    const apiPath = url.pathname;
    const query = url.search;
    
    const targetUrlString = `${backendUrl.replace(/\/+$/, '')}${apiPath}${query}`;

    const headers = new Headers();
    const sessionCookie = req.cookies.get('session')?.value;
    const authHeader = req.headers.get('authorization');
    
    if (sessionCookie) {
        headers.set('Cookie', `session=${sessionCookie}`);
    } else if (authHeader) {
        headers.set('Authorization', authHeader);
    } else {
        return NextResponse.json({ error: 'Unauthorized: No credentials provided' }, { status: 401 });
    }

    req.headers.forEach((value, key) => {
        if (SAFE_REQ_HEADERS.includes(key.toLowerCase())) {
            headers.set(key, value);
        }
    });

    try {
        const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
        const reqBody = hasBody ? await req.arrayBuffer() : undefined;
        
        const fetchOptions: RequestInit = {
            method: req.method,
            headers,
            body: reqBody,
            redirect: 'manual',
        };

        let response = await fetch(targetUrlString, fetchOptions);
        
        // Handle backend redirects safely
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location) {
                const redirectUrl = new URL(location, targetUrlString);
                const backendOrigin = new URL(backendUrl).origin;
                
                // Only follow if it stays on the backend
                if (redirectUrl.origin === backendOrigin) {
                    response = await fetch(redirectUrl.toString(), {
                        method: req.method,
                        headers,
                        body: reqBody,
                        redirect: 'manual'
                    });
                } else {
                    return NextResponse.json({ error: 'Invalid redirect origin' }, { status: 502 });
                }
            }
        }

        const resBody = await response.arrayBuffer();
        const responseHeaders = new Headers();
        
        response.headers.forEach((value, key) => {
            if (!UNSAFE_RES_HEADERS.includes(key.toLowerCase())) {
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
export const OPTIONS = (req: NextRequest) => proxyRequest(req, 'active-work');
