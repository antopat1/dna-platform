// frontend-dapp/src/lib/wagmiConfig.ts
import { arbitrumSepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID non è definito nel file .env. Verrà mostrato un errore nell'interfaccia se non lo si imposta.");
}

export const config = getDefaultConfig({
  appName: 'DnA Platform', 
  projectId,
  chains: [arbitrumSepolia],
  ssr: true, 





