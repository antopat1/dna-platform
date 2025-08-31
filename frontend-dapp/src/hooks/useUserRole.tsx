// frontend-dapp/src/hooks/useUserRole.tsx
'use client';

import { useAccount, useReadContract } from 'wagmi';
import { keccak256, toBytes } from 'viem';


// Importa l'ABI del tuo contratto ScientificContentRegistry
import ScientificContentRegistryABI from '@/lib/abi/ScientificContentRegistry.json';

// Utilizza la variabile d'ambiente pubblica in Next.js
const SCIENTIFIC_CONTENT_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_REGISTRY_ADDRESS as `0x${string}` | undefined;

// L'ABI è l'array di oggetti 'abi' all'interno del file JSON
const abi = ScientificContentRegistryABI.abi;

// Hash del ruolo di amministratore, calcolato in modo deterministico
const ADMIN_ROLE_HASH = keccak256(toBytes('ADMIN_ROLE'));

export const useUserRole = () => {
  const { address, isConnected } = useAccount();

  // Chiamata in lettura allo smart contract per verificare il ruolo di Admin
  const { data: isAdmin, isLoading: isLoadingAdmin, isError: isAdminError } = useReadContract({
    // Utilizza la variabile 'abi' che è tipizzata correttamente
    abi: abi,
    // Assicurati che l'indirizzo sia definito e nel formato corretto
    address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
    functionName: 'hasRole',
    args: [ADMIN_ROLE_HASH, address!], // L'operatore '!' serve a rassicurare TypeScript che 'address' non sarà undefined
    query: {
      enabled: isConnected && !!SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
    },
  });

  // Chiamata in lettura allo smart contract per verificare se l'utente è un autore in whitelist
  const { data: isAuthor, isLoading: isLoadingAuthor, isError: isAuthorError } = useReadContract({
    abi: abi,
    address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
    functionName: 'isAuthorWhitelisted',
    args: [address!],
    query: {
      enabled: isConnected && !!SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
    },
  });

  return {
    isAdmin: !!isAdmin,
    isAuthor: !!isAuthor,
    isLoading: isLoadingAdmin || isLoadingAuthor,
    isConnected,
    isError: isAdminError || isAuthorError,
  };
};