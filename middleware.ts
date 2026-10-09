import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Coarse gate only (cookie present). Real authorization happens in pages, actions and the engine.
export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if ((p.startsWith('/patient') || p.startsWith('/clinician') || p.startsWith('/api/export')) && !req.cookies.get('px_user') && !req.cookies.get('px_session')) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ['/patient/:path*', '/clinician/:path*', '/api/export'] };
