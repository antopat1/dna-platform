'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { NextUIProvider } from '@nextui-org/react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmiConfig';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';

// Interface definitions - aggiungi le tue interface qui
interface EventData {
  // Definisci la struttura dei tuoi eventi
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
    // WebSocket logic omitted for brevity
  }, []); 

  const memoizedEvents = useMemo(() => events, [events]);

  if (!mounted) {
    return null; // Evita hydration mismatch
  }

  return (
    <div className="h-full w-full bg-gray-100">
      <NextUIProvider className="h-full w-full">
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider 
              appInfo={{ appName: 'Scientific Content Platform DApp' }}
              modalSize="compact"
            >
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





