// frontend-dapp/src/app/marketplace/page.tsx

"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
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
import { Button } from "@/components/ui/button";
import { useMarketplaceNfts } from "@/hooks/useMarketplaceNfts";
import { resolveIpfsLink } from "@/utils/ipfs";
import { NFT } from "@/hooks/useOwnedNfts";
import { Star } from "lucide-react";

type NftFilter = "sale" | "auction";

const PLACEHOLDER_IMAGE_URL = "https://placehold.co/80x80/333333/ffffff?text=No+Img";
const ITEMS_PER_PAGE = 10;

const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-8">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
    <p className="ml-4 text-white">Caricamento Marketplace...</p>
  </div>
);

const FilterToggle = ({ activeFilter, onFilterChange }: { activeFilter: NftFilter; onFilterChange: (filter: NftFilter) => void; }) => {
  const filters: { key: NftFilter; label: string }[] = [
    { key: "sale", label: "In Vendita" },
    { key: "auction", label: "In Asta" },
  ];
  return (
    <div className="flex justify-center my-4 p-1 rounded-lg bg-gray-700 space-x-2">
      {filters.map((filter) => (
        <Button key={filter.key} onClick={() => onFilterChange(filter.key)} className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${activeFilter === filter.key ? "bg-purple-600 text-white shadow-md" : "bg-transparent text-gray-300 hover:bg-gray-600"}`}>
          {filter.label}
        </Button>
      ))}
    </div>
  );
};

export default function MarketplacePage() {
  const { listedNfts, isLoading, error, refetch } = useMarketplaceNfts();
  
  const [activeFilter, setActiveFilter] = useState<NftFilter>("sale");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { setCurrentPage(1); }, [activeFilter]);

  const { nftsForSale, nftsInAuction } = useMemo(() => {
    // Aggiungiamo un controllo per assicurarci che listedNfts sia un array
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

  const renderTable = (nfts: NFT[]) => (
    <div className="overflow-x-auto">
      <Table className="min-w-full divide-y divide-gray-700">
        <TableHeader className="bg-gray-700/50">
          <TableRow>
            <TableHead>Token ID</TableHead>
            <TableHead>Titolo</TableHead>
            <TableHead>Immagine</TableHead>
            <TableHead>Prezzo / Dettagli Asta</TableHead>
            <TableHead>Venditore</TableHead>
            <TableHead>Azione</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-gray-900 divide-y divide-gray-700">
          {nfts.map((nft) => {
            return (
              <TableRow key={nft.tokenId.toString()} className="hover:bg-gray-700/80 transition-colors">
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
                      const hoursLeft = Math.ceil(timeLeft / (3600000));
                      return (
                        <div className="text-orange-400 text-sm">
                          <p>Min: {status.minPrice} ETH</p>
                          <p className="text-xs">{timeLeft > 0 ? `~${hoursLeft} ore rimaste` : 'Terminata'}</p>
                        </div>
                      );
                    }
                  })()}
                </TableCell>
                <TableCell className="font-mono text-xs">
                    <a href={`https://sepolia.arbiscan.io/address/${nft.author}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                        {`${nft.author.slice(0, 6)}...${nft.author.slice(-4)}`}
                    </a>
                </TableCell>
                <TableCell>
                  <Button onClick={() => window.location.href = `/nft-details/${nft.tokenId.toString()}`} className="bg-blue-600 hover:bg-blue-700 text-white text-xs">Vedi Dettagli</Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6 space-x-2">
          <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Precedente</Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button key={page} onClick={() => setCurrentPage(page)} className={currentPage === page ? "bg-purple-800" : "bg-gray-700"}>{page}</Button>
          ))}
          <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Successiva</Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4 md:p-8">
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