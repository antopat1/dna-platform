'use client';

import { useRouter } from 'next/navigation';
import { useUserRole } from '@/hooks/useUserRole';
import { useAccount } from 'wagmi';
import { GuardStatusScreen } from './GuardStatusScreen'; 

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const { address } = useAccount();
  const { isAdmin, isLoading, isConnected, isError } = useUserRole();

 
  if (isLoading) {
    return (
      <GuardStatusScreen
        iconType="loading"
        title="Verifica Ruolo Amministratore..."
        message="Attendere prego, stiamo controllando le tue autorizzazioni."
      />
    );
  }


  if (!isConnected) {
    return (
      <GuardStatusScreen
        iconType="denied"
        title="Wallet non Connesso"
        message="Devi connettere il tuo wallet per accedere alla sezione Admin."
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

 
  if (isError) {
    return (
      <GuardStatusScreen
        iconType="error"
        title="Errore di Verifica"
        message="Impossibile verificare il tuo ruolo. Controlla la connessione e riprova."
        actions={
          <button
            onClick={() => window.location.reload()}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Riprova
          </button>
        }
      />
    );
  }


  if (!isAdmin) {
    return (
      <GuardStatusScreen
        iconType="denied"
        title="Accesso Negato"
        message={
          <>
            L'indirizzo <code className="bg-gray-200 px-2 py-1 rounded text-xs font-mono">{address}</code> non dispone dei privilegi di amministratore.
          </>
        }
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


  return <>{children}</>;
}

