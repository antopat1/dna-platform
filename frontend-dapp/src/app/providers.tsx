// frontend-dapp/src/app/providers.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { NextUIProvider } from '@nextui-org/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Wagmi & RainbowKit Imports ---
import { WagmiProvider, createConfig, http } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import {
  RainbowKitProvider,
  getDefaultWallets,
  connectorsForWallets,
} from '@rainbow-me/rainbowkit';

// --- I tuoi Provider Personalizzati ---
import { ThemeProvider } from '@/context/ThemeContext';
import { CoachAuthProvider } from '@/context/CoachAuthProvider';

// --- Wagmi & RainbowKit Config ---
const chains = [arbitrumSepolia] as const;
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error("La variabile d'ambiente NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID non è impostata");
}

const { wallets } = getDefaultWallets({
  appName: 'DnA Platform',
  projectId,
});

const connectors = connectorsForWallets(
  wallets,
  {
    appName: 'DnA Platform',
    projectId,
  }
);

const config = createConfig({
  chains,
  connectors,
  transports: {
    [arbitrumSepolia.id]: http(),
  },
  ssr: true,
});

// --- DEFINIZIONE DEI TIPI ---
// Questo rappresenta il documento dell'evento, la struttura dati che EventFeed.tsx si aspetta.
interface FullDocument {
  _id: string;
  type?: string;
  event?: string;
  transactionHash?: string;
  [key: string]: any;
}

// Questo rappresenta l'intero messaggio ricevuto dal WebSocket, che "incapsula" il documento dell'evento.
export interface EventData {
  operationType: 'insert' | 'update' | 'delete' | string;
  fullDocument?: FullDocument;
  wallClockTime: string;
}

// --- MODIFICA CHIAVE #1: IL CONTEXT DEVE FORNIRE L'EVENTO PURO ---
// Il context ora è tipizzato per contenere un array di "FullDocument",
// non di "EventData". Questo è ciò che il componente EventFeed si aspetta.
const WebSocketContext = createContext<FullDocument[]>([]);

export function useEventFeed() {
  return useContext(WebSocketContext);
}

// --- FUNZIONE PER COSTRUIRE L'URL WEBSOCKET CORRETTO ---
function buildWebSocketUrl(baseUrl: string): string {
  if (baseUrl.startsWith('ws://') || baseUrl.startsWith('wss://')) {
    return baseUrl;
  }
  if (baseUrl.startsWith('https://')) {
    return baseUrl.replace('https://', 'wss://');
  }
  if (baseUrl.startsWith('http://')) {
    return baseUrl.replace('http://', 'ws://');
  }
  if (!baseUrl.includes('://')) {
    const isProduction = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const protocol = isProduction ? 'wss://' : 'ws://';
    return `${protocol}${baseUrl}`;
  }
  return `wss://${baseUrl}`;
}

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // --- MODIFICA CHIAVE #2: LO STATO INTERNO CONTIENE L'EVENTO PURO ---
  // Anche lo stato interno del provider ora memorizza direttamente i documenti degli eventi.
  const [events, setEvents] = useState<FullDocument[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  useEffect(() => {
    setMounted(true);
    
    const baseUrl = "dna-nft-websocket.fly.dev";
    const websocketUrl = buildWebSocketUrl(baseUrl);
    
    console.log('🔌 URL WebSocket costruito:', websocketUrl);
    console.log('🌐 Ambiente rilevato:', typeof window !== 'undefined' && window.location.protocol);
    
    setConnectionStatus('connecting');
    
    const ws = new WebSocket(websocketUrl);

    ws.onopen = () => {
      console.log('✅ Connessione WebSocket aperta con successo');
      setConnectionStatus('connected');
    };

    // --- MODIFICA CHIAVE #3: LA LOGICA DI "SPACCHETTAMENTO" ---
    // Questa è la correzione principale.
    ws.onmessage = (message) => {
      console.log('📨 Messaggio ricevuto via WebSocket:', message.data);
      try {
        // 1. Analizza l'intero messaggio ricevuto (che è di tipo EventData)
        const rawMessage: EventData = JSON.parse(message.data);

        // 2. Estrai l'evento vero e proprio dalla proprietà "fullDocument"
        const eventDocument = rawMessage.fullDocument;

        // 3. Controlla che il documento esista prima di procedere
        if (eventDocument) {
          console.log('✅ Documento evento estratto:', eventDocument);
          // 4. Aggiungi SOLO il documento dell'evento (eventDocument) allo stato.
          // In questo modo, il context fornirà la struttura dati corretta.
          setEvents(prevEvents => [eventDocument, ...prevEvents].slice(0, 5));
        } else {
          console.warn("Messaggio WebSocket ricevuto senza 'fullDocument':", rawMessage);
        }
      } catch (e) {
        console.error("❌ Errore durante il parsing del messaggio JSON:", e);
      }
    };

    ws.onclose = (event) => {
      console.log('🔴 Connessione WebSocket chiusa.', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      setConnectionStatus('disconnected');
      
      if (!event.wasClean) {
        console.log('🔄 Tentativo di riconnessione in 5 secondi...');
        setTimeout(() => {
          if (mounted) {
            console.log('🔄 Tentativo di riconnessione...');
            // Logica di riconnessione può essere implementata qui
          }
        }, 5000);
      }
    };

    ws.onerror = (error) => {
      console.error('🚨 Errore WebSocket:', error);
      setConnectionStatus('error');
    };

    return () => {
      console.log('🧹 Cleanup: chiusura WebSocket');
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'Component unmounting');
      }
    };
  }, [mounted]);

  const memoizedEvents = useMemo(() => events, [events]);

  if (!mounted) {
    return null;
  }

  return (
    <ThemeProvider>
      <CoachAuthProvider>
        <NextUIProvider className="h-full w-full">
          <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider appInfo={{ appName: 'DnA Platform' }}>
                {/* Il provider ora passa 'memoizedEvents' che è un FullDocument[],
                    esattamente ciò che EventFeed.tsx si aspetta. */}
                <WebSocketContext.Provider value={memoizedEvents}>
                  {children}
                </WebSocketContext.Provider>
              </RainbowKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </NextUIProvider>
      </CoachAuthProvider>
    </ThemeProvider>
  );
}


// // frontend-dapp/src/app/providers.tsx
// 'use client';

// import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
// import { NextUIProvider } from '@nextui-org/react';
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// // --- Wagmi & RainbowKit Imports ---
// import { WagmiProvider, createConfig, http } from 'wagmi';
// import { arbitrumSepolia } from 'wagmi/chains';
// import {
//   RainbowKitProvider,
//   getDefaultWallets,
//   connectorsForWallets,
// } from '@rainbow-me/rainbowkit';

// // --- I tuoi Provider Personalizzati ---
// import { ThemeProvider } from '@/context/ThemeContext';
// import { CoachAuthProvider } from '@/context/CoachAuthProvider';

// // --- Wagmi & RainbowKit Config ---
// const chains = [arbitrumSepolia] as const;
// const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// if (!projectId) {
//   throw new Error("La variabile d'ambiente NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID non è impostata");
// }

// const { wallets } = getDefaultWallets({
//   appName: 'DnA Platform',
//   projectId,
// });

// const connectors = connectorsForWallets(
//   wallets, 
//   {
//     appName: 'DnA Platform',
//     projectId,
//   }
// );

// const config = createConfig({
//   chains,
//   connectors,
//   transports: {
//     [arbitrumSepolia.id]: http(),
//   },
//   ssr: true,
// });

// // --- WebSocket Context (come nel tuo originale) ---
// interface EventData {
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
//   }, []); 

//   const memoizedEvents = useMemo(() => events, [events]);

//   if (!mounted) {
//     return null;
//   }

//   return (
//     <ThemeProvider>
//       <CoachAuthProvider>
//         <NextUIProvider className="h-full w-full">
//           <WagmiProvider config={config}>
//             <QueryClientProvider client={queryClient}>
//               <RainbowKitProvider>
//                 <WebSocketContext.Provider value={memoizedEvents}>
//                   {children}
//                 </WebSocketContext.Provider>
//               </RainbowKitProvider>
//             </QueryClientProvider>
//           </WagmiProvider>
//         </NextUIProvider>
//       </CoachAuthProvider>
//     </ThemeProvider>
//   );
// }





