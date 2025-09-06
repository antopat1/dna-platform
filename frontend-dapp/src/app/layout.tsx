import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Providers } from "./providers";
import { CoachAuthProvider } from "@/context/CoachAuthProvider"; // Importa il nuovo Provider

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
      <body className={`${inter.className} min-h-screen bg-gray-900 text-gray-100 flex flex-col`}>
        <Providers>
          {/* Avvolgi i componenti che necessitano dello stato di autenticazione */}
          <CoachAuthProvider>
            <Navbar />
            <main className="flex-1 w-full">
              {children}
            </main>
            <Footer />
          </CoachAuthProvider>
        </Providers>
      </body>
    </html>
  );
}

