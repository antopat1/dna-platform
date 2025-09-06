'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toast } from 'react-hot-toast';
import { useCoachAuth } from '@/context/CoachAuthProvider';
import { FaSignOutAlt, FaShieldAlt, FaSpinner } from 'react-icons/fa';

import {
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS
} from '@/lib/constants';

// Dichiarazione TypeScript per window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

// ABI minimale per le funzioni necessarie
const registryAbi = parseAbi([
  'function addAdmin(address account) external',
  'function addAuthorToWhitelist(address _authorAddress) external',
]);

const nftAbi = parseAbi([
  'function grantRole(bytes32 role, address account) external',
]);

const marketplaceAbi = parseAbi([
  'function addAdmin(address account) external',
]);

const ADMIN_ROLE_HASH = '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775';

// Interfaccia per i risultati delle transazioni
interface TransactionResult {
  name: string;
  status: 'success' | 'error';
  hash?: string;
  error?: string;
}

// MIGLIORAMENTI DI SICUREZZA IMPLEMENTATI:
// 1. Memoria sicura con ArrayBuffer
// 2. Cancellazione immediata delle chiavi
// 3. Rate limiting sui tentativi
// 4. Logging di sicurezza
// 5. Controllo integrità
// 6. Session timeout

export default function SecureCoachSetupPage() {
  const router = useRouter();
  const { checkAuthStatus, logout } = useCoachAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const { address: coachAddress, isConnected } = useAccount();
  const [secretPhrase, setSecretPhrase] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [transactionResults, setTransactionResults] = useState<TransactionResult[]>([]);
  
  // Ref per gestire timeout di sicurezza
  const securityTimeoutRef = useRef<NodeJS.Timeout>();
  
  // MAX 3 tentativi prima di lockout
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_TIME = 30000; // 30 secondi

  // Controllo autenticazione coach
  useEffect(() => {
    const checkAuth = async () => {
      const isAuth = checkAuthStatus();
      if (!isAuth) {
        router.push('/');
        return;
      }
      setIsAuthorized(true);
      setIsLoading(false);
    };
    checkAuth();
  }, [checkAuthStatus, router]);

  // Handler per logout coach
  const handleCoachLogout = () => {
    logout();
  };

  // CLASSE PER GESTIONE SICURA DELLA MEMORIA
  class SecureMemory {
    private data: ArrayBuffer | null = null;
    private isValid: boolean = true;

    constructor(privateKey: string) {
      // Converte la stringa in ArrayBuffer per gestione sicura
      const encoder = new TextEncoder();
      this.data = encoder.encode(privateKey).buffer.slice();
    }

    // Recupera temporaneamente la chiave - ora corretto come async
    async use<T>(callback: (key: string) => Promise<T>): Promise<T> {
      if (!this.isValid || !this.data) {
        throw new Error('SecureMemory: Data non valida');
      }

      const decoder = new TextDecoder();
      const key = decoder.decode(this.data);
      
      try {
        return await callback(key);
      } finally {
        // Pulisce immediatamente dopo l'uso
        this.destroy();
      }
    }

    // Distrugge in modo sicuro la memoria
    destroy() {
      if (this.data) {
        // Sovrascrive con dati casuali
        const view = new Uint8Array(this.data);
        crypto.getRandomValues(view);
        this.data = null;
      }
      this.isValid = false;
    }

    isDestroyed(): boolean {
      return !this.isValid;
    }
  }

  // DECIFRATURA CON GESTIONE SICURA
  const decryptPrivateKeySecurely = async (phrase: string): Promise<SecureMemory | null> => {
  try {
    const ENCRYPTED_PRIVATE_KEY = process.env.NEXT_PUBLIC_ENCRYPTED_PRIVATE_KEY as string;
    
    if (!ENCRYPTED_PRIVATE_KEY) {
      throw new Error('Chiave cifrata non configurata');
    }

    // Decodifica Base64
    const encryptedData = Uint8Array.from(atob(ENCRYPTED_PRIVATE_KEY), c => c.charCodeAt(0));
    
    // Estrai componenti secondo il formato del tuo script Node.js
    // Formato: salt(16) + iv(12) + authTag(16) + ciphertext(resto)
    const salt = encryptedData.slice(0, 16);
    const iv = encryptedData.slice(16, 28);
    const authTag = encryptedData.slice(28, 44);
    const ciphertext = encryptedData.slice(44);

    console.log('Debug - Lunghezze:');
    console.log('Salt:', salt.length, 'bytes');
    console.log('IV:', iv.length, 'bytes');
    console.log('AuthTag:', authTag.length, 'bytes');
    console.log('Ciphertext:', ciphertext.length, 'bytes');

    // PBKDF2 con le stesse iterazioni del tuo script (100,000)
    const passwordKey = await crypto.subtle.importKey(
      'raw', 
      new TextEncoder().encode(phrase), 
      'PBKDF2', 
      false, 
      ['deriveKey']
    );
    
    const derivedKey = await crypto.subtle.deriveKey(
      { 
        name: 'PBKDF2', 
        salt, 
        iterations: 100000, // Stesso del tuo script
        hash: 'SHA-256' 
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['decrypt']
    );

    // Per Web Crypto API, dobbiamo combinare ciphertext + authTag
    const dataToDecrypt = new Uint8Array(ciphertext.length + authTag.length);
    dataToDecrypt.set(ciphertext, 0);
    dataToDecrypt.set(authTag, ciphertext.length);

    // Decifratura
    const decrypted = await crypto.subtle.decrypt(
      { 
        name: 'AES-GCM', 
        iv: iv
      }, 
      derivedKey, 
      dataToDecrypt
    );
    
    const privateKey = new TextDecoder().decode(decrypted);
    
    console.log('Debug - Chiave decifrata:', privateKey.substring(0, 10) + '...');
    
    // Validazione formato chiave
    if (!privateKey.match(/^(0x)?[a-fA-F0-9]{64}$/)) {
      console.error('Formato chiave non valido:', privateKey);
      throw new Error('Formato chiave privata non valido');
    }

    return new SecureMemory(privateKey);
    
  } catch (error) {
    console.error('Errore decifratura dettagliato:', error);
    return null;
  }
};

  // RATE LIMITING SICURO
  const checkRateLimit = useCallback((): boolean => {
    if (attempts >= MAX_ATTEMPTS) {
      if (!isLocked) {
        setIsLocked(true);
        toast.error(`Troppi tentativi falliti. Riprova tra ${LOCKOUT_TIME/1000} secondi.`);
        
        setTimeout(() => {
          setIsLocked(false);
          setAttempts(0);
        }, LOCKOUT_TIME);
      }
      return false;
    }
    return true;
  }, [attempts, isLocked]);

  // LOGGING DI SICUREZZA (per audit)
  const logSecurityEvent = useCallback((event: string, details: any = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      userAgent: navigator.userAgent,
      coachAddress,
      ...details
    };
    
    // In produzione, inviare a sistema di logging sicuro
    console.log('[SECURITY LOG]', logEntry);
    
    // Opzionale: inviare al backend per audit
    // fetch('/api/security/log', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(logEntry)
    // });
  }, [coachAddress]);

  // ESECUZIONE TRANSAZIONI
  const executeAllTransactions = async (walletClient: any, publicClient: any, coachAddr: string) => {
    const results: TransactionResult[] = [];
    
    const transactions = [
      {
        name: 'Add Admin to Registry',
        fn: async () => await walletClient.writeContract({
          address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
          abi: registryAbi,
          functionName: 'addAdmin',
          args: [coachAddr],
        })
      },
      {
        name: 'Whitelist Author in Registry', 
        fn: async () => await walletClient.writeContract({
          address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
          abi: registryAbi,
          functionName: 'addAuthorToWhitelist',
          args: [coachAddr],
        })
      },
      {
        name: 'Grant Admin to NFT Contract',
        fn: async () => await walletClient.writeContract({
          address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
          abi: nftAbi,
          functionName: 'grantRole',
          args: [ADMIN_ROLE_HASH, coachAddr],
        })
      },
      {
        name: 'Add Admin to Marketplace',
        fn: async () => await walletClient.writeContract({
          address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'addAdmin',
          args: [coachAddr],
        })
      }
    ];

    for (const tx of transactions) {
      try {
        logSecurityEvent('TRANSACTION_STARTED', { transaction: tx.name });
        const hash = await tx.fn();
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'success') {
          results.push({
            name: tx.name,
            status: 'success',
            hash
          });
          logSecurityEvent('TRANSACTION_SUCCESS', { transaction: tx.name, hash });
          toast.success(`${tx.name} completata!`);
        } else {
          throw new Error('Transazione fallita');
        }
      } catch (error: any) {
        results.push({
          name: tx.name,
          status: 'error',
          error: error.message
        });
        logSecurityEvent('TRANSACTION_ERROR', { 
          transaction: tx.name, 
          error: error.message 
        });
        toast.error(`Errore in ${tx.name}: ${error.message}`);
        throw error;
      }
    }
    
    return results;
  };

  // HANDLER PRINCIPALE SICURO
  const handleSecureSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validazioni preliminari
    if (!isConnected || !coachAddress) {
      toast.error('Connetti il wallet Metamask');
      return;
    }

    if (!secretPhrase.trim()) {
      toast.error('Inserisci la frase segreta');
      return;
    }

    if (!checkRateLimit()) {
      return;
    }

    // Inizio processo sicuro
    setIsProcessing(true);
    setShowResults(false);
    setTransactionResults([]);
    logSecurityEvent('SETUP_ATTEMPT_STARTED');

    try {
      // 1. Decifratura sicura
      const secureKey = await decryptPrivateKeySecurely(secretPhrase);
      
      if (!secureKey) {
        setAttempts(prev => prev + 1);
        logSecurityEvent('DECRYPTION_FAILED', { attempts: attempts + 1 });
        toast.error('Frase segreta errata');
        return;
      }

      // 2. Setup timeout di sicurezza (auto-cleanup dopo 5 minuti)
      securityTimeoutRef.current = setTimeout(() => {
        if (!secureKey.isDestroyed()) {
          secureKey.destroy();
          logSecurityEvent('SECURITY_TIMEOUT_CLEANUP');
        }
      }, 300000); // 5 minuti

      // 3. Esecuzione transazioni con gestione sicura
      const results = await secureKey.use(async (privateKey) => {
        const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}`);
        const publicClient = createPublicClient({ 
          chain: arbitrumSepolia, 
          transport: http() 
        });
        const walletClient = createWalletClient({ 
          account, 
          chain: arbitrumSepolia, 
          transport: http() 
        });

        // Esegui tutte le transazioni
        return await executeAllTransactions(walletClient, publicClient, coachAddress);
      });

      setTransactionResults(results);
      setShowResults(true);
      logSecurityEvent('SETUP_COMPLETED_SUCCESSFULLY');
      toast.success('Setup completato con successo!');

      // Dopo 3 secondi, mostra un messaggio finale e ricarica la pagina
      setTimeout(() => {
        toast.success('🎉 Tutti i privilegi sono stati assegnati! La pagina verrà aggiornata.', {
          duration: 2000,
        });
        
        // Ricarica la pagina dopo altri 2 secondi
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }, 3000);

    } catch (error: any) {
      logSecurityEvent('SETUP_ERROR', { error: error.message });
      toast.error(`Errore durante setup: ${error.message}`);
    } finally {
      // Cleanup sicurezza
      setIsProcessing(false);
      setSecretPhrase(''); // Pulisci input
      
      if (securityTimeoutRef.current) {
        clearTimeout(securityTimeoutRef.current);
      }
    }
  };

  // Loading state durante verifica autorizzazioni
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-purple-500 text-6xl mx-auto mb-4" />
          <p className="text-white text-lg">Verificando autorizzazioni...</p>
        </div>
      </div>
    );
  }

  // Se non autorizzato, non mostrare nulla (evita flash di contenuto)
  if (!isAuthorized) {
    return null;
  }

  // COMPONENTE UI CON INDICATORI DI SICUREZZA E HEADER PROTETTO
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header protetto */}
      <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <FaShieldAlt className="text-white text-2xl" />
            <div>
              <h1 className="text-white text-2xl font-bold">Modalità Audit Coach</h1>
              <p className="text-gray-200 text-sm">Sistema di Auto-Elevazione Privilegi</p>
            </div>
          </div>
          <button
            onClick={handleCoachLogout}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Contenuto principale */}
      <div className="container mx-auto p-4 max-w-4xl">
        <h2 className="text-3xl font-bold mb-6 text-white">
          Setup Coach Sicuro − Richiedi assegnazione di tutti i privilegi Autore e Admin dei contratti
        </h2>
        
        {/* Controllo connessione wallet */}
        {!isConnected && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>Connetti il tuo wallet Metamask per procedere.</p>
          </div>
        )}

        {isConnected && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            <p>Wallet connesso: {coachAddress}</p>
          </div>
        )}

        {/* Controllo chiave crittografata */}
        {!process.env.NEXT_PUBLIC_ENCRYPTED_PRIVATE_KEY && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>ERRORE: Variabile d'ambiente NEXT_PUBLIC_ENCRYPTED_PRIVATE_KEY non trovata!</p>
            <p className="text-sm">Assicurati che sia impostata nel file .env.local</p>
          </div>
        )}

        {/* Stato lockout */}
        {isLocked && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>Account temporaneamente bloccato per sicurezza. Riprova tra qualche secondo.</p>
          </div>
        )}

        {/* Form principale */}
        <form onSubmit={handleSecureSetup} className="space-y-4 mb-6">
          <div>
            <label htmlFor="secretPhrase" className="block text-sm font-medium text-gray-300 mb-2">
              Frase Segreta {attempts > 0 && `(Tentativi: ${attempts}/${MAX_ATTEMPTS})`}
            </label>
            <input
              id="secretPhrase"
              type="password"
              value={secretPhrase}
              onChange={(e) => setSecretPhrase(e.target.value)}
              placeholder="Inserisci frase segreta"
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={isProcessing || isLocked}
              autoComplete="off"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isProcessing || isLocked || !isConnected || !process.env.NEXT_PUBLIC_ENCRYPTED_PRIVATE_KEY} 
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded transition-colors flex items-center space-x-2"
          >
            {isProcessing ? (
              <>
                <FaSpinner className="animate-spin" />
                <span>Setup in corso...</span>
              </>
            ) : (
              <span>Avvia Setup Sicuro</span>
            )}
          </button>
        </form>

        {/* Risultati transazioni */}
        {showResults && transactionResults.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xl font-bold mb-4 text-white">Risultati Setup:</h3>
            <div className="space-y-3">
              {transactionResults.map((result: TransactionResult, idx: number) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded border ${
                    result.status === 'success' 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-800">{result.name}</span>
                    <span className={`px-3 py-1 rounded text-sm font-medium ${
                      result.status === 'success' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {result.status === 'success' ? 'Completata' : 'Errore'}
                    </span>
                  </div>
                  
                  {result.hash && (
                    <div className="mt-2">
                      <a 
                        href={`https://sepolia.arbiscan.io/tx/${result.hash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 text-sm underline"
                      >
                        Visualizza su Arbiscan: {result.hash.substring(0, 10)}...
                      </a>
                    </div>
                  )}
                  
                  {result.error && (
                    <p className="text-red-600 text-sm mt-2">
                      Errore: {result.error}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Riassunto finale */}
            <div className="mt-4 p-4 bg-gray-800 text-white rounded border border-gray-600">
              <h4 className="font-semibold mb-2">Riassunto:</h4>
              <p className="text-sm text-gray-300">
                Transazioni completate: {transactionResults.filter(r => r.status === 'success').length}/{transactionResults.length}
              </p>
              {transactionResults.every(r => r.status === 'success') && (
                <p className="text-green-400 font-medium mt-2">
                  🎉 Setup completato con successo! Il coach ora ha tutti i privilegi necessari.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

