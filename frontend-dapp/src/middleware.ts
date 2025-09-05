// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log(`MIDDLEWARE - Path: ${pathname}`)
  
  // Protezione speciale per la route /coach-setup
  if (pathname === '/coach-setup') {
    // *** MODIFICA CHIAVE: Controlla solo il cookie per l'autenticazione del coach. ***
    // Questo è l'unico modo affidabile per il middleware di conoscere lo stato di autenticazione impostato dal client.
    const coachAuthCookie = request.cookies.get('coachAuth')?.value;
    
    // Se il cookie non è presente o non è valido, reindirizza alla home page.
    if (coachAuthCookie !== 'true') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('error', 'coach-auth-required');
      console.log('MIDDLEWARE - Coach auth required, redirecting to home');
      return NextResponse.redirect(url);
    }
    
    console.log('MIDDLEWARE - Coach authenticated, allowing access to coach-setup');
  }
  
  // La protezione delle altre rotte rimane gestita lato client,
  // il che è corretto per una DApp che dipende dallo stato del wallet.
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Abbina tutti i percorsi di richiesta tranne quelli che iniziano con:
     * - api (rotte API)
     * - _next/static (file statici)
     * - _next/image (file di ottimizzazione immagini)
     * - favicon.ico (file favicon)
     * - auth (pagine di autenticazione, per evitare loop)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|auth).*)',
  ],
}




