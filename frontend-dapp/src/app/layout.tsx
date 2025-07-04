
// frontend-dapp/src/app/layout.tsx
// Questo è un Server Component di default. Non ha bisogno di 'use client'.

import './globals.css'; // Assicurati che il percorso del CSS sia corretto
import { Providers } from './providers'; // Importa il componente Providers
import '@rainbow-me/rainbowkit/styles.css'; // IMPORTO GLI STILI DI RAINBOWKIT GLOBALMENTE

export const metadata = {
  title: "Scientific Content Platform",
  description: "Decentralized platform for scientific content publishing and NFTs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}


// // frontend-dapp/src/app/layout.tsx
// // Questo è un Server Component di default. Non ha bisogno di 'use client'.

// import './globals.css'; // Assicurati che il percorso del CSS sia corretto
// import { Providers } from './providers'; // Importa il componente Providers

// export const metadata = {
//   title: "Scientific Content Platform",
//   description: "Decentralized platform for scientific content publishing and NFTs",
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en">
//       <body>
//         <Providers>
//           {children}
//         </Providers>
//       </body>
//     </html>
//   );
// }