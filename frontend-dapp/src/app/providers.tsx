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

// --- WebSocket Context (come nel tuo originale) ---
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
    <ThemeProvider>
      <CoachAuthProvider>
        <NextUIProvider className="h-full w-full">
          <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider>
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





