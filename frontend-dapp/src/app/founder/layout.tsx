// frontend-dapp/src/app/founder/layout.tsx
import type { Metadata } from 'next';
import React from 'react';

// ========================================
// METADATA SPECIFICI PER LA PAGINA FOUNDER
// Questo sovrascriverà/integrerà il title e la description del layout.tsx per questa specifica rotta
// ========================================
export const metadata: Metadata = {
  title: "Antonio Paternò | Ingegnere, Sviluppatore Blockchain e Docente",
  description: "Esplora il profilo professionale di Antonio Paternò: ingegnere delle telecomunicazioni con esperienza in Project Management FTTH, docenza di Coding & Robotica, e sviluppatore Blockchain e Web3.",
  keywords: ["Antonio Paternò", "profilo founder", "ingegnere telecomunicazioni", "Project Manager FTTH", "docente robotica coding", "blockchain developer", "Web3", "portfolio", "esperienze professionali"],
  
  openGraph: {
    title: "Antonio Paternò | Profilo Professionale e Progetti",
    description: "Scopri il percorso di Antonio Paternò, dalle telecomunicazioni al web3, con le sue esperienze e un portfolio di progetti innovativi.",
    url: 'https://www.dnaplatform.xyz/founder', // Sostituisci con l'URL reale della tua pagina founder
    images: [
      {
        url: 'https://www.dnaplatform.xyz/img/myimg.jpg', // Un'immagine specifica per il tuo profilo (assicurati che sia in `public/img/`)
        width: 800,
        height: 600,
        alt: 'Antonio Paternò Profile',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Antonio Paternò | Ingegnere, Sviluppatore Blockchain e Docente",
    description: "Esplora il percorso professionale e i progetti di Antonio Paternò, fondatore di DnA Platform.",
    images: ['https://www.dnaplatform.xyz/img/myimg.jpg'], // Stessa immagine di Open Graph
  }
};

export default function FounderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}