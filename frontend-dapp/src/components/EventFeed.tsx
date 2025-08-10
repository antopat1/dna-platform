// frontend-dapp/src/components/EventFeed.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useEventFeed } from './../app/providers';
import { EventData } from '@/app/providers';

// Mappa per tradurre i nomi degli eventi in un formato leggibile
const eventNameMap: { [key: string]: string } = {
  // Eventi NFT
  Approval: 'Approvazione',
  ApprovalForAll: 'Approvazione per tutti',
  BaseURIUpdated: 'Base URI aggiornata',
  CoordinatorSet: 'Coordinatore impostato',
  MintingFailed: 'Conio fallito',
  NFTMinted: 'NFT coniato',
  OwnershipTransferRequested: 'Richiesto trasferimento proprietà',
  OwnershipTransferred: 'Proprietà trasferita',
  ProtocolFeeReceiverUpdated: 'Ricevitore fee protocollo aggiornato',
  ProtocolFeesWithdrawn: 'Fee protocollo ritirate',
  Transfer: 'Trasferimento', 

  // Eventi da frontend e metodi
  safeTransferFrom: 'Trasferimento NFT', 
  listNFTForSale: 'Messa in vendita NFT',
  removeNFTFromSale: 'Rimozione vendita NFT',

  // Eventi Marketplace
  AuctionEnded: 'Asta terminata',
  AuctionStarted: 'Asta iniziata',
  NFTClaimed: 'NFT reclamato',
  NFTListedForSale: 'NFT messo in vendita',
  NFTPurchased: 'NFT acquistato',
  NFTSaleRemoved: 'Vendita NFT revocata',
  NewBid: 'Nuova offerta',
  RefundProcessed: 'Rimborso processato',
};

// Funzione di supporto per formattare il nome dell'evento in modo leggibile
const formatEventName = (name: string): string => {
  return eventNameMap[name] || name.replace(/([A-Z])/g, ' $1').trim();
};

const EventFeed = () => {
  const newEvents = useEventFeed();
  const [displayedEvents, setDisplayedEvents] = useState<EventData[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Carica gli eventi dal Local Storage all'avvio
  useEffect(() => {
    try {
      const storedEvents = localStorage.getItem('blockchainEvents');
      if (storedEvents) {
        setDisplayedEvents(JSON.parse(storedEvents));
      }
    } catch (error) {
      console.error("Errore nel caricamento degli eventi dal Local Storage", error);
    }
  }, []);

  // ******************************************************
  // NUOVA LOGICA: Sostituisce l'intera lista di eventi
  // quando il provider fornisce nuovi eventi per garantire
  // che l'UI sia sempre sincronizzata con l'ultima versione.
  // ******************************************************
  useEffect(() => {
    if (newEvents.length === 0) return;

    // L'evento più recente è l'ultimo nella lista del provider
    const latestEvent = newEvents[newEvents.length - 1];

    setDisplayedEvents(prevEvents => {
      let updatedEvents = [...prevEvents];
      
      const transactionHash = latestEvent.fullDocument?.transactionHash;
      const existingEventIndex = transactionHash 
        ? updatedEvents.findIndex(e => e.fullDocument?.transactionHash === transactionHash)
        : -1;

      if (existingEventIndex > -1) {
        updatedEvents[existingEventIndex] = latestEvent;
      } else {
        updatedEvents = [latestEvent, ...updatedEvents];
      }
      
      // Limita la cronologia
      const maxEvents = 50; 
      if (updatedEvents.length > maxEvents) {
        updatedEvents = updatedEvents.slice(0, maxEvents);
      }

      try {
        localStorage.setItem('blockchainEvents', JSON.stringify(updatedEvents));
      } catch (error) {
        console.error("Errore nel salvataggio degli eventi nel Local Storage", error);
      }

      return updatedEvents;
    });
  }, [newEvents]);

  // Gestisce l'espansione e la chiusura dei dettagli di un evento
  const toggleExpand = useCallback((transactionHash: string) => {
    setExpandedEventId(prevId => (prevId === transactionHash ? null : transactionHash));
  }, []);

  if (displayedEvents.length === 0) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg text-center text-gray-600">
        Nessun evento recente.
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white shadow-lg rounded-lg overflow-hidden my-4">
      <h2 className="text-xl font-bold p-4 bg-blue-600 text-white">Eventi della Piattaforma</h2>
      <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {displayedEvents.map((event: EventData, index: number) => {
          // *******************************************************
          // LOGICA AGGIORNATA: Priorità a `eventName`, se non c'è,
          // usa il nome del metodo dal `fullDocument`, altrimenti
          // usa il fallback 'Aggiornamento Database'.
          // *******************************************************
          const eventName = event.eventName || event.fullDocument?.methodName;
          const displayEventName = eventName
            ? `Evento: ${formatEventName(eventName)}`
            : `Aggiornamento Database: ${event.operationType}`;
          // *******************************************************

          const transactionHash = event.fullDocument?.transactionHash;
          const isExpanded = expandedEventId === transactionHash;
          
          return (
            <li key={transactionHash || index} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => transactionHash && toggleExpand(transactionHash)}>
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {event.operationType === 'insert' && <span className="text-green-500 text-2xl">➕</span>}
                  {event.operationType === 'update' && <span className="text-blue-500 text-2xl">✏️</span>}
                  {event.operationType === 'delete' && <span className="text-red-500 text-2xl">🗑️</span>}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {displayEventName}
                  </p>
                  <p className="text-xs text-gray-500">
                    Transazione: {transactionHash?.substring(0, 10) || 'N/A'}...
                  </p>
                  <p className="text-xs text-gray-500">
                    Timestamp: {new Date(event.wallClockTime).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              
              {isExpanded && (
                <div className="mt-4 p-4 bg-gray-100 rounded-md text-sm break-all">
                  <p className="font-bold">Dettagli Transazione:</p>
                  <p><strong>Hash:</strong> {transactionHash || 'N/A'}</p>
                  <p><strong>Da:</strong> {event.fullDocument?.from || 'N/A'}</p>
                  <p><strong>A:</strong> {event.fullDocument?.to || 'N/A'}</p>
                  <p><strong>Metodo:</strong> {event.fullDocument?.methodName || 'N/A'}</p>
                  <p><strong>Status:</strong> {event.fullDocument?.status || 'N/A'}</p>
                  <p><strong>Block:</strong> {event.fullDocument?.blockNumber || 'N/A'}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default EventFeed;
