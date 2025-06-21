// frontend-dapp/src/lib/clients.ts
import { createPublicClient, http, PublicClient } from 'viem';
// Importa le chain che ti servono. Non usare mainnet, sepolia da viem/chains
// se stai puntando ad Arbitrum Sepolia.
// Dobbiamo definire Arbitrum Sepolia come una chain custom di Viem.

// Importa le chain standard se le usi altrove, ma per questo caso specifico
// ci serve Arbitrum Sepolia.
// import { mainnet, sepolia } from 'viem/chains'; // Rimuovi o commenta se non usate

// Definisci Arbitrum Sepolia come un oggetto Chain per Viem
const arbitrumSepolia = {
  id: 421614, // Questo è il Chain ID di Arbitrum Sepolia come da hardhat.config.ts
  name: 'Arbitrum Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://sepolia-rollup.arbitrum.io/rpc'], // URL RPC di Arbitrum Sepolia
    },
  },
  blockExplorers: {
    default: {
      name: 'Arbiscan',
      url: 'https://sepolia.arbiscan.io', // Explorer di Arbitrum Sepolia
    },
  },
  testnet: true,
} as const; // 'as const' è una buona pratica per Viem

// La catena attiva sarà Arbitrum Sepolia
const activeChain = arbitrumSepolia;

// Funzione per ottenere un client pubblico (per letture dalla blockchain)
export function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: activeChain,
    transport: http(process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL), // Usa la variabile d'ambiente per l'URL RPC
  });
}