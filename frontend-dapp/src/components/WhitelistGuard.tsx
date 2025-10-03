'use client';

import { useRouter } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { SCIENTIFIC_CONTENT_REGISTRY_ABI, SCIENTIFIC_CONTENT_REGISTRY_ADDRESS } from '@/lib/constants';
import { GuardStatusScreen } from './GuardStatusScreen'; // Importa il nuovo componente

interface WhitelistGuardProps {
  children: React.ReactNode;
}

export default function WhitelistGuard({ children }: WhitelistGuardProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const { data: isWhitelisted, isLoading: isChecking, error } = useReadContract({
    address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
    abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
    functionName: 'isAuthorWhitelisted',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });


  if (!isConnected) {
    return (
      <GuardStatusScreen
        iconType="denied"
        title="Wallet non connesso"
        message="Connetti il tuo wallet per accedere a questa sezione."
        actions={
          <button
            onClick={() => router.push('/')}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Torna alla Home
          </button>
        }
      />
    );
  }


  if (isChecking) {
    return (
      <GuardStatusScreen
        iconType="loading"
        title="Controllo autorizzazioni..."
        message="Verifico se sei autorizzato a registrare contenuti."
      />
    );
  }


  if (error) {
    return (
      <GuardStatusScreen
        iconType="error"
        title="Errore di connessione"
        message="Non riesco a verificare il tuo stato di autorizzazione."
        actions={
          <>
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
          </>
        }
      />
    );
  }


  if (!isWhitelisted) {
    return (
      <GuardStatusScreen
        iconType="denied"
        title="Accesso non autorizzato"
        message={
          <>
            Il tuo indirizzo <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{address}</code> non è autorizzato a registrare contenuti scientifici.
          </>
        }
        actions={
          <>
            <button
              onClick={() => router.push('/apply-for-whitelist')}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Valutazione candidatura e accredito immediato by Agente AI
            </button>
            <button
              onClick={() => router.push('/auth/request-whitelist')}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-pink-300 hover:bg-pink-400"
            >
              Richiedi al Team controllo umano tramite Form
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Ricontrolla Stato
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Torna alla Home
            </button>
          </>
        }
      />
    );
  }


  return <>{children}</>;
}
