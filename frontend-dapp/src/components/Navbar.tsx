'use client';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { EventFeedNavbar } from './EventFeed';

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center bg-gray-500 text-white p-4 shadow-md sticky top-0 z-50 w-full shrink-0">
      <div className="flex items-center space-x-4">
        <Link href="/" className="text-2xl font-bold text-purple-400 hover:text-purple-300 transition-colors">
          DnA Platform
        </Link>
        <div className="space-x-4 text-lg">
          <Link href="/registered-content" className="hover:text-purple-300 transition-colors">
            Contenuti Registrati
          </Link>
          <Link href="/admin" className="hover:text-purple-300 transition-colors">
            Admin
          </Link>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        {/* Container per EventFeedNavbar con tooltip */}
        <div className="relative group">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-purple-200 hidden sm:inline">Live Events</span>
            <EventFeedNavbar />
          </div>
          {/* Tooltip descrittivo */}
          <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-3 py-2 bg-black text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 whitespace-nowrap z-40">
            <div className="text-center">
              <div className="font-semibold">Eventi in Tempo Reale</div>
              <div className="text-gray-300">WebSocket + Redis</div>
            </div>
            {/* Freccia del tooltip */}
            <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-black"></div>
          </div>
        </div>
        <ConnectButton showBalance={true} />
      </div>
    </nav>
  );
}


// 'use client';

// import Link from 'next/link';
// import { ConnectButton } from '@rainbow-me/rainbowkit';

// export default function Navbar() {
//   return (
//     <nav className="flex justify-between items-center bg-gray-500 text-white p-4 shadow-md sticky top-0 z-50 w-full shrink-0">
//       <div className="flex items-center space-x-4">
//         <Link href="/" className="text-2xl font-bold text-purple-400 hover:text-purple-300 transition-colors">
//           DnA Platform
//         </Link>
//         <div className="space-x-4 text-lg">
//           <Link href="/registered-content" className="hover:text-purple-300 transition-colors">
//             Contenuti
//           </Link>
//           <Link href="/admin/templates" className="hover:text-purple-300 transition-colors">
//             Admin
//           </Link>
//         </div>
//       </div>
//       <div className="flex items-center space-x-4">
//         <ConnectButton showBalance={true} />
//       </div>
//     </nav>
//   );
// }



