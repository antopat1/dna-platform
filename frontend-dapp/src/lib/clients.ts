// frontend-dapp/src/lib/clients.ts
import { createPublicClient, http, PublicClient } from 'viem';

const arbitrumSepolia = {
  id: 421614, 
  name: 'Arbitrum Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://sepolia-rollup.arbitrum.io/rpc'], 
    },
  },
  blockExplorers: {
    default: {
      name: 'Arbiscan',
      url: 'https://sepolia.arbiscan.io', 
    },
  },
  testnet: true,
} as const; 


const activeChain = arbitrumSepolia;


export function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: activeChain,
    transport: http(process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL), 
  });
}