// frontend-dapp/src/components/EventFeed.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useEventFeed } from "./../app/providers";


const eventNameMap: { [key: string]: string } = {
  Approval: "Approvazione",
  ApprovalForAll: "Approvazione per tutti",
  BaseURIUpdated: "Base URI aggiornata",
  CoordinatorSet: "Coordinatore impostato",
  MintingFailed: "Conio fallito",
  NFTMinted: "NFT Coniato", 
  OwnershipTransferRequested: "Richiesto trasferimento proprietà",
  OwnershipTransferred: "Proprietà trasferita",
  ProtocolFeeReceiverUpdated: "Ricevitore fee protocollo aggiornato",
  ProtocolFeesWithdrawn: "Fee protocollo ritirate",
  Transfer: "Trasferimento NFT", 

 
  AuctionEnded: "Asta terminata",
  AuctionStarted: "Asta iniziata",
  NFTClaimed: "NFT Reclamato",
  NFTListedForSale: "NFT messo in vendita", 
  NFTPurchased: "NFT Acquistato",
  NFTSaleRemoved: "Vendita NFT Revocata", 
  NewBid: "Nuova Offerta",
  RefundProcessed: "Rimborso Processato",

  
  safeTransferFrom: "Trasferimento NFT", 
  listNFTForSale: "Messa in vendita NFT", 
  removeNFTFromSale: "Rimozione vendita NFT", 

  
  frontend_tx_status: "Aggiornamento Stato Transazione", 
};


const formatEventName = (name: string): string => {
  return eventNameMap[name] || name.replace(/([A-Z])/g, " $1").trim();
};


const formatAddress = (address: string | undefined): string => {
  if (!address) return "N/A"; 
  return `${address.substring(0, 6)}...${address.substring(
    address.length - 4
  )}`;
};


const formatPriceInWeiToEth = (
  wei: string | number | { $numberLong: string }
): string => {
  let weiValue: string;
  if (typeof wei === "object" && wei && "$numberLong" in wei) {
    weiValue = wei.$numberLong;
  } else if (typeof wei === "number") {
    weiValue = wei.toString();
  } else {
    weiValue = wei as string;
  }


  if (!weiValue || !/^\d+$/.test(weiValue)) {
    console.warn(
      `Tentativo di convertire un valore non intero in BigInt (formatPriceInWeiToEth): ${weiValue}`
    );
    return "Invalid Wei Value";
  }

  const ethValue = (BigInt(weiValue) / BigInt(1e18)).toString();
  return `${ethValue} ETH`;
};


const getEventId = (event: any): string | null => {

  if (event._id) {
    if (
      typeof event._id === "object" &&
      event._id !== null &&
      "$oid" in event._id
    ) {
      return event._id.$oid;
    }
    if (typeof event._id === "string") {
      return event._id;
    }
  }
  
  if (event.transactionHash && event.logIndex !== undefined) {
    return `${event.transactionHash}-${event.logIndex}`;
  }
  
  if (event.transactionHash) {
    if (event.metadata_frontend_tx?.methodName) {
      return `${event.transactionHash}-${event.metadata_frontend_tx.methodName}`;
    }
    if (event.methodName) {
      return `${event.transactionHash}-${event.methodName}`;
    }
    if (event.source) {
      return `${event.transactionHash}-${event.source}`;
    }
  }
  return null;
};


const renderExpandedDetails = (event: any) => {
  
  const eventType =
    event.metadata_frontend_tx?.methodName || event.event || event.methodName;
  const args = event.args || event.metadata_frontend_tx;

  
  const commonDetails = (
    <div>
      {/* <p><strong>Hash:</strong> {formatAddress(event.transactionHash)}</p> */}
      <p>
        <strong>Hash:</strong>
        <a
          href={`https://sepolia.arbiscan.io/tx/${event.transactionHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline ml-1"
        >
          {formatAddress(event.transactionHash)}
        </a>
      </p>
      <p>
        <strong>Da:</strong> {formatAddress(event.from)}
      </p>
      <p>
        <strong>A:</strong> {formatAddress(event.to)}
      </p>
      <p>
        <strong>Metodo:</strong> {eventType || "N/A"}
      </p>
      <p>
        <strong>Status:</strong>{" "}
        {event.status || event.metadata_frontend_tx?.status || "N/A"}
      </p>
      <p>
        <strong>Block:</strong> {event.blockNumber || "N/A"}
      </p>
      {event.gasUsed && (
        <p>
          <strong>Gas Used:</strong> {event.gasUsed}
        </p>
      )}
      {event.gasPrice && (
        <p>
          <strong>Gas Price:</strong> {event.gasPrice}
        </p>
      )}
      {event.value && event.value !== "0" && (
        <p>
          <strong>Valore:</strong> {event.value} ETH
        </p>
      )}
    </div>
  );

  let specificDetails = null;
  if (args) {
    switch (eventType) {
      case "ApprovalForAll":
        specificDetails = (
          <div>
            <p>
              <strong>Proprietario:</strong> {formatAddress(args.owner)}
            </p>
            <p>
              <strong>Operatore:</strong> {formatAddress(args.operator)}
            </p>
            <p>
              <strong>Approvato:</strong> {args.approved ? "Sì" : "No"}
            </p>
          </div>
        );
        break;
      case "Transfer":
      case "safeTransferFrom":
        specificDetails = (
          <div>
            <p>
              <strong>Da:</strong> {formatAddress(args.from || event.from)}
            </p>
            <p>
              <strong>A:</strong> {formatAddress(args.to || args.recipient)}
            </p>
            <p>
              <strong>Token ID:</strong> {args.tokenId}
            </p>
          </div>
        );
        break;
      case "NFTListedForSale":
      case "listNFTForSale":
        let displayPrice;
        if (
          typeof args.priceEth === "number" ||
          typeof args.priceEth === "string"
        ) {
          displayPrice = `${args.priceEth} ETH`;
        } else if (args.price) {
          displayPrice = formatPriceInWeiToEth(args.price);
        } else {
          displayPrice = "N/A";
        }
        specificDetails = (
          <div>
            <p>
              <strong>Venditore:</strong>{" "}
              {formatAddress(args.seller || event.from)}
            </p>
            <p>
              <strong>Token ID:</strong> {args.tokenId}
            </p>
            <p>
              <strong>Prezzo:</strong> {displayPrice}
            </p>
            {args.timestamp && (
              <p>
                <strong>Timestamp di vendita:</strong>{" "}
                {new Date(args.timestamp * 1000).toLocaleString()}
              </p>
            )}
          </div>
        );
        break;
      case "removeNFTFromSale":
      case "NFTSaleRemoved":
        specificDetails = (
          <div>
            <p>
              <strong>Venditore:</strong>{" "}
              {formatAddress(args.from || event.from)}
            </p>
            <p>
              <strong>Token ID:</strong> {args.tokenId}
            </p>
            <p>
              <strong>Azione:</strong> Vendita rimossa
            </p>
          </div>
        );
        break;
      case "NFTMinted":
        specificDetails = (
          <div>
            <p>
              <strong>A:</strong> {formatAddress(args.to)}
            </p>
            <p>
              <strong>Token ID:</strong> {args.tokenId}
            </p>
          </div>
        );
        break;
      default:
        specificDetails = (
          <p>Dettagli specifici non disponibili per questo tipo di evento.</p>
        );
    }
  } else {
    specificDetails = (
      <p>Nessun argomento specifico dell'evento disponibile.</p>
    );
  }

  return (
    <div className="text-sm break-all">
      <p className="font-bold">Dettagli Generali:</p>
      {commonDetails}
      <p className="font-bold mt-2">Dettagli Specifici Evento:</p>
      {specificDetails}
    </div>
  );
};


const EventFeedNavbar = () => {
  const newEvents = useEventFeed();
  const [displayedEvents, setDisplayedEvents] = useState<any[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const fetchEventHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch("/api/events/history?limit=20");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const history: any[] = await response.json();
      console.log("Dati storici recuperati dall'API:", history);
      setDisplayedEvents(history.slice(0, 5));
      localStorage.setItem(
        "blockchainEvents",
        JSON.stringify(history.slice(0, 5))
      );
    } catch (error) {
      console.error(
        "Errore nel caricamento della cronologia eventi dall'API:",
        error
      );
      try {
        const storedEvents = localStorage.getItem("blockchainEvents");
        if (storedEvents) {
          setDisplayedEvents(JSON.parse(storedEvents));
        }
      } catch (e) {
        console.error("Errore fallback da Local Storage", e);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchEventHistory();
  }, [fetchEventHistory]);

  useEffect(() => {
    if (newEvents.length === 0) return;

    console.log("Ricevuti nuovi eventi dal WebSocket:", newEvents);

    setDisplayedEvents((prevEvents) => {
      const updatedEvents = [...prevEvents];

      newEvents.forEach((latestEvent) => {
        const eventId = getEventId(latestEvent);
        console.log(`Processing event from WebSocket with ID: ${eventId}`);

        if (!eventId) {
          console.warn(
            "Evento WebSocket ricevuto senza ID univoco, non sarà processato:",
            latestEvent
          );
          return;
        }

        const existingEventIndex = updatedEvents.findIndex(
          (e) => getEventId(e) === eventId
        );

        if (existingEventIndex > -1) {
          console.log(`Aggiornamento evento esistente con ID: ${eventId}`);
          updatedEvents[existingEventIndex] = {
            ...updatedEvents[existingEventIndex],
            ...latestEvent,
          };
        } else {
          console.log(`Aggiunta nuovo evento con ID: ${eventId}`);
          updatedEvents.unshift(latestEvent);
        }
      });

      const finalEvents = updatedEvents.slice(0, 5);
      console.log("Stato finale degli eventi visualizzati:", finalEvents);

      try {
        localStorage.setItem("blockchainEvents", JSON.stringify(finalEvents));
      } catch (error) {
        console.error(
          "Errore nel salvataggio degli eventi nel Local Storage",
          error
        );
      }

      return finalEvents;
    });
  }, [newEvents]);

  const toggleExpand = useCallback((transactionHash: string | null) => {
    setExpandedEventId((prevId) =>
      prevId === transactionHash ? null : transactionHash
    );
  }, []);

  if (isLoadingHistory) {
    return (
      <div className="relative group">
        <div className="flex items-center space-x-2 px-3 py-2 text-white hover:text-purple-300 transition-colors cursor-pointer">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
          <span className="text-sm">Caricamento...</span>
        </div>
      </div>
    );
  }

  if (displayedEvents.length === 0) {
    return (
      <div className="relative group">
        <div className="flex items-center space-x-2 px-3 py-2 text-white hover:text-purple-300 transition-colors cursor-pointer">
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          <span className="text-sm">Nessun evento</span>
        </div>
      </div>
    );
  }

  const latestEvent = displayedEvents[0];
  let eventNameToDisplay: string | undefined;

  if (latestEvent.metadata_frontend_tx?.methodName) {
    eventNameToDisplay = latestEvent.metadata_frontend_tx.methodName;
  } else if (latestEvent.event) {
    eventNameToDisplay = latestEvent.event;
  } else if (latestEvent.methodName) {
    eventNameToDisplay = latestEvent.methodName;
  } else if (latestEvent.source === "frontend_tx_status") {
    eventNameToDisplay = latestEvent.source;
  }

  const displayEventName = eventNameToDisplay
    ? `${formatEventName(eventNameToDisplay)}`
    : "Evento Sconosciuto";

  return (
    <div className="relative group">

      <div className="flex items-center space-x-2 px-3 py-2 text-white hover:text-purple-300 transition-colors cursor-pointer">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        <span className="text-sm font-medium">{displayEventName}</span>
        <svg
          className="w-4 h-4 transition-transform group-hover:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

  
      <div className="absolute top-full right-0 mt-2 w-96 bg-white shadow-xl rounded-lg overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-50">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
          <h3 className="text-lg font-bold text-white">Eventi Recenti</h3>
          <p className="text-blue-100 text-sm">
            Ultimi 5 eventi della piattaforma
          </p>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {displayedEvents.map((event: any, index: number) => {
            let eventNameToDisplay: string | undefined;

            if (event.metadata_frontend_tx?.methodName) {
              eventNameToDisplay = event.metadata_frontend_tx.methodName;
            } else if (event.event) {
              eventNameToDisplay = event.event;
            } else if (event.methodName) {
              eventNameToDisplay = event.methodName;
            } else if (event.source === "frontend_tx_status") {
              eventNameToDisplay = event.source;
            }

            const displayEventName = eventNameToDisplay
              ? `${formatEventName(eventNameToDisplay)}`
              : "Evento Sconosciuto";

            const transactionHash = event.transactionHash;
            const isExpanded = expandedEventId === transactionHash;
            const itemKey = getEventId(event) || `event-${index}`;

            const timestampToUse =
              event.timestamp_processed || event.createdAt || event.timestamp;
            const isValidDate =
              timestampToUse && !isNaN(new Date(timestampToUse).getTime());
            const displayTimestamp = isValidDate
              ? new Date(timestampToUse).toLocaleString()
              : "N/A";

            return (
              <div
                key={itemKey}
                className="border-b border-gray-100 last:border-b-0"
              >
                <div
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => toggleExpand(transactionHash)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            index === 0 ? "bg-green-400" : "bg-blue-400"
                          }`}
                        ></div>
                        <p className="text-sm font-medium text-gray-900">
                          {displayEventName}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatAddress(transactionHash)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {displayTimestamp}
                      </p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200">
                    <div className="mt-3 p-3 bg-white rounded-md shadow-sm text-gray-900">
                      {renderExpandedDetails(event)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-gray-50 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Passa il mouse per mantenere aperto
          </p>
        </div>
      </div>
    </div>
  );
};

const EventFeed = () => {
  const newEvents = useEventFeed();
  const [displayedEvents, setDisplayedEvents] = useState<any[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const fetchEventHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch("/api/events/history?limit=20");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const history: any[] = await response.json();
      console.log("Dati storici recuperati dall'API:", history);
      setDisplayedEvents(history.slice(0, 5));
      localStorage.setItem(
        "blockchainEvents",
        JSON.stringify(history.slice(0, 5))
      );
    } catch (error) {
      console.error(
        "Errore nel caricamento della cronologia eventi dall'API:",
        error
      );
      try {
        const storedEvents = localStorage.getItem("blockchainEvents");
        if (storedEvents) {
          setDisplayedEvents(JSON.parse(storedEvents));
        }
      } catch (e) {
        console.error("Errore fallback da Local Storage", e);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchEventHistory();
  }, [fetchEventHistory]);

  useEffect(() => {
    if (newEvents.length === 0) return;

    console.log("Ricevuti nuovi eventi dal WebSocket:", newEvents);

    setDisplayedEvents((prevEvents) => {
      const updatedEvents = [...prevEvents];

      newEvents.forEach((latestEvent) => {
        const eventId = getEventId(latestEvent);
        console.log(`Processing event from WebSocket with ID: ${eventId}`);

        if (!eventId) {
          console.warn(
            "Evento WebSocket ricevuto senza ID univoco, non sarà processato:",
            latestEvent
          );
          return;
        }

        const existingEventIndex = updatedEvents.findIndex(
          (e) => getEventId(e) === eventId
        );

        if (existingEventIndex > -1) {
          console.log(`Aggiornamento evento esistente con ID: ${eventId}`);
          updatedEvents[existingEventIndex] = {
            ...updatedEvents[existingEventIndex],
            ...latestEvent,
          };
        } else {
          console.log(`Aggiunta nuovo evento con ID: ${eventId}`);
          updatedEvents.unshift(latestEvent);
        }
      });

      const finalEvents = updatedEvents.slice(0, 5);
      console.log("Stato finale degli eventi visualizzati:", finalEvents);

      try {
        localStorage.setItem("blockchainEvents", JSON.stringify(finalEvents));
      } catch (error) {
        console.error(
          "Errore nel salvataggio degli eventi nel Local Storage",
          error
        );
      }

      return finalEvents;
    });
  }, [newEvents]);

  const toggleExpand = useCallback((transactionHash: string | null) => {
    setExpandedEventId((prevId) =>
      prevId === transactionHash ? null : transactionHash
    );
  }, []);

  if (isLoadingHistory) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg text-center text-gray-600">
        Caricamento cronologia eventi...
      </div>
    );
  }

  if (displayedEvents.length === 0) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg text-center text-gray-600">
        Nessun evento recente.
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white shadow-lg rounded-lg overflow-hidden my-4">
      <h2 className="text-xl font-bold p-4 bg-blue-600 text-white">
        Eventi di trasferimento , asta o vendita
      </h2>
      <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {displayedEvents.map((event: any, index: number) => {
          let eventNameToDisplay: string | undefined;

          if (event.metadata_frontend_tx?.methodName) {
            eventNameToDisplay = event.metadata_frontend_tx.methodName;
          } else if (event.event) {
            eventNameToDisplay = event.event;
          } else if (event.methodName) {
            eventNameToDisplay = event.methodName;
          } else if (event.source === "frontend_tx_status") {
            eventNameToDisplay = event.source;
          }

          const displayEventName = eventNameToDisplay
            ? `${formatEventName(eventNameToDisplay)}`
            : "Evento Sconosciuto";

          const transactionHash = event.transactionHash;
          const isExpanded = expandedEventId === transactionHash;
          const itemKey = getEventId(event) || `event-${index}`;

          const timestampToUse =
            event.timestamp_processed || event.createdAt || event.timestamp;
          const isValidDate =
            timestampToUse && !isNaN(new Date(timestampToUse).getTime());
          const displayTimestamp = isValidDate
            ? new Date(timestampToUse).toLocaleString()
            : "N/A";

          return (
            <li
              key={itemKey}
              className="p-4 hover:bg-gray-50 cursor-pointer"
              onClick={() => toggleExpand(transactionHash)}
            >
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-gray-900">
                  {displayEventName}
                </p>
                <p className="text-xs text-gray-500">
                  Transazione: {formatAddress(transactionHash)}
                </p>
                <p className="text-xs text-gray-500">
                  Timestamp: {displayTimestamp}
                </p>
              </div>
              {isExpanded && (
                <div className="mt-4 p-4 bg-gray-100 rounded-md break-all">
                  {renderExpandedDetails(event)}
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
export { EventFeedNavbar }; 
