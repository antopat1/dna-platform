// frontend-dapp/src/hooks/useUserRole.tsx
'use client';

import { useAccount, useReadContract } from 'wagmi';
import { keccak256, toBytes } from 'viem';
import ScientificContentRegistryABI from '@/lib/abi/ScientificContentRegistry.json';


const SCIENTIFIC_CONTENT_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_REGISTRY_ADDRESS as `0x${string}` | undefined;
const abi = ScientificContentRegistryABI.abi;
const ADMIN_ROLE_HASH = keccak256(toBytes('ADMIN_ROLE'));

export const useUserRole = () => {
  const { address, isConnected } = useAccount();


  const { data: isAdmin, isLoading: isLoadingAdmin, isError: isAdminError } = useReadContract({
    abi: abi,
    address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
    functionName: 'hasRole',
    args: [ADMIN_ROLE_HASH, address!], 
    query: {
      enabled: isConnected && !!SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
    },
  });


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