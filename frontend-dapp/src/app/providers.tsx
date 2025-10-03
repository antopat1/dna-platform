'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { NextUIProvider } from '@nextui-org/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { RainbowKitProvider, getDefaultWallets, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { ThemeProvider } from '@/context/ThemeContext';
import { CoachAuthProvider } from '@/context/CoachAuthProvider';


const chains = [arbitrumSepolia] as const;
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error("La variabile d'ambiente NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID non è impostata");
}

const { wallets } = getDefaultWallets({ appName: 'DnA Platform', projectId });
const connectors = connectorsForWallets(wallets, { appName: 'DnA Platform', projectId });
const config = createConfig({
  chains,
  connectors,
  transports: { [arbitrumSepolia.id]: http() },
  ssr: true,
});


interface FullDocument {
  _id: string;
  type?: string;
  event?: string;
  transactionHash?: string;
  blockNumber?: number | null;
  chainId?: number;
  contractName?: string;
  [key: string]: any;
}

export interface EventData {
  operationType: 'insert' | 'update' | 'delete' | string;
  fullDocument?: FullDocument;
  wallClockTime?: string;
}

const WebSocketContext = createContext<FullDocument[]>([]);

export function useEventFeed() {
  return useContext(WebSocketContext);
}

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<FullDocument[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connectWebSocket = useCallback(() => {
    
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('⚠️ WebSocket già connesso o in fase di connessione');
      return;
    }

    const websocketUrl = 'wss://dna-nft-websocket.fly.dev';
    console.log('🔌 Tentativo di connessione a WebSocket:', websocketUrl);
    console.log('📍 Tentativo #', reconnectAttemptsRef.current + 1);

    try {
      const ws = new WebSocket(websocketUrl);
      wsRef.current = ws;
      setConnectionStatus('connecting');

      ws.onopen = () => {
        console.log('✅ Connessione WebSocket aperta con successo');
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0; 
      };

      ws.onmessage = (message) => {
        console.log('📨 Messaggio ricevuto via WebSocket:', message.data);
        try {
          const rawMessage: EventData = JSON.parse(message.data);
          
          if (rawMessage.fullDocument) {
            console.log('✨ Aggiornamento eventi con:', rawMessage.fullDocument);
            setEvents(prevEvents => {
              const newEvents = [rawMessage.fullDocument!, ...prevEvents].slice(0, 10);
              console.log('📊 Eventi totali dopo update:', newEvents.length);
              return newEvents;
            });
          } else {
            console.warn("⚠️ Messaggio WebSocket ricevuto senza 'fullDocument':", rawMessage);
          }
        } catch (e) {
          console.error("❌ Errore durante il parsing del messaggio JSON:", e);
        }
      };

      ws.onclose = (event) => {
        console.log('🔴 Connessione WebSocket chiusa.', { 
          code: event.code, 
          reason: event.reason || 'Nessun motivo fornito',
          wasClean: event.wasClean 
        });
        setConnectionStatus('disconnected');
        wsRef.current = null;


        if (reconnectAttemptsRef.current < 10) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`🔄 Riconnessione programmata tra ${delay}ms`);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connectWebSocket();
          }, delay);
        } else {
          console.error('❌ Troppi tentativi di riconnessione falliti');
        }
      };

      ws.onerror = (error) => {
        console.error('🚨 Errore WebSocket:', error);
        console.error('🚨 WebSocket readyState:', ws.readyState);
        console.error('🚨 WebSocket URL:', ws.url);
      };

    } catch (error) {
      console.error('❌ Errore durante la creazione del WebSocket:', error);
      setConnectionStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    console.log('🚀 Inizializzazione WebSocket Provider');
    connectWebSocket();

    return () => {
      console.log('🧹 Cleanup: chiusura WebSocket');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  const memoizedEvents = useMemo(() => events, [events]);

  return (
    <ThemeProvider>
      <CoachAuthProvider>
        <NextUIProvider className="h-full w-full">
          <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider appInfo={{ appName: 'DnA Platform' }}>
                <WebSocketContext.Provider value={memoizedEvents}>
                  {children}
                  {/*Test connessioni WS da rimuovere in produzione */}
                  {/* <div className="fixed bottom-4 right-4 z-50 px-3 py-1 rounded-full text-xs font-mono bg-opacity-80"
                       style={{
                         backgroundColor: connectionStatus === 'connected' ? '#10b981' : 
                                        connectionStatus === 'connecting' ? '#f59e0b' : '#ef4444',
                         color: 'white'
                       }}>
                    WS: {connectionStatus} | Events: {events.length}
                  </div> */}
                </WebSocketContext.Provider>
              </RainbowKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </NextUIProvider>
      </CoachAuthProvider>
    </ThemeProvider>
  );
}