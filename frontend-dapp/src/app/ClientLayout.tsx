// src/app/ClientLayout.tsx
"use client"; // 

import { CoachAuthProvider } from "@/context/CoachAuthProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Providers } from "./providers"; // Il tuo file providers.tsx che abbiamo già corretto

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <CoachAuthProvider>
        <Navbar />
        <main className="flex-1 w-full">{children}</main>
        <Footer />
      </CoachAuthProvider>
    </Providers>
  );
}