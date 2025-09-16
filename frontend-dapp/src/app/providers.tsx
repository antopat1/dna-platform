// frontend-dapp/src/app/providers.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { NextUIProvider } from '@nextui-org/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- INIZIO CONFIGURAZIONE COMPATIBILE ---

// 1. Import da Wagmi
import { WagmiProvider, createConfig, http } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';

// 2. Import da RainbowKit (aggiungiamo 'connectorsForWallets')
import {
  RainbowKitProvider,
  getDefaultWallets,
  connectorsForWallets,
} from '@rainbow-me/rainbowkit';

// 3. Definiamo le chain
const chains = [arbitrumSepolia] as const;

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  throw new Error("La variabile d'ambiente NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID non è impostata");
}

// 4. Prendiamo la lista dei wallet da getDefaultWallets
//    NOTA: l'errore che hai visto su 'chains' qui indica che la tua versione di `getDefaultWallets`
//    non accetta questo parametro. Lo rimuoviamo per compatibilità.
const { wallets } = getDefaultWallets({
  appName: 'DnA Platform',
  projectId,
});

// 5. Usiamo `connectorsForWallets` per creare i connettori. 
//    Questo è il passaggio chiave per la compatibilità.
//    Questa funzione accetta `chains` come secondo parametro.
const connectors = connectorsForWallets(
  wallets, 
  {
    appName: 'DnA Platform',
    projectId,
  }
);


// 6. Creiamo la configurazione di Wagmi.
//    NOTA: Ora passiamo `connectors` invece di `wallets`.
const config = createConfig({
  chains,
  connectors, // <- Usiamo 'connectors' qui
  transports: {
    [arbitrumSepolia.id]: http(),
  },
  ssr: true,
});

// --- FINE CONFIGURAZIONE ---

// Interface definitions
interface EventData {
  id: string;
  type: string;
  data: any;
}

const WebSocketContext = createContext<EventData[]>([]);

export function useEventFeed() {
  return useContext(WebSocketContext);
}

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<EventData[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []); 

  const memoizedEvents = useMemo(() => events, [events]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="h-full w-full bg-gray-100">
      <NextUIProvider className="h-full w-full">
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              <WebSocketContext.Provider value={memoizedEvents}>
                <div className="h-full w-full bg-gray-100">
                  {children}
                </div>
              </WebSocketContext.Provider>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </NextUIProvider>
    </div>
  );
}



// 'use client';

// import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
// import { NextUIProvider } from '@nextui-org/react';
// import { WagmiProvider } from 'wagmi';
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { config } from '@/lib/wagmiConfig';
// import { RainbowKitProvider } from '@rainbow-me/rainbowkit';

// // Interface definitions - aggiungi le tue interface qui
// interface EventData {
//   // Definisci la struttura dei tuoi eventi
//   id: string;
//   type: string;
//   data: any;
// }

// const WebSocketContext = createContext<EventData[]>([]);

// export function useEventFeed() {
//   return useContext(WebSocketContext);
// }

// const queryClient = new QueryClient();

// export function Providers({ children }: { children: React.ReactNode }) {
//   const [mounted, setMounted] = useState(false);
//   const [events, setEvents] = useState<EventData[]>([]);

//   useEffect(() => {
//     setMounted(true);
//     // WebSocket logic omitted for brevity
//   }, []); 

//   const memoizedEvents = useMemo(() => events, [events]);

//   if (!mounted) {
//     return null; // Evita hydration mismatch
//   }

//   return (
//     <div className="h-full w-full bg-gray-100">
//       <NextUIProvider className="h-full w-full">
//         <WagmiProvider config={config}>
//           <QueryClientProvider client={queryClient}>
//             <RainbowKitProvider 
//               appInfo={{ appName: 'Scientific Content Platform DApp' }}
//               modalSize="compact"
//             >
//               <WebSocketContext.Provider value={memoizedEvents}>
//                 <div className="h-full w-full bg-gray-100">
//                   {children}
//                 </div>
//               </WebSocketContext.Provider>
//             </RainbowKitProvider>
//           </QueryClientProvider>
//         </WagmiProvider>
//       </NextUIProvider>
//     </div>
//   );
// }





