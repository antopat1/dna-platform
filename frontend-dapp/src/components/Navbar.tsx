// frontend-dapp/src/components/Navbar.tsx
'use client';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { EventFeedNavbar } from './EventFeed';
import { useUserRole } from '@/hooks/useUserRole';
import { CoachAuditButton } from './CoachAuditButton';
import { FaBars } from "react-icons/fa";

export default function Navbar() {
  const { isAdmin, isAuthor, isConnected } = useUserRole();

  // Definisci la lista dei link visibili solo quando l'utente è connesso
  const connectedLinks = [
    { href: "/registered-content", label: "Contenuti Registrati" },
    { href: "/my-nfts", label: "NFT Posseduti" },
  ];

  // Aggiungi i link specifici per il ruolo
  if (isAdmin) {
    connectedLinks.push({ href: "/admin", label: "Pannello Admin" });
  }
  if (isAuthor) {
    connectedLinks.push({ href: "/dashboard/register-content", label: "Crea Contenuto" });
  }

  // Testo dinamico che appare al centro solo quando l'utente è connesso
  const userRoleText = () => {
    if (!isConnected) {
      return null;
    }
    if (isAdmin) {
      return "Benvenuto Admin";
    }
    if (isAuthor) {
      return "Benvenuto Autore";
    }
    return "Benvenuto Utente Standard";
  };
  
  return (
    <nav className="flex justify-between items-center bg-gray-500 text-white p-4 shadow-md sticky top-0 z-50 w-full shrink-0">
      <div className="flex items-center h-full relative group min-w-[200px]">
        <Link href="/" className="flex items-center space-x-2 text-2xl font-bold text-purple-400 hover:text-purple-300 transition-colors z-10 pr-2">
          <span>DnA Platform</span>
          <FaBars className="text-xl animate-pulse" />
        </Link>
        
        {/* Coach Audit Button - visible to everyone */}
        <div className="ml-3">
          <CoachAuditButton />
        </div>
        
        {/* Container per i link del menu a scomparsa */}
        <div className="absolute left-0 bottom-0 transform translate-y-full p-4 bg-gray-500 rounded-b-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 whitespace-nowrap z-20">
          <div className="flex flex-col space-y-2 text-lg">
            {connectedLinks.map(link => (
              <Link key={link.href} href={link.href} className="hover:text-purple-300 transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Testo centrale, visibile solo quando l'utente è connesso */}
      <div className="flex-1 text-center font-semibold text-lg hidden md:block">
        {userRoleText()}
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative group">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-purple-200 hidden sm:inline">Live Events</span>
            <EventFeedNavbar />
          </div>
          <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-3 py-2 bg-black text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 whitespace-nowrap z-40">
            <div className="text-center">
              <div className="font-semibold">Eventi in Tempo Reale</div>
              <div className="text-gray-300">WebSocket + Redis</div>
            </div>
            <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-black"></div>
          </div>
        </div>
        <ConnectButton showBalance={true} />
      </div>
    </nav>
  );
}

// // frontend-dapp/src/components/Navbar.tsx
// 'use client';
// import Link from 'next/link';
// import { ConnectButton } from '@rainbow-me/rainbowkit';
// import { EventFeedNavbar } from './EventFeed';
// import { useUserRole } from '@/hooks/useUserRole';
// import { FaBars } from "react-icons/fa";

// export default function Navbar() {
//   const { isAdmin, isAuthor, isConnected } = useUserRole();

//   // Definisci la lista dei link visibili solo quando l'utente è connesso
//   const connectedLinks = [
//     { href: "/registered-content", label: "Contenuti Registrati" },
//     { href: "/my-nfts", label: "NFT Posseduti" },
//   ];

//   // Aggiungi i link specifici per il ruolo
//   if (isAdmin) {
//     connectedLinks.push({ href: "/admin", label: "Pannello Admin" });
//   }
//   if (isAuthor) {
//     connectedLinks.push({ href: "/dashboard/register-content", label: "Crea Contenuto" });
//   }

//   // Testo dinamico che appare al centro solo quando l'utente è connesso
//   const userRoleText = () => {
//     if (!isConnected) {
//       return null;
//     }
//     if (isAdmin) {
//       return "Benvenuto Admin";
//     }
//     if (isAuthor) {
//       return "Benvenuto Autore";
//     }
//     return "Benvenuto Utente Standard";
//   };
  
//   return (
//     <nav className="flex justify-between items-center bg-gray-500 text-white p-4 shadow-md sticky top-0 z-50 w-full shrink-0">
//       <div className="flex items-center h-full relative group min-w-[200px]">
//         <Link href="/" className="flex items-center space-x-2 text-2xl font-bold text-purple-400 hover:text-purple-300 transition-colors z-10 pr-2">
//           <span>DnA Platform</span>
//           <FaBars className="text-xl animate-pulse" />
//         </Link>
        
//         {/* Container per i link del menu a scomparsa */}
//         <div className="absolute left-0 bottom-0 transform translate-y-full p-4 bg-gray-500 rounded-b-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 whitespace-nowrap z-20">
//           <div className="flex flex-col space-y-2 text-lg">
//             {connectedLinks.map(link => (
//               <Link key={link.href} href={link.href} className="hover:text-purple-300 transition-colors">
//                 {link.label}
//               </Link>
//             ))}
//           </div>
//         </div>
//       </div>

//       {/* Testo centrale, visibile solo quando l'utente è connesso */}
//       <div className="flex-1 text-center font-semibold text-lg hidden md:block">
//         {userRoleText()}
//       </div>

//       <div className="flex items-center space-x-4">
//         <div className="relative group">
//           <div className="flex items-center space-x-2">
//             <span className="text-xs text-purple-200 hidden sm:inline">Live Events</span>
//             <EventFeedNavbar />
//           </div>
//           <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-3 py-2 bg-black text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 whitespace-nowrap z-40">
//             <div className="text-center">
//               <div className="font-semibold">Eventi in Tempo Reale</div>
//               <div className="text-gray-300">WebSocket + Redis</div>
//             </div>
//             <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-black"></div>
//           </div>
//         </div>
//         <ConnectButton showBalance={true} />
//       </div>
//     </nav>
//   );
// }





