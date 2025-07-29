// frontend-dapp/src/hooks/useMarketplaceInteractions.ts

import { useState, useCallback } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { toast } from 'react-hot-toast';
import { parseEther, formatEther, Address } from 'viem';

import {
  SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
  SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  SCIENTIFIC_CONTENT_NFT_ABI,
} from '@/lib/constants';

import {
  trackTransaction,
  buildPendingTxDetails,
  buildConfirmedTxDetails,
  buildFailedTxDetails,
  TransactionDetails,
} from '@/utils/trackTransaction';

// Definizione dei tipi NftStatusInfo per coerenza
export type NftAuctionStatusInfo = {
  type: "inAuction";
  minPrice: string;
  highestBid: string;
  highestBidder: Address;
  startTime: number;
  endTime: number;
  seller: Address;
  claimed: boolean; // Aggiunto per tracciare lo stato di reclamo
  currentUserBidInfo?: { amount: string; refunded: boolean; }; // Aggiunto per lo stato di bid dell'utente corrente
};

export type NftSaleStatus =
  | { type: 'sale'; price: string; seller: Address }
  | NftAuctionStatusInfo; // Usa il tipo esteso per l'asta


export const useMarketplaceInteractions = () => {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [isLoading, setIsLoading] = useState(false);

  const checkAllowance = useCallback(async (tokenId: bigint): Promise<boolean> => {
    if (!publicClient || !address || !SCIENTIFIC_CONTENT_NFT_ADDRESS || !SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS) {
      console.warn("Missing publicClient, address, NFT address, or Marketplace address for allowance check.");
      return false;
    }
    try {
      console.log(`Checking allowance for NFT ${tokenId.toString()} from ${address} to ${SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS}`);
      const isApproved = await publicClient.readContract({
        address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
        abi: SCIENTIFIC_CONTENT_NFT_ABI,
        functionName: 'isApprovedForAll',
        args: [address, SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS],
      }) as boolean;

      console.log(`isApprovedForAll result: ${isApproved}`);
      return isApproved;
    } catch (error) {
      console.error("Error checking allowance:", error);
      toast.error("Errore durante il controllo dell'approvazione del marketplace.");
      return false;
    }
  }, [publicClient, address]);

  const approveMarketplace = useCallback(async (): Promise<boolean> => {
    if (!walletClient || !address || !publicClient || !SCIENTIFIC_CONTENT_NFT_ADDRESS || !SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS || chainId === undefined) {
      toast.error("Wallet o client non disponibili per l'approvazione o chainId mancante.");
      console.error("Missing walletClient, address, publicClient, NFT address, Marketplace address, or chainId for approval.");
      return false;
    }

    setIsLoading(true);
    const loadingToastId = toast.loading("Approvazione del marketplace in corso...");

    let hash: `0x${string}` | undefined;
    let pendingDetails: TransactionDetails | undefined;

    try {
      console.log(`Approving marketplace ${SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS} for NFT contract ${SCIENTIFIC_CONTENT_NFT_ADDRESS}`);

      const { request } = await publicClient.simulateContract({
        account: address,
        address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
        abi: SCIENTIFIC_CONTENT_NFT_ABI,
        functionName: 'setApprovalForAll',
        args: [SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS, true],
      });

      hash = await walletClient.writeContract(request);
      console.log("Approval transaction sent. Hash:", hash);

      pendingDetails = buildPendingTxDetails(
        hash,
        address,
        SCIENTIFIC_CONTENT_NFT_ADDRESS,
        BigInt(0),
        "setApprovalForAll",
        "ScientificContentNFT",
        chainId,
        { marketplaceAddress: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS, approved: true }
      );
      await trackTransaction(pendingDetails);

      toast.loading(`Transazione di approvazione inviata: ${hash.slice(0, 6)}...${hash.slice(-4)}. In attesa di conferma...`, { id: loadingToastId });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log("Approval transaction receipt:", receipt);

      if (receipt.status === 'success') {
        const confirmedDetails = buildConfirmedTxDetails(pendingDetails, receipt);
        await trackTransaction(confirmedDetails);
        toast.success("Marketplace approvato con successo!", { id: loadingToastId });
        return true;
      } else {
        const failedDetails = buildFailedTxDetails(
            pendingDetails!,
            new Error("Transaction reverted")
        );
        await trackTransaction(failedDetails);
        toast.error("Approvazione del marketplace fallita.", { id: loadingToastId });
        return false;
      }
    } catch (error: any) {
      console.error("Error approving marketplace:", error);
      const fallbackHash = hash || ("0x" + "0".repeat(64)) as `0x${string}`;
      if (!pendingDetails) {
        pendingDetails = {
          transactionHash: fallbackHash,
          from: address as Address,
          to: SCIENTIFIC_CONTENT_NFT_ADDRESS as Address,
          value: "0",
          methodName: "setApprovalForAll",
          contractName: "ScientificContentNFT",
          chainId: chainId!,
          status: 'pending',
          metadata: { marketplaceAddress: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS, approved: true },
        };
      }
      const failedDetails = buildFailedTxDetails(pendingDetails, error);
      await trackTransaction(failedDetails);
      toast.error(`Errore durante l'approvazione: ${error.shortMessage || error.message}`, { id: loadingToastId });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, chainId]);

  const getNftStatus = useCallback(async (tokenId: bigint): Promise<NftSaleStatus | null> => {
    if (!publicClient || !SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS) {
      console.warn("Missing publicClient or Marketplace contract address for getting NFT status.");
      return null;
    }
    try {
      const fixedPriceListing = await publicClient.readContract({
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        functionName: 'fixedPriceListings',
        args: [tokenId],
      }) as readonly [`0x${string}`, bigint, bigint, boolean, bigint];

      if (fixedPriceListing[3]) { // isActive
        return {
          type: 'sale',
          price: formatEther(fixedPriceListing[2]),
          seller: fixedPriceListing[0],
        };
      }

      const auction = await publicClient.readContract({
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        functionName: 'auctions',
        args: [tokenId],
      }) as readonly [`0x${string}`, bigint, bigint, bigint, `0x${string}`, bigint, bigint, boolean, boolean];

      // `isActive` nel contratto indica se l'asta è ancora nel marketplace e non finalizzata.
      // `claimed` indica se è stata finalizzata.
      // Per `getNftStatus`, vogliamo lo stato attuale di un'asta, che include anche quelle scadute
      // ma non ancora reclamate, per poterle visualizzare correttamente.
      if (auction[7]) { // isActive == true
        return {
          type: 'inAuction',
          seller: auction[0],
          minPrice: formatEther(auction[2]),
          highestBid: formatEther(auction[3]),
          highestBidder: auction[4],
          startTime: Number(auction[5]),
          endTime: Number(auction[6]),
          claimed: auction[8], // Passa lo stato di 'claimed'
        };
      }

      return null;
    } catch (error) {
      console.error(`Error fetching status for NFT ${tokenId.toString()}:`, error);
      return null;
    }
  }, [publicClient]);

  const listForSale = useCallback(async (tokenId: bigint, priceEth: string) => {
    if (!walletClient || !address || !publicClient || chainId === undefined || !SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS) {
      toast.error("Wallet o client non disponibili o chainId mancante.");
      console.error("Missing prerequisites for listForSale.");
      return;
    }

    const priceWei = parseEther(priceEth);
    setIsLoading(true);
    const loadingToastId = toast.loading(`Mettendo in vendita NFT ID ${tokenId.toString()}...`);

    let hash: `0x${string}` | undefined;
    let pendingDetails: TransactionDetails | undefined;

    try {
      const isApproved = await checkAllowance(tokenId);
      if (!isApproved) {
        toast.dismiss(loadingToastId);
        const approved = await approveMarketplace();
        if (!approved) {
          throw new Error("Marketplace non approvato. Impossibile procedere con la vendita.");
        }
        toast.loading(`Marketplace approvato. Mettendo in vendita NFT ID ${tokenId.toString()}...`, { id: loadingToastId });
      }

      const { request } = await publicClient.simulateContract({
        account: address,
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        functionName: 'listNFTForSale',
        args: [tokenId, priceWei],
      });

      hash = await walletClient.writeContract(request);

      pendingDetails = buildPendingTxDetails(
        hash,
        address,
        SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        BigInt(0),
        "listNFTForSale",
        "Marketplace",
        chainId,
        { tokenId: tokenId.toString(), priceEth, saleType: 'fixed-price' }
      );
      await trackTransaction(pendingDetails);

      toast.loading(`Transazione inviata: ${hash.slice(0, 6)}...${hash.slice(-4)}. In attesa di conferma...`, { id: loadingToastId });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        const confirmedDetails = buildConfirmedTxDetails(pendingDetails, receipt);
        await trackTransaction(confirmedDetails);
        toast.success(`NFT ID ${tokenId.toString()} messo in vendita con successo!`, { id: loadingToastId });
      } else {
        const failedDetails = buildFailedTxDetails(
            pendingDetails!,
            new Error("Transaction reverted")
        );
        await trackTransaction(failedDetails);
        toast.error(`Messa in vendita fallita per NFT ID ${tokenId.toString()}.`, { id: loadingToastId });
        throw new Error("Transaction reverted");
      }
    } catch (error: any) {
      console.error("Error listing NFT for sale:", error);
      if(pendingDetails) {
        const failedDetails = buildFailedTxDetails(pendingDetails, error);
        await trackTransaction(failedDetails);
      }
      toast.error(`Errore durante la messa in vendita: ${error.shortMessage || error.message}`, { id: loadingToastId });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, chainId, checkAllowance, approveMarketplace]);

  const startAuction = useCallback(async (tokenId: bigint, minPriceEth: string, durationSeconds: number) => {
    if (!walletClient || !address || !publicClient || chainId === undefined || !SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS) {
      toast.error("Wallet o client non disponibili o chainId mancante.");
      console.error("Missing prerequisites for startAuction.");
      return;
    }

    // Frontend validation for auction duration (matching contract)
    const MIN_AUCTION_DURATION_SECONDS = 15 * 60; // 15 minutes
    const MAX_AUCTION_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 days
    if (durationSeconds < MIN_AUCTION_DURATION_SECONDS) {
        toast.error(`La durata minima dell'asta è di ${MIN_AUCTION_DURATION_SECONDS / 60} minuti.`);
        throw new Error(`Auction must last at least ${MIN_AUCTION_DURATION_SECONDS / 60} minutes.`);
    }
    if (durationSeconds > MAX_AUCTION_DURATION_SECONDS) {
        toast.error(`La durata massima dell'asta è di ${MAX_AUCTION_DURATION_SECONDS / (24 * 60 * 60)} giorni.`);
        throw new Error(`Auction cannot last more than ${MAX_AUCTION_DURATION_SECONDS / (24 * 60 * 60)} days.`);
    }


    const minPriceWei = parseEther(minPriceEth);
    setIsLoading(true);
    const loadingToastId = toast.loading(`Avvio asta per NFT ID ${tokenId.toString()}...`);

    let hash: `0x${string}` | undefined;
    let pendingDetails: TransactionDetails | undefined;

    try {
      const isApproved = await checkAllowance(tokenId);
      if (!isApproved) {
        toast.dismiss(loadingToastId);
        const approved = await approveMarketplace();
        if (!approved) {
          throw new Error("Marketplace non approvato. Impossibile procedere con l'asta.");
        }
        toast.loading(`Marketplace approvato. Avvio asta per NFT ID ${tokenId.toString()}...`, { id: loadingToastId });
      }

      const { request } = await publicClient.simulateContract({
        account: address,
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        functionName: 'startAuction',
        args: [tokenId, minPriceWei, BigInt(durationSeconds)],
      });

      hash = await walletClient.writeContract(request);

      pendingDetails = buildPendingTxDetails(
        hash,
        address,
        SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        BigInt(0),
        "startAuction",
        "Marketplace",
        chainId,
        { tokenId: tokenId.toString(), minPriceEth, durationSeconds, saleType: 'auction' }
      );
      await trackTransaction(pendingDetails);

      toast.loading(`Transazione inviata: ${hash.slice(0, 6)}...${hash.slice(-4)}. In attesa di conferma...`, { id: loadingToastId });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        const confirmedDetails = buildConfirmedTxDetails(pendingDetails, receipt);
        await trackTransaction(confirmedDetails);
        toast.success(`NFT ID ${tokenId.toString()} messo all'asta con successo!`, { id: loadingToastId });
      } else {
        const failedDetails = buildFailedTxDetails(
            pendingDetails!,
            new Error("Transaction reverted")
        );
        await trackTransaction(failedDetails);
        toast.error(`Avvio asta fallito per NFT ID ${tokenId.toString()}.`, { id: loadingToastId });
        throw new Error("Transaction reverted");
      }
    } catch (error: any) {
      console.error("Error starting auction:", error);
      if(pendingDetails) {
        const failedDetails = buildFailedTxDetails(pendingDetails, error);
        await trackTransaction(failedDetails);
      }
      toast.error(`Errore durante l'avvio dell'asta: ${error.shortMessage || error.message}`, { id: loadingToastId });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, chainId, checkAllowance, approveMarketplace]);

  const removeFromSale = useCallback(async (tokenId: bigint) => {
    if (!walletClient || !address || !publicClient || chainId === undefined || !SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS) {
      toast.error("Wallet o client non disponibili o chainId mancante.");
      console.error("Missing prerequisites for removeFromSale.");
      return;
    }

    setIsLoading(true);
    const loadingToastId = toast.loading(`Revocando la vendita per NFT ID ${tokenId.toString()}...`);

    let hash: `0x${string}` | undefined;
    let pendingDetails: TransactionDetails | undefined;

    try {
      const { request } = await publicClient.simulateContract({
        account: address,
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        functionName: 'removeNFTFromSale',
        args: [tokenId],
      });

      hash = await walletClient.writeContract(request);

      pendingDetails = buildPendingTxDetails(
        hash,
        address,
        SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        BigInt(0),
        "removeNFTFromSale",
        "Marketplace",
        chainId,
        { tokenId: tokenId.toString(), saleType: 'revoke' }
      );
      await trackTransaction(pendingDetails);

      toast.loading(`Transazione inviata: ${hash.slice(0, 6)}...${hash.slice(-4)}. In attesa di conferma...`, { id: loadingToastId });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        const confirmedDetails = buildConfirmedTxDetails(pendingDetails, receipt);
        await trackTransaction(confirmedDetails);
        toast.success(`Vendita revocata con successo per NFT ID ${tokenId.toString()}!`, { id: loadingToastId });
      } else {
        const failedDetails = buildFailedTxDetails(
            pendingDetails!,
            new Error("Transaction reverted")
        );
        await trackTransaction(failedDetails);
        toast.error(`Revoca della vendita fallita per NFT ID ${tokenId.toString()}.`, { id: loadingToastId });
        throw new Error("Transaction reverted");
      }
    } catch (error: any) {
      console.error("Error removing NFT from sale:", error);
      if(pendingDetails) {
        const failedDetails = buildFailedTxDetails(pendingDetails, error);
        await trackTransaction(failedDetails);
      }
      toast.error(`Errore durante la revoca della vendita: ${error.shortMessage || error.message}`, { id: loadingToastId });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, chainId]);

  // --- FUNZIONI INTEGRATE ---

  const purchaseNFT = useCallback(async (tokenId: bigint, priceEth: string) => {
    if (!walletClient || !address || !publicClient || !chainId) {
        toast.error("Wallet o client non disponibili o chainId mancante.");
        throw new Error("Prerequisiti per l'acquisto non soddisfatti.");
    }
    
    setIsLoading(true);
    const toastId = toast.loading(`Acquisto NFT ${tokenId} in corso...`);
    let pendingDetails: TransactionDetails | undefined;
    let hash: `0x${string}` | undefined;
    
    try {
      const priceWei = parseEther(priceEth);
      const { request } = await publicClient.simulateContract({
        account: address,
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        functionName: 'purchaseNFT',
        args: [tokenId],
        value: priceWei,
      });
      
      hash = await walletClient.writeContract(request);
      pendingDetails = buildPendingTxDetails(hash, address, SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS, priceWei, "purchaseNFT", "Marketplace", chainId, { tokenId: tokenId.toString(), priceEth });
      await trackTransaction(pendingDetails);
      toast.loading(`Transazione inviata: ${hash.slice(0, 6)}... In attesa di conferma...`, { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        const confirmedDetails = buildConfirmedTxDetails(pendingDetails, receipt);
        await trackTransaction(confirmedDetails);
        toast.success(`NFT ${tokenId} acquistato con successo!`, { id: toastId });
      } else {
        throw new Error("Transazione fallita (reverted).");
      }
    } catch (err: any) {
      if(pendingDetails) {
        const failedDetails = buildFailedTxDetails(pendingDetails, err);
        await trackTransaction(failedDetails);
      }
      toast.error(`Acquisto fallito: ${err.shortMessage || err.message}`, { id: toastId });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, chainId]);

  const placeBid = useCallback(async (tokenId: bigint, bidAmountEth: string) => {
    if (!walletClient || !address || !publicClient || !chainId) {
        toast.error("Wallet o client non disponibili o chainId mancante.");
        throw new Error("Prerequisiti per l'offerta non soddisfatti.");
    }

    setIsLoading(true);
    const toastId = toast.loading(`Invio offerta per NFT ${tokenId}...`);
    let pendingDetails: TransactionDetails | undefined;
    let hash: `0x${string}` | undefined;

    try {
      const bidAmountWei = parseEther(bidAmountEth);
      const { request } = await publicClient.simulateContract({
        account: address,
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        functionName: 'placeBid',
        args: [tokenId],
        value: bidAmountWei,
      });
      
      hash = await walletClient.writeContract(request);
      pendingDetails = buildPendingTxDetails(hash, address, SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS, bidAmountWei, "placeBid", "Marketplace", chainId, { tokenId: tokenId.toString(), bidAmountEth });
      await trackTransaction(pendingDetails);
      toast.loading(`Transazione inviata: ${hash.slice(0, 6)}... In attesa di conferma...`, { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        const confirmedDetails = buildConfirmedTxDetails(pendingDetails, receipt);
        await trackTransaction(confirmedDetails);
        toast.success(`Offerta per NFT ${tokenId} inviata con successo!`, { id: toastId });
      } else {
        throw new Error("Transazione fallita (reverted).");
      }
    } catch (err: any) {
      if(pendingDetails) {
        const failedDetails = buildFailedTxDetails(pendingDetails, err);
        await trackTransaction(failedDetails);
      }
      toast.error(`Offerta fallita: ${err.shortMessage || err.message}`, { id: toastId });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, chainId]);

  // --- NUOVE FUNZIONI PER CLAIM E REFUND ---

  const claimAuction = useCallback(async (tokenId: bigint) => {
    if (!walletClient || !address || !publicClient || !chainId) {
        toast.error("Wallet o client non disponibili o chainId mancante.");
        throw new Error("Prerequisiti per il claim non soddisfatti.");
    }

    setIsLoading(true);
    const toastId = toast.loading(`Reclamo asta per NFT ${tokenId}...`);
    let pendingDetails: TransactionDetails | undefined;
    let hash: `0x${string}` | undefined;

    try {
      const { request } = await publicClient.simulateContract({
        account: address,
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        functionName: 'claimAuction',
        args: [tokenId],
      });
      
      hash = await walletClient.writeContract(request);
      pendingDetails = buildPendingTxDetails(hash, address, SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS, BigInt(0), "claimAuction", "Marketplace", chainId, { tokenId: tokenId.toString() });
      await trackTransaction(pendingDetails);
      toast.loading(`Transazione inviata: ${hash.slice(0, 6)}... In attesa di conferma...`, { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        const confirmedDetails = buildConfirmedTxDetails(pendingDetails, receipt);
        await trackTransaction(confirmedDetails);
        toast.success(`Asta per NFT ${tokenId} reclamata con successo!`, { id: toastId });
      } else {
        throw new Error("Transazione fallita (reverted).");
      }
    } catch (err: any) {
      if(pendingDetails) {
        const failedDetails = buildFailedTxDetails(pendingDetails, err);
        await trackTransaction(failedDetails);
      }
      toast.error(`Reclamo fallito: ${err.shortMessage || err.message}`, { id: toastId });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, chainId]);

  const claimRefund = useCallback(async (tokenId: bigint) => {
    if (!walletClient || !address || !publicClient || !chainId) {
        toast.error("Wallet o client non disponibili o chainId mancante.");
        throw new Error("Prerequisiti per il rimborso non soddisfatti.");
    }

    setIsLoading(true);
    const toastId = toast.loading(`Richiesta rimborso per NFT ${tokenId}...`);
    let pendingDetails: TransactionDetails | undefined;
    let hash: `0x${string}` | undefined;

    try {
      const { request } = await publicClient.simulateContract({
        account: address,
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        functionName: 'claimRefund',
        args: [tokenId],
      });
      
      hash = await walletClient.writeContract(request);
      pendingDetails = buildPendingTxDetails(hash, address, SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS, BigInt(0), "claimRefund", "Marketplace", chainId, { tokenId: tokenId.toString() });
      await trackTransaction(pendingDetails);
      toast.loading(`Transazione inviata: ${hash.slice(0, 6)}... In attesa di conferma...`, { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        const confirmedDetails = buildConfirmedTxDetails(pendingDetails, receipt);
        await trackTransaction(confirmedDetails);
        toast.success(`Rimborso per NFT ${tokenId} processato con successo!`, { id: toastId });
      } else {
        throw new Error("Transazione fallita (reverted).");
      }
    } catch (err: any) {
      if(pendingDetails) {
        const failedDetails = buildFailedTxDetails(pendingDetails, err);
        await trackTransaction(failedDetails);
      }
      toast.error(`Richiesta rimborso fallita: ${err.shortMessage || err.message}`, { id: toastId });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, chainId]);

  return {
    isLoading, 
    checkAllowance, 
    approveMarketplace, 
    getNftStatus,
    listForSale,
    startAuction,
    removeFromSale,
    purchaseNFT, 
    placeBid, 
    claimAuction, 
    claimRefund, 
  };
};

