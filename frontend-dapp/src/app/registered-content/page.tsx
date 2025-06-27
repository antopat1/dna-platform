// frontend-dapp/src/app/registered-content/page.tsx
"use client"; // Questo è un componente client-side

import { useAccount, usePublicClient } from "wagmi";
import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  SCIENTIFIC_CONTENT_REGISTRY_ABI,
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
  SCIENTIFIC_CONTENT_NFT_ABI, // Importa l'ABI del contratto NFT
  SCIENTIFIC_CONTENT_NFT_ADDRESS, // Importa l'indirizzo del contratto NFT
} from "@/lib/constants";
import { useRegisterContent } from "@/hooks/useRegisterContent";
import { getContract } from "viem";
import { formatEther } from "viem";

// Componenti UI (assicurati che i percorsi siano corretti)
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
import axios from "axios"; // Assicurati di aver installato axios: npm install axios

// Recupera il sottodominio del gateway Pinata dalle variabili d'ambiente.
const PINATA_GATEWAY_SUBDOMAIN =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY_SUBDOMAIN;

// Placeholder per LoadingSpinner
const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-8">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    <p className="ml-4 text-gray-700">Caricamento...</p>
  </div>
);

// Funzione helper per risolvere i link IPFS utilizzando il gateway Pinata o un fallback
const resolveIpfsLink = (ipfsUri: string): string => {
  if (!ipfsUri) return "";

  let cid: string;
  if (ipfsUri.startsWith("ipfs://")) {
    cid = ipfsUri.replace("ipfs://", "");
  } else {
    cid = ipfsUri; // Se ipfsUri è già solo il CID
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

// Definizione del tipo per il contenuto registrato dal contratto
// Questa struct deve MATCHARE ESATTAMENTE la `Content` struct nel tuo ScientificContentRegistry.sol
type RegistryContent = {
  title: string;
  description: string;
  author: `0x${string}`;
  contentHash: `0x${string}`;
  isAvailable: boolean;
  registrationTime: bigint;
  maxCopies: bigint;
  mintedCopies: bigint; // Questo campo è aggiornato atomicalmente on-chain
  ipfsHash: string; // Questo è l'ipfsHash del documento principale registrato nel Registry
  nftMintPrice: bigint;
};

// Nuovo tipo combinato per i dati del contenuto da mostrare nella tabella
type DisplayContent = RegistryContent & {
  contentId: bigint; // Aggiungiamo esplicitamente l'ID del contenuto
  displayImageUrl: string | undefined;
};

const RegisteredContentPage = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();

  const [registeredContents, setRegisteredContents] = useState<
    DisplayContent[]
  >([]);
  const [isLoadingContents, setIsLoadingContents] = useState<boolean>(true);
  const [contentsError, setContentsError] = useState<string | null>(null);

  const {
    handleRequestMintForCopy,
    isRequestMintPending,
    isRequestingMint,
    isMintingFulfilled,
    mintedTokenId,
    mintingRevertReason,
    resetForm,
    handleMetadataUpload,
  } = useRegisterContent();

  const [activeMintContentId, setActiveMintContentId] = useState<bigint | null>(
    null
  );

  // --- Funzione per caricare i contenuti ---
  const fetchRegisteredContents = useCallback(async () => {
    if (!publicClient) {
      setContentsError("Public client non disponibile.");
      setIsLoadingContents(false);
      return;
    }

    setIsLoadingContents(true);
    setContentsError(null);
    setRegisteredContents([]); // Resetta i contenuti prima di caricarli

    try {
      await publicClient.getBlockNumber();
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
      await publicClient?.getBlockNumber();

      const nextContentIdBigInt =
        (await registryContract.read.nextContentId()) as bigint;
      const totalContents = Number(nextContentIdBigInt) - 1;

      const fetchedContents: DisplayContent[] = [];

      for (let i = 1; i <= totalContents; i++) {
        try {
          const content = (await registryContract.read.getContent([
            BigInt(i),
          ])) as RegistryContent;

          let displayImageUrl: string | undefined = undefined;

          // Se ci sono copie mintate, proviamo a recuperare l'immagine dal primo NFT coniato
          if (content.mintedCopies > BigInt(0)) {
            try {
              // Si assume che il tokenId del primo NFT per un dato contentId sia il contentId stesso,
              // o che ci sia un modo per recuperare un tokenId valido per un contentId.
              // La logica più robusta potrebbe richiedere un getter nel contratto NFT
              // o il parsing degli eventi passati. Per ora, si mantiene l'assunzione iniziale.
              const firstTokenIdForContent = BigInt(i);
              const tokenURI = (await nftContract.read.tokenURI([
                firstTokenIdForContent,
              ])) as string;

              if (tokenURI) {
                const resolvedTokenURI = resolveIpfsLink(tokenURI);
                const metadataResponse = await axios.get(resolvedTokenURI);
                const metadata = metadataResponse.data;

                // LOGICA AGGIORNATA PER LA SELEZIONE DELL'IMMAGINE:
                // 1. Cerchiamo il campo 'image' standard per l'immagine di anteprima.
                // 2. Se 'image' non è un'immagine valida (es. è un PDF), cerchiamo il campo 'previewImageFileCID' che abbiamo aggiunto.
                if (metadata.image) {
                  const imageUrlAttempt = resolveIpfsLink(metadata.image);
                  if (imageUrlAttempt.endsWith(".pdf")) {
                    console.warn(
                      `Token ID ${firstTokenIdForContent}: Il campo 'image' è un PDF (${imageUrlAttempt}). Cerco 'previewImageFileCID'.`
                    );
                    if (metadata.previewImageFileCID) {
                      displayImageUrl = resolveIpfsLink(
                        metadata.previewImageFileCID
                      );
                      console.log(
                        `Token ID ${firstTokenIdForContent}: Trovata immagine di anteprima in 'previewImageFileCID': ${displayImageUrl}`
                      );
                    } else {
                      console.warn(
                        `Token ID ${firstTokenIdForContent}: Nessun 'previewImageFileCID' trovato. Userò l'immagine di fallback.`
                      );
                      displayImageUrl = undefined;
                    }
                  } else {
                    displayImageUrl = imageUrlAttempt;
                    console.log(
                      `Token ID ${firstTokenIdForContent}: Trovata immagine di anteprima in 'image': ${displayImageUrl}`
                    );
                  }
                } else if (metadata.previewImageFileCID) {
                  displayImageUrl = resolveIpfsLink(
                    metadata.previewImageFileCID
                  );
                  console.log(
                    `Token ID ${firstTokenIdForContent}: Trovata immagine di anteprima in 'previewImageFileCID': ${displayImageUrl}`
                  );
                } else {
                  console.warn(
                    `Token ID ${firstTokenIdForContent}: Nessun campo 'image' o 'previewImageFileCID' valido trovato nei metadati.`
                  );
                  displayImageUrl = undefined;
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

  // --- useEffect per il feedback del minting ---
  useEffect(() => {
    if (activeMintContentId !== null) {
      if (isRequestMintPending) {
        toast.loading(
          `Inizializzazione minting per Content ID ${activeMintContentId.toString()}...`,
          { id: "mintingProgress" }
        );
      } else if (isRequestingMint) {
        toast.loading(
          `Conio NFT in corso per Content ID ${activeMintContentId.toString()} (richiesta VRF inviata)...`,
          { id: "mintingProgress" }
        );
      }
    }

    if (isMintingFulfilled && activeMintContentId !== null) {
      if (mintedTokenId !== null) {
        toast.success(
          `🎉 NFT Mintato! Token ID: ${mintedTokenId.toString()} per Content ID ${activeMintContentId.toString()}.`,
          { id: "mintingProgress" }
        );
      } else {
        toast.success(
          `🎉 Minting completato per Content ID ${activeMintContentId.toString()}.`,
          { id: "mintingProgress" }
        );
      }
      // CHIAVE: Ricarica la lista dei contenuti per aggiornare i conteggi on-chain
      fetchRegisteredContents();
      setActiveMintContentId(null);
      resetForm();
    } else if (mintingRevertReason && activeMintContentId !== null) {
      toast.error(
        `Errore nel minting per Content ID ${activeMintContentId.toString()}: ${mintingRevertReason}`,
        { id: "mintingProgress" }
      );
      setActiveMintContentId(null);
      resetForm();
    }
  }, [
    isRequestMintPending,
    isRequestingMint,
    isMintingFulfilled,
    mintedTokenId,
    mintingRevertReason,
    activeMintContentId,
    resetForm,
    fetchRegisteredContents,
  ]);

  // --- useEffect per chiamare fetchRegisteredContents inizialmente e con intervallo ---
  useEffect(() => {
    if (isConnected && chainId === ARBITRUM_SEPOLIA_CHAIN_ID && publicClient) {
      fetchRegisteredContents();
      const intervalId = setInterval(fetchRegisteredContents, 60000); // Ricarica ogni 20 secondi
      return () => clearInterval(intervalId);
    } else {
      setIsLoadingContents(false);
      setRegisteredContents([]);
      setContentsError(null);
    }
  }, [isConnected, chainId, publicClient, fetchRegisteredContents]);

  const onMintNewCopy = useCallback(
    async (contentId: bigint) => {
      if (!isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID || !address) {
        toast.error("Connetti il tuo wallet alla rete Arbitrum Sepolia.");
        return;
      }

      if (activeMintContentId !== null) {
        toast(
          "Un'operazione di minting è già in corso. Attendi il completamento.",
          { icon: "ℹ️" }
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

      setActiveMintContentId(contentId);

      try {
        // Estrai CID puliti (senza prefisso)
        const mainDocCid = contentToMint.ipfsHash.replace("ipfs://", "");
        const previewCid = contentToMint.displayImageUrl
          ? contentToMint.displayImageUrl.split("/ipfs/")[1]
          : "";

        // Genera i metadati per il nuovo NFT
        const metadataCid = await handleMetadataUpload({
          isCopy: true,
          contentId: contentId,
          title: contentToMint.title,
          description: contentToMint.description,
          mainDocumentIpfsHash: mainDocCid,
          previewImageIpfsHash: previewCid,
        });

        if (!metadataCid) {
          toast.error(
            "Impossibile generare i metadati per il nuovo NFT. Minting annullato."
          );
          setActiveMintContentId(null);
          return;
        }

        const metadataJsonUri = `ipfs://${metadataCid}`;

        // Avvia il processo di minting
        await handleRequestMintForCopy(
          contentId,
          metadataJsonUri,
          contentToMint.nftMintPrice // Prezzo in wei
        );
      } catch (err: any) {
        console.error("Errore nel minting:", err);
        toast.error(`Errore: ${err.message || "Operazione fallita"}`);
        setActiveMintContentId(null);
      }
    },
    [
      address,
      isConnected,
      chainId,
      activeMintContentId,
      registeredContents,
      handleRequestMintForCopy,
      handleMetadataUpload,
    ]
  );

  if (!mounted) {
    return null;
  }

  // Il controllo `!isConnected` deve essere qui all'inizio del componente Page
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
        <ConnectButton /> {/* Il pulsante di connessione */}
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
    // container mx-auto p-4
    <div className=" bg-gray-200 text-white min-h-screen">
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
                  {registeredContents.map((content) => (
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
                            disabled={
                              activeMintContentId === content.contentId ||
                              isRequestMintPending ||
                              isRequestingMint
                            }
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md shadow-sm text-sm font-medium"
                          >
                            {activeMintContentId === content.contentId
                              ? isRequestingMint
                                ? "Minting in corso..."
                                : "Preparazione..."
                              : "Conia Nuova Copia"}
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
                  ))}
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

// // frontend-dapp/src/app/registered-content/page.tsx
// "use client"; // Questo è un componente client-side

// import { useAccount, usePublicClient } from "wagmi";
// import { useEffect, useState, useCallback } from "react";
// import { toast } from "react-hot-toast";
// import {
//   ARBITRUM_SEPOLIA_CHAIN_ID,
//   SCIENTIFIC_CONTENT_REGISTRY_ABI,
//   SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
//   SCIENTIFIC_CONTENT_NFT_ABI, // Importa l'ABI del contratto NFT
//   SCIENTIFIC_CONTENT_NFT_ADDRESS, // Importa l'indirizzo del contratto NFT
// } from "@/lib/constants";
// import { useRegisterContent } from "@/hooks/useRegisterContent";
// import { getContract } from "viem";
// import { formatEther } from "viem";

// // Componenti UI (assicurati che i percorsi siano corretti)
// import { Button } from "@/components/ui/button";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import Link from "next/link";
// import Image from "next/image";
// import { ConnectButton } from "@rainbow-me/rainbowkit";
// import axios from "axios"; // Assicurati di aver installato axios: npm install axios

// // Recupera il sottodominio del gateway Pinata dalle variabili d'ambiente.
// const PINATA_GATEWAY_SUBDOMAIN =
//   process.env.NEXT_PUBLIC_PINATA_GATEWAY_SUBDOMAIN;

// // Placeholder per LoadingSpinner
// const LoadingSpinner = () => (
//   <div className="flex justify-center items-center py-8">
//     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
//     <p className="ml-4 text-gray-700">Caricamento...</p>
//   </div>
// );

// // Funzione helper per risolvere i link IPFS utilizzando il gateway Pinata o un fallback
// const resolveIpfsLink = (ipfsUri: string): string => {
//   if (!ipfsUri) return "";

//   let cid: string;
//   if (ipfsUri.startsWith("ipfs://")) {
//     cid = ipfsUri.replace("ipfs://", "");
//   } else {
//     cid = ipfsUri; // Se ipfsUri è già solo il CID
//   }

//   if (PINATA_GATEWAY_SUBDOMAIN) {
//     return `https://${PINATA_GATEWAY_SUBDOMAIN}.mypinata.cloud/ipfs/${cid}`;
//   } else {
//     console.warn(
//       "NEXT_PUBLIC_PINATA_GATEWAY_SUBDOMAIN non è impostato. Utilizzo un gateway IPFS pubblico di fallback."
//     );
//     return `https://ipfs.io/ipfs/${cid}`;
//   }
// };

// // Definizione del tipo per il contenuto registrato dal contratto
// // Questa struct deve MATCHARE ESATTAMENTE la `Content` struct nel tuo ScientificContentRegistry.sol
// type RegistryContent = {
//   title: string;
//   description: string;
//   author: `0x${string}`;
//   contentHash: `0x${string}`;
//   isAvailable: boolean;
//   registrationTime: bigint;
//   maxCopies: bigint;
//   mintedCopies: bigint; // Questo campo è aggiornato atomicalmente on-chain
//   ipfsHash: string; // Questo è l'ipfsHash del documento principale registrato nel Registry
//   nftMintPrice: bigint;
// };

// // Nuovo tipo combinato per i dati del contenuto da mostrare nella tabella
// type DisplayContent = RegistryContent & {
//   contentId: bigint; // Aggiungiamo esplicitamente l'ID del contenuto
//   displayImageUrl: string | undefined;
// };

// const RegisteredContentPage = () => {
//   const [mounted, setMounted] = useState(false);
//   useEffect(() => setMounted(true), []);

//   const { address, isConnected, chainId } = useAccount();
//   const publicClient = usePublicClient();

//   const [registeredContents, setRegisteredContents] = useState<
//     DisplayContent[]
//   >([]);
//   const [isLoadingContents, setIsLoadingContents] = useState<boolean>(true);
//   const [contentsError, setContentsError] = useState<string | null>(null);

//   const {
//     handleRequestMintNFT,
//     isRequestMintPending,
//     isRequestingMint,
//     isMintingFulfilled,
//     mintedTokenId,
//     mintingRevertReason,
//     resetForm,
//     handleMetadataUpload,
//   } = useRegisterContent();

//   const [activeMintContentId, setActiveMintContentId] = useState<bigint | null>(
//     null
//   );

//   // --- Funzione per caricare i contenuti ---
//   const fetchRegisteredContents = useCallback(async () => {
//     if (!publicClient) {
//       setContentsError("Public client non disponibile.");
//       setIsLoadingContents(false);
//       return;
//     }

//     setIsLoadingContents(true);
//     setContentsError(null);
//     setRegisteredContents([]); // Resetta i contenuti prima di caricarli

//     try {
//       await publicClient.getBlockNumber();
//       const registryContract = getContract({
//         address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
//         abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
//         client: publicClient,
//       });

//       const nftContract = getContract({
//         address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
//         abi: SCIENTIFIC_CONTENT_NFT_ABI,
//         client: publicClient,
//       });
//       await publicClient?.getBlockNumber();

//       const nextContentIdBigInt =
//         (await registryContract.read.nextContentId()) as bigint;
//       const totalContents = Number(nextContentIdBigInt) - 1;

//       const fetchedContents: DisplayContent[] = [];

//       for (let i = 1; i <= totalContents; i++) {
//         try {
//           const content = (await registryContract.read.getContent([
//             BigInt(i),
//           ])) as RegistryContent;

//           let displayImageUrl: string | undefined = undefined;

//           // Se ci sono copie mintate, proviamo a recuperare l'immagine dal primo NFT coniato
//           if (content.mintedCopies > BigInt(0)) {
//             try {
//               // Si assume che il tokenId del primo NFT per un dato contentId sia il contentId stesso,
//               // o che ci sia un modo per recuperare un tokenId valido per un contentId.
//               // La logica più robusta potrebbe richiedere un getter nel contratto NFT
//               // o il parsing degli eventi passati. Per ora, si mantiene l'assunzione iniziale.
//               const firstTokenIdForContent = BigInt(i);
//               const tokenURI = (await nftContract.read.tokenURI([
//                 firstTokenIdForContent,
//               ])) as string;

//               if (tokenURI) {
//                 const resolvedTokenURI = resolveIpfsLink(tokenURI);
//                 const metadataResponse = await axios.get(resolvedTokenURI);
//                 const metadata = metadataResponse.data;

//                 // LOGICA AGGIORNATA PER LA SELEZIONE DELL'IMMAGINE:
//                 // 1. Cerchiamo il campo 'image' standard per l'immagine di anteprima.
//                 // 2. Se 'image' non è un'immagine valida (es. è un PDF), cerchiamo il campo 'previewImageFileCID' che abbiamo aggiunto.
//                 if (metadata.image) {
//                   const imageUrlAttempt = resolveIpfsLink(metadata.image);
//                   if (imageUrlAttempt.endsWith(".pdf")) {
//                     console.warn(
//                       `Token ID ${firstTokenIdForContent}: Il campo 'image' è un PDF (${imageUrlAttempt}). Cerco 'previewImageFileCID'.`
//                     );
//                     if (metadata.previewImageFileCID) {
//                       displayImageUrl = resolveIpfsLink(
//                         metadata.previewImageFileCID
//                       );
//                       console.log(
//                         `Token ID ${firstTokenIdForContent}: Trovata immagine di anteprima in 'previewImageFileCID': ${displayImageUrl}`
//                       );
//                     } else {
//                       console.warn(
//                         `Token ID ${firstTokenIdForContent}: Nessun 'previewImageFileCID' trovato. Userò l'immagine di fallback.`
//                       );
//                       displayImageUrl = undefined;
//                     }
//                   } else {
//                     displayImageUrl = imageUrlAttempt;
//                     console.log(
//                       `Token ID ${firstTokenIdForContent}: Trovata immagine di anteprima in 'image': ${displayImageUrl}`
//                     );
//                   }
//                 } else if (metadata.previewImageFileCID) {
//                   displayImageUrl = resolveIpfsLink(
//                     metadata.previewImageFileCID
//                   );
//                   console.log(
//                     `Token ID ${firstTokenIdForContent}: Trovata immagine di anteprima in 'previewImageFileCID': ${displayImageUrl}`
//                   );
//                 } else {
//                   console.warn(
//                     `Token ID ${firstTokenIdForContent}: Nessun campo 'image' o 'previewImageFileCID' valido trovato nei metadati.`
//                   );
//                   displayImageUrl = undefined;
//                 }
//               }
//             } catch (metadataError) {
//               console.warn(
//                 `Could not fetch or parse metadata for Content ID ${i}:`,
//                 metadataError
//               );
//             }
//           }

//           fetchedContents.push({
//             contentId: BigInt(i),
//             ...content,
//             displayImageUrl: displayImageUrl,
//           });
//         } catch (innerError: any) {
//           console.warn(
//             `Errore durante il recupero del contenuto ID ${i}:`,
//             innerError.message || innerError.shortMessage || String(innerError)
//           );
//         }
//       }
//       setRegisteredContents(fetchedContents);
//     } catch (err: any) {
//       console.error("Errore nel recupero dei contenuti registrati:", err);
//       setContentsError(
//         `Impossibile caricare i contenuti: ${
//           err.message || err.shortMessage || String(err)
//         }`
//       );
//     } finally {
//       setIsLoadingContents(false);
//     }
//   }, [publicClient]);

//   // --- useEffect per il feedback del minting ---
//   useEffect(() => {
//     if (activeMintContentId !== null) {
//       if (isRequestMintPending) {
//         toast.loading(
//           `Inizializzazione minting per Content ID ${activeMintContentId.toString()}...`,
//           { id: "mintingProgress" }
//         );
//       } else if (isRequestingMint) {
//         toast.loading(
//           `Conio NFT in corso per Content ID ${activeMintContentId.toString()} (richiesta VRF inviata)...`,
//           { id: "mintingProgress" }
//         );
//       }
//     }

//     if (isMintingFulfilled && activeMintContentId !== null) {
//       if (mintedTokenId !== null) {
//         toast.success(
//           `🎉 NFT Mintato! Token ID: ${mintedTokenId.toString()} per Content ID ${activeMintContentId.toString()}.`,
//           { id: "mintingProgress" }
//         );
//       } else {
//         toast.success(
//           `🎉 Minting completato per Content ID ${activeMintContentId.toString()}.`,
//           { id: "mintingProgress" }
//         );
//       }
//       // CHIAVE: Ricarica la lista dei contenuti per aggiornare i conteggi on-chain
//       fetchRegisteredContents();
//       setActiveMintContentId(null);
//       resetForm();
//     } else if (mintingRevertReason && activeMintContentId !== null) {
//       toast.error(
//         `Errore nel minting per Content ID ${activeMintContentId.toString()}: ${mintingRevertReason}`,
//         { id: "mintingProgress" }
//       );
//       setActiveMintContentId(null);
//       resetForm();
//     }
//   }, [
//     isRequestMintPending,
//     isRequestingMint,
//     isMintingFulfilled,
//     mintedTokenId,
//     mintingRevertReason,
//     activeMintContentId,
//     resetForm,
//     fetchRegisteredContents,
//   ]);

//   // --- useEffect per chiamare fetchRegisteredContents inizialmente e con intervallo ---
//   useEffect(() => {
//     if (isConnected && chainId === ARBITRUM_SEPOLIA_CHAIN_ID && publicClient) {
//       fetchRegisteredContents();
//       const intervalId = setInterval(fetchRegisteredContents, 60000); // Ricarica ogni 20 secondi
//       return () => clearInterval(intervalId);
//     } else {
//       setIsLoadingContents(false);
//       setRegisteredContents([]);
//       setContentsError(null);
//     }
//   }, [isConnected, chainId, publicClient, fetchRegisteredContents]);

//   // --- Funzione per avviare il minting di una copia specifica ---
//   const onMintNewCopy = useCallback(
//     async (contentId: bigint) => {
//       if (!isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID || !address) {
//         toast.error("Connetti il tuo wallet alla rete Arbitrum Sepolia.");
//         return;
//       }

//       if (activeMintContentId !== null) {
//         toast(
//           "Un'operazione di minting è già in corso. Attendi il completamento.",
//           { icon: "ℹ️" }
//         );
//         return;
//       }

//       const contentToMint = registeredContents.find(
//         (c) => c.contentId === contentId
//       );
//       if (!contentToMint) {
//         toast.error("Dettagli del contenuto non trovati.");
//         return;
//       }

//       if (contentToMint.mintedCopies >= contentToMint.maxCopies) {
//         toast.error(
//           "Tutte le copie disponibili per questo contenuto sono già state mintate."
//         );
//         return;
//       }

//       setActiveMintContentId(contentId);

//       // Estrarre il CID dall'URL
//       const getCidFromUrl = (url: string | undefined): string | null => {
//         if (!url) return null;
//         try {
//           const urlObj = new URL(url);
//           const pathSegments = urlObj.pathname.split("/");
//           const ipfsIndex = pathSegments.indexOf("ipfs");
//           if (ipfsIndex > -1 && pathSegments.length > ipfsIndex + 1) {
//             return pathSegments[ipfsIndex + 1];
//           }
//         } catch (e) {
//           // Ignora errori se l'URL non è valido
//         }
//         return null;
//       };

//       // CID dell'immagine di anteprima da usare per i nuovi metadati
//       const previewImageCidForNewMint =
//         getCidFromUrl(contentToMint.displayImageUrl) || contentToMint.ipfsHash; // Fallback al CID del documento principale

//       // CID del documento principale da usare per i nuovi metadati (sempre quello dal Registry)
//       const mainDocumentCidForNewMint = contentToMint.ipfsHash;

//       const metadataCid = await handleMetadataUpload(
//         contentId,
//         previewImageCidForNewMint,
//         mainDocumentCidForNewMint
//       );

//       if (!metadataCid) {
//         toast.error(
//           "Impossibile caricare i metadati per il nuovo NFT. Minting annullato."
//         );
//         setActiveMintContentId(null);
//         return;
//       }

//       const metadataJsonUri = `ipfs://${metadataCid}`;

//       // MODIFICA CHIAVE: Rimosso l'aggiornamento ottimistico dello stato locale `registeredContents`.
//       // Ora ci si affida completamente al re-fetch dei dati dalla blockchain
//       // una volta che il minting è stato fulfillato con successo.
//       // Questo garantisce che `mintedCopies` rifletta sempre lo stato on-chain.

//       await handleRequestMintNFT(contentId, metadataJsonUri);
//     },
//     [
//       address,
//       isConnected,
//       chainId,
//       activeMintContentId,
//       registeredContents, // Mantenuto se usato in altre parti per selezioni, ma non per l'update di mintedCopies
//       handleRequestMintNFT,
//       handleMetadataUpload,
//     ]
//   );

//   if (!mounted) {
//     return null;
//   }

//   // Il controllo `!isConnected` deve essere qui all'inizio del componente Page
//   if (!isConnected) {
//     return (
//       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center bg-gray-900 text-white p-4">
//         <h1 className="text-2xl font-bold mb-4 text-purple-400">
//           Connetti il tuo Wallet
//         </h1>
//         <p className="text-gray-400 mb-4">
//           Per visualizzare e interagire con i contenuti, per favore connetti il
//           tuo wallet.
//         </p>
//         <ConnectButton /> {/* Il pulsante di connessione */}
//       </div>
//     );
//   }

//   if (chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
//     return (
//       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center bg-gray-900 text-red-400 p-4">
//         <h1 className="text-2xl font-bold mb-4">Rete Errata</h1>
//         <p className="text-gray-400">
//           Per favore connetti il tuo wallet alla rete Arbitrum Sepolia per
//           visualizzare i contenuti.
//         </p>
//       </div>
//     );
//   }

//   return (
//     // container mx-auto p-4
//     <div className=" bg-gray-200 text-white min-h-screen">
//       <Card className="bg-gray-200 border-purple-600">
//         <CardHeader>
//           <CardTitle className="text-3xl font-bold text-purple-400">
//             Contenuti Scientifici Registrati
//           </CardTitle>
//           <CardDescription className="text-gray-700">
//             Esplora tutti i contenuti scientifici registrati. Se disponibile,
//             puoi coniare una nuova copia NFT.
//           </CardDescription>
//         </CardHeader>
//         <CardContent>
//           {isLoadingContents ? (
//             <LoadingSpinner />
//           ) : contentsError ? (
//             <div className="text-red-500 text-center py-8">
//               Errore: {contentsError}
//             </div>
//           ) : registeredContents.length === 0 ? (
//             <div className="text-center text-gray-500 py-8 text-lg">
//               Nessun contenuto registrato trovato.
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <Table className="min-w-full divide-y divide-gray-200">
//                 <TableHeader className="bg-gray-700">
//                   <TableRow>
//                     <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
//                       ID
//                     </TableHead>
//                     <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
//                       Titolo
//                     </TableHead>
//                     <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
//                       Autore
//                     </TableHead>
//                     <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
//                       Immagine Copertina
//                     </TableHead>
//                     <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
//                       Documento Principale
//                     </TableHead>
//                     <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
//                       Copie (Mintate/Massime)
//                     </TableHead>
//                     <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
//                       Prezzo Mint
//                     </TableHead>
//                     <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
//                       Disponibilità
//                     </TableHead>
//                     <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
//                       Azioni
//                     </TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody className="bg-gray-600 divide-y divide-gray-700">
//                   {registeredContents.map((content) => (
//                     <TableRow
//                       key={content.contentId.toString()}
//                       className="hover:bg-gray-500 transition-colors"
//                     >
//                       <TableCell className="px-4 py-3 whitespace-nowrap font-medium text-purple-300">
//                         {content.contentId.toString()}
//                       </TableCell>
//                       <TableCell className="px-4 py-3 whitespace-nowrap text-gray-200">
//                         {content.title}
//                       </TableCell>
//                       <TableCell className="px-4 py-3 whitespace-nowrap text-gray-200 text-xs">
//                         {content.author}
//                       </TableCell>
//                       <TableCell className="px-4 py-3 whitespace-nowrap">
//                         {content.displayImageUrl ? (
//                           <Image
//                             src={content.displayImageUrl}
//                             alt={`Copertina di ${content.title}`}
//                             width={80}
//                             height={80}
//                             className="rounded-md object-cover"
//                             onError={(e) => {
//                               e.currentTarget.src =
//                                 "https://placehold.co/80x80/333333/ffffff?text=No+Img";
//                               e.currentTarget.alt = "Immagine non disponibile";
//                             }}
//                           />
//                         ) : (
//                           <Image
//                             src="https://placehold.co/80x80/333333/ffffff?text=No+Img"
//                             alt="Immagine non disponibile"
//                             width={80}
//                             height={80}
//                             className="rounded-md object-cover"
//                           />
//                         )}
//                       </TableCell>
//                       <TableCell className="px-4 py-3 whitespace-nowrap">
//                         {content.ipfsHash ? (
//                           <Link
//                             href={resolveIpfsLink(content.ipfsHash)}
//                             target="_blank"
//                             rel="noopener noreferrer"
//                             className="text-blue-400 hover:underline"
//                           >
//                             Scarica Documento
//                           </Link>
//                         ) : (
//                           <span className="text-gray-400">Non Disponibile</span>
//                         )}
//                       </TableCell>
//                       <TableCell className="px-4 py-3 whitespace-nowrap text-gray-200">
//                         {content.mintedCopies.toString()} /{" "}
//                         {content.maxCopies.toString()}
//                       </TableCell>
//                       <TableCell className="px-4 py-3 whitespace-nowrap text-gray-200">
//                         {formatEther(content.nftMintPrice)} ETH
//                       </TableCell>
//                       <TableCell className="px-4 py-3 whitespace-nowrap">
//                         <span
//                           className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
//                             content.isAvailable &&
//                             content.mintedCopies < content.maxCopies
//                               ? "bg-green-100 text-green-800"
//                               : "bg-red-100 text-red-800"
//                           }`}
//                         >
//                           {content.isAvailable &&
//                           content.mintedCopies < content.maxCopies
//                             ? "Disponibile"
//                             : "Esaurito"}
//                         </span>
//                       </TableCell>
//                       <TableCell className="px-4 py-3 whitespace-nowrap">
//                         {content.mintedCopies < content.maxCopies &&
//                         content.isAvailable ? (
//                           <Button
//                             onClick={() => onMintNewCopy(content.contentId)}
//                             disabled={
//                               activeMintContentId === content.contentId ||
//                               isRequestMintPending ||
//                               isRequestingMint
//                             }
//                             className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md shadow-sm text-sm font-medium"
//                           >
//                             {activeMintContentId === content.contentId
//                               ? isRequestingMint
//                                 ? "Minting in corso..."
//                                 : "Preparazione..."
//                               : "Conia Nuova Copia"}
//                           </Button>
//                         ) : (
//                           <Button
//                             disabled
//                             className="bg-gray-600 text-gray-400 px-4 py-2 rounded-md shadow-sm text-sm font-medium cursor-not-allowed"
//                           >
//                             Non Disponibile
//                           </Button>
//                         )}
//                       </TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>
//             </div>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// };

// export default RegisteredContentPage;
