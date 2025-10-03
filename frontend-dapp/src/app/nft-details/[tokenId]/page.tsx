// frontend-dapp/src/app/nft-details/[tokenId]/page.tsx

"use client"; 

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation"; 
import { usePublicClient, useAccount } from "wagmi"; 
import { toast, Toaster } from "react-hot-toast"; 
import Image from "next/image"; 
import { Address, getContract } from "viem"; 

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
  SCIENTIFIC_CONTENT_REGISTRY_ABI, 
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS, 
} from "@/lib/constants";
import { resolveIpfsLink } from "@/utils/ipfs"; 
import { NFT as OwnedNFT } from "@/hooks/useOwnedNfts"; 


interface NFTMetadata {
  name: string;
  description: string;
  image?: string; 
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: any }>;
  originalDocumentFileCID?: string; 
  previewImageFileCID?: string;
  scientific_type?: string;
  publication_date?: string;
  contentIpfsHash?: string;
  author?: Address; 
  tokenId?: string;
}


type ScientificContentRegistry_ContentMetadata = {
  title: string;
  description: string;
  author: Address;
  contentHash: Address; 
  isAvailable: boolean;
  registrationTime: bigint;
  maxCopies: bigint;
  mintedCopies: bigint;
  ipfsHash: string; 
  nftMintPrice: bigint;
};

const PLACEHOLDER_IMAGE_URL =
  "https://placehold.co/300x300/333333/ffffff?text=No+Image";

export default function NftDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const publicClient = usePublicClient();
  const { address: connectedAddress, isConnected } = useAccount(); 

  const tokenId = params.tokenId as string;
  const [nftData, setNftData] = useState<OwnedNFT | null>(null);
  const [fullMetadata, setFullMetadata] = useState<NFTMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false); 
  const [nftOwner, setNftOwner] = useState<Address | null>(null); 

  const fetchNftDetails = useCallback(async () => {
    if (!publicClient || !tokenId) {
      return;
    }

    if (
      !SCIENTIFIC_CONTENT_NFT_ADDRESS ||
      !SCIENTIFIC_CONTENT_REGISTRY_ADDRESS
    ) {
      setError("Indirizzi dei contratti NFT o Registry non configurati.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {

      const nftContract = getContract({
        address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
        abi: SCIENTIFIC_CONTENT_NFT_ABI,
        client: publicClient,
      });

   
      const owner = (await nftContract.read.ownerOf([
        BigInt(tokenId),
      ])) as Address;
      setNftOwner(owner);

      
      const userIsOwner = !!(
        isConnected &&
        connectedAddress &&
        owner.toLowerCase() === connectedAddress.toLowerCase()
      );
      setIsOwner(userIsOwner);


      const tokenURI = (await nftContract.read.tokenURI([
        BigInt(tokenId),
      ])) as string;

      if (!tokenURI) {
        throw new Error("Impossibile recuperare il tokenURI per questo NFT.");
      }

      const resolvedTokenURI = resolveIpfsLink(tokenURI);
      if (!resolvedTokenURI) {
        throw new Error("Impossibile risolvere l'URI IPFS dei metadati.");
      }

      const response = await fetch(resolvedTokenURI);
      if (!response.ok) {
        throw new Error(
          `Errore nel recupero dei metadati: ${response.statusText}`
        );
      }
      const metadata: NFTMetadata = await response.json();
      setFullMetadata({ ...metadata, tokenId });


      const nftContractMetadata = (await nftContract.read.getNFTMetadata([
        BigInt(tokenId),
      ])) as {
        contentId: bigint;
        author: Address;
        randomSeed: bigint;
        hasSpecialContent: boolean;
        copyNumber: bigint;
        metadataURI: string;
      };


      let registryContentMetadata: Partial<ScientificContentRegistry_ContentMetadata> =
        {};
      if (nftContractMetadata.contentId > BigInt(0)) {
        const registryContract = getContract({
          address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
          abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
          client: publicClient,
        });

        const contentData = (await registryContract.read.getContent([
          nftContractMetadata.contentId,
        ])) as ScientificContentRegistry_ContentMetadata;
        registryContentMetadata.title = contentData.title;
        registryContentMetadata.description = contentData.description;
        registryContentMetadata.ipfsHash = contentData.ipfsHash; 
      }

      setNftData({
        tokenId: BigInt(tokenId),
        owner: owner,
        contentId: nftContractMetadata.contentId,
        author: nftContractMetadata.author,
        randomSeed: nftContractMetadata.randomSeed,
        hasSpecialContent: nftContractMetadata.hasSpecialContent,
        copyNumber: nftContractMetadata.copyNumber,
        metadataURI: nftContractMetadata.metadataURI,
        title: registryContentMetadata.title,
        description: registryContentMetadata.description,
        contentIpfsHash: registryContentMetadata.ipfsHash,
        imageUrlFromMetadata: metadata.image,
        status: { type: "inWallet" },
        seller: owner, 
      });
    } catch (err: any) {
      console.error("Errore nel caricamento dei dettagli NFT:", err);
      setError(
        `Impossibile caricare i dettagli dell'NFT: ${
          err.shortMessage || err.message || "Errore sconosciuto"
        }`
      );
      toast.error(
        `Errore: ${err.shortMessage || err.message || "Operazione fallita"}`
      );
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, tokenId, isConnected, connectedAddress]); 

  useEffect(() => {
    fetchNftDetails();
  }, [fetchNftDetails]); 


  const navigateToNextNFT = useCallback(() => {
    router.push(`/nft-details/${parseInt(tokenId) + 1}`);
  }, [router, tokenId]);


  const navigateToPreviousNFT = useCallback(() => {
    if (parseInt(tokenId) > 1) {
      router.push(`/nft-details/${parseInt(tokenId) - 1}`);
    }
  }, [router, tokenId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-xl text-gray-700">
          Caricamento dettagli NFT...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50 text-red-800 p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Errore nel Caricamento</h1>
        <p className="text-lg mb-4">{error}</p>
        <Button
          onClick={() => router.push("/my-nfts")}
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
        <p className="text-lg mb-4">
          Non è stato possibile trovare i dettagli per l'NFT con ID: {tokenId}.
        </p>
        <Button
          onClick={() => router.push("/my-nfts")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md text-lg"
        >
          Torna alla Lista NFT
        </Button>
      </div>
    );
  }


  const displayImageUrl = fullMetadata.image
    ? resolveIpfsLink(fullMetadata.image)
    : PLACEHOLDER_IMAGE_URL;

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

          {!isOwner && isConnected && (
            <div className="mb-6 border border-orange-400 bg-orange-50 p-4 rounded-lg">
              <div className="text-orange-800">
                <strong>⚠️ Attenzione:</strong> L'NFT con ID {tokenId} non
                appartiene al tuo wallet attualmente collegato (
                {connectedAddress}). Il proprietario attuale è:{" "}
                <span className="font-mono text-sm">{nftOwner}</span>. Puoi
                visualizzare i dettagli ma non puoi effettuare operazioni su
                questo NFT.
              </div>
            </div>
          )}


          {!isConnected && (
            <div className="mb-6 border border-red-400 bg-red-50 p-4 rounded-lg">
              <div className="text-red-800">
                <strong>🔐 Wallet non connesso:</strong> Connetti il tuo wallet
                per verificare la proprietà dell'NFT.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

            <div className="flex justify-center items-center">
              <Image
                src={displayImageUrl}
                alt={`Copertina di ${fullMetadata.name || `NFT ID ${tokenId}`}`}
                width={300}
                height={300}
                className="rounded-lg object-cover shadow-lg border-2 border-blue-200"
                onError={(e) => {
                  e.currentTarget.src = PLACEHOLDER_IMAGE_URL;
                  console.error(
                    `Failed to load image for NFT ${tokenId}: ${displayImageUrl}`
                  );
                }}
              />
            </div>


            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-lg text-gray-800">
                  <strong className="text-blue-700">Token ID:</strong> {tokenId}
                </p>
              </div>


              {nftData.hasSpecialContent && (
                <div className="bg-yellow-100 p-4 rounded-lg flex items-center justify-center border border-yellow-400">
                  <span className="text-yellow-700 text-xl mr-2 animate-pulse">
                    ✨
                  </span>
                  <p className="text-lg text-yellow-800 font-bold">
                    EDIZIONE SPECIALE!
                  </p>
                  <span className="text-yellow-700 text-xl ml-2 animate-pulse">
                    ✨
                  </span>
                </div>
              )}

              <div
                className={`p-4 rounded-lg ${
                  isOwner ? "bg-green-50" : "bg-gray-50"
                }`}
              >
                <p className="text-lg text-gray-800">
                  <strong
                    className={isOwner ? "text-green-700" : "text-gray-700"}
                  >
                    Proprietà:
                  </strong>
                  <span
                    className={`ml-2 ${
                      isOwner ? "text-green-600" : "text-gray-600"
                    }`}
                  >
                    {isOwner ? "✅ Tuo NFT" : "❌ Non tuo"}
                  </span>
                </p>
              </div>


              {nftOwner && (
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-lg text-gray-800">
                    <strong className="text-orange-700">
                      Proprietario Attuale:
                    </strong>{" "}
                    <a
                      href={`https://sepolia.arbiscan.io/address/${nftOwner}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline break-all font-mono text-sm"
                    >
                      {nftOwner}
                    </a>
                  </p>
                </div>
              )}

              {nftData.contentId !== BigInt(0) && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-lg text-gray-800">
                    <strong className="text-green-700">Content ID:</strong>{" "}
                    {nftData.contentId.toString()}
                  </p>
                </div>
              )}

              {fullMetadata.description && (
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-lg text-gray-800">
                    <strong className="text-purple-700">Descrizione:</strong>
                    <span className="ml-2 break-words">
                      {fullMetadata.description}
                    </span>
                  </p>
                </div>
              )}


              {nftData.author &&
                nftData.author !==
                  "0x0000000000000000000000000000000000000000" && (
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <p className="text-lg text-gray-800">
                      <strong className="text-indigo-700">Autore (EoA):</strong>{" "}
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
                <div className="bg-pink-50 p-4 rounded-lg">
                  <p className="text-lg text-gray-800">
                    <strong className="text-pink-700">Link Esterno:</strong>{" "}
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
                    <strong className="text-teal-700">
                      Hash IPFS Contenuto:
                    </strong>{" "}
                    <a
                      href={resolveIpfsLink(nftData.contentIpfsHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline break-all font-mono text-sm"
                    >
                      {nftData.contentIpfsHash.slice(0, 10)}...
                      {nftData.contentIpfsHash.slice(-10)}
                    </a>
                  </p>
                </div>
              )}


              {fullMetadata.attributes &&
                fullMetadata.attributes.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">
                      Attributi Personalizzati:
                    </h3>
                    <div className="space-y-2">
                      {fullMetadata.attributes.map((attr, index) => (
                        <div
                          key={index}
                          className="bg-white p-3 rounded border-l-4 border-blue-400"
                        >
                          <p className="text-lg text-gray-800">
                            <strong className="text-blue-700">
                              {attr.trait_type}:
                            </strong>
                            <span className="ml-2 break-words">
                              {String(attr.value)}
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


              {fullMetadata.scientific_type && (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-lg text-gray-800">
                    <strong className="text-yellow-700">
                      Tipo Scientifico:
                    </strong>
                    <span className="ml-2 break-words">
                      {fullMetadata.scientific_type}
                    </span>
                  </p>
                </div>
              )}

              {fullMetadata.publication_date && (
                <div className="bg-lime-50 p-4 rounded-lg">
                  <p className="text-lg text-gray-800">
                    <strong className="text-lime-700">
                      Data Pubblicazione:
                    </strong>
                    <span className="ml-2 break-words">
                      {fullMetadata.publication_date}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>


          <div className="mt-8">
            <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">
              Schema Metadati (JSON Completo)
            </h3>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
              <pre className="text-green-400 text-sm overflow-x-auto break-words whitespace-pre-wrap max-w-full">
                <code className="break-words">
                  {JSON.stringify(fullMetadata, null, 2)}
                </code>
              </pre>
            </div>
          </div>


          <div className="flex justify-between mt-8 gap-4">
            <Button
              onClick={navigateToPreviousNFT}
              disabled={parseInt(tokenId) <= 1}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md text-lg disabled:opacity-50 disabled:cursor-not-allowed flex-1 max-w-xs"
            >
              &larr; NFT Precedente
            </Button>
            <Button
              onClick={navigateToNextNFT}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md text-lg flex-1 max-w-xs"
            >
              NFT Successivo &rarr;
            </Button>
          </div>


          <div className="mt-6 text-center">
            {!isOwner && isConnected ? (
              <div className="space-y-4">
                <Button
                  onClick={() => router.push("/my-nfts")}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-lg text-lg font-semibold shadow-lg transform hover:scale-105 transition-transform"
                >
                  Torna ai Miei NFT
                </Button>
                <p className="text-sm text-gray-600">
                  Torna alla lista dei tuoi NFT per vedere solo quelli che
                  possiedi
                </p>
              </div>
            ) : (
              <Button
                onClick={() => router.push("/my-nfts")}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold shadow-lg transform hover:scale-105 transition-transform"
              >
                Torna alla Lista NFT
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
