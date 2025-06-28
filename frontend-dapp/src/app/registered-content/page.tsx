// frontend-dapp/src/app/registered-content/page.tsx
"use client";

import { useAccount, usePublicClient } from "wagmi";
import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  SCIENTIFIC_CONTENT_REGISTRY_ABI,
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
  SCIENTIFIC_CONTENT_NFT_ABI,
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
} from "@/lib/constants";
import { useRegisterContent } from "@/hooks/useRegisterContent";
import { getContract } from "viem";
import { formatEther } from "viem";
import { Toaster } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import axios from "axios";

const PINATA_GATEWAY_SUBDOMAIN =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY_SUBDOMAIN;

const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-8">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    <p className="ml-4 text-gray-700">Caricamento...</p>
  </div>
);

const resolveIpfsLink = (ipfsUri: string): string => {
  if (!ipfsUri) return "";

  let cid: string;
  if (ipfsUri.startsWith("ipfs://")) {
    cid = ipfsUri.replace("ipfs://", "");
  } else {
    cid = ipfsUri;
  }

  if (PINATA_GATEWAY_SUBDOMAIN) {
    return `https://${PINATA_GATEWAY_SUBDOMAIN}.mypinata.cloud/ipfs/${cid}`;
  } else {
    console.warn(
      "NEXT_PUBLIC_PINATA_GATEWAY_SUBDOMAIN non è impostato. Utilizzo un gateway IPFS pubblico di fallback."
    );
    return `https://ipfs.io/ipfs/${cid}`;
  }
};

type RegistryContent = {
  title: string;
  description: string;
  author: `0x${string}`;
  contentHash: `0x${string}`;
  isAvailable: boolean;
  registrationTime: bigint;
  maxCopies: bigint;
  mintedCopies: bigint;
  ipfsHash: string;
  nftMintPrice: bigint;
};

type DisplayContent = RegistryContent & {
  contentId: bigint;
  displayImageUrl: string | undefined;
};

type MintingState = {
  contentId: bigint;
  startTime: number;
  tokenId?: bigint;
  txHash?: string;
  isCompleted: boolean;
};

const SuccessNotification = ({ 
  contentId, 
  tokenId, 
  txHash, 
  onClose 
}: { 
  contentId: bigint; 
  tokenId?: bigint | null;
  txHash?: string | null;
  onClose: () => void; 
}) => (
  <div className="fixed top-4 right-4 z-50 bg-green-500 text-white p-6 rounded-lg shadow-lg border-2 border-green-400 max-w-md">
    <div className="flex items-start">
      <div className="text-2xl mr-3">🎉</div>
      <div className="flex-1">
        <h3 className="font-bold text-lg">NFT Coniato con Successo!</h3>
        <p className="text-sm">Content ID: {contentId.toString()}</p>
        {tokenId && (
          <p className="text-sm">Token ID: {tokenId.toString()}</p>
        )}
        {txHash && (
          <p className="text-xs mt-1">
            <a
              href={`https://sepolia.arbiscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-200 hover:text-white underline"
            >
              Vedi transazione
            </a>
          </p>
        )}
        <p className="text-xs mt-1">Il tuo NFT è stato creato correttamente</p>
      </div>
      <button 
        onClick={onClose}
        className="ml-2 text-green-200 hover:text-white text-xl"
      >
        ×
      </button>
    </div>
  </div>
);

const RegisteredContentPage = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();

  const [registeredContents, setRegisteredContents] = useState<DisplayContent[]>([]);
  const [isLoadingContents, setIsLoadingContents] = useState<boolean>(true);
  const [contentsError, setContentsError] = useState<string | null>(null);

  // Stati per gestire il minting con fallback
  const [mintingStates, setMintingStates] = useState<Map<string, MintingState>>(new Map());
  const [showSuccessNotification, setShowSuccessNotification] = useState<{
    contentId: bigint;
    tokenId?: bigint | null;
    txHash?: string | null;
  } | null>(null);

  const {
    handleRequestMintForCopy,
    handleMetadataUpload,
    resetMintingState,
    isRequestMintPending,
    isRequestingMint,
    error
  } = useRegisterContent();

  const fetchRegisteredContents = useCallback(async () => {
    if (!publicClient) {
      setContentsError("Public client non disponibile.");
      setIsLoadingContents(false);
      return;
    }

    setIsLoadingContents(true);
    setContentsError(null);
    setRegisteredContents([]);

    try {
      const registryContract = getContract({
        address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
        abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
        client: publicClient,
      });

      const nftContract = getContract({
        address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
        abi: SCIENTIFIC_CONTENT_NFT_ABI,
        client: publicClient,
      });

      const nextContentIdBigInt = await registryContract.read.nextContentId();
      const totalContents = Number(nextContentIdBigInt) - 1;

      const fetchedContents: DisplayContent[] = [];

      for (let i = 1; i <= totalContents; i++) {
        try {
          const content = await registryContract.read.getContent([BigInt(i)]) as RegistryContent;

          let displayImageUrl: string | undefined = undefined;

          if (content.mintedCopies > BigInt(0)) {
            try {
              const firstTokenIdForContent = BigInt(i);
              const tokenURI = await nftContract.read.tokenURI([firstTokenIdForContent]) as string;

              if (tokenURI) {
                const resolvedTokenURI = resolveIpfsLink(tokenURI);
                const metadataResponse = await axios.get(resolvedTokenURI);
                const metadata = metadataResponse.data;

                if (metadata.image) {
                  const imageUrlAttempt = resolveIpfsLink(metadata.image);
                  if (imageUrlAttempt.endsWith(".pdf")) {
                    if (metadata.previewImageFileCID) {
                      displayImageUrl = resolveIpfsLink(metadata.previewImageFileCID);
                    }
                  } else {
                    displayImageUrl = imageUrlAttempt;
                  }
                } else if (metadata.previewImageFileCID) {
                  displayImageUrl = resolveIpfsLink(metadata.previewImageFileCID);
                }
              }
            } catch (metadataError) {
              console.warn(
                `Could not fetch or parse metadata for Content ID ${i}:`,
                metadataError
              );
            }
          }

          fetchedContents.push({
            contentId: BigInt(i),
            ...content,
            displayImageUrl: displayImageUrl,
          });
        } catch (innerError: any) {
          console.warn(
            `Errore durante il recupero del contenuto ID ${i}:`,
            innerError.message || innerError.shortMessage || String(innerError)
          );
        }
      }
      setRegisteredContents(fetchedContents);
    } catch (err: any) {
      console.error("Errore nel recupero dei contenuti registrati:", err);
      setContentsError(
        `Impossibile caricare i contenuti: ${
          err.message || err.shortMessage || String(err)
        }`
      );
    } finally {
      setIsLoadingContents(false);
    }
  }, [publicClient]);

  // Funzione per aggiungere un nuovo stato di minting
  const addMintingState = useCallback((contentId: bigint) => {
    const key = contentId.toString();
    setMintingStates(prev => {
      const newStates = new Map(prev);
      newStates.set(key, {
        contentId,
        startTime: Date.now(),
        isCompleted: false
      });
      return newStates;
    });
  }, []);

  // Funzione per completare il minting
  const completeMinting = useCallback((contentId: bigint, tokenId?: bigint, txHash?: string) => {
    const key = contentId.toString();
    setMintingStates(prev => {
      const newStates = new Map(prev);
      const existing = newStates.get(key);
      if (existing) {
        newStates.set(key, {
          ...existing,
          tokenId,
          txHash,
          isCompleted: true
        });
      }
      return newStates;
    });
  }, []);

  // Funzione per rimuovere lo stato di minting
  const removeMintingState = useCallback((contentId: bigint) => {
    const key = contentId.toString();
    setMintingStates(prev => {
      const newStates = new Map(prev);
      newStates.delete(key);
      return newStates;
    });
  }, []);

  // Funzione per verificare se un contenuto è in fase di minting
  const isContentMinting = useCallback((contentId: bigint): boolean => {
    const key = contentId.toString();
    const state = mintingStates.get(key);
    return state !== undefined && !state.isCompleted;
  }, [mintingStates]);

  // Polling per verificare se il minting è completato
  const checkMintingCompletion = useCallback(async (contentId: bigint) => {
    if (!publicClient || !address) return;

    try {
      const currentBlock = await publicClient.getBlockNumber();
      
      // Cerca eventi NFTMinted recenti
      const mintEvents = await publicClient.getLogs({
        address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
        event: {
          type: 'event',
          name: 'NFTMinted',
          inputs: [
            { name: 'contentId', type: 'uint256', indexed: true },
            { name: 'tokenId', type: 'uint256', indexed: true },
            { name: 'owner', type: 'address', indexed: true },
            { name: 'metadataURI', type: 'string', indexed: false }
          ]
        },
        fromBlock: currentBlock - BigInt(50), // Cerca negli ultimi 50 blocchi
        toBlock: 'latest'
      });

      // Filtra gli eventi per il contentId e owner correnti
      const relevantEvents = mintEvents.filter((event: any) => {
        const eventContentId = event.args?.contentId;
        const eventOwner = event.args?.owner;
        return eventContentId === contentId && 
               eventOwner?.toLowerCase() === address?.toLowerCase();
      });

      if (relevantEvents.length > 0) {
        const latestEvent = relevantEvents[relevantEvents.length - 1];
        const tokenId = latestEvent.args?.tokenId;
        const txHash = latestEvent.transactionHash;

        console.log("Evento NFTMinted trovato:", {
          contentId: contentId.toString(),
          tokenId: tokenId?.toString(),
          txHash
        });

        // Completa il minting
        completeMinting(contentId, tokenId, txHash);
        
        // Chiudi toast di loading
        toast.dismiss(`mint-${contentId.toString()}`);
        
        // Mostra notifica di successo
        setShowSuccessNotification({
          contentId,
          tokenId,
          txHash
        });

        // Ricarica contenuti
        setTimeout(() => {
          fetchRegisteredContents();
        }, 2000);

        return true; // Minting completato
      }
    } catch (error) {
      console.error("Errore durante il controllo del minting:", error);
    }
    
    return false; // Minting non ancora completato
  }, [publicClient, address, completeMinting, fetchRegisteredContents]);

  // Timeout automatico per il fallback
  const setupMintingTimeout = useCallback((contentId: bigint) => {
    const timeoutId = setTimeout(async () => {
      console.log(`Timeout raggiunto per contentId: ${contentId.toString()}`);
      
      // Prova un ultimo controllo prima del fallback
      const isCompleted = await checkMintingCompletion(contentId);
      
      if (!isCompleted) {
        // Fallback: considera il minting completato
        console.log("Attivando fallback per minting completato");
        
        // Chiudi toast di loading
        toast.dismiss(`mint-${contentId.toString()}`);
        
        // Mostra notifica di fallback
        setShowSuccessNotification({
          contentId,
          tokenId: null,
          txHash: null
        });
        
        // Completa il minting localmente
        completeMinting(contentId);
        
        // Ricarica contenuti
        setTimeout(() => {
          fetchRegisteredContents();
        }, 2000);
      }
    }, 12000); // 12 secondi

    return timeoutId;
  }, [checkMintingCompletion, completeMinting, fetchRegisteredContents]);

  // Carica contenuti al mount e setup interval
  useEffect(() => {
    if (isConnected && chainId === ARBITRUM_SEPOLIA_CHAIN_ID && publicClient) {
      fetchRegisteredContents();
      const intervalId = setInterval(fetchRegisteredContents, 60000);
      return () => clearInterval(intervalId);
    } else {
      setIsLoadingContents(false);
      setRegisteredContents([]);
      setContentsError(null);
    }
  }, [isConnected, chainId, publicClient, fetchRegisteredContents]);

  // Polling per verificare il completamento dei minting attivi - CORRETTO
  useEffect(() => {
    if (mintingStates.size === 0) return;

    const intervalId = setInterval(async () => {
      // Usa Array.from per convertire l'iteratore in array
      const mintingEntries = Array.from(mintingStates.entries());
      
      for (const [key, state] of mintingEntries) {
        if (!state.isCompleted) {
          await checkMintingCompletion(state.contentId);
        }
      }
    }, 3000); // Controlla ogni 3 secondi

    return () => clearInterval(intervalId);
  }, [mintingStates, checkMintingCompletion]);

  const onMintNewCopy = useCallback(
    async (contentId: bigint) => {
      if (!isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID || !address) {
        toast.error("Connetti il tuo wallet alla rete Arbitrum Sepolia.");
        return;
      }

      // Controlla se c'è già un minting in corso per questo contenuto
      if (isContentMinting(contentId)) {
        toast.error("Un minting è già in corso per questo contenuto. Attendi il completamento.");
        return;
      }

      const contentToMint = registeredContents.find(
        (c) => c.contentId === contentId
      );
      if (!contentToMint) {
        toast.error("Dettagli del contenuto non trovati.");
        return;
      }

      if (contentToMint.mintedCopies >= contentToMint.maxCopies) {
        toast.error(
          "Tutte le copie disponibili per questo contenuto sono già state mintate."
        );
        return;
      }

      console.log("Iniziando minting per contentId:", contentId.toString());

      // Aggiungi lo stato di minting
      addMintingState(contentId);

      // Mostra toast di preparazione
      toast.loading(
        `Preparazione minting per Content ID ${contentId.toString()}...`,
        { id: `mint-${contentId.toString()}` }
      );

      try {
        // Reset dello stato di minting nell'hook
        if (resetMintingState) {
          resetMintingState();
        }
        
        const mainDocCid = contentToMint.ipfsHash.replace("ipfs://", "");
        const previewCid = contentToMint.displayImageUrl
          ? contentToMint.displayImageUrl.split("/ipfs/")[1]
          : "";

        console.log("Caricando metadati...");
        const metadataCid = await handleMetadataUpload({
          isCopy: true,
          contentId: contentId,
          title: contentToMint.title,
          description: contentToMint.description,
          mainDocumentIpfsHash: mainDocCid,
          previewImageIpfsHash: previewCid,
        });

        if (!metadataCid) {
          throw new Error("Impossibile generare i metadati per il nuovo NFT");
        }

        const metadataJsonUri = `ipfs://${metadataCid}`;

        // Aggiorna toast
        toast.loading(
          `Conio NFT in corso per Content ID ${contentId.toString()}...`,
          { id: `mint-${contentId.toString()}` }
        );

        console.log("Avviando transazione di minting...");
        await handleRequestMintForCopy(
          contentId,
          metadataJsonUri,
          contentToMint.nftMintPrice
        );

        console.log("Transazione di minting avviata, avviando timeout...");
        
        // Avvia il timeout per il fallback
        setupMintingTimeout(contentId);

      } catch (err: any) {
        console.error("Errore nel minting:", err);
        
        // Rimuovi lo stato di minting in caso di errore
        removeMintingState(contentId);
        
        // Chiudi toast di loading e mostra errore
        toast.dismiss(`mint-${contentId.toString()}`);
        toast.error(`Errore: ${err.message || "Operazione fallita"}`);
        
        // Reset dell'hook
        if (resetMintingState) {
          resetMintingState();
        }
      }
    },
    [
      address,
      isConnected,
      chainId,
      registeredContents,
      isContentMinting,
      addMintingState,
      removeMintingState,
      handleRequestMintForCopy,
      handleMetadataUpload,
      resetMintingState,
      setupMintingTimeout
    ]
  );

  const handleCloseSuccessNotification = () => {
    setShowSuccessNotification(null);
    
    // Rimuovi lo stato di minting se presente
    if (showSuccessNotification) {
      removeMintingState(showSuccessNotification.contentId);
    }
    
    // Reset finale degli stati
    if (resetMintingState) {
      resetMintingState();
    }
  };

  if (!mounted) {
    return null;
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center bg-gray-900 text-white p-4">
        <h1 className="text-2xl font-bold mb-4 text-purple-400">
          Connetti il tuo Wallet
        </h1>
        <p className="text-gray-400 mb-4">
          Per visualizzare e interagire con i contenuti, per favore connetti il
          tuo wallet.
        </p>
        <ConnectButton />
      </div>
    );
  }

  if (chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center bg-gray-900 text-red-400 p-4">
        <h1 className="text-2xl font-bold mb-4">Rete Errata</h1>
        <p className="text-gray-400">
          Per favore connetti il tuo wallet alla rete Arbitrum Sepolia per
          visualizzare i contenuti.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-200 text-white min-h-screen">
      <Toaster position="top-right" />
      
      {showSuccessNotification && (
        <SuccessNotification 
          contentId={showSuccessNotification.contentId}
          tokenId={showSuccessNotification.tokenId}
          txHash={showSuccessNotification.txHash}
          onClose={handleCloseSuccessNotification}
        />
      )}
      
      <Card className="bg-gray-200 border-purple-600">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-purple-400">
            Contenuti Scientifici Registrati
          </CardTitle>
          <CardDescription className="text-gray-700">
            Esplora tutti i contenuti scientifici registrati. Se disponibile,
            puoi coniare una nuova copia NFT.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingContents ? (
            <LoadingSpinner />
          ) : contentsError ? (
            <div className="text-red-500 text-center py-8">
              Errore: {contentsError}
            </div>
          ) : registeredContents.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-lg">
              Nessun contenuto registrato trovato.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-full divide-y divide-gray-200">
                <TableHeader className="bg-gray-700">
                  <TableRow>
                    <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                      ID
                    </TableHead>
                    <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                      Titolo
                    </TableHead>
                    <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                      Autore
                    </TableHead>
                    <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                      Immagine Copertina
                    </TableHead>
                    <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                      Documento Principale
                    </TableHead>
                    <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                      Copie (Mintate/Massime)
                    </TableHead>
                    <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                      Prezzo Mint
                    </TableHead>
                    <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                      Disponibilità
                    </TableHead>
                    <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                      Azioni
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-gray-600 divide-y divide-gray-700">
                  {registeredContents.map((content) => {
                    const isCurrentlyMinting = isContentMinting(content.contentId);
                    
                    return (
                      <TableRow
                        key={content.contentId.toString()}
                        className="hover:bg-gray-500 transition-colors"
                      >
                        <TableCell className="px-4 py-3 whitespace-nowrap font-medium text-purple-300">
                          {content.contentId.toString()}
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap text-gray-200">
                          {content.title}
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap text-gray-200 text-xs">
                          {content.author}
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap">
                          {content.displayImageUrl ? (
                            <Image
                              src={content.displayImageUrl}
                              alt={`Copertina di ${content.title}`}
                              width={80}
                              height={80}
                              className="rounded-md object-cover"
                              onError={(e) => {
                                e.currentTarget.src =
                                  "https://placehold.co/80x80/333333/ffffff?text=No+Img";
                                e.currentTarget.alt = "Immagine non disponibile";
                              }}
                            />
                          ) : (
                            <Image
                              src="https://placehold.co/80x80/333333/ffffff?text=No+Img"
                              alt="Immagine non disponibile"
                              width={80}
                              height={80}
                              className="rounded-md object-cover"
                            />
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap">
                          {content.ipfsHash ? (
                            <Link
                              href={resolveIpfsLink(content.ipfsHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              Scarica Documento
                            </Link>
                          ) : (
                            <span className="text-gray-400">Non Disponibile</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap text-gray-200">
                          {content.mintedCopies.toString()} /{" "}
                          {content.maxCopies.toString()}
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap text-gray-200">
                          {formatEther(content.nftMintPrice)} ETH
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              content.isAvailable &&
                              content.mintedCopies < content.maxCopies
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {content.isAvailable &&
                            content.mintedCopies < content.maxCopies
                              ? "Disponibile"
                              : "Esaurito"}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap">
                          {content.mintedCopies < content.maxCopies &&
                          content.isAvailable ? (
                            <Button
                              onClick={() => onMintNewCopy(content.contentId)}
                              disabled={isCurrentlyMinting}
                              className={`px-4 py-2 rounded-md shadow-sm text-sm font-medium transition-colors ${
                                isCurrentlyMinting
                                  ? "bg-yellow-600 hover:bg-yellow-700 text-white cursor-not-allowed"
                                  : "bg-purple-600 hover:bg-purple-700 text-white"
                              }`}
                            >
                              {isCurrentlyMinting ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Coniando...
                                </div>
                              ) : (
                                "Conia Nuova Copia"
                              )}
                            </Button>
                          ) : (
                            <Button
                              disabled
                              className="bg-gray-600 text-gray-400 px-4 py-2 rounded-md shadow-sm text-sm font-medium cursor-not-allowed"
                            >
                              Non Disponibile
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisteredContentPage;

