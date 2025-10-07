'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BiLayer, BiDollar, BiNetworkChart, BiChip, BiX } from 'react-icons/bi';
import teamFocusAnimation from '../assets/animation/team-focus.json';
import { useUserRole } from '@/hooks/useUserRole';
import dynamic from 'next/dynamic';

const Player = dynamic(
  () => import('@lottiefiles/react-lottie-player').then((mod) => mod.Player),
  { ssr: false }
);

const techData = {
  frontend: {
    title: 'Frontend: Next.js & React',
    description: 'La UI è costruita con Next.js, un framework React leader per la creazione di applicazioni web performanti e moderne. Questa scelta garantisce un esperienza utente veloce, reattiva e fluida, fondamentale per interagire con la componente blockchain.',
    tools: ['Next.js', 'React', 'Tailwind CSS', 'Viem.sh', 'LottieFiles']
  },
  blockchain: {
    title: 'Blockchain: Solidity & Hardhat',
    description: 'Il cuore della piattaforma. Gli smart contract sono scritti in Solidity e sviluppati usando l ambiente Hardhat. L uso di standard OpenZeppelin garantisce sicurezza e affidabilità per la logica on-chain.',
    tools: ['Solidity', 'Hardhat', 'OpenZeppelin', 'Ethers.js']
  },
  data: {
    title: 'Dati & Architettura a Eventi',
    description: 'Un architettura strategica per la gestione dei dati off-chain e la reattività in tempo reale. MongoDB cattura le modifiche al database. Redis agisce come un bus di messaggi (pub/sub) per notificare i listener Python, permettendo al frontend di aggiornarsi istantaneamente.',
    tools: ['MongoDB', 'Redis', 'Python', 'Docker']
  },
  ai: {
    title: 'AI & Automazione: Google Gemini',
    description: 'Le API di Google Gemini vengono orchestrate tramite Make.com per eseguire la validazione delle candidature degli autori, dimostrando integrazione di servizi AI esterni.',
    tools: ['Google Gemini API', 'Make.com']
  },
  infra: {
    title: 'Infrastruttura & Servizi Cloud',
    description: 'La Dapp è deployata su piattaforme moderne e scalabili. Vercel è ideale per hosting del frontend Next.js, offrendo performance e CI/CD integrato. Fly.io ospita i servizi containerizzati (listener Python), garantendo flessibilità e robustezza.',
    tools: ['Vercel', 'Fly.io', 'Upstash (Redis)', 'MongoDB Atlas']
  }
};

const TechStackModal = ({ onClose }: { onClose: () => void }) => {
  const [activeStack, setActiveStack] = useState('frontend');

  const StackItem = ({ id, title, subtitle, activeId, setActive }: any) => (
    <div
      onClick={() => setActive(id)}
      className={`bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md border-2 w-full text-center cursor-pointer transition-all duration-300 transform hover:scale-105 ${
        activeId === id ? 'border-purple-500 scale-105 shadow-purple-200 dark:shadow-purple-900' : 'border-slate-300 dark:border-slate-600'
      }`}
    >
      <p className="font-bold text-slate-800 dark:text-slate-200">{title}</p>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
    </div>
  );

  const Connector = () => <div className="h-8 w-1 bg-purple-300 dark:bg-purple-700 my-2"></div>;
  
  const currentData = techData[activeStack as keyof typeof techData];

  return (
    <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm p-4"
        onClick={onClose}
    >
      <div 
        className="relative bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto p-6 md:p-8 transform transition-all duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="sticky top-0 right-0 float-right z-10 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-full p-1"
        >
          <BiX className="w-8 h-8" />
        </button>

        <div className="clear-both">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
            Esploratore dello Stack Tecnologico
          </h2>
          <p className="text-center text-slate-500 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
            Clicca su un componente dell'architettura per dettagli della piattaforma full-stack.
          </p>

          <div className="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
            <div className="flex flex-col items-center justify-center p-4">
              <StackItem id="frontend" title="Frontend" subtitle="Next.js" activeId={activeStack} setActive={setActiveStack} />
              <Connector />
              <StackItem id="blockchain" title="Blockchain" subtitle="Solidity, Hardhat" activeId={activeStack} setActive={setActiveStack} />
              <Connector />
              <div className="flex w-full justify-center items-start gap-4">
                  <div className="flex flex-col items-center w-1/2">
                      <StackItem id="data" title="Dati & Eventi" subtitle="MongoDB, Redis, Python" activeId={activeStack} setActive={setActiveStack} />
                  </div>
                  <div className="flex flex-col items-center w-1/2">
                      <StackItem id="ai" title="AI & Automazione" subtitle="Google Gemini, Make.com" activeId={activeStack} setActive={setActiveStack} />
                  </div>
              </div>
              <Connector />
              <StackItem id="infra" title="Infrastruttura" subtitle="Vercel, Fly.io" activeId={activeStack} setActive={setActiveStack} />
            </div>

            <div className="mt-8 lg:mt-0 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 min-h-[280px] flex flex-col justify-center">
              <h4 className="text-xl font-bold mb-3 text-purple-500">{currentData.title}</h4>
              <p className="text-slate-600 dark:text-slate-300 mb-4 text-base">{currentData.description}</p>
              <div className="flex flex-wrap gap-2">
                {currentData.tools.map(tool => (
                  <span key={tool} className="bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-full dark:bg-purple-900 dark:text-purple-200">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default function Home() {
  const { isAuthor, isConnected } = useUserRole();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-screen bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-200">
        
        <section className="text-center py-20 px-4 max-w-4xl mx-auto flex flex-col items-center">
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
            Il Futuro della Scienza è Tokenizzato.
          </h1>
        
          <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 font-light mb-8">
            Benvenuto su DnA, il marketplace che trasforma la ricerca scientifica in asset digitali unici e verificabili.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/marketplace" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-full transition-colors shadow-lg">
              Esplora il Marketplace
            </Link>
            
            {isConnected && (
              <Link 
                href={isAuthor ? "/dashboard/register-content" : "/my-nfts"} 
                className="bg-transparent border-2 border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-400 dark:hover:text-blue-400 font-semibold py-3 px-8 rounded-full transition-colors"
              >
                {isAuthor ? 'Crea il tuo NFT' : 'Visualizza i tuoi NFT'}
              </Link>
            )}
          </div>

          <div className="mt-8 w-full flex justify-center transform transition-transform duration-300 hover:scale-110">
            <div className="w-2/3 md:w-1/2 lg:w-1/3 max-w-[280px]">
              <Player
                autoplay
                loop
                src={teamFocusAnimation}
                className="w-full h-auto"
              />
            </div>
          </div>
        </section>

        <section className="w-full py-20 px-4 bg-slate-100 dark:bg-slate-800">
          <div className="max-w-6xl mx-auto flex flex-col items-center">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center w-full">
              <div className="flex flex-col items-center p-6 bg-white dark:bg-slate-700 rounded-xl shadow-lg transform transition-transform hover:scale-105">
                <BiLayer className="text-5xl text-blue-400 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Trasparenza Assoluta</h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Ogni contenuto scientifico è registrato in modo immutabile sulla blockchain, garantendo provenienza e proprietà.
                </p>
              </div>
              <div className="flex flex-col items-center p-6 bg-white dark:bg-slate-700 rounded-xl shadow-lg transform transition-transform hover:scale-105">
                <BiDollar className="text-5xl text-blue-400 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Nuove Opportunità</h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Monetizza il tuo lavoro di ricerca o supporta i progetti che ami, creando un ecosistema di valore.
                </p>
              </div>
              <div className="flex flex-col items-center p-6 bg-white dark:bg-slate-700 rounded-xl shadow-lg transform transition-transform hover:scale-105">
                <BiNetworkChart className="text-5xl text-blue-400 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Connessione Globale</h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Una community di scienziati, ricercatori e appassionati connessi da una visione comune di innovazione.
                </p>
              </div>
            </div>
            <div className="mt-16 text-center">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-3 bg-transparent border-2 border-purple-500 text-purple-500 font-semibold py-3 px-8 rounded-full transition-all duration-300 hover:bg-purple-500 hover:text-white hover:shadow-lg hover:scale-105"
              >
                <BiChip className="text-2xl" />
                <span>Scopri lo Stack Tecnologico</span>
              </button>
            </div>
          </div>
        </section>

        <section className="text-center py-20 px-4">
          <h2 className="text-3xl font-bold mb-4">
            Pronto a Rivoluzionare la Ricerca?
          </h2>

          <p className="text-lg text-slate-500 dark:text-slate-400 mb-6">
           Unisciti a noi e contribuisci a costruire un futuro della scienza aperto e accessibile a tutti.<br/>
           Richiedi l'accredito immediato tramite agente AI o invia form al nostro Team per registrare contenuti scientifici <br/>disponibili per il Minting in NFT unici
          </p>
          <Link href="/dashboard/register-content" className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-full transition-colors shadow-lg">
            Inizia Ora
          </Link>
        </section>
        
      </div>

      {isModalOpen && <TechStackModal onClose={() => setIsModalOpen(false)} />}
    </>
  );
}

