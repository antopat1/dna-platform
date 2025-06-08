// frontend-dapp/src/components/ContractTestViem.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAccount, useConnect, useReadContract, useSwitchChain } from 'wagmi';
import { metaMask } from 'wagmi/connectors';
import {
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
  SCIENTIFIC_CONTENT_REGISTRY_ABI,
  ARBITRUM_SEPOLIA_CHAIN_ID,
} from '@/lib/constants';
import { arbitrumSepolia } from 'wagmi/chains';

const ContractTestViem: React.FC = () => {
  // Wagmi Hooks per gestione account, connessione e catena
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const { switchChain } = useSwitchChain();
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false); // Nuovo stato per l'idratazione

  // useReadContract: Hook per chiamate di sola lettura su smart contract
  const { data: contentData, isLoading, error: readError } = useReadContract({
    abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
    address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
    functionName: 'getContent',
    args: [BigInt(1)],
    chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
    query: {
        enabled: isConnected && chainId === ARBITRUM_SEPOLIA_CHAIN_ID,
    },
  });

  // Questo useEffect si esegue solo sul client, dopo il montaggio
  useEffect(() => {
    setMounted(true); // Imposta mounted a true una volta che il componente è sul client
  }, []);

  useEffect(() => {
    if (!mounted) return; // Non eseguire questo blocco finché non è montato

    if (!isConnected) {
      setError("Connetti il tuo wallet MetaMask.");
    } else if (chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
      setError(`Sei connesso a Chain ID: ${chainId}. Clicca qui sotto per passare ad Arbitrum Sepolia.`);
    } else {
      setError(null);
    }

    if (readError) {
        console.error("Errore durante la lettura del contratto:", readError);
        if ((readError as any).message?.includes("Content does not exist")) {
            setError("Nessun contenuto di esempio (ID 1) trovato nel ScientificContentRegistry. Ma la connessione al contratto è valida.");
        } else {
            setError(`Errore di lettura contratto: ${(readError as any).message}`);
        }
    }
  }, [isConnected, chainId, readError, mounted]); // Aggiunto mounted come dipendenza

  const handleConnect = async () => {
    try {
      await connect({ connector: metaMask() });
    } catch (err: any) {
      setError(`Errore durante la connessione: ${err.message}`);
    }
  };

  const handleSwitchChain = () => {
    switchChain({ chainId: ARBITRUM_SEPOLIA_CHAIN_ID });
  };

  // Se il componente non è ancora montato sul client, non renderizzare il contenuto dinamico
  if (!mounted) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <p>Inizializzazione dApp...</p> {/* Mostra un placeholder molto generico */}
      </div>
    );
  }

  // Il resto del rendering avviene solo dopo che mounted è true
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#333' }}>Test di Connessione Smart Contract (Viem/Wagmi)</h2>

      {!isConnected ? (
        <button
          onClick={handleConnect}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            padding: '10px 15px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Connetti Wallet MetaMask
        </button>
      ) : (
        <>
          <p>Wallet Connesso: <strong style={{ color: '#007bff' }}>{address?.slice(0, 6)}...{address?.slice(-4)}</strong></p>
          {chainId !== ARBITRUM_SEPOLIA_CHAIN_ID ? (
            <p style={{ color: 'orange', fontWeight: 'bold' }}>
              Sei connesso a una rete sbagliata (Chain ID: {chainId}).{' '}
              <button
                onClick={handleSwitchChain}
                style={{
                  backgroundColor: '#ffc107',
                  color: 'black',
                  padding: '5px 10px',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  marginLeft: '10px',
                }}
              >
                Passa ad Arbitrum Sepolia
              </button>
            </p>
          ) : (
            <>
              {isLoading ? ( // Sposto isLoading qui, dentro al blocco "connesso alla rete giusta"
                <div>Caricamento dati dal contratto...</div>
              ) : (
                <>
                  <p>Rete: <strong style={{ color: '#28a745' }}>Arbitrum Sepolia</strong></p>
                  {error && <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>}
                  {contentData ? (
                    <p>
                      Contenuto con ID 1 dal Registry: <strong style={{ color: '#6f42c1' }}>{contentData.title}</strong>
                    </p>
                  ) : (
                    !error && <p>Nessun contenuto di esempio (ID 1) trovato o in attesa di dati.</p>
                  )}
                  <p style={{ color: '#555' }}>
                    Questo conferma che la tua dApp può comunicare con il contratto ScientificContentRegistry
                    e che Viem/Wagmi sono configurati correttamente.
                  </p>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ContractTestViem;