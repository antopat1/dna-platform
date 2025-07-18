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

export type SaleType = 'sale' | 'auction';

export type NftSaleStatus =
  | { type: 'sale'; price: string; seller: Address }
  | { type: 'auction'; minPrice: string; endTime: number; highestBid: string; highestBidder: Address };

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
      console.log(`Getting sale status for tokenId: ${tokenId.toString()}`);
      // L'ABI conferma che nftsForSale (fixedPriceListings) restituisce (seller, tokenId, price, isActive, listedAt)
      // Per compatibilità con il tipo attuale, estraiamo solo seller e price se isActive è true
      const fixedPriceListing = await publicClient.readContract({
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        functionName: 'fixedPriceListings', // Usiamo fixedPriceListings come da ABI
        args: [tokenId],
      }) as [`0x${string}`, bigint, bigint, boolean, bigint]; // (seller, tokenId, price, isActive, listedAt)

      console.log(`Raw fixed price listing data for ${tokenId.toString()}:`, fixedPriceListing);

      if (fixedPriceListing[3] === true) { // Se isActive è true
        return {
          type: 'sale',
          price: formatEther(fixedPriceListing[2]), // price
          seller: fixedPriceListing[0], // seller
        };
      }

      console.log(`Getting auction status for tokenId: ${tokenId.toString()}`);
      // L'ABI conferma che auctions restituisce (seller, tokenId, minPrice, highestBid, highestBidder, startTime, endTime, isActive, claimed)
      const auction = await publicClient.readContract({
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        functionName: 'auctions',
        args: [tokenId],
      }) as [`0x${string}`, bigint, bigint, bigint, `0x${string}`, bigint, bigint, boolean, boolean]; // Mappa i campi come da ABI

      console.log(`Raw auction data for ${tokenId.toString()}:`, auction);
      const currentTime = Math.floor(Date.now() / 1000);
      console.log("Current time (seconds):", currentTime);
      console.log("Auction end time (seconds):", Number(auction[6])); // endTime è il 7° elemento (indice 6)

      // Check if it's an active auction (isActive is true and endTime is in the future)
      if (auction[7] === true && Number(auction[6]) > currentTime) { // isActive è l'8° elemento (indice 7)
        return {
          type: 'auction',
          minPrice: formatEther(auction[2]), // minPrice
          endTime: Number(auction[6]), // endTime
          highestBid: formatEther(auction[3]), // highestBid
          highestBidder: auction[4], // highestBidder
        };
      }

      console.log(`No active sale or auction found for tokenId: ${tokenId.toString()}`);
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
    console.log(`Listing NFT ${tokenId.toString()} for sale. Price ETH: ${priceEth}, Price Wei: ${priceWei.toString()}`);

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

      console.log("Simulating listNFTForSale transaction...");
      const { request } = await publicClient.simulateContract({
        account: address,
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        functionName: 'listNFTForSale',
        // --- CORREZIONE: RIMOSSO SCIENTIFIC_CONTENT_NFT_ADDRESS ---
        // L'ABI mostra che listNFTForSale si aspetta solo 'tokenId' e 'price'.
        args: [tokenId, priceWei],
      });

      hash = await walletClient.writeContract(request);
      console.log("listNFTForSale transaction sent. Hash:", hash);

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
      console.log("listNFTForSale transaction receipt:", receipt);

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
      const fallbackHash = hash || ("0x" + "0".repeat(64)) as `0x${string}`;
      if (!pendingDetails) {
        pendingDetails = {
          transactionHash: fallbackHash,
          from: address as Address,
          to: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS as Address,
          value: "0",
          methodName: "listNFTForSale",
          contractName: "Marketplace",
          chainId: chainId!,
          status: 'pending',
          metadata: { tokenId: tokenId.toString(), priceEth, saleType: 'fixed-price' },
        };
      }
      const failedDetails = buildFailedTxDetails(pendingDetails, error);
      await trackTransaction(failedDetails);
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

    const minPriceWei = parseEther(minPriceEth);
    console.log(`Starting auction for NFT ${tokenId.toString()}. Min Price ETH: ${minPriceEth}, Min Price Wei: ${minPriceWei.toString()}, Duration Seconds: ${durationSeconds}`);

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

      console.log("Simulating createAuction transaction...");
      const { request } = await publicClient.simulateContract({
        account: address,
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        functionName: 'startAuction', // La funzione è 'startAuction'
        // --- CORREZIONE: RIMOSSO SCIENTIFIC_CONTENT_NFT_ADDRESS ---
        // L'ABI mostra che startAuction si aspetta solo 'tokenId', 'minPrice', 'duration'.
        args: [tokenId, minPriceWei, BigInt(durationSeconds)],
      });

      hash = await walletClient.writeContract(request);
      console.log("createAuction transaction sent. Hash:", hash);

      pendingDetails = buildPendingTxDetails(
        hash,
        address,
        SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        BigInt(0),
        "createAuction", // Nome della funzione nel tracking, puoi mantenerlo così o cambiarlo a "startAuction" per consistenza.
        "Marketplace",
        chainId,
        { tokenId: tokenId.toString(), minPriceEth, durationSeconds, saleType: 'auction' }
      );
      await trackTransaction(pendingDetails);

      toast.loading(`Transazione inviata: ${hash.slice(0, 6)}...${hash.slice(-4)}. In attesa di conferma...`, { id: loadingToastId });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log("createAuction transaction receipt:", receipt);

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
      const fallbackHash = hash || ("0x" + "0".repeat(64)) as `0x${string}`;
      if (!pendingDetails) {
        pendingDetails = {
          transactionHash: fallbackHash,
          from: address as Address,
          to: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS as Address,
          value: "0",
          methodName: "startAuction", // Cambiato per consistenza con ABI
          contractName: "Marketplace",
          chainId: chainId!,
          status: 'pending',
          metadata: { tokenId: tokenId.toString(), minPriceEth, durationSeconds, saleType: 'auction' },
        };
      }
      const failedDetails = buildFailedTxDetails(pendingDetails, error);
      await trackTransaction(failedDetails);
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

    console.log(`Removing NFT ${tokenId.toString()} from sale.`);
    setIsLoading(true);
    const loadingToastId = toast.loading(`Revocando la vendita per NFT ID ${tokenId.toString()}...`);

    let hash: `0x${string}` | undefined;
    let pendingDetails: TransactionDetails | undefined;

    try {
      console.log("Simulating removeNFTFromSale transaction...");
      const { request } = await publicClient.simulateContract({
        account: address,
        address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
        functionName: 'removeNFTFromSale',
        args: [tokenId], // L'ABI conferma che si aspetta solo 'tokenId'
      });

      hash = await walletClient.writeContract(request);
      console.log("removeNFTFromSale transaction sent. Hash:", hash);

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
      console.log("removeNFTFromSale transaction receipt:", receipt);

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
      const fallbackHash = hash || ("0x" + "0".repeat(64)) as `0x${string}`;
      if (!pendingDetails) {
        pendingDetails = {
          transactionHash: fallbackHash,
          from: address as Address,
          to: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS as Address,
          value: "0",
          methodName: "removeNFTFromSale",
          contractName: "Marketplace",
          chainId: chainId!,
          status: 'pending',
          metadata: { tokenId: tokenId.toString(), saleType: 'revoke' },
        };
      }
      const failedDetails = buildFailedTxDetails(pendingDetails, error);
      await trackTransaction(failedDetails);
      toast.error(`Errore durante la revoca della vendita: ${error.shortMessage || error.message}`, { id: loadingToastId });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, chainId]);

  return {
    getNftStatus,
    listForSale,
    startAuction,
    removeFromSale,
    isLoading,
  };
};

