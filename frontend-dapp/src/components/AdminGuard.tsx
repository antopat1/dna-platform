// src/components/AdminGuard.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useUserRole } from '@/hooks/useUserRole'
import { useAccount } from 'wagmi'

interface AdminGuardProps {
  children: React.ReactNode
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter()
  const { address } = useAccount()
  const { isAdmin, isLoading, isConnected, isError } = useUserRole()

  // 1. Stato di caricamento: mentre verifichiamo il ruolo
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <h2 className="mt-6 text-2xl font-bold text-gray-900">
          Verifica Ruolo Amministratore...
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Attendere prego, stiamo controllando le tue autorizzazioni.
        </p>
      </div>
    )
  }

  // 2. Wallet non connesso
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Wallet non Connesso
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Devi connettere il tuo wallet per accedere alla sezione Admin.
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 w-full max-w-xs flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          Torna alla Home
        </button>
      </div>
    )
  }

  // 3. Errore durante la verifica
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="rounded-full h-12 w-12 bg-red-100 mx-auto flex items-center justify-center">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        </div>
        <h2 className="mt-6 text-2xl font-bold text-gray-900">
          Errore di Verifica
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Impossibile verificare il tuo ruolo. Controlla la connessione e riprova.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 w-full max-w-xs flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          Riprova
        </button>
      </div>
    )
  }

  // 4. Utente connesso ma NON amministratore
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
         <div className="rounded-full h-12 w-12 bg-red-100 mx-auto flex items-center justify-center">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
        <h2 className="mt-6 text-2xl font-bold text-gray-900">
          Accesso Negato
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          L'indirizzo <code className="bg-gray-200 px-2 py-1 rounded text-xs font-mono">{address}</code> non dispone dei privilegi di amministratore.
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 w-full max-w-xs flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          Torna alla Home
        </button>
      </div>
    )
  }

  // 5. Utente autorizzato: mostra il contenuto delle pagine admin
  return <>{children}</>
}