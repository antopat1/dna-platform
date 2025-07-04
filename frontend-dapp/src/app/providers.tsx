// frontend-dapp/src/app/providers.tsx
'use client'; // Questo è ESSENZIALE per tutti i provider che usano Hooks o contesto

import { NextUIProvider } from '@nextui-org/react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmiConfig'; // Percorso corretto alla tua configurazione Wagmi
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'; // IMPORTO RAINBOWKITPROVIDER
import React from 'react';
// Non è più necessario importare 'chains' qui, RainbowKitProvider la prenderà dalla WagmiConfig

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  // `mounted` state per risolvere un potenziale problema di hydration con RainbowKit
  // che potrebbe causare errori di mismatch tra server e client rendering.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <NextUIProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {/* RainbowKitProvider non ha più la prop 'chains' direttamente. */}
          {/* Le catene vengono derivate dalla configurazione passata a WagmiProvider. */}
          {/* L'appInfo è opzionale ma consigliata per personalizzare il modale */}
          <RainbowKitProvider appInfo={{ appName: 'Scientific Content Platform DApp' }}>
            {mounted && children} {/* Renderizza i children solo dopo che il componente è montato sul client */}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </NextUIProvider>
  );
}

// // frontend-dapp/src/app/providers.tsx
// 'use client'; // Questo è ESSENZIALE per tutti i provider che usano Hooks o contesto

// import { NextUIProvider } from '@nextui-org/react';
// import { WagmiProvider } from 'wagmi';
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { config } from '@/lib/wagmiConfig'; // Percorso corretto alla tua configurazione Wagmi
// import React from 'react';

// const queryClient = new QueryClient();

// export function Providers({ children }: { children: React.ReactNode }) {
//   return (
//     <NextUIProvider>
//       <WagmiProvider config={config}>
//         <QueryClientProvider client={queryClient}>
//           {children}
//         </QueryClientProvider>
//       </WagmiProvider>
//     </NextUIProvider>
//   );
// }