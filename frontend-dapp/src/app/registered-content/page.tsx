"use client";

import { useAccount } from "wagmi";
import { useEffect, useState, useCallback, useMemo } from "react";
import { toast, Toaster } from "react-hot-toast";
import { ARBITRUM_SEPOLIA_CHAIN_ID } from "@/lib/constants";
import useAdminContentManagement from "@/hooks/useAdminContentManagement";
import { formatEther } from "viem";
import Link from "next/link";
import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRegisteredContents, DisplayContent } from "@/hooks/useRegisteredContents";
import { resolveIpfsLink } from "@/utils/ipfs";

const ITEMS_PER_PAGE = 10;
const PLACEHOLDER_IMAGE_URL = "https://placehold.co/80x80/333333/ffffff?text=No+Img";

// --- COMPONENTI UI ---
const LoadingSpinner = () => <div className="flex justify-center items-center py-8"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div><p className="ml-4 text-white">Caricamento...</p></div>;

const SuccessNotification = ({ contentId, onClose }: { contentId: bigint; onClose: () => void; }) => (
  <div className="fixed top-4 right-4 z-50 bg-green-500 text-white p-6 rounded-lg shadow-lg border-2 border-green-400 max-w-md">
    <div className="flex items-start">
      <div className="text-2xl mr-3">🎉</div>
      <div className="flex-1">
        <h3 className="font-bold text-lg">NFT Mintato con Successo!</h3>
        <p className="text-sm">Il tuo nuovo NFT per il Content ID {contentId.toString()} è stato creato.</p>
        <p className="text-xs mt-1">La tabella si aggiornerà a breve con i nuovi dati.</p>
      </div>
      <button onClick={onClose} className="ml-2 text-green-200 hover:text-white text-xl">×</button>
    </div>
  </div>
);

// --- COMPONENTE PER NOTIFICA CONNESSIONE ---
const ConnectionNotice = ({ isConnected, chainId }: { isConnected: boolean; chainId: number | undefined }) => {
  if (!isConnected) {
    return (
      <div className="mb-6 p-4 bg-yellow-900/50 border border-yellow-600 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-yellow-400 font-semibold">Wallet non connesso</h3>
            <p className="text-yellow-200 text-sm">Connetti il tuo wallet per poter mintare i contenuti.</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
    return (
      <div className="mb-6 p-4 bg-red-900/50 border border-red-600 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-red-400 font-semibold">Rete Errata</h3>
            <p className="text-red-200 text-sm">Connetti a Arbitrum Sepolia per poter mintare.</p>
          </div>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return null;
};

// --- PAGINA PRINCIPALE ---
const RegisteredContentPage = () => {
  const { address, isConnected, chainId } = useAccount();
  const { registeredContents, isLoading: isLoadingContents, error: contentsError, refetch } = useRegisteredContents();
  const { handleRequestMintForCopy, resetMintingState, isProcessing: isAdminProcessing } = useAdminContentManagement();

  const [isMintingId, setIsMintingId] = useState<bigint | null>(null);
  const [showSuccessNotification, setShowSuccessNotification] = useState<bigint | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Determiniamo se l'utente può mintare (connesso e rete corretta)
  const canMint = isConnected && chainId === ARBITRUM_SEPOLIA_CHAIN_ID;

  const onMintNewCopy = useCallback(async (content: DisplayContent) => {
    if (!isConnected || !address) { toast.error("Connetti il tuo wallet."); return; }
    if (chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) { toast.error("Connetti a Arbitrum Sepolia."); return; }
    if (isAdminProcessing || isMintingId) { toast.error("Un'altra operazione è già in corso."); return; }

    const { contentId, title, description, ipfsHash, displayImageUrl, nftMintPrice, mintedCopies, maxCopies, isAvailable } = content;
    if (mintedCopies >= maxCopies || !isAvailable) { toast.error("Contenuto non più disponibile per il minting."); return; }

    setIsMintingId(contentId);
    
    try {
      if (resetMintingState) resetMintingState();
      const mainDocCid = ipfsHash?.replace("ipfs://", "") || null;
      const previewCid = displayImageUrl?.split("/ipfs/")[1] || null;

      // Avviamo la transazione
      await handleRequestMintForCopy(contentId, title, description, mainDocCid, previewCid, nftMintPrice);
      
      // La transazione è stata inviata (l'utente ha confermato su Metamask)
      toast.success("Transazione inviata! In attesa della finalizzazione...");

      // --- LOGICA DEL TIMER ---
      // Impostiamo un timer per mostrare il pop-up e riattivare i pulsanti
      setTimeout(() => {
        setShowSuccessNotification(contentId);
        setIsMintingId(null); // Riattiva i pulsanti
        refetch(); // Forziamo l'aggiornamento dei dati
      }, 12000); // Aspettiamo 12 secondi

    } catch (err: any) {
      // Questo blocco viene eseguito se l'utente rifiuta la transazione in Metamask
      console.error("Minting process failed or was rejected:", err);
      toast.error(err.shortMessage || "Transazione annullata dall'utente.");
      setIsMintingId(null); // Riattiviamo subito i pulsanti in caso di rifiuto
    }
  }, [isConnected, address, chainId, isAdminProcessing, isMintingId, resetMintingState, handleRequestMintForCopy, refetch]);

  const totalPages = useMemo(() => Math.ceil(registeredContents.length / ITEMS_PER_PAGE), [registeredContents]);
  const currentContents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return registeredContents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [registeredContents, currentPage]);

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4">
      <Toaster position="top-right" />
      {showSuccessNotification && <SuccessNotification contentId={showSuccessNotification} onClose={() => setShowSuccessNotification(null)} />}
      
      <Card className="bg-gray-800 border-purple-600">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-purple-400">Contenuti Scientifici Registrati</CardTitle>
          <CardDescription className="text-gray-400">Esplora i contenuti registrati e conia la tua copia NFT.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Notifica di connessione sempre visibile quando necessaria */}
          <ConnectionNotice isConnected={isConnected} chainId={chainId} />
          
          {isLoadingContents ? <LoadingSpinner /> : contentsError ? <div className="text-red-500 text-center py-8">Errore: {contentsError}</div> : currentContents.length === 0 ? <div className="text-center text-gray-500 py-8 text-lg">Nessun contenuto registrato trovato.</div> : (
            <div className="overflow-x-auto">
              <Table className="min-w-full divide-y divide-gray-700">
                <TableHeader className="bg-gray-700">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Anteprima</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Copie</TableHead>
                    <TableHead>Prezzo Mint</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-gray-900 divide-y divide-gray-700">
                  {currentContents.map((content) => {
                    const isMintingThis = isMintingId === content.contentId;
                    const isAvailable = content.mintedCopies < content.maxCopies && content.isAvailable;
                    
                    // Il pulsante è disabilitato se:
                    // 1. Non può mintare (wallet non connesso o rete sbagliata)
                    // 2. Contenuto non disponibile/esaurito
                    // 3. Operazione in corso (admin processing o minting in corso)
                    const isButtonDisabled = !canMint || !isAvailable || isAdminProcessing || !!isMintingId;
                    
                    return (
                      <TableRow key={content.contentId.toString()} className="hover:bg-gray-700/80 transition-colors">
                        <TableCell className="font-medium text-purple-300">{content.contentId.toString()}</TableCell>
                        <TableCell className="text-gray-200">{content.title}</TableCell>
                        <TableCell><Image src={content.displayImageUrl || PLACEHOLDER_IMAGE_URL} alt={`Copertina di ${content.title}`} width={80} height={80} className="rounded-md object-cover" /></TableCell>
                        <TableCell>{content.ipfsHash ? <Link href={resolveIpfsLink(content.ipfsHash)} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Vedi Documento</Link> : "N/D"}</TableCell>
                        <TableCell className="text-gray-200">{content.mintedCopies.toString()} / {content.maxCopies.toString()}</TableCell>
                        <TableCell className="text-gray-200">{formatEther(content.nftMintPrice)} ETH</TableCell>
                        <TableCell>
                          {!isAvailable ? (
                            <Button disabled className="bg-gray-600 cursor-not-allowed">Esaurito</Button>
                          ) : (
                            <Button 
                              onClick={() => onMintNewCopy(content)} 
                              disabled={isButtonDisabled} 
                              className={`transition-colors ${
                                isMintingThis ? "bg-yellow-600" : 
                                isButtonDisabled ? "bg-gray-500 cursor-not-allowed" : 
                                "bg-purple-600 hover:bg-purple-700"
                              }`}
                            >
                              {!canMint ? "Connetti Wallet" :
                               isMintingThis ? "In attesa..." : 
                               (isAdminProcessing || !!isMintingId) ? "Operazione in corso..." : 
                               "Conia Copia"}
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
                  <Button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}>Precedente</Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => <Button key={page} onClick={() => setCurrentPage(page)} className={currentPage === page ? "bg-purple-800" : "bg-gray-700"}>{page}</Button>)}
                  <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}>Successiva</Button>
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



// "use client";

// import { useAccount } from "wagmi";
// import { useEffect, useState, useCallback, useMemo } from "react";
// import { toast, Toaster } from "react-hot-toast";
// import { ARBITRUM_SEPOLIA_CHAIN_ID } from "@/lib/constants";
// import useAdminContentManagement from "@/hooks/useAdminContentManagement";
// import { formatEther } from "viem";
// import Link from "next/link";
// import Image from "next/image";
// import { ConnectButton } from "@rainbow-me/rainbowkit";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// import { useRegisteredContents, DisplayContent } from "@/hooks/useRegisteredContents";
// import { resolveIpfsLink } from "@/utils/ipfs";

// const ITEMS_PER_PAGE = 10;
// const PLACEHOLDER_IMAGE_URL = "https://placehold.co/80x80/333333/ffffff?text=No+Img";

// // --- COMPONENTI UI ---
// const LoadingSpinner = () => <div className="flex justify-center items-center py-8"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div><p className="ml-4 text-white">Caricamento...</p></div>;

// const SuccessNotification = ({ contentId, onClose }: { contentId: bigint; onClose: () => void; }) => (
//   <div className="fixed top-4 right-4 z-50 bg-green-500 text-white p-6 rounded-lg shadow-lg border-2 border-green-400 max-w-md">
//     <div className="flex items-start">
//       <div className="text-2xl mr-3">🎉</div>
//       <div className="flex-1">
//         <h3 className="font-bold text-lg">NFT Mintato con Successo!</h3>
//         <p className="text-sm">Il tuo nuovo NFT per il Content ID {contentId.toString()} è stato creato.</p>
//         <p className="text-xs mt-1">La tabella si aggiornerà a breve con i nuovi dati.</p>
//       </div>
//       <button onClick={onClose} className="ml-2 text-green-200 hover:text-white text-xl">×</button>
//     </div>
//   </div>
// );

// // --- PAGINA PRINCIPALE ---
// const RegisteredContentPage = () => {
//   const { address, isConnected, chainId } = useAccount();
//   const { registeredContents, isLoading: isLoadingContents, error: contentsError, refetch } = useRegisteredContents();
//   const { handleRequestMintForCopy, resetMintingState, isProcessing: isAdminProcessing } = useAdminContentManagement();

//   const [isMintingId, setIsMintingId] = useState<bigint | null>(null);
//   const [showSuccessNotification, setShowSuccessNotification] = useState<bigint | null>(null);
//   const [currentPage, setCurrentPage] = useState(1);

//   const onMintNewCopy = useCallback(async (content: DisplayContent) => {
//     if (!isConnected || !address) { toast.error("Connetti il tuo wallet."); return; }
//     if (isAdminProcessing || isMintingId) { toast.error("Un'altra operazione è già in corso."); return; }

//     const { contentId, title, description, ipfsHash, displayImageUrl, nftMintPrice, mintedCopies, maxCopies, isAvailable } = content;
//     if (mintedCopies >= maxCopies || !isAvailable) { toast.error("Contenuto non più disponibile per il minting."); return; }

//     setIsMintingId(contentId);
    
//     try {
//       if (resetMintingState) resetMintingState();
//       const mainDocCid = ipfsHash?.replace("ipfs://", "") || null;
//       const previewCid = displayImageUrl?.split("/ipfs/")[1] || null;

//       // Avviamo la transazione
//       await handleRequestMintForCopy(contentId, title, description, mainDocCid, previewCid, nftMintPrice);
      
//       // La transazione è stata inviata (l'utente ha confermato su Metamask)
//       toast.success("Transazione inviata! In attesa della finalizzazione...");

//       // --- LOGICA DEL TIMER ---
//       // Impostiamo un timer per mostrare il pop-up e riattivare i pulsanti
//       setTimeout(() => {
//         setShowSuccessNotification(contentId);
//         setIsMintingId(null); // Riattiva i pulsanti
//         refetch(); // Forziamo l'aggiornamento dei dati
//       }, 12000); // Aspettiamo 12 secondi

//     } catch (err: any) {
//       // Questo blocco viene eseguito se l'utente rifiuta la transazione in Metamask
//       console.error("Minting process failed or was rejected:", err);
//       toast.error(err.shortMessage || "Transazione annullata dall'utente.");
//       setIsMintingId(null); // Riattiviamo subito i pulsanti in caso di rifiuto
//     }
//   }, [isConnected, address, isAdminProcessing, isMintingId, resetMintingState, handleRequestMintForCopy, refetch]);

//   const totalPages = useMemo(() => Math.ceil(registeredContents.length / ITEMS_PER_PAGE), [registeredContents]);
//   const currentContents = useMemo(() => {
//     const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
//     return registeredContents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
//   }, [registeredContents, currentPage]);

//   if (!isConnected) return <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center"><h1 className="text-2xl mb-4 text-purple-400">Connetti il tuo Wallet</h1><p className="text-gray-400 mb-4">Per interagire con i contenuti, connetti il tuo wallet.</p><ConnectButton /></div>;
//   if (chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) return <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center"><h1 className="text-2xl mb-4 text-red-400">Rete Errata</h1><p className="text-gray-400">Connetti a Arbitrum Sepolia.</p></div>;

//   return (
//     <div className="bg-gray-900 text-white min-h-screen p-4">
//       <Toaster position="top-right" />
//       {showSuccessNotification && <SuccessNotification contentId={showSuccessNotification} onClose={() => setShowSuccessNotification(null)} />}
//       <Card className="bg-gray-800 border-purple-600">
//         <CardHeader>
//           <CardTitle className="text-3xl font-bold text-purple-400">Contenuti Scientifici Registrati</CardTitle>
//           <CardDescription className="text-gray-400">Esplora i contenuti registrati e conia la tua copia NFT.</CardDescription>
//         </CardHeader>
//         <CardContent>
//           {isLoadingContents ? <LoadingSpinner /> : contentsError ? <div className="text-red-500 text-center py-8">Errore: {contentsError}</div> : currentContents.length === 0 ? <div className="text-center text-gray-500 py-8 text-lg">Nessun contenuto registrato trovato.</div> : (
//             <div className="overflow-x-auto">
//               <Table className="min-w-full divide-y divide-gray-700">
//                 <TableHeader className="bg-gray-700">
//                   <TableRow>
//                     <TableHead>ID</TableHead>
//                     <TableHead>Titolo</TableHead>
//                     <TableHead>Anteprima</TableHead>
//                     <TableHead>Documento</TableHead>
//                     <TableHead>Copie</TableHead>
//                     <TableHead>Prezzo Mint</TableHead>
//                     <TableHead>Azioni</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody className="bg-gray-900 divide-y divide-gray-700">
//                   {currentContents.map((content) => {
//                     const isMintingThis = isMintingId === content.contentId;
//                     const isAvailable = content.mintedCopies < content.maxCopies && content.isAvailable;
//                     return (
//                       <TableRow key={content.contentId.toString()} className="hover:bg-gray-700/80 transition-colors">
//                         <TableCell className="font-medium text-purple-300">{content.contentId.toString()}</TableCell>
//                         <TableCell className="text-gray-200">{content.title}</TableCell>
//                         <TableCell><Image src={content.displayImageUrl || PLACEHOLDER_IMAGE_URL} alt={`Copertina di ${content.title}`} width={80} height={80} className="rounded-md object-cover" /></TableCell>
//                         <TableCell>{content.ipfsHash ? <Link href={resolveIpfsLink(content.ipfsHash)} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Vedi Documento</Link> : "N/D"}</TableCell>
//                         <TableCell className="text-gray-200">{content.mintedCopies.toString()} / {content.maxCopies.toString()}</TableCell>
//                         <TableCell className="text-gray-200">{formatEther(content.nftMintPrice)} ETH</TableCell>
//                         <TableCell>
//                           {isAvailable ? (
//                             <Button onClick={() => onMintNewCopy(content)} disabled={isAdminProcessing || !!isMintingId} className={`transition-colors ${isMintingThis ? "bg-yellow-600" : (isAdminProcessing || !!isMintingId) ? "bg-gray-500 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"}`}>
//                               {isMintingThis ? "In attesa..." : (isAdminProcessing || !!isMintingId) ? "Operazione in corso..." : "Conia Copia"}
//                             </Button>
//                           ) : <Button disabled className="bg-gray-600 cursor-not-allowed">Esaurito</Button>}
//                         </TableCell>
//                       </TableRow>
//                     );
//                   })}
//                 </TableBody>
//               </Table>
//               {totalPages > 1 && (
//                 <div className="flex justify-center items-center mt-6 space-x-2">
//                   <Button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}>Precedente</Button>
//                   {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => <Button key={page} onClick={() => setCurrentPage(page)} className={currentPage === page ? "bg-purple-800" : "bg-gray-700"}>{page}</Button>)}
//                   <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}>Successiva</Button>
//                 </div>
//               )}
//             </div>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// };

// export default RegisteredContentPage;

