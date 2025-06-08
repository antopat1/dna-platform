// frontend-dapp/src/app/layout.tsx
'use client'; // Questo componente deve essere eseguito lato client

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmiConfig'; // Importa la configurazione Wagmi
import './globals.css'; // Assicurati che il percorso del CSS sia corretto

// Crea un'istanza di QueryClient, necessaria per React Query (dipendenza di Wagmi)
const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* Wrap l'intera applicazione con WagmiProvider e QueryClientProvider */}
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}