// frontend-dapp/src/lib/wagmiConfig.ts
import { createConfig, http } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { injected, metaMask } from 'wagmi/connectors';
import { ARBITRUM_SEPOLIA_RPC_URL } from '@/lib/constants'; // Importa l'URL RPC

export const config = createConfig({
  chains: [arbitrumSepolia], // Definisci le catene supportate dalla tua dApp
  connectors: [
    injected(), // Connettore generico per wallet iniettati
    metaMask(), // Connettore specifico per MetaMask
  ],
  transports: {
    // Mappa l'ID della catena al suo URL RPC. Usiamo l'URL dal nostro constants.ts
    [arbitrumSepolia.id]: http(ARBITRUM_SEPOLIA_RPC_URL),
  },
});