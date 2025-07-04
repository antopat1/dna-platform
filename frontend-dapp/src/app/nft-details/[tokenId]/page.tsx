// frontend-dapp/src/app/nft-details/[tokenId]/page.tsx

"use client"; // Questo è importante per usare gli hook React e Wagmi

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Hook per accedere ai parametri dell'URL e navigare
import { usePublicClient } from 'wagmi'; // Per interagire con la blockchain
import { toast, Toaster } from 'react-hot-toast'; // Per notifiche
import Image from 'next/image'; // Per visualizzare l'immagine dell'NFT
import { Address, getContract } from 'viem'; // Importa Address e getContract da viem

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  SCIENTIFIC_CONTENT_NFT_ABI,
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  SCIENTIFIC_CONTENT_REGISTRY_ABI, // Importa l'ABI del Registry
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS, // Importa l'indirizzo del Registry
} from "@/lib/constants";
import { resolveIpfsLink } from "@/utils/ipfs"; // La funzione per risolvere gli URL IPFS
import { NFT as OwnedNFT } from "@/hooks/useOwnedNfts"; // Importa 'NFT' e rinominalo come 'OwnedNFT'

// Definisco l'interfaccia per i metadati completi dell'NFT come recuperati dal JSON IPFS.
// Questa interfaccia riflette la struttura `ExternalNFTMetadata` dal tuo useOwnedNfts.ts
interface NFTMetadata {
  name: string;
  description: string;
  image?: string; // URI IPFS per l'immagine di copertina dell'NFT
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: any }>;
  originalDocumentFileCID?: string; // Questo è l'IPFS hash del documento scientifico reale, se nei metadati
  previewImageFileCID?: string;
  // Aggiungi qui qualsiasi altro campo che ti aspetti dal tuo JSON di metadati
  scientific_type?: string;
  publication_date?: string;
  // Potrebbe essere utile avere il contentIpfsHash anche qui se presente nel JSON
  contentIpfsHash?: string;
  author?: Address; // L'autore potrebbe anche essere nei metadati JSON
  // Aggiungiamo anche il tokenId qui per comodità, anche se non è nel JSON originale
  tokenId?: string;
}

// Definire un tipo per i metadati del contenuto dal Registry,
// per essere sicuri che la destrutturazione sia corretta
type ScientificContentRegistry_ContentMetadata = {
    title: string;
    description: string;
    author: Address;
    contentHash: Address; // O string, a seconda del tipo di hash
    isAvailable: boolean;
    registrationTime: bigint;
    maxCopies: bigint;
    mintedCopies: bigint;
    ipfsHash: string; // Questo è l'IPFS hash del documento scientifico reale
    nftMintPrice: bigint;
};

const PLACEHOLDER_IMAGE_URL = "https://placehold.co/300x300/333333/ffffff?text=No+Image";

export default function NftDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const publicClient = usePublicClient();

  const tokenId = params.tokenId as string;
  const [nftData, setNftData] = useState<OwnedNFT | null>(null);
  const [fullMetadata, setFullMetadata] = useState<NFTMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNftDetails = useCallback(async () => {
    if (!publicClient || !tokenId) {
      return;
    }

    if (!SCIENTIFIC_CONTENT_NFT_ADDRESS || !SCIENTIFIC_CONTENT_REGISTRY_ADDRESS) {
      setError("Indirizzi dei contratti NFT o Registry non configurati.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Ottieni il contratto NFT
      const nftContract = getContract({
        address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
        abi: SCIENTIFIC_CONTENT_NFT_ABI,
        client: publicClient,
      });

      // 1. Recupera l'URI dei metadati on-chain (tokenURI)
      const tokenURI = await nftContract.read.tokenURI([BigInt(tokenId)]) as string;

      if (!tokenURI) {
        throw new Error("Impossibile recuperare il tokenURI per questo NFT.");
      }

      const resolvedTokenURI = resolveIpfsLink(tokenURI);
      if (!resolvedTokenURI) {
        throw new Error("Impossibile risolvere l'URI IPFS dei metadati.");
      }

      // 2. Recupera i metadati completi dal JSON esterno (off-chain)
      const response = await fetch(resolvedTokenURI);
      if (!response.ok) {
        throw new Error(`Errore nel recupero dei metadati: ${response.statusText}`);
      }
      const metadata: NFTMetadata = await response.json();
      setFullMetadata({ ...metadata, tokenId });

      // 3. Recupera i metadati specifici on-chain dal NFT contract (getNFTMetadata)
      const nftContractMetadata = await nftContract.read.getNFTMetadata([BigInt(tokenId)]) as {
        contentId: bigint;
        author: Address;
        randomSeed: bigint;
        hasSpecialContent: boolean;
        copyNumber: bigint;
        metadataURI: string;
      };

      // 4. Recupera i metadati del contenuto dal Registry (se contentId > 0)
      let registryContentMetadata: Partial<ScientificContentRegistry_ContentMetadata> = {};
      if (nftContractMetadata.contentId > BigInt(0)) {
        const registryContract = getContract({ // Usa getContract da viem
          address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
          abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
          client: publicClient,
        });

        const contentData = await registryContract.read.getContent([nftContractMetadata.contentId]) as ScientificContentRegistry_ContentMetadata;
        registryContentMetadata.title = contentData.title;
        registryContentMetadata.description = contentData.description;
        registryContentMetadata.ipfsHash = contentData.ipfsHash; // L'hash IPFS del documento scientifico reale
      }

      // 5. Recupera l'owner dell'NFT
      const owner = await nftContract.read.ownerOf([BigInt(tokenId)]) as Address;

      // Combina tutti i dati per il tipo OwnedNFT (per la visualizzazione principale)
      setNftData({
        tokenId: BigInt(tokenId),
        owner: owner,
        contentId: nftContractMetadata.contentId,
        author: nftContractMetadata.author, // Autore direttamente dal contratto NFT
        randomSeed: nftContractMetadata.randomSeed,
        hasSpecialContent: nftContractMetadata.hasSpecialContent,
        copyNumber: nftContractMetadata.copyNumber,
        metadataURI: nftContractMetadata.metadataURI,
        title: registryContentMetadata.title,
        description: registryContentMetadata.description,
        contentIpfsHash: registryContentMetadata.ipfsHash, // IPFS hash del contenuto scientifico reale
        imageUrlFromMetadata: metadata.image, // Prende l'immagine dai metadati esterni
      });

    } catch (err: any) {
      console.error("Errore nel caricamento dei dettagli NFT:", err);
      setError(`Impossibile caricare i dettagli dell'NFT: ${err.shortMessage || err.message || "Errore sconosciuto"}`);
      toast.error(`Errore: ${err.shortMessage || err.message || "Operazione fallita"}`);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, tokenId]); // Dipendenze per useCallback

  useEffect(() => {
    fetchNftDetails();
  }, [fetchNftDetails]); // Dipendenza per useEffect

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-xl text-gray-700">Caricamento dettagli NFT...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50 text-red-800 p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Errore nel Caricamento</h1>
        <p className="text-lg mb-4">{error}</p>
        <Button
          onClick={() => router.push('/my-nfts')}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-md text-lg"
        >
          Torna ai Miei NFT
        </Button>
      </div>
    );
  }

  if (!nftData || !fullMetadata) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-gray-800 p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">NFT Non Trovato</h1>
        <p className="text-lg mb-4">Non è stato possibile trovare i dettagli per l'NFT con ID: {tokenId}.</p>
        <Button
          onClick={() => router.push('/my-nfts')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md text-lg"
        >
          Torna alla Lista NFT
        </Button>
      </div>
    );
  }

  // Risolvi l'URL dell'immagine usando la funzione resolveIpfsLink
  const displayImageUrl = fullMetadata.image ? resolveIpfsLink(fullMetadata.image) : PLACEHOLDER_IMAGE_URL;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-200 to-black p-6">
      <Toaster position="top-right" />

      <Card className="bg-white border-blue-200 shadow-xl max-w-4xl mx-auto">
        <CardHeader className="text-center bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
          <CardTitle className="text-4xl font-bold mb-2">
            Dettagli NFT: {fullMetadata.name || `ID ${tokenId}`}
          </CardTitle>
          <CardDescription className="text-blue-100 text-lg">
            Esplora tutte le informazioni per il tuo NFT scientifico.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Sezione Immagine */}
            <div className="flex justify-center items-center">
              <Image
                src={displayImageUrl}
                alt={`Copertina di ${fullMetadata.name || `NFT ID ${tokenId}`}`}
                width={300}
                height={300}
                className="rounded-lg object-cover shadow-lg border-2 border-blue-200"
                onError={(e) => {
                  e.currentTarget.src = PLACEHOLDER_IMAGE_URL;
                  console.error(`Failed to load image for NFT ${tokenId}: ${displayImageUrl}`);
                }}
              />
            </div>

            {/* Sezione Dettagli Principali */}
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-lg text-gray-800">
                  <strong className="text-blue-700">Token ID:</strong> {tokenId}
                </p>
              </div>
              
              {nftData.contentId !== BigInt(0) && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-lg text-gray-800">
                    <strong className="text-green-700">Content ID:</strong> {nftData.contentId.toString()}
                  </p>
                </div>
              )}
              
              {fullMetadata.description && (
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-lg text-gray-800">
                    <strong className="text-purple-700">Descrizione:</strong> 
                    <span className="ml-2 break-words">{fullMetadata.description}</span>
                  </p>
                </div>
              )}
              
              {/* Mostra l'autore direttamente dall'Address, e controlla se è un indirizzo valido (non un indirizzo zero) */}
              {nftData.author && nftData.author !== "0x0000000000000000000000000000000000000000" && (
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-lg text-gray-800">
                    <strong className="text-orange-700">Autore (EoA):</strong>{" "}
                    <a
                      href={`https://sepolia.arbiscan.io/address/${nftData.author}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline break-all font-mono text-sm"
                    >
                      {nftData.author}
                    </a>
                  </p>
                </div>
              )}
              
              {fullMetadata.external_url && (
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <p className="text-lg text-gray-800">
                    <strong className="text-indigo-700">Link Esterno:</strong>{" "}
                    <a
                      href={fullMetadata.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline break-all"
                    >
                      {fullMetadata.external_url}
                    </a>
                  </p>
                </div>
              )}
              
              {nftData.contentIpfsHash && (
                <div className="bg-teal-50 p-4 rounded-lg">
                  <p className="text-lg text-gray-800">
                    <strong className="text-teal-700">Hash IPFS Contenuto:</strong>{" "}
                    <a
                      href={resolveIpfsLink(nftData.contentIpfsHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline break-all font-mono text-sm"
                    >
                      {nftData.contentIpfsHash.slice(0, 10)}...{nftData.contentIpfsHash.slice(-10)}
                    </a>
                  </p>
                </div>
              )}

              {/* Campi personalizzati dallo schema (Attributes) */}
              {fullMetadata.attributes && fullMetadata.attributes.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">Attributi Personalizzati:</h3>
                  <div className="space-y-2">
                    {fullMetadata.attributes.map((attr, index) => (
                      <div key={index} className="bg-white p-3 rounded border-l-4 border-blue-400">
                        <p className="text-lg text-gray-800">
                          <strong className="text-blue-700">{attr.trait_type}:</strong> 
                          <span className="ml-2 break-words">{String(attr.value)}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Altri campi specifici del tuo schema, se presenti nell'interfaccia NFTMetadata */}
              {fullMetadata.scientific_type && (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-lg text-gray-800">
                    <strong className="text-yellow-700">Tipo Scientifico:</strong> 
                    <span className="ml-2 break-words">{fullMetadata.scientific_type}</span>
                  </p>
                </div>
              )}
              
              {fullMetadata.publication_date && (
                <div className="bg-pink-50 p-4 rounded-lg">
                  <p className="text-lg text-gray-800">
                    <strong className="text-pink-700">Data Pubblicazione:</strong> 
                    <span className="ml-2 break-words">{fullMetadata.publication_date}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sezione Metadati JSON Completi */}
          <div className="mt-8">
            <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">Schema Metadati (JSON Completo)</h3>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
              <pre className="text-green-400 text-sm overflow-x-auto break-words whitespace-pre-wrap max-w-full">
                <code className="break-words">{JSON.stringify(fullMetadata, null, 2)}</code>
              </pre>
            </div>
          </div>

          {/* Pulsanti di Navigazione */}
          <div className="flex justify-between mt-8 gap-4">
            <Button
              onClick={() => router.push(`/nft-details/${parseInt(tokenId) - 1}`)}
              disabled={parseInt(tokenId) <= 1}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md text-lg disabled:opacity-50 disabled:cursor-not-allowed flex-1 max-w-xs"
            >
              &larr; NFT Precedente
            </Button>
            <Button
              onClick={() => router.push(`/nft-details/${parseInt(tokenId) + 1}`)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md text-lg flex-1 max-w-xs"
            >
              NFT Successivo &rarr;
            </Button>
          </div>

          <div className="mt-6 text-center">
            <Button
              onClick={() => router.push('/my-nfts')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold shadow-lg transform hover:scale-105 transition-transform"
            >
              Torna alla Lista NFT
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}