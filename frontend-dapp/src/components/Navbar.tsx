'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center bg-gray-500 text-white p-4 shadow-md sticky top-0 z-50 w-full shrink-0">
      <div className="flex items-center space-x-4">
        <Link href="/" className="text-2xl font-bold text-purple-400 hover:text-purple-300 transition-colors">
          DnA Platform
        </Link>
        <div className="space-x-4 text-lg">
          <Link href="/registered-content" className="hover:text-purple-300 transition-colors">
            Contenuti
          </Link>
          <Link href="/admin/templates" className="hover:text-purple-300 transition-colors">
            Admin
          </Link>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <ConnectButton showBalance={true} />
      </div>
    </nav>
  );
}



