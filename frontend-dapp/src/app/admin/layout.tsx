// frontend-dapp/src/app/admin/layout.tsx
'use client'; 

import React from 'react';
import Link from 'next/link';
import AdminGuard from '@/components/AdminGuard'; 

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      
      <aside className="w-64 bg-gray-800 text-white p-4">
        <h2 className="text-2xl font-bold mb-6">DnA Admin</h2>
        <nav>
          <ul>
            <li className="mb-2">
              <Link href="/admin/templates" className="block p-2 rounded hover:bg-gray-700">
                NFT Templates
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/admin/authors" className="block p-2 rounded hover:bg-gray-700">
                Whitelisted Authors
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/dashboard/register-content" className="block p-2 rounded hover:bg-gray-700">
                Register & Mint
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/admin/withdraw-funds" className="block p-2 rounded hover:bg-gray-700">
                Ritira commissioni
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/admin/grant-role" className="block p-2 rounded hover:bg-gray-700">
                Eleggi Amministratore Piattaforma
              </Link>
            </li>
          </ul>
        </nav>
      </aside>

      
      <main className="flex-1 p-8 bg-gray-100">
        <AdminGuard>
          {children}
        </AdminGuard>
      </main>
    </div>
  );
}
