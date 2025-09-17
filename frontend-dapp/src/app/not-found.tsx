// frontend-dapp/src/app/not-found.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import notFoundAnimation from '../assets/animation/not-found.json';
import dynamic from 'next/dynamic'; // Importa la funzione dynamic

// ======================= INIZIO SOLUZIONE =======================
// Applichiamo la stessa tecnica qui: importiamo il componente Player
// in modo dinamico, disabilitando il Server-Side Rendering.
const Player = dynamic(
  () => import('@lottiefiles/react-lottie-player').then((mod) => mod.Player),
  { ssr: false }
);
// ======================== FINE SOLUZIONE ========================

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)] bg-gray-900 text-gray-100 p-6 text-center">
      <h1 className="text-6xl md:text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-600 mb-4">
        404
      </h1>
      <h2 className="text-3xl md:text-4xl font-bold text-gray-200 mb-2">
        Pagina non trovata
      </h2>
      <p className="text-lg text-gray-400 mb-8 max-w-xl">
        Oops! Sembra che tu abbia preso una strada sbagliata. La pagina che stai cercando non esiste.
      </p>

      {/* Lottie Animation per il 404 */}
      <div className="w-full max-w-sm mb-8">
        <Player
          autoplay
          loop
          src={notFoundAnimation}
          className="w-full h-auto"
        />
      </div>

      <Link href="/" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-full transition-colors shadow-lg">
        Torna alla Homepage
      </Link>
    </div>
  );
}

// // frontend-dapp/src/app/not-found.tsx

// 'use client';

// import React from 'react';
// import { Player } from '@lottiefiles/react-lottie-player';
// import Link from 'next/link';
// // Importa il file Lottie per la pagina 404
// import notFoundAnimation from '../assets/animation/not-found.json';

// export default function NotFound() {
//   return (
//     <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)] bg-gray-900 text-gray-100 p-6 text-center">
//       <h1 className="text-6xl md:text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-600 mb-4">
//         404
//       </h1>
//       <h2 className="text-3xl md:text-4xl font-bold text-gray-200 mb-2">
//         Pagina non trovata
//       </h2>
//       <p className="text-lg text-gray-400 mb-8 max-w-xl">
//         Oops! Sembra che tu abbia preso una strada sbagliata. La pagina che stai cercando non esiste.
//       </p>

//       {/* Lottie Animation per il 404 */}
//       <div className="w-full max-w-sm mb-8">
//         <Player
//           autoplay
//           loop
//           src={notFoundAnimation}
//           className="w-full h-auto"
//         />
//       </div>

//       <Link href="/" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-full transition-colors shadow-lg">
//         Torna alla Homepage
//       </Link>
//     </div>
//   );
// }