// frontend-dapp/src/app/layout.tsx
import type { Metadata } from "next"; 
import { Inter } from "next/font/google";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
// Importa il nuovo componente wrapper che gestirà tutta la logica client-side
import ClientLayout from "./ClientLayout"; 

const inter = Inter({ subsets: ["latin"] });

// METADATA GLOBALI PER L'INTERA APPLICAZIONE (DnA Platform)
// Questa è una funzionalità del Server Component e deve rimanere qui. È perfetto.
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

// Questo RootLayout rimane un Server Component.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="h-full"> 
      <body className={`${inter.className} min-h-screen bg-gray-900 text-gray-100 flex flex-col`}>
        {/* 
          Qui sta la magia: invece di inserire direttamente Providers, Navbar, etc.,
          usiamo il nostro ClientLayout. Questo componente, essendo marcato come "use client",
          crea una barriera tra il server (questo file) e il client (tutto ciò che contiene).
          Passiamo 'children' al suo interno in modo che le tue pagine vengano renderizzate
          nel punto corretto (dentro il tag <main> di ClientLayout).
        */}
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}


// // frontend-dapp/src/app/layout.tsx
// import type { Metadata } from "next"; 
// import { Inter } from "next/font/google";
// import "./globals.css";
// import "@rainbow-me/rainbowkit/styles.css";
// import Navbar from "../components/Navbar";
// import Footer from "../components/Footer";
// import { Providers } from "./providers";
// import { CoachAuthProvider } from "@/context/CoachAuthProvider";

// const inter = Inter({ subsets: ["latin"] });

// // METADATA GLOBALI PER L'INTERA APPLICAZIONE (DnA Platform)
// export const metadata: Metadata = {
//   title: "DnA Platform | Tokenizza la Ricerca Scientifica in NFT Verificabili",
//   description: "DnA è un marketplace blockchain per la tokenizzazione di contenuti scientifici. Trasforma la ricerca in NFT unici e garantisce la proprietà e la trasparenza. Attraverso un agente AI, valuta automaticamente il contenuto e assegna i privilegi di whitelist on-chain agli autori.",
//   keywords: ["blockchain", "NFT", "ricerca scientifica", "tokenizzazione", "marketplace", "smart contracts", "Web3", "intelligenza artificiale", "whitelist", "VRF", "Arbitrum Sepolia"],
  
//   icons: {
//     icon: '../public/img/logo.png', // Percorso relativo alla cartella `public`
//     apple: '../public/img/logo.png', // Per dispositivi Apple
//   },

//   openGraph: {
//     title: "DnA Platform: Blockchain per la Ricerca Scientifica",
//     description: "DnA trasforma articoli e dati scientifici in NFT, creando un ecosistema di valore e trasparenza. Utilizza un'IA per automatizzare l'onboarding degli autori e l'assegnazione dei privilegi.",
//     url: "https://www.dnaplatform.xyz", // Sostituisci con l'URL del tuo sito quando sarà online
//     siteName: "DnA Platform",
//     images: [
//       {
//         url: "https://www.dnaplatform.xyz/img/dna-logo-banner.png", // Immagine per Open Graph, assicurati che sia in `public/img/`
//         width: 1200, 
//         height: 630,
//         alt: "DnA Platform Logo Banner",
//       },
//     ],
//     locale: "it_IT",
//     type: "website",
//   },
  
//   twitter: {
//     card: "summary_large_image",
//     title: "DnA Platform: Blockchain per la Ricerca Scientifica",
//     description: "Tokenizza e monetizza la ricerca scientifica. Un marketplace basato su blockchain che usa l'IA per automatizzare l'onboarding degli autori e l'assegnazione dei privilegi.",
//     images: ["https://www.dnaplatform.xyz/img/dna-logo-banner.png"], 
//   },
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="it" className="h-full"> 
//       <body className={`${inter.className} min-h-screen bg-gray-900 text-gray-100 flex flex-col`}>
//         <Providers>
//           <CoachAuthProvider>
//             <Navbar />
//             <main className="flex-1 w-full">
//               {children}
//             </main>
//             <Footer />
//           </CoachAuthProvider>
//         </Providers>
//       </body>
//     </html>
//   );
// }
