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
// Nota: 'fullDocument' è opzionale qui perché le sue proprietà potrebbero essere "flattened"
export interface FullDocument {
  _id?: string;
  type?: string;
  event?: string;
  transactionHash?: string;
  from?: string;
  to?: string;
  methodName?: string;
  status?: string;
  blockNumber?: number;
  [key: string]: any;
}

// L'interfaccia EventData ora include direttamente le proprietà che erano in fullDocument
export interface EventData {
  _id: string | { [key: string]: any }; // Gestisce sia stringhe che ObjectId
  operationType: 'insert' | 'update' | 'delete' | string;
  wallClockTime: string; // Timestamp dell'operazione di Change Stream
  source?: string; // Origine del record (es. 'frontend_tx_status')

  // Proprietà flattenate da fullDocument o presenti direttamente
  event?: string; // Nome dell'evento on-chain (es. 'Transfer')
  methodName?: string; // Nome del metodo di transazione frontend (es. 'listNFTForSale')
  transactionHash?: string; // Hash della transazione
  status?: string; // Stato della transazione (pending, success, failed)
  args?: { [key: string]: any }; // Argomenti dell'evento on-chain
  metadata_frontend_tx?: { [key: string]: any }; // Metadati per transazioni frontend
  blockNumber?: number;
  logIndex?: number;
  from?: string;
  to?: string;
  gasUsed?: string;
  gasPrice?: string;
  value?: string;
  timestamp?: string; // Potrebbe arrivare direttamente dal backend
  createdAt?: string; // Potrebbe arrivare direttamente dal backend
  timestamp_processed?: string; // Potrebbe arrivare direttamente dal backend
  
  // Manteniamo fullDocument opzionale se vuoi accedervi direttamente per debug o altre logiche
  fullDocument?: FullDocument;
  [key: string]: any; // Permette altre proprietà dinamiche
}

// --- CONTEXT PER IL FEED DEGLI EVENTI ---
const WebSocketContext = createContext<EventData[]>([]);

export function useEventFeed() {
  return useContext(WebSocketContext);
}
// --- FINE CONTEXT ---

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<EventData[]>([]);

  useEffect(() => {
    setMounted(true);
    const websocketUrl = "wss://dna-nft-websocket.fly.dev"; 

    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWebSocket = () => {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            ws.close();
        }
        clearTimeout(reconnectTimeout); 

        ws = new WebSocket(websocketUrl);

        ws.onopen = () => {
            console.log('Connessione WebSocket aperta.');
        };

        ws.onmessage = (event) => {
            try {
                const rawEvent: EventData = JSON.parse(event.data);
                
                // *** MODIFICA CRUCIALE QUI: appiattiamo l'oggetto fullDocument ***
                const processedEvent: EventData = {
                    ...rawEvent, // Copia tutte le proprietà di base (operationType, wallClockTime, source)
                    ...(rawEvent.fullDocument || {}) // Aggiunge le proprietà di fullDocument direttamente a processedEvent
                };
                // ***************************************************************

                // Assicurati che l'ID sia presente o generato per la deduplicazione
                if (!processedEvent._id && processedEvent.fullDocument?._id) {
                    processedEvent._id = processedEvent.fullDocument._id;
                }
                if (!processedEvent.transactionHash && processedEvent.fullDocument?.transactionHash) {
                    processedEvent.transactionHash = processedEvent.fullDocument.transactionHash;
                }
                if (!processedEvent.methodName && processedEvent.fullDocument?.metadata_frontend_tx?.methodName) {
                    processedEvent.methodName = processedEvent.fullDocument.metadata_frontend_tx.methodName;
                }
                if (!processedEvent.event && processedEvent.fullDocument?.event) {
                    processedEvent.event = processedEvent.fullDocument.event;
                }
                // Potresti dover copiare anche args e metadata_frontend_tx se non sono già a livello root dal backend
                if (!processedEvent.args && rawEvent.fullDocument?.args) {
                    processedEvent.args = rawEvent.fullDocument.args;
                }
                if (!processedEvent.metadata_frontend_tx && rawEvent.fullDocument?.metadata_frontend_tx) {
                    processedEvent.metadata_frontend_tx = rawEvent.fullDocument.metadata_frontend_tx;
                }

                console.log('Evento WebSocket processato:', processedEvent);
                setEvents(prevEvents => [processedEvent, ...prevEvents]); 
            } catch (e) {
                console.error("Errore durante il parsing/processamento del messaggio JSON dal WebSocket:", e, "Dati ricevuti:", event.data);
            }
        };

        ws.onclose = (e) => {
            console.log(`Connessione WebSocket chiusa. Codice: ${e.code}, Ragione: ${e.reason}. Tentativo di riconnessione...`);
            if (e.code !== 1000) { 
                reconnectTimeout = setTimeout(connectWebSocket, 3000); 
            }
        };

        ws.onerror = (error) => {
            console.error('Errore WebSocket:', error);
        };
    };

    connectWebSocket(); 

    return () => {
      if (ws) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, 'Componente smontato');
        }
        clearTimeout(reconnectTimeout); 
      }
    };
  }, []); 

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


