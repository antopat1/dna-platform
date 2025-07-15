"use client";

import { useAccount, usePublicClient } from "wagmi";
import { useEffect, useState, useCallback, useMemo } from "react";
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

const CACHE_KEY = "registeredContentsCache";
const CACHE_VALIDITY_MS = 300000; // 5 minuti (per la validità della cache, non per l'aggiornamento)

const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-8">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
    <p className="ml-4 text-white">Caricamento...</p>
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
  onClose,
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
        {tokenId && <p className="text-sm">Token ID: {tokenId.toString()}</p>}
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

const ITEMS_PER_PAGE = 10;
const PLACEHOLDER_IMAGE_URL =
  "https://placehold.co/80x80/333333/ffffff?text=No+Img";

const RegisteredContentPage = () => {
  const [mounted, setMounted] = useState(false);
  const [contentTokenMapping, setContentTokenMapping] = useState<
    Map<string, bigint[]>
  >(new Map());
  const [lastProcessedBlock, setLastProcessedBlock] = useState<bigint | null>(
    null
  );
  const [isMappingInitialized, setIsMappingInitialized] =
    useState<boolean>(false);

  useEffect(() => setMounted(true), []);

  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();

  const [registeredContents, setRegisteredContents] = useState<
    DisplayContent[]
  >([]);
  const [isLoadingContents, setIsLoadingContents] = useState<boolean>(true);
  const [contentsError, setContentsError] = useState<string | null>(null);
  const [isAnyMintingInProgress, setIsAnyMintingInProgress] =
    useState<boolean>(false);

  const [mintingStates, setMintingStates] = useState<Map<string, MintingState>>(
    new Map()
  );
  const [showSuccessNotification, setShowSuccessNotification] = useState<{
    contentId: bigint;
    tokenId?: bigint | null;
    txHash?: string | null;
  } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);

  const {
    handleRequestMintForCopy,
    handleMetadataUpload,
    resetMintingState,
    isRequestMintPending,
    isRequestingMint,
    error,
  } = useRegisterContent();

  // Funzioni per gestire la cache in localStorage con conversione BigInt
  type SerializedDisplayContent = Omit<DisplayContent, 'contentId' | 'registrationTime' | 'maxCopies' | 'mintedCopies' | 'nftMintPrice'> & {
    contentId: string;
    registrationTime: string;
    maxCopies: string;
    mintedCopies: string;
    nftMintPrice: string;
  };

  const getCachedContents = useCallback((): DisplayContent[] | null => {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (!cachedData) return null;

    const { data, timestamp }: { data: SerializedDisplayContent[]; timestamp: number } = JSON.parse(cachedData);
    if (Date.now() - timestamp > CACHE_VALIDITY_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    // Riconverti stringhe in BigInt
    return data.map((cachedContent) => ({
      ...cachedContent,
      contentId: BigInt(cachedContent.contentId),
      registrationTime: BigInt(cachedContent.registrationTime),
      maxCopies: BigInt(cachedContent.maxCopies),
      mintedCopies: BigInt(cachedContent.mintedCopies),
      nftMintPrice: BigInt(cachedContent.nftMintPrice),
    }));
  }, []);

  const setCachedContents = useCallback((contents: DisplayContent[]) => {
    // Converti BigInt in stringhe per serializzazione
    const serializedContents: SerializedDisplayContent[] = contents.map((content) => ({
      ...content,
      contentId: content.contentId.toString(),
      registrationTime: content.registrationTime.toString(),
      maxCopies: content.maxCopies.toString(),
      mintedCopies: content.mintedCopies.toString(),
      nftMintPrice: content.nftMintPrice.toString(),
    }));

    const cacheData = {
      data: serializedContents,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  }, []);

  const buildContentTokenMapping = useCallback(async () => {
    if (!publicClient) return;

    try {
      console.log("Costruendo mappatura contentId → tokenId dagli eventi...");

      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = lastProcessedBlock || BigInt(0);

      const mintEvents = await publicClient.getLogs({
        address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
        event: {
          type: "event",
          name: "NFTMinted",
          inputs: [
            { name: "contentId", type: "uint256", indexed: true },
            { name: "tokenId", type: "uint256", indexed: true },
            { name: "owner", type: "address", indexed: true },
            { name: "metadataURI", type: "string", indexed: false },
          ],
        },
        fromBlock,
        toBlock: "latest",
      });

      const newMapping = new Map(contentTokenMapping);

      mintEvents.forEach((event: any) => {
        const contentId = event.args?.contentId;
        const tokenId = event.args?.tokenId;

        if (contentId && tokenId) {
          const contentKey = contentId.toString();
          const existingTokens = newMapping.get(contentKey) || [];

          if (!existingTokens.includes(tokenId)) {
            newMapping.set(contentKey, [...existingTokens, tokenId]);
          }
        }
      });

      setContentTokenMapping(newMapping);
      setLastProcessedBlock(currentBlock);
      setIsMappingInitialized(true);

      console.log(`Mappatura aggiornata con ${mintEvents.length} nuovi eventi`);
    } catch (error) {
      console.error("Errore nella costruzione della mappatura:", error);
      setIsMappingInitialized(true);
    }
  }, [publicClient, contentTokenMapping, lastProcessedBlock]);

  const fetchRegisteredContents = useCallback(async () => {
    if (!publicClient) {
      setContentsError("Public client non disponibile.");
      setIsLoadingContents(false);
      return;
    }

    setIsLoadingContents(true);
    setContentsError(null);

    // Passo 1: Controlla cache locale
    const cachedContents = getCachedContents();
    if (cachedContents) {
      setRegisteredContents(cachedContents);
      setIsLoadingContents(false);
      console.log("Caricato da cache locale");
    } else {
      setRegisteredContents([]);
    }

    // Passo 2: Fetcha o aggiorna dalla blockchain
    try {
      if (!isMappingInitialized) {
        await buildContentTokenMapping();
      }

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

      let fetchedContents: DisplayContent[] = cachedContents || [];
      const startId = fetchedContents.length + 1; // Inizia dal primo ID non cachato

      const metadataPromises: Promise<void>[] = [];

      for (let i = startId; i <= totalContents; i++) {
        try {
          const content = (await registryContract.read.getContent([
            BigInt(i),
          ])) as RegistryContent;

          fetchedContents.push({
            contentId: BigInt(i),
            ...content,
            displayImageUrl: undefined,
          });

          if (content.mintedCopies > BigInt(0)) {
            const fetchMetadataPromise = (async () => {
              let displayImageUrl: string | undefined = undefined;
              try {
                const contentKey = i.toString();
                const tokenIds = contentTokenMapping.get(contentKey);

                if (tokenIds && tokenIds.length > 0) {
                  const firstTokenId = tokenIds[0];
                  const tokenURI = (await nftContract.read.tokenURI([
                    firstTokenId,
                  ])) as string;

                  if (tokenURI) {
                    const resolvedTokenURI = resolveIpfsLink(tokenURI);
                    const metadataResponse = await axios.get(resolvedTokenURI);
                    const metadata = metadataResponse.data;

                    if (metadata.image) {
                      const imageUrlAttempt = resolveIpfsLink(metadata.image);
                      if (imageUrlAttempt.endsWith(".pdf")) {
                        if (metadata.previewImageFileCID) {
                          displayImageUrl = resolveIpfsLink(
                            metadata.previewImageFileCID
                          );
                        }
                      } else {
                        displayImageUrl = imageUrlAttempt;
                      }
                    } else if (metadata.previewImageFileCID) {
                      displayImageUrl = resolveIpfsLink(
                        metadata.previewImageFileCID
                      );
                    }
                  }
                } else {
                  console.warn(
                    `Nessun tokenId trovato nella mappatura per contentId ${i}, usando fallback`
                  );

                  const totalSupply = await nftContract.read.totalSupply();
                  let foundTokenId: bigint | null = null;

                  for (
                    let tokenId = 1;
                    tokenId <= Number(totalSupply);
                    tokenId++
                  ) {
                    try {
                      const nftMetadata = (await nftContract.read.getNFTMetadata([
                        BigInt(tokenId),
                      ])) as {
                        contentId: bigint;
                        author: string;
                        randomSeed: bigint;
                        hasSpecialContent: boolean;
                        copyNumber: bigint;
                        metadataURI: string;
                      };
                      if (nftMetadata.contentId === BigInt(i)) {
                        foundTokenId = BigInt(tokenId);
                        break;
                      }
                    } catch (tokenError) {
                      continue;
                    }
                  }

                  if (foundTokenId) {
                    const tokenURI = (await nftContract.read.tokenURI([
                      foundTokenId,
                    ])) as string;

                    if (tokenURI) {
                      const resolvedTokenURI = resolveIpfsLink(tokenURI);
                      const metadataResponse = await axios.get(resolvedTokenURI);
                      const metadata = metadataResponse.data;

                      if (metadata.image) {
                        const imageUrlAttempt = resolveIpfsLink(metadata.image);
                        if (imageUrlAttempt.endsWith(".pdf")) {
                          if (metadata.previewImageFileCID) {
                            displayImageUrl = resolveIpfsLink(
                              metadata.previewImageFileCID
                            );
                          }
                        } else {
                          displayImageUrl = imageUrlAttempt;
                        }
                      } else if (metadata.previewImageFileCID) {
                        displayImageUrl = resolveIpfsLink(
                          metadata.previewImageFileCID
                        );
                      }
                    }
                  }
                }
              } catch (metadataError) {
                console.warn(
                  `Could not fetch or parse metadata for Content ID ${i}:`,
                  metadataError
                );
              }

              const contentIndex = fetchedContents.findIndex(
                (c) => c.contentId === BigInt(i)
              );
              if (contentIndex !== -1) {
                fetchedContents[contentIndex].displayImageUrl = displayImageUrl;
              }
            })();

            metadataPromises.push(fetchMetadataPromise);
          }
        } catch (innerError: any) {
          console.warn(
            `Errore durante il recupero del contenuto ID ${i}:`,
            innerError.message || innerError.shortMessage || String(innerError)
          );
        }
      }

      await Promise.all(metadataPromises);

      // Aggiorna stato e cache solo se ci sono cambiamenti
      if (fetchedContents.length > (cachedContents?.length || 0)) {
        setRegisteredContents(fetchedContents);
        setCachedContents(fetchedContents);
      }
    } catch (err: any) {
      console.error("Errore nel recupero dei contenuti registrati:", err);
      setContentsError(
        `Impossibile caricare i contenuti: ${
          err.message || err.shortMessage || String(err)
        }`
      );
    } finally {
      if (!cachedContents) {
        setIsLoadingContents(false);
      }
    }
  }, [
    publicClient,
    contentTokenMapping,
    isMappingInitialized,
    buildContentTokenMapping,
    getCachedContents,
    setCachedContents,
  ]);

  const totalPages = useMemo(
    () => Math.ceil(registeredContents.length / ITEMS_PER_PAGE),
    [registeredContents]
  );

  const currentContents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return registeredContents.slice(startIndex, endIndex);
  }, [registeredContents, currentPage]);

  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const goToPrevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages]
  );

  const addMintingState = useCallback((contentId: bigint) => {
    const key = contentId.toString();
    setMintingStates((prev) => {
      const newStates = new Map(prev);
      newStates.set(key, {
        contentId,
        startTime: Date.now(),
        isCompleted: false,
      });
      return newStates;
    });
    setIsAnyMintingInProgress(true);
  }, []);

  const completeMinting = useCallback(
    (contentId: bigint, tokenId?: bigint, txHash?: string) => {
      const key = contentId.toString();
      setMintingStates((prev) => {
        const newStates = new Map(prev);
        const existing = newStates.get(key);
        if (existing) {
          newStates.set(key, {
            ...existing,
            tokenId,
            txHash,
            isCompleted: true,
          });
        }
        return newStates;
      });
      setIsAnyMintingInProgress(false);
    },
    []
  );

  const removeMintingState = useCallback((contentId: bigint) => {
    const key = contentId.toString();
    setMintingStates((prev) => {
      const newStates = new Map(prev);
      newStates.delete(key);
      return newStates;
    });
    setIsAnyMintingInProgress(false);
  }, []);

  const isContentMinting = useCallback(
    (contentId: bigint): boolean => {
      const key = contentId.toString();
      const state = mintingStates.get(key);
      return state !== undefined && !state.isCompleted;
    },
    [mintingStates]
  );

  const checkMintingCompletion = useCallback(
    async (contentId: bigint) => {
      if (!publicClient || !address) return;

      try {
        const currentBlock = await publicClient.getBlockNumber();

        const mintEvents = await publicClient.getLogs({
          address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
          event: {
            type: "event",
            name: "NFTMinted",
            inputs: [
              { name: "contentId", type: "uint256", indexed: true },
              { name: "tokenId", type: "uint256", indexed: true },
              { name: "owner", type: "address", indexed: true },
              { name: "metadataURI", type: "string", indexed: false },
            ],
          },
          fromBlock: currentBlock - BigInt(50),
          toBlock: "latest",
        });

        const relevantEvents = mintEvents.filter((event: any) => {
          const eventContentId = event.args?.contentId;
          const eventOwner = event.args?.owner;
          return (
            eventContentId === contentId &&
            eventOwner?.toLowerCase() === address?.toLowerCase()
          );
        });

        if (relevantEvents.length > 0) {
          const latestEvent = relevantEvents[relevantEvents.length - 1];
          const tokenId = latestEvent.args?.tokenId;
          const txHash = latestEvent.transactionHash;

          console.log("Evento NFTMinted trovato:", {
            contentId: contentId.toString(),
            tokenId: tokenId?.toString(),
            txHash,
          });

          completeMinting(contentId, tokenId, txHash);
          if (tokenId) {
            const contentKey = contentId.toString();
            const existingTokens = contentTokenMapping.get(contentKey) || [];
            if (!existingTokens.includes(tokenId)) {
              setContentTokenMapping((prev) =>
                new Map(prev).set(contentKey, [...existingTokens, tokenId])
              );
            }
          }

          toast.dismiss(`mint-${contentId.toString()}`);

          setShowSuccessNotification({
            contentId,
            tokenId,
            txHash,
          });

          // Invalida la cache dopo un minting riuscito, per forzare un refresh
          localStorage.removeItem(CACHE_KEY);

          setTimeout(() => {
            fetchRegisteredContents();
          }, 2000);

          return true;
        }
      } catch (error) {
        console.error("Errore durante il controllo del minting:", error);
      }

      return false;
    },
    [publicClient, address, completeMinting, fetchRegisteredContents]
  );

  const setupMintingTimeout = useCallback(
    (contentId: bigint) => {
      const timeoutId = setTimeout(async () => {
        console.log(`Timeout raggiunto per contentId: ${contentId.toString()}`);

        const isCompleted = await checkMintingCompletion(contentId);

        if (!isCompleted) {
          toast.dismiss(`mint-${contentId.toString()}`);

          setShowSuccessNotification({
            contentId,
            tokenId: null,
            txHash: null,
          });

          completeMinting(contentId);

          // Invalida la cache dopo timeout
          localStorage.removeItem(CACHE_KEY);

          setTimeout(() => {
            fetchRegisteredContents();
          }, 2000);
        }
      }, 12000);

      return timeoutId;
    },
    [checkMintingCompletion, completeMinting, fetchRegisteredContents]
  );

  useEffect(() => {
    if (isConnected && chainId === ARBITRUM_SEPOLIA_CHAIN_ID && publicClient) {
      fetchRegisteredContents();
      const intervalId = setInterval(async () => {
        await buildContentTokenMapping();
        fetchRegisteredContents();
      }, 120000); // <--- QUI: Aggiornamento ogni 2 minuti (120000 ms). Modifica questo valore per cambiare l'intervallo.
      return () => clearInterval(intervalId);
    } else {
      setIsLoadingContents(false);
      setRegisteredContents([]);
      setContentsError(null);
    }
  }, [
    isConnected,
    chainId,
    publicClient,
    fetchRegisteredContents,
    buildContentTokenMapping,
  ]);

  useEffect(() => {
    if (mintingStates.size === 0) return;

    const intervalId = setInterval(async () => {
      const mintingEntries = Array.from(mintingStates.entries());

      for (const [key, state] of mintingEntries) {
        if (!state.isCompleted) {
          await checkMintingCompletion(state.contentId);
        }
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [mintingStates, checkMintingCompletion]);

  const onMintNewCopy = useCallback(
    async (contentId: bigint) => {
      if (!isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID || !address) {
        toast.error("Connetti il tuo wallet alla rete Arbitrum Sepolia.");
        return;
      }

      if (isAnyMintingInProgress) {
        toast.error(
          "Un minting è già in corso. Attendi il completamento prima di avviarne un altro."
        );
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

      addMintingState(contentId);

      toast.loading(
        `Preparazione minting per Content ID ${contentId.toString()}...`,
        { id: `mint-${contentId.toString()}` }
      );

      try {
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

        setupMintingTimeout(contentId);
      } catch (err: any) {
        console.error("Errore nel minting:", err);

        removeMintingState(contentId);

        toast.dismiss(`mint-${contentId.toString()}`);
        toast.error(`Errore: ${err.message || "Operazione fallita"}`);

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
      isAnyMintingInProgress,
      addMintingState,
      removeMintingState,
      handleRequestMintForCopy,
      handleMetadataUpload,
      resetMintingState,
      setupMintingTimeout,
    ]
  );

  const handleCloseSuccessNotification = () => {
    setShowSuccessNotification(null);

    if (showSuccessNotification) {
      removeMintingState(showSuccessNotification.contentId);
    }

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
    <div className="bg-gray-900 text-white min-h-screen p-4">
      <Toaster position="top-right" />

      {showSuccessNotification && (
        <SuccessNotification
          contentId={showSuccessNotification.contentId}
          tokenId={showSuccessNotification.tokenId}
          txHash={showSuccessNotification.txHash}
          onClose={handleCloseSuccessNotification}
        />
      )}

      <Card className="bg-gray-800 border-purple-600">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-purple-400">
            Contenuti Scientifici Registrati
          </CardTitle>
          <CardDescription className="text-gray-400">
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
              <Table className="min-w-full divide-y divide-gray-700">
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
                <TableBody className="bg-gray-900 divide-y divide-gray-700">
                  {currentContents.map((content) => {
                    const isCurrentlyMinting = isContentMinting(
                      content.contentId
                    );
                    const isContentAvailable =
                      content.mintedCopies < content.maxCopies &&
                      content.isAvailable;

                    return (
                      <TableRow
                        key={content.contentId.toString()}
                        className="hover:bg-gray-700 transition-colors"
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
                                e.currentTarget.src = PLACEHOLDER_IMAGE_URL;
                                e.currentTarget.alt =
                                  "Immagine non disponibile";
                              }}
                            />
                          ) : (
                            <Image
                              src={PLACEHOLDER_IMAGE_URL}
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
                            <span className="text-gray-400">
                              Non Disponibile
                            </span>
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
                              isContentAvailable
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {isContentAvailable ? "Disponibile" : "Esaurito"}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap">
                          {isContentAvailable ? (
                            <Button
                              onClick={() => onMintNewCopy(content.contentId)}
                              disabled={isAnyMintingInProgress}
                              className={`px-4 py-2 rounded-md shadow-sm text-sm font-medium transition-colors ${
                                isCurrentlyMinting
                                  ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                                  : isAnyMintingInProgress
                                  ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                                  : "bg-purple-600 hover:bg-purple-700 text-white"
                              }`}
                            >
                              {isCurrentlyMinting ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Coniando...
                                </div>
                              ) : isAnyMintingInProgress ? (
                                "Altro minting in corso"
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

              {totalPages > 1 && (
                <div className="flex justify-center items-center mt-6 space-x-2">
                  <Button
                    onClick={goToPrevPage}
                    disabled={currentPage === 1}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Precedente
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <Button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`px-4 py-2 rounded-md ${
                          currentPage === page
                            ? "bg-purple-800 text-white font-bold"
                            : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                        }`}
                      >
                        {page}
                      </Button>
                    )
                  )}
                  <Button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Successiva
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisteredContentPage;


