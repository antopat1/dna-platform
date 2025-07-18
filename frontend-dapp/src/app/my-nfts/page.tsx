// frontend-dapp/src/app/my-nfts/page.tsx

"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { toast, Toaster } from "react-hot-toast";
import { Address, isAddress } from "viem";
import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  SCIENTIFIC_CONTENT_NFT_ABI,
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
} from "@/lib/constants";
import { ConnectButton } from "@rainbow-me/rainbowkit";
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
import { Input } from "@/components/ui/input";
import { useOwnedNfts, NFT as OwnedNFT } from "@/hooks/useOwnedNfts";
import { useMarketplaceInteractions } from "@/hooks/useMarketplaceInteractions"; // Nuovo hook importato
import { resolveIpfsLink } from "@/utils/ipfs";
import { Star } from "lucide-react";
import {
  trackTransaction,
  buildPendingTxDetails,
  buildConfirmedTxDetails,
  buildFailedTxDetails,
  TransactionDetails,
} from "@/utils/trackTransaction";
import { decodeEventLog, formatUnits, parseEther } from "viem";

// --- TIPI DI STATO PER LE MIGLIORIE ---
type SaleType = "sale" | "auction";
type NftFilter = "all" | "sale" | "auction";
type NftSaleStatus = { type: SaleType; price?: string; minPrice?: string; endTime?: number } | null;

const PLACEHOLDER_IMAGE_URL =
  "https://placehold.co/80x80/333333/ffffff?text=No+Img";
const ITEMS_PER_PAGE = 10;

const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-8">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
    <p className="ml-4 text-white">Caricamento...</p>
  </div>
);

const ToggleSwitch = ({
  isAuction,
  onToggle,
}: {
  isAuction: boolean;
  onToggle: () => void;
}) => (
  <div className="flex items-center space-x-3">
    <span
      className={`text-sm ${
        !isAuction ? "text-purple-400 font-semibold" : "text-gray-400"
      }`}
    >
      VENDITA IMMEDIATA
    </span>
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
        isAuction ? "bg-purple-600" : "bg-gray-600"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          isAuction ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
    <span
      className={`text-sm ${
        isAuction ? "text-purple-400 font-semibold" : "text-gray-400"
      }`}
    >
      ASTA
    </span>
  </div>
);

// Componente Modale per Vendita/Asta (COMPLETO)
const SellAuctionModal = ({
  nft,
  isOpen,
  onClose,
  onConfirmSale,
}: {
  nft: OwnedNFT | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmSale: (tokenId: bigint, saleType: SaleType, price: string, duration?: number) => void;
}) => {
  const [isAuction, setIsAuction] = useState(false);
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("24"); // Default 24 ore
  const [priceError, setPriceError] = useState("");
  const [durationError, setDurationError] = useState("");

  const validatePrice = (value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) {
      setPriceError("Inserisci un prezzo valido");
      return false;
    }
    if (numericValue < 0.005) {
      setPriceError("Il prezzo minimo è 0.005 ETH");
      return false;
    }
    if (numericValue > 5) {
      setPriceError("Il prezzo massimo è 5 ETH");
      return false;
    }
    setPriceError("");
    return true;
  };

  const validateDuration = (value: string) => {
    const numericValue = parseInt(value);
    if (isNaN(numericValue)) {
      setDurationError("Inserisci una durata valida");
      return false;
    }
    if (numericValue < 1) {
      setDurationError("Durata minima 1 ora");
      return false;
    }
    if (numericValue > 720) { // 30 giorni = 720 ore
      setDurationError("Durata massima 720 ore (30 giorni)");
      return false;
    }
    setDurationError("");
    return true;
  };

  const handlePriceChange = (value: string) => {
    setPrice(value);
    if (value) validatePrice(value);
  };

  const handleDurationChange = (value: string) => {
    setDuration(value);
    if (value) validateDuration(value);
  };

  const handleStartSale = () => {
    if (!nft || !price || !validatePrice(price)) {
      toast.error("Inserisci un prezzo valido tra 0.005 e 5 ETH");
      return;
    }
    if (isAuction && (!duration || !validateDuration(duration))) {
      toast.error("Inserisci una durata valida tra 1 e 720 ore");
      return;
    }

    const saleType: SaleType = isAuction ? "auction" : "sale";
    const durationSeconds = isAuction ? parseInt(duration) * 3600 : undefined;

    onConfirmSale(nft.tokenId, saleType, price, durationSeconds);

    setPrice("");
    setDuration("24");
    setPriceError("");
    setDurationError("");
    setIsAuction(false);
    onClose();
  };

  const handleClose = () => {
    setPrice("");
    setDuration("24");
    setPriceError("");
    setDurationError("");
    setIsAuction(false);
    onClose();
  };

  if (!isOpen || !nft) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4 border border-purple-600">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-purple-400 mb-2">
            Vendi il tuo NFT
          </h2>
          <p className="text-gray-300 text-sm mb-4">
            Stai per mettere in vendita il tuo NFT "{nft.title}" (ID:{" "}
            {nft.tokenId.toString()}). Scegli la modalità di vendita e imposta
            il prezzo.
          </p>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Modalità di vendita
          </label>
          <ToggleSwitch
            isAuction={isAuction}
            onToggle={() => setIsAuction(!isAuction)}
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {isAuction ? "Prezzo di partenza" : "Prezzo di vendita"} (ETH)
          </label>
          <div className="relative">
            <Input
              type="number"
              step="0.001"
              min="0.005"
              max="5"
              placeholder="es. 0.1"
              value={price}
              onChange={(e) => handlePriceChange(e.target.value)}
              className="bg-gray-700 text-white border border-gray-500 rounded-md p-3 text-sm focus:border-purple-400 focus:ring-purple-400 pr-12"
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
              ETH
            </span>
          </div>
          {priceError && (
            <p className="text-red-400 text-xs mt-1">{priceError}</p>
          )}
          <p className="text-gray-500 text-xs mt-1">
            Prezzo minimo: 0.005 ETH - Prezzo massimo: 5 ETH
          </p>
        </div>
        {isAuction && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Durata dell'asta (ore)
            </label>
            <div className="relative">
              <Input
                type="number"
                min="1"
                max="720"
                placeholder="es. 24"
                value={duration}
                onChange={(e) => handleDurationChange(e.target.value)}
                className="bg-gray-700 text-white border border-gray-500 rounded-md p-3 text-sm focus:border-purple-400 focus:ring-purple-400 pr-12"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                ore
              </span>
            </div>
            {durationError && (
              <p className="text-red-400 text-xs mt-1">{durationError}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              Durata minima: 1 ora - Massima: 720 ore (30 giorni)
            </p>
          </div>
        )}
        <div className="flex space-x-3">
          <Button
            onClick={handleClose}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
          >
            Annulla
          </Button>
          <Button
            onClick={handleStartSale}
            disabled={!price || !!priceError || (isAuction && (!!durationError || !duration))}
            className={`flex-1 px-4 py-2 rounded-md ${
              !price || !!priceError || (isAuction && (!!durationError || !duration))
                ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            }`}
          >
            {isAuction ? "AVVIA ASTA" : "AVVIA VENDITA"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- NUOVO COMPONENTE: INTERRUTTORE PER FILTRARE GLI NFT ---
const FilterToggle = ({
  activeFilter,
  onFilterChange,
}: {
  activeFilter: NftFilter;
  onFilterChange: (filter: NftFilter) => void;
}) => {
  const filters: { key: NftFilter; label: string }[] = [
    { key: "all", label: "Tutti" },
    { key: "sale", label: "In Vendita" },
    { key: "auction", label: "In Asta" },
  ];

  return (
    <div className="flex justify-center my-4 p-1 rounded-lg bg-gray-700 space-x-2">
      {filters.map((filter) => (
        <Button
          key={filter.key}
          onClick={() => onFilterChange(filter.key)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            activeFilter === filter.key
              ? "bg-purple-600 text-white shadow-md"
              : "bg-transparent text-gray-300 hover:bg-gray-600"
          }`}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
};

export default function MyNFTsPage() {
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const { ownedNfts, isLoadingNfts, fetchError, refetchOwnedNfts } =
    useOwnedNfts();

  // Nuovo hook per interazioni marketplace
  const {
    getNftStatus,
    listForSale,
    startAuction,
    removeFromSale,
    isLoading: isMarketplaceLoading,
  } = useMarketplaceInteractions();

  const [transferAddressInput, setTransferAddressInput] = useState<
    Map<string, string>
  >(new Map());
  const [isValidAddress, setIsValidAddress] = useState<Map<string, boolean>>(
    new Map()
  );
  const [isTransferring, setIsTransferring] = useState<Map<string, boolean>>(
    new Map()
  );
  const [transferStatus, setTransferStatus] = useState<Map<string, string>>(
    new Map()
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNft, setSelectedNft] = useState<OwnedNFT | null>(null);

  // --- STATI MODIFICATI E NUOVI ---
  const [saleStatus, setSaleStatus] = useState<Map<string, NftSaleStatus>>(
    new Map()
  );
  const [activeFilter, setActiveFilter] = useState<NftFilter>("all");
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const isChainCorrect = chainId === ARBITRUM_SEPOLIA_CHAIN_ID;

  // NUOVO: Resetta la pagina quando cambia il filtro per evitare pagine vuote
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  // NUOVO: Fetch stato reale di vendita/asta dal contratto marketplace
  const fetchNftSaleStatus = useCallback(async (tokenId: bigint): Promise<NftSaleStatus> => {
    try {
      // Usa la funzione dall'hook per consistenza
      return await getNftStatus(tokenId);
    } catch (err) {
      console.error(`Errore fetch status NFT ${tokenId}:`, err);
      return null;
    }
  }, [getNftStatus]);

  // Fetch status per tutti gli NFT owned
  useEffect(() => {
    const fetchAllStatuses = async () => {
      if (!ownedNfts.length || !publicClient) return;
      setIsLoadingStatus(true);
      const newStatusMap = new Map<string, NftSaleStatus>();
      for (const nft of ownedNfts) {
        const status = await fetchNftSaleStatus(nft.tokenId);
        if (status) newStatusMap.set(nft.tokenId.toString(), status);
      }
      setSaleStatus(newStatusMap);
      setIsLoadingStatus(false);
    };
    fetchAllStatuses();
  }, [ownedNfts, publicClient, fetchNftSaleStatus]);

  // Lista di NFT filtrata in base al filtro attivo e allo stato di vendita
  const filteredAndDisplayableNfts = useMemo(() => {
    const displayable = ownedNfts.filter((nft) => {
      const hasContentMetadata =
        nft.title && nft.description && nft.contentIpfsHash;
      const hasValidImage = nft.imageUrlFromMetadata;
      return hasContentMetadata && hasValidImage;
    });

    if (activeFilter === "all") {
      return displayable;
    }

    return displayable.filter((nft) => {
      const status = saleStatus.get(nft.tokenId.toString());
      return status?.type === activeFilter;
    });
  }, [ownedNfts, activeFilter, saleStatus]);

  // La logica di paginazione ora usa la lista filtrata
  const totalPages = Math.ceil(
    filteredAndDisplayableNfts.length / ITEMS_PER_PAGE
  );
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentNfts = filteredAndDisplayableNfts.slice(startIndex, endIndex);

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

  const handleTransferAddressChange = useCallback(
    (tokenId: bigint, value: string) => {
      setTransferAddressInput((prev) =>
        new Map(prev).set(tokenId.toString(), value)
      );
      setIsValidAddress((prev) =>
        new Map(prev).set(tokenId.toString(), isAddress(value))
      );
    },
    []
  );

  const handleSellAuction = useCallback(async (nft: OwnedNFT) => {
    setSelectedNft(nft);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedNft(null);
  }, []);

  // MODIFICATO: ora usa le funzioni del nuovo hook
  const handleConfirmSale = useCallback(
    async (tokenId: bigint, saleType: SaleType, price: string, duration?: number) => {
      try {
        if (saleType === "sale") {
          await listForSale(tokenId, price);
          toast.success(`Vendita avviata per NFT ${tokenId}!`);
        } else {
          if (!duration) throw new Error("Durata asta mancante");
          await startAuction(tokenId, price, duration);
          toast.success(`Asta avviata per NFT ${tokenId}!`);
        }
        // Refetch status dopo conferma
        const newStatus = await fetchNftSaleStatus(tokenId);
        setSaleStatus((prev) => new Map(prev).set(tokenId.toString(), newStatus));
      } catch (err: any) {
        toast.error(`Errore: ${err.message}`);
      }
    },
    [listForSale, startAuction, fetchNftSaleStatus]
  );

  const handleRevokeSale = useCallback(async (nft: OwnedNFT) => {
    const nftIdString = nft.tokenId.toString();
    const currentStatus = saleStatus.get(nftIdString);
    if (!currentStatus) return;

    try {
      if (currentStatus.type === "sale") {
        await removeFromSale(nft.tokenId);
        toast.success(`Vendita revocata per NFT ${nftIdString}!`);
      } else {
        toast.error("Le aste non possono essere revocate una volta avviate.");
        return;
      }
      // Refetch status
      const newStatus = await fetchNftSaleStatus(nft.tokenId);
      setSaleStatus((prev) => new Map(prev).set(nftIdString, newStatus));
    } catch (err: any) {
      toast.error(`Errore revoca: ${err.message}`);
    }
  }, [saleStatus, removeFromSale, fetchNftSaleStatus]);

  const handleTransfer = useCallback(
    async (nft: OwnedNFT) => {
      const nftIdString = nft.tokenId.toString();
      const recipient = transferAddressInput.get(nftIdString);

      if (!recipient || !isAddress(recipient)) {
        toast.error(
          "Inserisci un indirizzo Ethereum valido per il trasferimento."
        );
        return;
      }

      if (!walletClient || !address || !publicClient || !chainId) {
        toast.error("Wallet o client pubblici non disponibili.");
        return;
      }

      setIsTransferring((prev) => {
        const newMap = new Map(prev);
        newMap.set(nftIdString, true);
        return newMap;
      });
      setTransferStatus((prev) =>
        new Map(prev).set(nftIdString, "Iniziando il trasferimento...")
      );

      const loadingToastId = toast.loading(
        `Trasferimento NFT ID ${nft.tokenId.toString()} a ${recipient}...`
      );

      let hash: `0x${string}` | undefined;

      try {
        const nftContractAddress: Address = SCIENTIFIC_CONTENT_NFT_ADDRESS;
        if (!nftContractAddress) {
          throw new Error("Indirizzo del contratto NFT non configurato.");
        }

        const { request } = await publicClient.simulateContract({
          account: address,
          address: nftContractAddress,
          abi: SCIENTIFIC_CONTENT_NFT_ABI,
          functionName: "safeTransferFrom",
          args: [address, recipient as Address, nft.tokenId],
        });

        hash = await walletClient.writeContract(request);

        // Traccia la transazione come pending
        const metadata = {
          tokenId: nft.tokenId.toString(),
          recipient,
          type: "Transfer",
        };
        const pendingDetails = buildPendingTxDetails(
          hash,
          address,
          nftContractAddress,
          BigInt(0),
          "safeTransferFrom",
          "ScientificContentNFT",
          chainId,
          metadata
        );
        await trackTransaction(pendingDetails);

        toast.loading(
          `Transazione inviata: ${hash.slice(0, 6)}...${hash.slice(
            -4
          )}. In attesa di conferma...`,
          {
            id: loadingToastId,
          }
        );
        setTransferStatus((prev) =>
          new Map(prev).set(
            nftIdString,
            `Transazione inviata, in attesa di conferma: ${hash.slice(
              0,
              6
            )}...${hash.slice(-4)}`
          )
        );

        const transactionReceipt = await publicClient.waitForTransactionReceipt(
          { hash }
        );

        if (transactionReceipt.status === "success") {
          // Traccia la transazione come confermata
          const confirmedDetails = buildConfirmedTxDetails(
            pendingDetails,
            transactionReceipt
          );
          await trackTransaction(confirmedDetails);

          toast.success(
            `NFT ID ${nft.tokenId.toString()} trasferito con successo! Transazione: ${hash.slice(
              0,
              6
            )}...${hash.slice(-4)}`,
            {
              id: loadingToastId,
            }
          );
          setTransferStatus((prev) =>
            new Map(prev).set(
              nftIdString,
              "Trasferimento completato con successo!"
            )
          );
          setTransferAddressInput((prev) => {
            const newMap = new Map(prev);
            newMap.delete(nftIdString);
            return newMap;
          });
          setIsValidAddress((prev) => {
            const newMap = new Map(prev);
            newMap.delete(nftIdString);
            return newMap;
          });
          refetchOwnedNfts();
        } else {
          // Traccia la transazione come fallita (reverted)
          const failedDetails = buildFailedTxDetails(
            pendingDetails,
            new Error("Transaction reverted")
          );
          await trackTransaction(failedDetails);

          toast.error(
            `Trasferimento fallito per NFT ID ${nft.tokenId.toString()}.`,
            {
              id: loadingToastId,
            }
          );
          setTransferStatus((prev) =>
            new Map(prev).set(
              nftIdString,
              "Trasferimento fallito o annullato. Controlla la transazione."
            )
          );
        }
      } catch (err: any) {
        // Traccia la transazione come fallita
        const metadata = {
          tokenId: nft.tokenId.toString(),
          recipient,
          type: "Transfer",
        };
        const initialDetails = {
          transactionHash: hash || ("0x" as `0x${string}`),
          from: address,
          to: SCIENTIFIC_CONTENT_NFT_ADDRESS,
          value: "0",
          methodName: "safeTransferFrom",
          contractName: "ScientificContentNFT",
          chainId,
          metadata,
        };
        const failedDetails = buildFailedTxDetails(initialDetails, err);
        await trackTransaction(failedDetails);

        toast.error(
          `Errore nel trasferimento: ${
            err.shortMessage || err.message || "Operazione fallita"
          }`,
          {
            id: loadingToastId,
          }
        );
        setTransferStatus((prev) =>
          new Map(prev).set(
            nftIdString,
            `Errore: ${err.shortMessage || err.message || "Operazione fallita"}`
          )
        );
      } finally {
        setIsTransferring((prev) => {
          const newMap = new Map(prev);
          newMap.set(nftIdString, false);
          return newMap;
        });
      }
    },
    [
      address,
      walletClient,
      publicClient,
      chainId,
      transferAddressInput,
      refetchOwnedNfts,
    ]
  );

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center bg-gray-900 text-white p-4">
        <h1 className="text-2xl font-bold mb-4 text-purple-400">
          Connetti il tuo Wallet
        </h1>
        <p className="text-gray-400 mb-4">
          Per visualizzare i tuoi NFT, per favore connetti il tuo wallet.
        </p>
        <ConnectButton />
      </div>
    );
  }

  if (!isChainCorrect) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center bg-gray-900 text-red-400 p-4">
        <h1 className="text-2xl font-bold mb-4">Rete Errata</h1>
        <p className="text-gray-400">
          Per favore connetti il tuo wallet alla rete Arbitrum Sepolia per
          visualizzare i tuoi NFT.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4">
      <Toaster position="top-right" />

      <Card className="bg-gray-800 border-purple-600">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-purple-400">
            I Miei NFT Scientifici
          </CardTitle>
          <CardDescription className="text-gray-400">
            Qui trovi tutti gli NFT di contenuto scientifico che possiedi.
            Filtra per stato e gestisci le tue proprietà.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingNfts || isLoadingStatus || isMarketplaceLoading ? (
            <LoadingSpinner />
          ) : fetchError ? (
            <div className="text-red-500 text-center py-8">
              Errore: {fetchError}
              <Button
                onClick={refetchOwnedNfts}
                className="ml-4 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm"
              >
                Riprova
              </Button>
            </div>
          ) : (
            <>
              {/* --- INTERRUTTORE DEL FILTRO INSERITO QUI --- */}
              <FilterToggle
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
              />

              {filteredAndDisplayableNfts.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-lg">
                  {activeFilter === "all"
                    ? "Nessun NFT Scientific Content valido trovato nel tuo wallet."
                    : `Nessun NFT trovato per il filtro selezionato.`}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-full divide-y divide-gray-700">
                    <TableHeader className="bg-gray-700">
                      <TableRow>
                        <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                          Token ID
                        </TableHead>
                        <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                          Content ID
                        </TableHead>
                        <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                          Titolo
                        </TableHead>
                        <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                          Descrizione
                        </TableHead>
                        <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                          Autore (EoA)
                        </TableHead>
                        <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                          Immagine Copertina
                        </TableHead>
                        {/* NUOVA COLONNA PER INDICATORE SPECIALE */}
                        <TableHead className="px-4 py-2 text-center text-sm font-semibold text-gray-200">
                          Speciale
                        </TableHead>
                        <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-200">
                          Azioni
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="bg-gray-900 divide-y divide-gray-700">
                      {currentNfts.map((nft) => {
                        const nftIdString = nft.tokenId.toString();
                        const isTokenTransferring =
                          isTransferring.get(nftIdString) || false;
                        const currentSaleStatus = saleStatus.get(nftIdString);
                        const isTransferButtonDisabled =
                          !isValidAddress.get(nftIdString) ||
                          isTokenTransferring ||
                          !!currentSaleStatus; // Disabilita se in vendita/asta

                        const currentTransferStatus =
                          transferStatus.get(nftIdString);
                        const imageUrl = nft.imageUrlFromMetadata
                          ? resolveIpfsLink(nft.imageUrlFromMetadata)
                          : PLACEHOLDER_IMAGE_URL;

                        // --- LOGICA MODIFICATA PER TESTO DINAMICO ---
                        const revokeButtonText = currentSaleStatus?.type === "auction"
                          ? "Revoca Asta"
                          : "Revoca Vendita";
                        const isRevokeDisabled = !currentSaleStatus || isMarketplaceLoading || (currentSaleStatus.type === "auction"); // Disabilita per aste

                        return (
                          <TableRow
                            key={nftIdString}
                            className="hover:bg-gray-700 transition-colors cursor-pointer"
                            onClick={() => {
                              window.location.href = `/nft-details/${nft.tokenId.toString()}`;
                            }}
                          >
                            <TableCell className="px-4 py-3 whitespace-nowrap font-medium text-purple-300">
                              {nft.tokenId.toString()}
                            </TableCell>
                            <TableCell className="px-4 py-3 whitespace-nowrap text-gray-200">
                              {nft.contentId.toString()}
                            </TableCell>
                            <TableCell className="px-4 py-3 whitespace-nowrap text-gray-200">
                              {nft.title}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-gray-200 max-w-xs overflow-hidden text-ellipsis">
                              {nft.description}
                            </TableCell>
                            <TableCell className="px-4 py-3 whitespace-nowrap text-gray-200 text-xs">
                              <a
                                href={`https://sepolia.arbiscan.io/address/${nft.author}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {nft.author.slice(0, 6)}...
                                {nft.author.slice(-4)}
                              </a>
                            </TableCell>
                            <TableCell className="px-4 py-3 whitespace-nowrap">
                              <Image
                                src={imageUrl}
                                alt={`Immagine di Copertina di ${
                                  nft.title || "NFT"
                                }`}
                                width={80}
                                height={80}
                                className="rounded-md object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = PLACEHOLDER_IMAGE_URL;
                                }}
                              />
                            </TableCell>
                            <TableCell className="px-4 py-3 whitespace-nowrap text-center">
                              {nft.hasSpecialContent && (
                                <div className="flex justify-center items-center">
                                  <div title="Contenuto Speciale">
                                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell
                              className="px-4 py-3 whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex flex-col space-y-2">
                                <Button
                                  onClick={() => handleSellAuction(nft)}
                                  disabled={!!currentSaleStatus || isMarketplaceLoading}
                                  className={`bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm ${
                                    !!currentSaleStatus || isMarketplaceLoading ? "opacity-50 cursor-not-allowed" : ""
                                  }`}
                                >
                                  Vendi / Avvia Asta
                                </Button>

                                {/* --- BOTTONE DI REVOCA CON TESTO DINAMICO --- */}
                                <Button
                                  onClick={() => handleRevokeSale(nft)}
                                  disabled={isRevokeDisabled}
                                  title={currentSaleStatus?.type === "auction" ? "Le aste non possono essere revocate" : ""}
                                  className={`px-3 py-1 rounded-md text-sm ${
                                    isRevokeDisabled
                                      ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                                      : "bg-red-600 hover:bg-red-700 text-white"
                                  }`}
                                >
                                  {revokeButtonText}
                                </Button>

                                <div className="flex flex-col space-y-1 pt-2">
                                  <Input
                                    type="text"
                                    placeholder="Indirizzo Destinatario"
                                    value={
                                      transferAddressInput.get(nftIdString) ||
                                      ""
                                    }
                                    onChange={(e) =>
                                      handleTransferAddressChange(
                                        nft.tokenId,
                                        e.target.value
                                      )
                                    }
                                    className="bg-gray-700 text-white border border-gray-500 rounded-md p-1 text-sm focus:border-purple-400 focus:ring-purple-400"
                                  />
                                  <Button
                                    onClick={() => handleTransfer(nft)}
                                    disabled={isTransferButtonDisabled}
                                    className={`px-3 py-1 rounded-md text-sm ${
                                      isTransferButtonDisabled
                                        ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                                        : "bg-blue-600 hover:bg-blue-700 text-white"
                                    }`}
                                  >
                                    {isTokenTransferring
                                      ? "Trasferendo..."
                                      : !!currentSaleStatus
                                      ? "Non trasferibile (In vendita/asta)"
                                      : "Trasferisci"}
                                  </Button>
                                  {currentTransferStatus && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      {currentTransferStatus}
                                    </p>
                                  )}
                                </div>
                              </div>
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
            </>
          )}
        </CardContent>
      </Card>

      <SellAuctionModal
        nft={selectedNft}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConfirmSale={handleConfirmSale}
      />
    </div>
  );
}


