// frontend-dapp/src/app/layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DnA Platform",
  description: "A scientific content NFT platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-screen bg-gray-100 flex flex-col`}>
        <Providers>
          <Navbar />
          <main className="flex-1 w-full bg-gray-100">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
