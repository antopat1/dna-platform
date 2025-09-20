// frontend-dapp/src/app/layout.tsx
import type { Metadata } from "next"; 
import { Inter } from "next/font/google";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import ClientLayout from "./ClientLayout"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DnA Platform | Tokenizza la Ricerca Scientifica in NFT Verificabili",
  description: "DnA è un marketplace blockchain per la tokenizzazione di contenuti scientifici. Trasforma la ricerca in NFT unici e garantisce la proprietà e la trasparenza. Attraverso un agente AI, valuta automaticamente il contenuto e assegna i privilegi di whitelist on-chain agli autori.",
  keywords: ["blockchain", "NFT", "ricerca scientifica", "tokenizzazione", "marketplace", "smart contracts", "Web3", "intelligenza artificiale", "whitelist", "VRF", "Arbitrum Sepolia"],
  
  icons: {
    icon: '../public/img/logo.png',
    apple: '../public/img/logo.png',
  },

  openGraph: {
    title: "DnA Platform: Blockchain per la Ricerca Scientifica",
    description: "DnA trasforma articoli e dati scientifici in NFT, creando un ecosistema di valore e trasparenza. Utilizza un'IA per automatizzare l'onboarding degli autori e l'assegnazione dei privilegi.",
    url: "https://www.dnaplatform.xyz",
    siteName: "DnA Platform",
    images: [
      {
        url: "https://www.dnaplatform.xyz/img/dna-logo-banner.png",
        width: 1200, 
        height: 630,
        alt: "DnA Platform Logo Banner",
      },
    ],
    locale: "it_IT",
    type: "website",
  },
  
  twitter: {
    card: "summary_large_image",
    title: "DnA Platform: Blockchain per la Ricerca Scientifica",
    description: "Tokenizza e monetizza la ricerca scientifica. Un marketplace basato su blockchain che usa l'IA per automatizzare l'onboarding degli autori e l'assegnazione dei privilegi.",
    images: ["https://www.dnaplatform.xyz/img/dna-logo-banner.png"], 
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Aggiungiamo 'dark' come classe di default per il rendering iniziale
    // e 'suppressHydrationWarning' per gestire il cambio di classe sul client
    <html lang="it" className="h-full dark" suppressHydrationWarning> 
      <body 
        className={`${inter.className} min-h-screen flex flex-col bg-white text-gray-800 dark:bg-gray-900 dark:text-gray-100 transition-colors duration-300`}
      >
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}

