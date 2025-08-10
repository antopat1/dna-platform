// frontend-dapp/src/app/providers.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { NextUIProvider } from '@nextui-org/react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmiConfig';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';

// --- DEFINIZIONE DEL TIPO DI EVENTO RICEVUTO DAL WEBSOCKET ---
// Questa interfaccia descrive la struttura attesa dei tuoi eventi MongoDB/Blockchain
interface FullDocument {
  _id: string;
  type?: string;
  // MODIFICA QUI: Il backend invia 'event' (il nome dell'evento), non 'event_name'
  event?: string; 
  transactionHash?: string;
  [key: string]: any; // Permette altre proprietà non specificate
}

// MODIFICA QUI: Ho aggiunto 'export' per rendere EventData importabile da altri file
export interface EventData {
  operationType: 'insert' | 'update' | 'delete' | string; // Tipo di operazione MongoDB
  fullDocument?: FullDocument; // Dettagli completi del documento dopo l'operazione
  wallClockTime: string; // Timestamp dell'evento
}

// --- NUOVO CONTESTO PER IL FEED DEGLI EVENTI ---
// Specifichiamo che il contesto contiene un array di EventData
const WebSocketContext = createContext<EventData[]>([]);

export function useEventFeed() {
  return useContext(WebSocketContext);
}
// --- FINE NUOVO CONTESTO ---

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // Inizializza lo stato con il tipo EventData[]
  const [events, setEvents] = useState<EventData[]>([]);

  useEffect(() => {
    setMounted(true);
    // Assicurati che l'URL del WebSocket sia corretto per il tuo deployment su Fly.io
    // Usa un URL con 'wss://' per la produzione su Fly.io (force_https = true)
    // Sostituisci "dna-nft-websocket.fly.dev" con l'URL effettivo della tua app Fly.io
    const websocketUrl = "https://dna-nft-websocket.fly.dev"; 

    const ws = new WebSocket(websocketUrl);

    ws.onopen = () => {
      console.log('Connessione WebSocket aperta.');
    };

    ws.onmessage = (event) => {
      console.log('Messaggio ricevuto via WebSocket:', event.data);
      try {
        // Parsa il messaggio come EventData
        const newEvent: EventData = JSON.parse(event.data);
        // Mantiene solo gli ultimi 5 eventi (come richiesto)
        setEvents(prevEvents => [newEvent, ...prevEvents].slice(0, 5)); 
      } catch (e) {
        console.error("Errore durante il parsing del messaggio JSON:", e);
      }
    };

    ws.onclose = () => {
      console.log('Connessione WebSocket chiusa.');
    };

    ws.onerror = (error) => {
      console.error('Errore WebSocket:', error);
    };

    // Funzione di cleanup per chiudere la connessione quando il componente viene smontato
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // UseMemo per evitare che l'oggetto events cambi ad ogni render se il contenuto non cambia
  const memoizedEvents = useMemo(() => events, [events]);

  return (
    <NextUIProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider appInfo={{ appName: 'Scientific Content Platform DApp' }}>
            {mounted && (
              <WebSocketContext.Provider value={memoizedEvents}>
                {children}
              </WebSocketContext.Provider>
            )}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </NextUIProvider>
  );
}

