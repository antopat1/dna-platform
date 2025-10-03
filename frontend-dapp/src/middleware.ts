// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log(`MIDDLEWARE - Path: ${pathname}`)
  

  if (pathname === '/coach-setup') {
    const coachAuthCookie = request.cookies.get('coachAuth')?.value;
    
    if (coachAuthCookie !== 'true') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('error', 'coach-auth-required');
      console.log('MIDDLEWARE - Coach auth required, redirecting to home');
      return NextResponse.redirect(url);
    }
    
    console.log('MIDDLEWARE - Coach authenticated, allowing access to coach-setup');
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|auth).*)',
  ],
}




