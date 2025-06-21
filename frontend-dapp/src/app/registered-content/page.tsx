// frontend-dapp/src/app/registered-content/page.tsx
"use client"; // Questo è un componente client-side

import { useAccount } from "wagmi";
import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { ARBITRUM_SEPOLIA_CHAIN_ID } from "@/lib/constants";
import { usePublicContents } from "@/hooks/usePublicContents"; // Importa il nuovo hook
import { useRegisterContent } from "@/hooks/useRegisterContent"; // Useremo questo per la funzione di mint

// IMPORTANTE: Assicurati che questi percorsi e componenti esistano.
// Esempio: `components/LoadingSpinner.tsx`
// Esempio: `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/table.tsx` da shadcn/ui
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

// Placeholder per LoadingSpinner se non hai ancora un componente dedicato
const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-8">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    <p className="ml-4 text-gray-700">Caricamento...</p>
  </div>
);


// Funzione helper per risolvere i link IPFS (la stessa che era nell'hook, la mettiamo qui per riuso)
const resolveIpfsLink = (ipfsUri: string): string => {
  if (!ipfsUri) return "";
  if (ipfsUri.startsWith("ipfs://")) {
    const cid = ipfsUri.replace("ipfs://", "");
    // Considera di configurare un gateway IPFS preferito o di fallback
    // ad esempio, il tuo gateway dedicato se ne hai uno, o un servizio come Pinata/Infura
    return `https://${cid}.ipfs.dweb.link/`;
  }
  return ipfsUri;
};

const RegisteredContentPage = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // Per evitare mismatch SSR/CSR

  const { address, isConnected, chainId } = useAccount();
  const {
    registeredContents,
    isLoading: isLoadingContents,
    error: contentsError,
    refreshContents,
  } = usePublicContents(); // Usiamo il nuovo hook!

  // Importiamo le funzioni e gli stati necessari da useRegisterContent
  const {
    handleRequestMintNFT,
    isRequestMintPending,
    isRequestingMint,
    isMintingFulfilled,
    mintedTokenId,
    mintingRevertReason,
    resetForm,
    // setRegistryContentId non è più strettamente necessario esporlo e usarlo direttamente qui per il minting
  } = useRegisterContent();

  // Stato locale per gestire quale contenuto è in fase di minting (per UI)
  const [activeMintContentId, setActiveMintContentId] = useState<bigint | null>(null);

  useEffect(() => {
    // Gestisce il feedback per il minting iniziato/pending
    if (activeMintContentId !== null) {
      if (isRequestMintPending) {
        toast.loading(`Inizializzazione minting per Content ID ${activeMintContentId.toString()}...`);
      } else if (isRequestingMint) {
        toast.loading(`Conio NFT in corso per Content ID ${activeMintContentId.toString()} (richiesta VRF inviata)...`);
      }
    }

    // Gestisce il feedback per il minting completato o fallito
    if (isMintingFulfilled && activeMintContentId !== null) {
      if (mintedTokenId !== null) {
        toast.success(`🎉 NFT Mintato! Token ID: ${mintedTokenId.toString()} per Content ID ${activeMintContentId.toString()}.`);
      } else {
        toast.success(`🎉 Minting completato per Content ID ${activeMintContentId.toString()}.`);
      }
      refreshContents(); // Ricarica la lista dei contenuti per aggiornare i conteggi
      setActiveMintContentId(null); // Resetta lo stato di minting della UI
      resetForm(); // Resetta lo stato interno di useRegisterContent relativo al minting
    } else if (mintingRevertReason && activeMintContentId !== null) {
      toast.error(`Errore nel minting per Content ID ${activeMintContentId.toString()}: ${mintingRevertReason}`);
      setActiveMintContentId(null);
      resetForm(); // Resetta lo stato interno
    }
  }, [
    isRequestMintPending,
    isRequestingMint,
    isMintingFulfilled,
    mintedTokenId,
    mintingRevertReason,
    activeMintContentId,
    refreshContents,
    resetForm,
  ]);


  // Funzione per avviare il minting di una copia specifica
  const onMintNewCopy = useCallback(async (contentId: bigint) => {
    if (!isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID || !address) {
      toast.error("Connetti il tuo wallet alla rete Arbitrum Sepolia.");
      return;
    }

    // Controlla se c'è già un'operazione di minting in corso
    if (activeMintContentId !== null) {
      toast("Un'operazione di minting è già in corso. Attendi il completamento.", { icon: "ℹ️" });
      return;
    }

    const contentToMint = registeredContents.find(c => c.contentId === contentId);
    if (!contentToMint) {
      toast.error("Dettagli del contenuto non trovati.");
      return;
    }

    // Imposta lo stato per la UI per indicare quale contenuto è in minting
    setActiveMintContentId(contentId);

    // Qui ora passiamo i due argomenti richiesti
    if (!contentToMint.firstMintMetadataJsonUri) {
      toast.error("Impossibile trovare i metadati del primo mint per questo contenuto.");
      setActiveMintContentId(null); // Resetta lo stato attivo se non si può procedere
      return;
    }

    await handleRequestMintNFT(contentId, contentToMint.firstMintMetadataJsonUri);

  }, [address, isConnected, chainId, activeMintContentId, registeredContents, handleRequestMintNFT]);


  if (!mounted) {
    return null;
  }

  // Non controllare l'account admin qui, la pagina è pubblica
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <h1 className="text-2xl font-bold mb-4">Connetti il tuo Wallet</h1>
        <p className="text-gray-600">Per visualizzare e interagire con i contenuti, per favore connetti il tuo wallet.</p>
        {/* Potresti aggiungere qui un pulsante per connettere il wallet */}
      </div>
    );
  }

  if (chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <h1 className="text-2xl font-bold mb-4">Rete Errata</h1>
        <p className="text-gray-600">Per favore connetti il tuo wallet alla rete Arbitrum Sepolia per visualizzare i contenuti.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Contenuti Scientifici Registrati</CardTitle>
          <CardDescription>
            Esplora tutti i contenuti scientifici registrati. Se disponibile, puoi coniare una nuova copia NFT.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingContents ? (
            <LoadingSpinner />
          ) : contentsError ? (
            <div className="text-red-500">Errore: {contentsError}</div>
          ) : registeredContents.length === 0 ? (
            <div className="text-center text-gray-500 py-8">Nessun contenuto registrato trovato.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Immagine Copertina</TableHead>
                    <TableHead>Documento Principale</TableHead>
                    <TableHead>Copie (Mintate/Massime)</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registeredContents.map((content) => (
                    <TableRow key={content.contentId.toString()}>
                      <TableCell className="font-medium">{content.contentId.toString()}</TableCell>
                      <TableCell>{content.title}</TableCell>
                      <TableCell>
                        {content.previewImageCID ? (
                          // Il path della sorgente dell'immagine dovrebbe usare resolveIpfsLink
                          <Image
                            src={resolveIpfsLink(`ipfs://${content.previewImageCID}`)}
                            alt={`Copertina di ${content.title}`}
                            width={80}
                            height={80}
                            className="rounded-md object-cover"
                          />
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {content.originalDocumentFileCID ? ( // Usa originalDocumentFileCID dai metadati NFT
                          <Link href={resolveIpfsLink(`ipfs://${content.originalDocumentFileCID}`)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            Scarica Documento
                          </Link>
                        ) : (
                          <span className="text-gray-400">Non Disponibile</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {content.mintedCopies.toString()} / {content.maxCopies.toString()}
                      </TableCell>
                      <TableCell>
                        {content.mintedCopies < content.maxCopies && content.isAvailable ? (
                          <Button
                            onClick={() => onMintNewCopy(content.contentId)}
                            disabled={
                              // Disabilita se questo è il contenuto attualmente in fase di minting
                              activeMintContentId === content.contentId ||
                              isRequestMintPending ||
                              isRequestingMint ||
                              isMintingFulfilled
                            }
                            className="bg-blue-500 hover:bg-blue-600 text-white"
                          >
                            {activeMintContentId === content.contentId ? (
                              isMintingFulfilled ? "Minting Completato!" : "Minting in corso..."
                            ) : "Conia Nuova Copia"}
                          </Button>
                        ) : (
                          <span className="text-gray-500">Limite Copie Raggiunto</span>
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