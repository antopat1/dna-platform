// frontend-dapp/src/lib/wagmiConfig.ts

import { http, createConfig } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
// Assicurati che 'metaMask' e 'walletConnect' (se lo usi) siano importati
import { metaMask, walletConnect } from 'wagmi/connectors'; // HO RIMOSSO 'injected' QUI

import { ARBITRUM_SEPOLIA_RPC_URL } from '@/lib/constants';

export const config = createConfig({
  chains: [arbitrumSepolia],
  connectors: [
    // Preferiamo usare il connettore specifico per MetaMask
    // Rimuovendo 'injected()' eviti che altri wallet iniettati (come Kepler)
    // possano sovrascrivere o essere l'unica opzione visualizzata.
    metaMask(),
    // Se vuoi supportare WalletConnect, assicurati di avere il tuo Project ID nel .env
    // e decommenta la riga qui sotto:
    // walletConnect({ projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '' }),
  ],
  transports: {
    [arbitrumSepolia.id]: http(ARBITRUM_SEPOLIA_RPC_URL),
  },
});


// // frontend-dapp/src/lib/wagmiConfig.ts

// import { http, createConfig } from 'wagmi';
// import { arbitrumSepolia } from 'wagmi/chains';
// import { injected, walletConnect, metaMask } from 'wagmi/connectors';
// import { ARBITRUM_SEPOLIA_RPC_URL } from '@/lib/constants';

// export const config = createConfig({
//   chains: [arbitrumSepolia],
//   connectors: [
//     injected(),
//     metaMask(),
//   ],
//   transports: {
//     [arbitrumSepolia.id]: http(ARBITRUM_SEPOLIA_RPC_URL),
//   },
// });


