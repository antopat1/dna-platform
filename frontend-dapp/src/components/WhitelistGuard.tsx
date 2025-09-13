// src/components/WhitelistGuard.tsx
'use client'


import { useRouter } from 'next/navigation'
import { useAccount, useReadContract } from 'wagmi'
import {
  SCIENTIFIC_CONTENT_REGISTRY_ABI,
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
} from '@/lib/constants'

interface WhitelistGuardProps {
  children: React.ReactNode
}

export default function WhitelistGuard({ children }: WhitelistGuardProps) {
  const router = useRouter()
  const { address, isConnected } = useAccount()

  const { 
    data: isWhitelisted, 
    isLoading: isChecking, 
    error 
  } = useReadContract({
    address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
    abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
    functionName: 'isAuthorWhitelisted',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    }
  })

  // Se non è connesso, reindirizza alla home
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Wallet non connesso
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Connetti il tuo wallet per accedere a questa sezione
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Torna alla Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Mentre sta controllando
  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Controllo autorizzazioni...
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Verifico se sei autorizzato a registrare contenuti
          </p>
        </div>
      </div>
    )
  }

  // Errore nella verifica
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="rounded-full h-12 w-12 bg-red-100 mx-auto flex items-center justify-center">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Errore di connessione
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Non riesco a verificare il tuo stato di autorizzazione
            </p>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Riprova
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Torna alla Home
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Non è in whitelist
  if (!isWhitelisted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="rounded-full h-12 w-12 bg-red-100 mx-auto flex items-center justify-center">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Accesso non autorizzato
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Il tuo indirizzo <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{address}</code> non è autorizzato a registrare contenuti scientifici.
            </p>
          </div>

          <div className="mt-8 space-y-4">
           
           <button
              onClick={() => router.push('/apply-for-whitelist')}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Valutazione candidatura e accredito immediato by Agente AI
            </button>

            <button
              onClick={() => router.push('/auth/request-whitelist')}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-pink-300 hover:bg-pink-400"
            >
              Richiedi al Team controllo umano tramite Form 
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Ricontrolla Stato
            </button>
            
            

            <button
              onClick={() => router.push('/')}
              className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Torna alla Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Utente autorizzato - mostra il contenuto
  return <>{children}</>
}