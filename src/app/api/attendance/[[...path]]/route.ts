import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const SAFE_REQ_HEADERS = ['accept', 'content-type', 'user-agent', 'x-requested-with'];
const UNSAFE_RES_HEADERS = ['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive', 'upgrade', 'content-encoding', 'set-cookie'];

async function proxyRequest(req: NextRequest, { params }: { params?: { path?: string[] } }, moduleName: string) {
    const requestId = req.headers.get('X-DBIZ-Request-ID') || randomUUID();
    const url = new URL(req.url);
    const apiPath = url.pathname;
    const query = url.search;
    const sessionCookie = req.cookies.get('session');
    const authHeader = req.headers.get('authorization');
    const allCookies = req.cookies.getAll().map(c => c.name);

    console.log(JSON.stringify({
      stage: 'proxy-entry',
      requestId,
      route: req.nextUrl.pathname,
      method: req.method,
      cookieNames: allCookies,
      incomingSessionCookieExists: !!sessionCookie,
      incomingAuthorizationExists: !!authHeader,
      host: req.headers.get('host'),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer')
    }));

    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) {
        return NextResponse.json({ error: 'BACKEND_URL is not set' }, { status: 500 });
    }
    
    const targetUrlString = `${backendUrl.replace(/\/+$/, '')}${apiPath}${query}`;

    const headers = new Headers();
    if (sessionCookie) {
        headers.set('Cookie', `session=${sessionCookie.value}`);
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
            credentials: 'omit' // Node.js fetch default, explicitly set
        };

        let backendHost = '';
        const targetUrl = new URL(targetUrlString);
        try { backendHost = targetUrl.host; } catch (e) {}

        console.log(JSON.stringify({
          stage: 'proxy-outgoing',
          requestId,
          backendHost,
          outgoingUrl: { pathname: targetUrl.pathname, backendHost: targetUrl.hostname, queryKeys: [...targetUrl.searchParams.keys()] },
          outgoingCookieHeaderExists: headers.has('Cookie'),
          outgoingAuthorizationHeaderExists: headers.has('Authorization'),
          redirectMode: fetchOptions.redirect
        }));

        let response = await fetch(targetUrlString, fetchOptions);
        let redirected = false;
        
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location) {
                const redirectUrl = new URL(location, targetUrlString);
                const backendOrigin = new URL(backendUrl).origin;
                
                if (redirectUrl.origin === backendOrigin) {
                    redirected = true;
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

        const hasLocationHeader = response.headers.has('location');
        const hasSetCookieHeader = response.headers.has('set-cookie');

        console.log(JSON.stringify({
          stage: 'proxy-response',
          requestId,
          status: response.status,
          redirected,
          finalUrlHost: backendHost,
          locationHeaderExists: hasLocationHeader,
          setCookieHeaderExists: hasSetCookieHeader
        }));

        responseHeaders.set('X-DBIZ-Request-ID', requestId);

        return new NextResponse(resBody, {
            status: response.status,
            headers: responseHeaders,
        });

    } catch (err: any) {
        console.error(`[Next.js Proxy Error] ${moduleName}:`, err);
        return NextResponse.json({ error: 'Internal Server Proxy Error' }, { status: 500 });
    }
}

export const GET = (req: NextRequest, ctx: any) => proxyRequest(req, ctx, 'attendance');
export const POST = (req: NextRequest, ctx: any) => proxyRequest(req, ctx, 'attendance');
export const PUT = (req: NextRequest, ctx: any) => proxyRequest(req, ctx, 'attendance');
export const PATCH = (req: NextRequest, ctx: any) => proxyRequest(req, ctx, 'attendance');
export const DELETE = (req: NextRequest, ctx: any) => proxyRequest(req, ctx, 'attendance');
export const OPTIONS = (req: NextRequest, ctx: any) => proxyRequest(req, ctx, 'attendance');
