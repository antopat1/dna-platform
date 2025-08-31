// frontend-dapp/src/app/page.tsx
'use client';

import React from 'react';
import { Player } from '@lottiefiles/react-lottie-player';
import Link from 'next/link';
import { BiLayer, BiDollar, BiNetworkChart } from 'react-icons/bi';
// Importa l'animazione Lottie dal tuo file locale
import teamFocusAnimation from '../assets/animation/team-focus.json';
import { useUserRole } from '@/hooks/useUserRole';

export default function Home() {
  const { isAuthor, isConnected } = useUserRole();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-gray-100">
      
      {/* Hero Section */}
      <section className="text-center py-20 px-4 max-w-4xl mx-auto flex flex-col items-center">
        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
          Il Futuro della Scienza è Tokenizzato.
        </h1>
        <p className="text-xl md:text-2xl text-gray-300 font-light mb-8">
          Benvenuto su DnA, il marketplace che trasforma la ricerca scientifica in asset digitali unici e verificabili.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/marketplace" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-full transition-colors shadow-lg">
            Esplora il Marketplace
          </Link>
          {isConnected && isAuthor ? (
            <Link href="/register-content" className="bg-transparent border-2 border-gray-400 hover:border-blue-400 text-gray-300 hover:text-blue-400 font-semibold py-3 px-8 rounded-full transition-colors">
              Crea il tuo NFT
            </Link>
          ) : (
            <Link href="/my-nfts" className="bg-transparent border-2 border-gray-400 hover:border-blue-400 text-gray-300 hover:text-blue-400 font-semibold py-3 px-8 rounded-full transition-colors">
              Visualizza i tuoi NFT
            </Link>
          )}
        </div>

        {/* Lottie Animation (Team Focus) */}
        <div className="mt-8 w-full flex justify-center transform transition-transform duration-300 hover:scale-110">
          <div className="w-2/3 md:w-1/2 lg:w-1/3 max-w-[280px]">
            <Player
              autoplay
              loop
              src={teamFocusAnimation}
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-800 w-full py-20 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div className="flex flex-col items-center p-6 bg-gray-700 rounded-xl shadow-lg transform transition-transform hover:scale-105">
            <BiLayer className="text-5xl text-blue-400 mb-4" />
            <h3 className="text-2xl font-bold mb-2">Trasparenza Assoluta</h3>
            <p className="text-gray-400">
              Ogni contenuto scientifico è registrato in modo immutabile sulla blockchain, garantendo provenienza e proprietà.
            </p>
          </div>
          <div className="flex flex-col items-center p-6 bg-gray-700 rounded-xl shadow-lg transform transition-transform hover:scale-105">
            <BiDollar className="text-5xl text-blue-400 mb-4" />
            <h3 className="text-2xl font-bold mb-2">Nuove Opportunità</h3>
            <p className="text-gray-400">
              Monetizza il tuo lavoro di ricerca o supporta i progetti che ami, creando un ecosistema di valore.
            </p>
          </div>
          <div className="flex flex-col items-center p-6 bg-gray-700 rounded-xl shadow-lg transform transition-transform hover:scale-105">
            <BiNetworkChart className="text-5xl text-blue-400 mb-4" />
            <h3 className="text-2xl font-bold mb-2">Connessione Globale</h3>
            <p className="text-gray-400">
              Una community di scienziati, ricercatori e appassionati connessi da una visione comune di innovazione.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="text-center py-20 px-4">
        <h2 className="text-3xl font-bold mb-4">
          Pronto a Rivoluzionare la Ricerca?
        </h2>
        <p className="text-lg text-gray-400 mb-6">
          Unisciti a noi e contribuisci a costruire un futuro della scienza aperto e accessibile a tutti.
        </p>
        <Link href="/explore" className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-full transition-colors shadow-lg">
          Inizia Ora
        </Link>
      </section>
      
    </div>
  );
}


// // frontend-dapp/src/app/page.tsx

// 'use client';

// import React from 'react';
// import { Player } from '@lottiefiles/react-lottie-player';
// import Link from 'next/link';
// import { BiLayer, BiDollar, BiNetworkChart } from 'react-icons/bi';
// // Importa l'animazione Lottie dal tuo file locale
// import teamFocusAnimation from '../assets/animation/team-focus.json';

// export default function Home() {
//   return (
//     <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-gray-100">
      
//       {/* Hero Section */}
//       <section className="text-center py-20 px-4 max-w-4xl mx-auto flex flex-col items-center">
//         <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
//           Il Futuro della Scienza è Tokenizzato.
//         </h1>
//         <p className="text-xl md:text-2xl text-gray-300 font-light mb-8">
//           Benvenuto su DnA, il marketplace che trasforma la ricerca scientifica in asset digitali unici e verificabili.
//         </p>
//         <div className="flex flex-col sm:flex-row justify-center gap-4">
//           <Link href="/marketplace" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-full transition-colors shadow-lg">
//             Esplora il Marketplace
//           </Link>
//           <Link href="/register-content" className="bg-transparent border-2 border-gray-400 hover:border-blue-400 text-gray-300 hover:text-blue-400 font-semibold py-3 px-8 rounded-full transition-colors">
//             Crea il tuo NFT
//           </Link>
//         </div>

//         {/* Lottie Animation (Team Focus) */}
//         {/* L'animazione è posizionata qui, sotto i pulsanti */}
//         <div className="mt-8 w-full flex justify-center transform transition-transform duration-300 hover:scale-110">
//           <div className="w-2/3 md:w-1/2 lg:w-1/3 max-w-[280px]">
//             <Player
//               autoplay
//               loop
//               src={teamFocusAnimation}
//               className="w-full h-auto"
//             />
//           </div>
//         </div>
//       </section>

//       {/* Features Section */}
//       <section className="bg-gray-800 w-full py-20 px-4">
//         <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
//           <div className="flex flex-col items-center p-6 bg-gray-700 rounded-xl shadow-lg transform transition-transform hover:scale-105">
//             <BiLayer className="text-5xl text-blue-400 mb-4" />
//             <h3 className="text-2xl font-bold mb-2">Trasparenza Assoluta</h3>
//             <p className="text-gray-400">
//               Ogni contenuto scientifico è registrato in modo immutabile sulla blockchain, garantendo provenienza e proprietà.
//             </p>
//           </div>
//           <div className="flex flex-col items-center p-6 bg-gray-700 rounded-xl shadow-lg transform transition-transform hover:scale-105">
//             <BiDollar className="text-5xl text-blue-400 mb-4" />
//             <h3 className="text-2xl font-bold mb-2">Nuove Opportunità</h3>
//             <p className="text-gray-400">
//               Monetizza il tuo lavoro di ricerca o supporta i progetti che ami, creando un ecosistema di valore.
//             </p>
//           </div>
//           <div className="flex flex-col items-center p-6 bg-gray-700 rounded-xl shadow-lg transform transition-transform hover:scale-105">
//             <BiNetworkChart className="text-5xl text-blue-400 mb-4" />
//             <h3 className="text-2xl font-bold mb-2">Connessione Globale</h3>
//             <p className="text-gray-400">
//               Una community di scienziati, ricercatori e appassionati connessi da una visione comune di innovazione.
//             </p>
//           </div>
//         </div>
//       </section>

//       {/* Final CTA Section */}
//       <section className="text-center py-20 px-4">
//         <h2 className="text-3xl font-bold mb-4">
//           Pronto a Rivoluzionare la Ricerca?
//         </h2>
//         <p className="text-lg text-gray-400 mb-6">
//           Unisciti a noi e contribuisci a costruire un futuro della scienza aperto e accessibile a tutti.
//         </p>
//         <Link href="/explore" className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-full transition-colors shadow-lg">
//           Inizia Ora
//         </Link>
//       </section>
      
//     </div>
//   );
// }
