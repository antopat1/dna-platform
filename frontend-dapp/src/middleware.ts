// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Log per debugging, utile per vedere quando il middleware viene eseguito.
  console.log(`MIDDLEWARE - Path: ${pathname}`)

  // In questa configurazione, la protezione delle rotte (sia per la whitelist
  // che per il ruolo admin) è gestita lato client tramite componenti "Guard".
  // Questo è l'approccio corretto per le DApp, poiché il middleware sul server
  // non conosce lo stato del wallet dell'utente.

  // Pertanto, il middleware si limita a lasciar passare la richiesta.
  // In futuro, potresti usarlo per altre logiche server-side (es. geoblocking).
  
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


// // src/middleware.ts
// import { NextRequest, NextResponse } from 'next/server'

// // Percorsi che richiedono solo connessione wallet (senza whitelist)
// const AUTH_REQUIRED_PATHS = ['/z'] //'/my-nfts', '/transactionhistory', '/nft-details'

// export function middleware(request: NextRequest) {
//   const { pathname } = request.nextUrl

//   // Log per debugging - controlla sia browser che terminale server
//   console.log(`MIDDLEWARE EXECUTING: ${pathname}`)

//   // Per le pagine che richiedono whitelist, lascia passare - 
//   // il controllo whitelist sarà fatto direttamente nella pagina
//   if (pathname.startsWith('/dashboard/register-content')) {
//     console.log(`ALLOWING whitelist-protected path: ${pathname}`)
//     return NextResponse.next()
//   }

//   // Controlla se il percorso richiede autenticazione
//   const requiresAuth = AUTH_REQUIRED_PATHS.some(path => {
//     const matches = pathname.startsWith(path)
//     console.log(`Checking auth for ${path} -> ${matches}`)
//     return matches
//   })

//   if (requiresAuth) {
//     console.log(`REDIRECTING to wallet connect from ${pathname}`)
//     const url = request.nextUrl.clone()
//     url.pathname = '/auth/connect-wallet'
//     url.searchParams.set('redirect', pathname)
//     return NextResponse.redirect(url)
//   }

//   console.log(`ALLOWING access to ${pathname}`)
//   return NextResponse.next()
// }

// export const config = {
//   matcher: [
//     /*
//      * Match all request paths except for the ones starting with:
//      * - api (API routes)
//      * - _next/static (static files)
//      * - _next/image (image optimization files)
//      * - favicon.ico (favicon file)
//      * - auth (auth pages themselves)
//      */
//     '/((?!api|_next/static|_next/image|favicon.ico|auth).*)',
//   ],
// }

