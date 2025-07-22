// frontend-dapp/src/app/marketplace/page.tsx

"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import Image from "next/image";
import { toast, Toaster } from "react-hot-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketplaceNfts } from "@/hooks/useMarketplaceNfts";
import { useMarketplaceInteractions } from "@/hooks/useMarketplaceInteractions";
import { resolveIpfsLink } from "@/utils/ipfs";
import { NFT } from "@/hooks/useOwnedNfts";
import { Star } from "lucide-react";

type NftFilter = "sale" | "auction";

const PLACEHOLDER_IMAGE_URL = "https://placehold.co/80x80/333333/ffffff?text=No+Img";
const ITEMS_PER_PAGE = 10;

const LoadingSpinner = () => <div className="flex justify-center items-center py-8"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div><p className="ml-4 text-white">Caricamento...</p></div>;

const FilterToggle = ({ activeFilter, onFilterChange }: { activeFilter: NftFilter; onFilterChange: (filter: NftFilter) => void; }) => {
  const filters: { key: NftFilter; label: string }[] = [{ key: "sale", label: "In Vendita" }, { key: "auction", label: "In Asta" }];
  return (
    <div className="flex justify-center my-4 p-1 rounded-lg bg-gray-700 space-x-2">
      {filters.map((filter) => (<Button key={filter.key} onClick={() => onFilterChange(filter.key)} className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${activeFilter === filter.key ? "bg-purple-600 text-white shadow-md" : "bg-transparent text-gray-300 hover:bg-gray-600"}`}>{filter.label}</Button>))}
    </div>
  );
};

export default function MarketplacePage() {
  const { isConnected, address } = useAccount();
  const { listedNfts, isLoading, error, refetch } = useMarketplaceNfts();
  const { purchaseNFT, placeBid, isLoading: isActionLoading } = useMarketplaceInteractions();

  const [activeFilter, setActiveFilter] = useState<NftFilter>("sale");
  const [currentPage, setCurrentPage] = useState(1);
  const [bidInputs, setBidInputs] = useState<Map<string, { value: string; error: string | null }>>(new Map());

  useEffect(() => { setCurrentPage(1); }, [activeFilter]);
  
  const { nftsForSale, nftsInAuction } = useMemo(() => {
    const safeListedNfts = Array.isArray(listedNfts) ? listedNfts : [];
    return {
      nftsForSale: safeListedNfts.filter(nft => nft.status.type === 'forSale'),
      nftsInAuction: safeListedNfts.filter(nft => nft.status.type === 'inAuction'),
    };
  }, [listedNfts]);

  const currentList = activeFilter === 'sale' ? nftsForSale : nftsInAuction;
  const totalPages = Math.ceil(currentList.length / ITEMS_PER_PAGE);
  const currentNftsToDisplay = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return currentList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentList, currentPage]);

  const handlePurchase = useCallback(async (nft: NFT) => {
    if (nft.status.type !== 'forSale') return;
    try {
      await purchaseNFT(nft.tokenId, nft.status.price);
      setTimeout(() => refetch(), 2000); 
    } catch (err) { console.error("Purchase failed:", err); }
  }, [purchaseNFT, refetch]);

  const handlePlaceBid = useCallback(async (nft: NFT) => {
    if (nft.status.type !== 'inAuction') return;
    const bidInput = bidInputs.get(nft.tokenId.toString());
    if (!bidInput || bidInput.error || !bidInput.value) {
      toast.error("Per favore, correggi l'importo dell'offerta.");
      return;
    }
    try {
      await placeBid(nft.tokenId, bidInput.value);
      setTimeout(() => refetch(), 2000);
    } catch (err) { console.error("Placing bid failed:", err); }
  }, [placeBid, refetch, bidInputs]);

  const handleBidInputChange = useCallback((nft: NFT, value: string) => {
    const nftIdString = nft.tokenId.toString();
    if (nft.status.type !== 'inAuction') return;
    let error: string | null = null;
    const numericValue = parseFloat(value);
    if (value && isNaN(numericValue)) { error = "Valore non numerico."; }
    else if (numericValue <= 0) { error = "L'offerta deve essere positiva."; }
    else {
        const minBid = parseFloat(nft.status.minPrice);
        if (numericValue < minBid) { error = `Minimo ${minBid} ETH`; }
    }
    setBidInputs(prev => new Map(prev).set(nftIdString, { value, error }));
  }, []);

  const renderTable = (nfts: NFT[]) => (
    <div className="overflow-x-auto">
      <Table className="min-w-full divide-y divide-gray-700">
        <TableHeader className="bg-gray-700/50">
          <TableRow>
            <TableHead>Token ID</TableHead>
            <TableHead>Titolo</TableHead>
            <TableHead>Anteprima</TableHead>
            <TableHead>Prezzo / Dettagli</TableHead>
            <TableHead>Venditore</TableHead>
            <TableHead className="text-center">Azione</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-gray-900 divide-y divide-gray-700">
          {nfts.map((nft) => {
            const isSeller = isConnected && address?.toLowerCase() === nft.seller?.toLowerCase();
            const bidInput = bidInputs.get(nft.tokenId.toString());

            return (
              <TableRow key={nft.tokenId.toString()} className="hover:bg-gray-700/80">
                <TableCell className="font-mono text-purple-300">
                  {nft.tokenId.toString()}
                  {nft.hasSpecialContent && <Star className="w-4 h-4 ml-2 inline-block text-yellow-400 fill-yellow-400" />}
                </TableCell>
                <TableCell className="font-semibold text-gray-200">{nft.title}</TableCell>
                <TableCell><Image src={nft.imageUrlFromMetadata || PLACEHOLDER_IMAGE_URL} alt={nft.title!} width={64} height={64} className="rounded-md object-cover" /></TableCell>
                <TableCell>
                  {(() => {
                    const status = nft.status;
                    if (status.type === 'forSale') return <span className="text-green-400 font-semibold">{status.price} ETH</span>;
                    if (status.type === 'inAuction') {
                      const timeLeft = status.endTime * 1000 - Date.now();
                      const hoursLeft = Math.ceil(timeLeft / 3600000);
                      return (<div className="text-orange-400 text-sm"><p>Min: {status.minPrice} ETH</p><p className="text-xs">{timeLeft > 0 ? `~${hoursLeft} ore rimaste` : 'Terminata'}</p></div>);
                    }
                  })()}
                </TableCell>
                <TableCell className="font-mono text-xs"><a href={`https://sepolia.arbiscan.io/address/${nft.seller}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{`${nft.seller?.slice(0, 6)}...${nft.seller?.slice(-4)}`}</a></TableCell>
                <TableCell className="w-64">
                    <div className="flex flex-col items-center space-y-2">
                        <Button size="sm" onClick={() => window.location.href = `/nft-details/${nft.tokenId.toString()}`} className="bg-gray-600 hover:bg-gray-500 text-white text-xs w-full">Vedi Dettagli</Button>
                        {!isConnected && <p className="text-xs text-gray-500 pt-2">Connettiti per interagire</p>}
                        {isConnected && (
                            isSeller ? (
                                <Button size="sm" disabled className="bg-gray-500 text-xs w-full cursor-not-allowed">Sei il venditore</Button>
                            ) : (
                                nft.status.type === 'forSale' ? (
                                    <Button size="sm" onClick={() => handlePurchase(nft)} disabled={isActionLoading} className="bg-green-600 hover:bg-green-700 w-full text-xs">{isActionLoading ? 'In corso...' : 'Acquista Ora'}</Button>
                                ) : nft.status.type === 'inAuction' && nft.status.endTime * 1000 > Date.now() ? (
                                    <div className="flex flex-col items-stretch w-full pt-1">
                                        <div className="flex items-center space-x-2">
                                            <Input type="number" step="0.01" placeholder="Offerta in ETH" value={bidInput?.value || ''} onChange={(e) => handleBidInputChange(nft, e.target.value)} className="bg-gray-200 text-black text-xs p-1 h-8 flex-grow focus:ring-purple-500 focus:border-purple-500"/>
                                            <Button size="sm" onClick={() => handlePlaceBid(nft)} disabled={isActionLoading || !!bidInput?.error || !bidInput?.value} className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-500 text-xs px-2 h-8">{isActionLoading ? '...' : 'Offri'}</Button>
                                        </div>
                                        {bidInput?.error && <p className="text-red-400 text-xs mt-1 text-center">{bidInput.error}</p>}
                                    </div>
                                ) : null
                            )
                        )}
                    </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6 space-x-2">
          <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Precedente</Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (<Button key={page} onClick={() => setCurrentPage(page)} className={currentPage === page ? "bg-purple-800" : "bg-gray-700"}>{page}</Button>))}
          <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Successiva</Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4 md:p-8">
      <Toaster position="top-right" />
      <Card className="bg-gray-800 border-purple-600 shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-purple-400">Marketplace Pubblico</CardTitle>
          <CardDescription className="text-gray-400">Esplora tutti gli NFT attualmente disponibili per la vendita o in asta.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <LoadingSpinner /> : error ? <div className="text-red-500 text-center py-8">{error}</div> : (
            <>
              <FilterToggle activeFilter={activeFilter} onFilterChange={setActiveFilter} />
              {currentList.length === 0 ? <div className="text-center text-gray-500 py-8 text-lg">Nessun NFT trovato per questa categoria.</div> : renderTable(currentNftsToDisplay)}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// // frontend-dapp/src/app/marketplace/page.tsx

// "use client";

// import { useMemo, useState, useEffect, useCallback } from "react";
// import { useAccount } from "wagmi";
// import Image from "next/image";
// import { toast, Toaster } from "react-hot-toast";
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
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { useMarketplaceNfts } from "@/hooks/useMarketplaceNfts";
// import { useMarketplaceInteractions } from "@/hooks/useMarketplaceInteractions";
// import { resolveIpfsLink } from "@/utils/ipfs";
// import { NFT } from "@/hooks/useOwnedNfts";
// import { Star } from "lucide-react";

// type NftFilter = "sale" | "auction";

// const PLACEHOLDER_IMAGE_URL = "https://placehold.co/80x80/333333/ffffff?text=No+Img";
// const ITEMS_PER_PAGE = 10;

// const LoadingSpinner = () => (
//   <div className="flex justify-center items-center py-8">
//     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
//     <p className="ml-4 text-white">Caricamento Marketplace...</p>
//   </div>
// );

// const FilterToggle = ({ activeFilter, onFilterChange }: { activeFilter: NftFilter; onFilterChange: (filter: NftFilter) => void; }) => {
//   const filters: { key: NftFilter; label: string }[] = [{ key: "sale", label: "In Vendita" }, { key: "auction", label: "In Asta" }];
//   return (
//     <div className="flex justify-center my-4 p-1 rounded-lg bg-gray-700 space-x-2">
//       {filters.map((filter) => (
//         <Button key={filter.key} onClick={() => onFilterChange(filter.key)} className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${activeFilter === filter.key ? "bg-purple-600 text-white shadow-md" : "bg-transparent text-gray-300 hover:bg-gray-600"}`}>
//           {filter.label}
//         </Button>
//       ))}
//     </div>
//   );
// };

// export default function MarketplacePage() {
//   const { isConnected, address } = useAccount();
//   const { listedNfts, isLoading, error, refetch } = useMarketplaceNfts();
//   const { purchaseNFT, placeBid, isLoading: isActionLoading } = useMarketplaceInteractions();

//   const [activeFilter, setActiveFilter] = useState<NftFilter>("sale");
//   const [currentPage, setCurrentPage] = useState(1);
//   const [bidInputs, setBidInputs] = useState<Map<string, { value: string; error: string | null }>>(new Map());

//   useEffect(() => { setCurrentPage(1); }, [activeFilter]);
  
//   const { nftsForSale, nftsInAuction } = useMemo(() => {
//     const safeListedNfts = Array.isArray(listedNfts) ? listedNfts : [];
//     return {
//       nftsForSale: safeListedNfts.filter(nft => nft.status.type === 'forSale'),
//       nftsInAuction: safeListedNfts.filter(nft => nft.status.type === 'inAuction'),
//     };
//   }, [listedNfts]);

//   const currentList = activeFilter === 'sale' ? nftsForSale : nftsInAuction;
//   const totalPages = Math.ceil(currentList.length / ITEMS_PER_PAGE);
//   const currentNftsToDisplay = useMemo(() => {
//     const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
//     return currentList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
//   }, [currentList, currentPage]);

//   const handlePurchase = useCallback(async (nft: NFT) => {
//     if (nft.status.type !== 'forSale') return;
//     try {
//       await purchaseNFT(nft.tokenId, nft.status.price);
//       setTimeout(() => refetch(), 2000); 
//     } catch (err) {
//       console.error("Purchase failed:", err);
//     }
//   }, [purchaseNFT, refetch]);

//   const handlePlaceBid = useCallback(async (nft: NFT) => {
//     if (nft.status.type !== 'inAuction') return;
//     const bidInput = bidInputs.get(nft.tokenId.toString());
    
//     if (!bidInput || bidInput.error || !bidInput.value) {
//       toast.error("Per favore, correggi l'importo dell'offerta.");
//       return;
//     }
    
//     try {
//       await placeBid(nft.tokenId, bidInput.value);
//       setTimeout(() => refetch(), 2000);
//     } catch (err) {
//       console.error("Placing bid failed:", err);
//     }
//   }, [placeBid, refetch, bidInputs]);

//   const handleBidInputChange = useCallback((nft: NFT, value: string) => {
//     const nftIdString = nft.tokenId.toString();
//     if (nft.status.type !== 'inAuction') return;

//     let error: string | null = null;
//     const numericValue = parseFloat(value);
    
//     if (value && isNaN(numericValue)) {
//       error = "Valore non numerico.";
//     } else if (numericValue <= 0) {
//       error = "L'offerta deve essere positiva.";
//     } else {
//         const minBid = parseFloat(nft.status.minPrice);
//         if (numericValue < minBid) {
//             error = `Minimo ${minBid} ETH`;
//         }
//     }

//     setBidInputs(prev => new Map(prev).set(nftIdString, { value, error }));
//   }, []);

//   const renderTable = (nfts: NFT[]) => (
//     <div className="overflow-x-auto">
//       <Table className="min-w-full divide-y divide-gray-700">
//         <TableHeader className="bg-gray-700/50">
//           <TableRow>
//             <TableHead>Token ID</TableHead>
//             <TableHead>Titolo</TableHead>
//             <TableHead>Anteprima</TableHead>
//             <TableHead>Prezzo / Dettagli</TableHead>
//             <TableHead>Venditore</TableHead>
//             <TableHead className="text-center">Azione</TableHead>
//           </TableRow>
//         </TableHeader>
//         <TableBody className="bg-gray-900 divide-y divide-gray-700">
//           {nfts.map((nft) => {
//             const isOwner = isConnected && address?.toLowerCase() === nft.author.toLowerCase();
//             const bidInput = bidInputs.get(nft.tokenId.toString());

//             return (
//               <TableRow key={nft.tokenId.toString()} className="hover:bg-gray-700/80">
//                 <TableCell className="font-mono text-purple-300">
//                   {nft.tokenId.toString()}
//                   {nft.hasSpecialContent && <Star className="w-4 h-4 ml-2 inline-block text-yellow-400 fill-yellow-400" />}
//                 </TableCell>
//                 <TableCell className="font-semibold text-gray-200">{nft.title}</TableCell>
//                 <TableCell><Image src={nft.imageUrlFromMetadata || PLACEHOLDER_IMAGE_URL} alt={nft.title!} width={64} height={64} className="rounded-md object-cover" /></TableCell>
//                 <TableCell>
//                   {(() => {
//                     const status = nft.status;
//                     if (status.type === 'forSale') return <span className="text-green-400 font-semibold">{status.price} ETH</span>;
//                     if (status.type === 'inAuction') {
//                       const timeLeft = status.endTime * 1000 - Date.now();
//                       const hoursLeft = Math.ceil(timeLeft / 3600000);
//                       return (
//                         <div className="text-orange-400 text-sm">
//                           <p>Min: {status.minPrice} ETH</p>
//                           <p className="text-xs">{timeLeft > 0 ? `~${hoursLeft} ore rimaste` : 'Terminata'}</p>
//                         </div>
//                       );
//                     }
//                   })()}
//                 </TableCell>
//                 <TableCell className="font-mono text-xs"><a href={`https://sepolia.arbiscan.io/address/${nft.author}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{`${nft.author.slice(0, 6)}...${nft.author.slice(-4)}`}</a></TableCell>
//                 <TableCell className="w-64">
//                     <div className="flex flex-col items-center space-y-2">
//                         <Button size="sm" onClick={() => window.location.href = `/nft-details/${nft.tokenId.toString()}`} className="bg-gray-600 hover:bg-gray-500 text-white text-xs w-full">Vedi Dettagli</Button>
//                         {!isConnected && <p className="text-xs text-gray-500 pt-2">Connettiti per interagire</p>}
//                         {isConnected && (
//                             isOwner ? (
//                                 <Button size="sm" disabled className="bg-gray-500 text-xs w-full cursor-not-allowed">Sei il venditore</Button>
//                             ) : (
//                                 nft.status.type === 'forSale' ? (
//                                     <Button size="sm" onClick={() => handlePurchase(nft)} disabled={isActionLoading} className="bg-green-600 hover:bg-green-700 w-full text-xs">
//                                         {isActionLoading ? 'In corso...' : 'Acquista Ora'}
//                                     </Button>
//                                 ) : nft.status.type === 'inAuction' && nft.status.endTime * 1000 > Date.now() ? (
//                                     <div className="flex flex-col items-stretch w-full pt-1">
//                                         <div className="flex items-center space-x-2">
//                                             <Input 
//                                                 type="number" 
//                                                 step="0.01" 
//                                                 placeholder="Offerta in ETH" 
//                                                 value={bidInput?.value || ''} 
//                                                 onChange={(e) => handleBidInputChange(nft, e.target.value)} 
//                                                 className="bg-gray-200 text-black text-xs p-1 h-8 flex-grow focus:ring-purple-500 focus:border-purple-500"
//                                             />
//                                             <Button 
//                                                 size="sm" 
//                                                 onClick={() => handlePlaceBid(nft)} 
//                                                 disabled={isActionLoading || !!bidInput?.error || !bidInput?.value} 
//                                                 className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-500 text-xs px-2 h-8"
//                                             >
//                                                 {isActionLoading ? '...' : 'Offri'}
//                                             </Button>
//                                         </div>
//                                         {bidInput?.error && <p className="text-red-400 text-xs mt-1 text-center">{bidInput.error}</p>}
//                                     </div>
//                                 ) : null
//                             )
//                         )}
//                     </div>
//                 </TableCell>
//               </TableRow>
//             );
//           })}
//         </TableBody>
//       </Table>
//       {totalPages > 1 && (
//         <div className="flex justify-center items-center mt-6 space-x-2">
//           <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Precedente</Button>
//           {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (<Button key={page} onClick={() => setCurrentPage(page)} className={currentPage === page ? "bg-purple-800" : "bg-gray-700"}>{page}</Button>))}
//           <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Successiva</Button>
//         </div>
//       )}
//     </div>
//   );

//   return (
//     <div className="bg-gray-900 text-white min-h-screen p-4 md:p-8">
//       <Toaster position="top-right" />
//       <Card className="bg-gray-800 border-purple-600 shadow-lg">
//         <CardHeader>
//           <CardTitle className="text-3xl font-bold text-purple-400">Marketplace Pubblico</CardTitle>
//           <CardDescription className="text-gray-400">Esplora tutti gli NFT attualmente disponibili per la vendita o in asta.</CardDescription>
//         </CardHeader>
//         <CardContent>
//           {isLoading ? <LoadingSpinner /> : error ? <div className="text-red-500 text-center py-8">{error}</div> : (
//             <>
//               <FilterToggle activeFilter={activeFilter} onFilterChange={setActiveFilter} />
//               {currentList.length === 0 ? <div className="text-center text-gray-500 py-8 text-lg">Nessun NFT trovato per questa categoria.</div> : renderTable(currentNftsToDisplay)}
//             </>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// }

