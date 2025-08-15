// frontend-dapp/src/lib/wagmiConfig.ts
import { arbitrumSepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// IMPORTANTE: Ottieni il tuo Project ID da https://cloud.walletconnect.com/
// e aggiungilo al tuo file .env: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="YOUR_PROJECT_ID"
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID non è definito nel file .env. Verrà mostrato un errore nell'interfaccia se non lo si imposta.");
}

export const config = getDefaultConfig({
  appName: 'DnA Platform', // Il nome della tua DApp
  projectId,
  chains: [arbitrumSepolia],
  ssr: true, // Importante per l'App Router di Next.js
});





