// frontend-dapp\src\hooks\useAdminContentManagement.ts
import { useCallback, useState, useRef, useEffect } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useAccount,
  usePublicClient,
} from "wagmi";
import {
  parseEther,
  formatUnits,
  Abi,
  Hex,
  decodeEventLog,
  AbiEvent,
} from "viem";
import { toast } from "react-hot-toast";

// Importa le tue costanti
import {
  SCIENTIFIC_CONTENT_NFT_ABI,
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
  SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
  ARBITRUM_SEPOLIA_CHAIN_ID,
} from "@/lib/constants";

// Importa le utilità di tracking
import {
  trackTransaction,
  buildPendingTxDetails,
  buildConfirmedTxDetails,
  buildFailedTxDetails,
  TransactionDetails,
} from "@/utils/trackTransaction";

// Definizione dell'interfaccia per gli argomenti dell'evento NFTMinted
interface NFTMintedEventArgs {
  tokenId: bigint;
  contentId: bigint;
  owner: `0x${string}`;
  isSpecial: boolean;
  copyNumber: bigint;
  metadataURI: string;
}

// Prezzo di minting
const MINT_PRICE_ETH = "0.005";

// Funzione per salvare l'evento in MongoDB (adattala al tuo endpoint reale)
const saveMintEventToMongo = async (eventData: {
  contentId: string;
  tokenId: string;
  owner: string;
  metadataURI: string;
  // Aggiungi altri campi come nel tuo handleRequestMintForNewContent
}) => {
  try {
    const response = await fetch("/api/save-mint-event", { // Assumi endpoint simile al tuo progetto
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
    });
    if (!response.ok) {
      throw new Error("Errore nel salvataggio su MongoDB");
    }
    toast.success("Evento mint salvato su MongoDB!");
  } catch (err: any) {
    console.error("Errore salvataggio MongoDB:", err);
    toast.error(`Errore salvataggio su DB: ${err.message}`);
  }
};

// Funzione per il caricamento dei metadati (con fix per BigInt)
const uploadMetadataToIpfs = async (
  address: `0x${string}` | undefined,
  contentId: bigint | null,
  title: string,
  description: string,
  mainDocumentIpfsHash: string | null,
  previewImageIpfsHash: string | null,
  isCopy: boolean = false
) => {
  await new Promise((resolve) => setTimeout(resolve, 500));

  let fullMetadata: any;
  if (isCopy) {
    fullMetadata = {
      name: title || "Scientific Content Copy",
      description: description || "Copy of registered scientific content",
      image: previewImageIpfsHash
        ? `ipfs://${previewImageIpfsHash}`
        : undefined,
      external_url: `https://tuo-dominio-dapp.com/content/${
        contentId?.toString() || "unknown"
      }`,
      attributes: [
        { trait_type: "Author Address", value: address },
        {
          trait_type: "Registry Content ID",
          value: contentId?.toString() || "N/A",
        },
        { trait_type: "Content Type", value: "Copy" },
      ],
      originalDocumentFileCID: mainDocumentIpfsHash,
      previewImageFileCID: previewImageIpfsHash,
    };
  } else {
    fullMetadata = {
      name: title,
      description: description,
      image: previewImageIpfsHash
        ? `ipfs://${previewImageIpfsHash}`
        : undefined,
      external_url: `https://tuo-dominio-dapp.com/content/${
        contentId?.toString() || "unknown"
      }`,
      attributes: [
        { trait_type: "Author Address", value: address },
        {
          trait_type: "Registry Content ID",
          value: contentId ? contentId.toString() : "N/A",
        },
      ],
      originalDocumentFileCID: mainDocumentIpfsHash,
      previewImageFileCID: previewImageIpfsHash,
    };
  }

  // Safeguard: Converti eventuali BigInt in stringhe
  const serializedMetadata = JSON.stringify(fullMetadata, (key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );

  try {
    const formData = new FormData();
    const metadataBlob = new Blob([serializedMetadata], {
      type: "application/json",
    });
    formData.append("file", metadataBlob, "metadata.json");

    const res = await fetch("/api/ipfs-upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (data.success) {
      toast.success(`Metadati caricati su IPFS: ${data.cid}`);
      return data.cid;
    } else {
      throw new Error(
        data.message || "Errore nel caricamento dei metadati su IPFS."
      );
    }
  } catch (err: any) {
    toast.error(
      `Errore nel caricamento dei metadati su IPFS: ${
        (err as any)?.message || "Errore sconosciuto"
      }`
    );
    return null;
  }
};

const useAdminContentManagement = (onMintingCompleted?: () => void) => {
  const [error, setError] = useState<string | null>(null);
  const [mintingRevertReason, setMintingRevertReason] = useState<string | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [mintedTokenId, setMintedTokenId] = useState<bigint | null>(null);
  const [isMintingFulfilled, setIsMintingFulfilled] = useState(false);
  const [mintingFulfillmentTxHash, setMintingFulfillmentTxHash] =
    useState<Hex | null>(null);
  const [mintedNftImageUrl, setMintedNftImageUrl] = useState<string | null>(
    null
  );

  const currentMintContentIdRef = useRef<bigint | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckedBlockNumber = useRef<bigint | null>(null);
  const hasStartedMintPolling = useRef(false);

  const chainId = useChainId();
  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: ARBITRUM_SEPOLIA_CHAIN_ID });

  // Riferimento per i dettagli iniziali della transazione (ora usiamo TransactionDetails)
  const pendingTxDetailsRef = useRef<TransactionDetails | null>(null);

  const currentPreviewImageCidRef = useRef<string | null>(null);

  const lastProcessedTxHashRef = useRef<Hex | null>(null);

  // ***** NFT Contract Interactions *****
  const {
    data: nftTxHash,
    writeContract: writeNftContract,
    isPending: isNftWritePending,
    isError: isNftWriteError,
    error: nftWriteError,
    reset: resetNftWrite,
  } = useWriteContract();

  const {
    isLoading: isNftTxConfirming,
    isSuccess: isNftTxSuccess,
    isError: isNftTxConfirmationError,
    error: nftTxConfirmationError,
    data: nftTxReceipt,
  } = useWaitForTransactionReceipt({
    hash: nftTxHash,
    query: { enabled: !!nftTxHash },
  });

  // ***** Marketplace Contract Interactions *****
  const {
    data: marketplaceTxHash,
    writeContract: writeMarketplaceContract,
    isPending: isMarketplaceWritePending,
    isError: isMarketplaceWriteError,
    error: marketplaceWriteError,
    reset: resetMarketplaceWrite,
  } = useWriteContract();

  const {
    isLoading: isMarketplaceTxConfirming,
    isSuccess: isMarketplaceTxSuccess,
    isError: isMarketplaceTxConfirmationError,
    error: marketplaceTxConfirmationError,
    data: marketplaceTxReceipt,
  } = useWaitForTransactionReceipt({
    hash: marketplaceTxHash,
    query: { enabled: !!marketplaceTxHash },
  });

  const resetMintingState = useCallback(() => {
    setIsMintingFulfilled(false);
    setMintedTokenId(null);
    setMintingFulfillmentTxHash(null);
    setMintedNftImageUrl(null);
    setMintingRevertReason(null);
    currentPreviewImageCidRef.current = null;
    lastProcessedTxHashRef.current = null;

    // AGGIUNTA: Resetta lo stato di useWriteContract per pulire nftTxHash e prevenire trigger errati nell'useEffect
    resetNftWrite();
    resetMarketplaceWrite(); // Opzionale, per completezza (anche se non usato nel minting)
  }, [resetNftWrite, resetMarketplaceWrite]); // Aggiunte dipendenze

  // useEffect per gestire la conferma delle transazioni (NFT)
  // Sostituisci la sezione degli useEffect per la gestione delle transazioni

  // useEffect per gestire la conferma delle transazioni (NFT)
  useEffect(() => {
    async function handleNftConfirmation() {
      if (!nftTxHash) {
        return;
      }

      // Verifica se abbiamo già processato questa transazione
      if (lastProcessedTxHashRef.current === nftTxHash) {
        return;
      }

      // Se non abbiamo dettagli pending, creali ora
      if (!pendingTxDetailsRef.current && userAddress) {
        pendingTxDetailsRef.current = {
          transactionHash: nftTxHash,
          from: userAddress,
          to: SCIENTIFIC_CONTENT_NFT_ADDRESS,
          value: formatUnits(parseEther(MINT_PRICE_ETH), 18),
          methodName: "mintNFT",
          contractName: "ScientificContentNFT",
          chainId: chainId || ARBITRUM_SEPOLIA_CHAIN_ID,
          status: "pending" as const,
          metadata: {
            contentId: currentMintContentIdRef.current?.toString() || "unknown",
            type: "NewContentMint",
          },
        };

        // Traccia immediatamente come pending
        await trackTransaction(pendingTxDetailsRef.current);
      }

      if (isNftTxSuccess && nftTxReceipt && pendingTxDetailsRef.current) {
        const updatedTxData = buildConfirmedTxDetails(
          pendingTxDetailsRef.current,
          nftTxReceipt
        );
        await trackTransaction(updatedTxData);
        toast.success(
          `Transazione NFT ${nftTxHash.slice(0, 6)}... confermata!`
        );
        setIsProcessing(false);
        lastProcessedTxHashRef.current = nftTxHash;

        // Aggiunta: Salva evento in MongoDB (simile a handleRequestMintForNewContent)
        if (nftTxReceipt.logs) {
          const mintLog = nftTxReceipt.logs.find((log) =>
            log.address === SCIENTIFIC_CONTENT_NFT_ADDRESS &&
            log.topics[0] === "NFTMinted" // Assumi topic corretto
          );
          if (mintLog) {
            const decoded = decodeEventLog({
              abi: SCIENTIFIC_CONTENT_NFT_ABI,
              data: mintLog.data,
              topics: mintLog.topics,
            }) as { args: NFTMintedEventArgs };
            await saveMintEventToMongo({
              contentId: decoded.args.contentId.toString(),
              tokenId: decoded.args.tokenId.toString(),
              owner: decoded.args.owner,
              metadataURI: decoded.args.metadataURI,
              // Aggiungi altri campi come nel tuo progetto
            });
          }
        }
      } else if (
        isNftTxConfirmationError &&
        nftTxConfirmationError &&
        pendingTxDetailsRef.current
      ) {
        const updatedTxData = buildFailedTxDetails(
          pendingTxDetailsRef.current,
          nftTxConfirmationError
        );
        await trackTransaction(updatedTxData);
        toast.error(
          `Transazione NFT ${nftTxHash.slice(0, 6)}... fallita: ${
            nftTxConfirmationError.message
          }`
        );
        setIsProcessing(false);
        setMintingRevertReason(nftTxConfirmationError.message);
        lastProcessedTxHashRef.current = nftTxHash;
      } else if (
        isNftWriteError &&
        nftWriteError &&
        pendingTxDetailsRef.current
      ) {
        const updatedTxData = buildFailedTxDetails(
          pendingTxDetailsRef.current,
          nftWriteError
        );
        await trackTransaction(updatedTxData);
        toast.error(
          `Transazione NFT rifiutata o fallita: ${
            (nftWriteError as any)?.message || "Errore sconosciuto"
          }`
        );
        setIsProcessing(false);
        setMintingRevertReason(
          (nftWriteError as any)?.message || "Errore sconosciuto"
        );
        lastProcessedTxHashRef.current = nftTxHash;
      }
    }

    handleNftConfirmation();
  }, [
    nftTxHash,
    isNftTxSuccess,
    nftTxReceipt,
    isNftTxConfirmationError,
    nftTxConfirmationError,
    isNftWriteError,
    nftWriteError,
    userAddress,
    chainId,
  ]);

  // useEffect per gestire la conferma delle transazioni (Marketplace)
  useEffect(() => {
    async function handleMarketplaceConfirmation() {
      if (
        !marketplaceTxHash ||
        !pendingTxDetailsRef.current ||
        pendingTxDetailsRef.current.transactionHash !== marketplaceTxHash
      ) {
        return;
      }

      if (isMarketplaceTxSuccess && marketplaceTxReceipt) {
        const updatedTxData = buildConfirmedTxDetails(
          pendingTxDetailsRef.current,
          marketplaceTxReceipt
        );
        await trackTransaction(updatedTxData);
        toast.success(
          `Transazione Marketplace ${marketplaceTxHash.slice(
            0,
            6
          )}... confermata!`
        );
        setIsProcessing(false);
      } else if (
        isMarketplaceTxConfirmationError &&
        marketplaceTxConfirmationError
      ) {
        const updatedTxData = buildFailedTxDetails(
          pendingTxDetailsRef.current,
          marketplaceTxConfirmationError
        );
        await trackTransaction(updatedTxData);
        toast.error(
          `Transazione Marketplace ${marketplaceTxHash.slice(
            0,
            6
          )}... fallita: ${marketplaceTxConfirmationError.message}`
        );
        setIsProcessing(false);
      } else if (isMarketplaceWriteError && marketplaceWriteError) {
        const updatedTxData = buildFailedTxDetails(
          pendingTxDetailsRef.current,
          marketplaceWriteError
        );
        await trackTransaction(updatedTxData);
        toast.error(
          `Transazione Marketplace rifiutata o fallita in fase di invio: ${
            (marketplaceWriteError as any)?.message || "Errore sconosciuto"
          }`
        );
        setIsProcessing(false);
      }

      pendingTxDetailsRef.current = null;
    }
    handleMarketplaceConfirmation();
  }, [
    marketplaceTxHash,
    isMarketplaceTxSuccess,
    marketplaceTxReceipt,
    isMarketplaceTxConfirmationError,
    marketplaceTxConfirmationError,
    isMarketplaceWriteError,
    marketplaceWriteError,
    setIsProcessing,
  ]);

  // Funzione per gestire l'invio generico di transazioni
const sendTransaction = useCallback(
  async (
    contractAddress: `0x${string}`,
    abi: Abi,
    functionName: string,
    args: any[],
    value: bigint = BigInt(0),
    contractName: string,
    txMetadata: Record<string, any> = {}
  ) => {
    if (isProcessing) {
      toast("Un'operazione è già in corso. Attendi il completamento.", {
        icon: "ℹ️",
      });
      return;
    }
    if (!chainId || !userAddress || !isConnected) {
      toast.error("Connettiti al tuo wallet e seleziona una rete.");
      return;
    }

    resetNftWrite();
    resetMarketplaceWrite();
    setError(null);
    setMintingRevertReason(null);
    setIsProcessing(true);
    pendingTxDetailsRef.current = null;
    lastProcessedTxHashRef.current = null; // Reset anche questo

    toast(`Preparazione transazione per ${functionName}...`, { icon: "⏳" });

    try {
      let writeContractResult: any;

      if (contractAddress === SCIENTIFIC_CONTENT_NFT_ADDRESS) {
        writeContractResult = await writeNftContract({
          abi: abi,
          address: contractAddress,
          functionName: functionName,
          args: args,
          value: value,
        });
      } else if (contractAddress === SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS) {
        writeContractResult = await writeMarketplaceContract({
          abi: abi,
          address: contractAddress,
          functionName: functionName,
          args: args,
          value: value,
        });
      } else {
        throw new Error("Indirizzo contratto non riconosciuto.");
      }
      
      // Il risultato di writeContract dovrebbe essere l'hash della transazione
      // Ma potrebbe essere restituito in modo asincrono, quindi aspettiamo che nftTxHash o marketplaceTxHash vengano impostati
      
      toast("Transazione inviata! In attesa di conferma...", {
        icon: "🚀",
      });
      
    } catch (err: any) {
      const errorMessage =
        (err as any)?.message ||
        "Errore sconosciuto durante l'invio della transazione";
      setError(`Errore: ${errorMessage}`);
      toast.error(`Errore: ${errorMessage}`);
      setIsProcessing(false);
      setMintingRevertReason(errorMessage);
      
      // Costruisci dettagli failed e traccia
      const initialDetails = {
        transactionHash: "0x" as `0x${string}`,
        from: userAddress,
        to: contractAddress,
        value: formatUnits(value, 18),
        methodName: functionName,
        contractName: contractName,
        chainId: chainId,
        metadata: txMetadata,
      };
      const failedDetails = buildFailedTxDetails(initialDetails, err);
      await trackTransaction(failedDetails);
    }
  },
  [
    isProcessing,
    chainId,
    userAddress,
    isConnected,
    writeNftContract,
    writeMarketplaceContract,
    resetNftWrite,
    resetMarketplaceWrite,
  ]
);

  // ***** Funzioni specifiche del tuo DApp (usando sendTransaction) *****

  // PER IL MINTING INIZIALE (dopo registrazione)
  const handleRequestMintForNewContent = useCallback(
    async (
      registryContentId: bigint,
      contentTitle: string,
      contentDescription: string,
      ipfsMainDocumentCid: string | null,
      ipfsPreviewImageCid: string | null,
      refetchContentDetails?: () => void
    ) => {
      // RESET COMPLETO DELLO STATO PRIMA DI INIZIARE
      resetMintingState();
      setError(null);
      setMintingRevertReason(null);
      hasStartedMintPolling.current = false;

      // Salva il CID dell'immagine
      currentPreviewImageCidRef.current = ipfsPreviewImageCid;

      if (isProcessing) {
        toast("Un'operazione è già in corso. Attendi il completamento.", {
          icon: "ℹ️",
        });
        return;
      }

      if (!registryContentId) {
        setError("Contenuto non ancora registrato o ID non recuperato.");
        toast.error("Contenuto non ancora registrato o ID non recuperato.");
        return;
      }

      setIsProcessing(true);
      toast("Preparazione dei metadati per il minting NFT...", { icon: "⏳" });

      try {
        // 1. CARICA I METADATI SU IPFS
        const metadataCid = await uploadMetadataToIpfs(
          userAddress,
          registryContentId,
          contentTitle,
          contentDescription,
          ipfsMainDocumentCid,
          ipfsPreviewImageCid,
          false
        );

        if (!metadataCid) {
          throw new Error(
            "Errore nel caricamento dei metadati per il minting dell'NFT."
          );
        }

        const metadataURI = `ipfs://${metadataCid}`;
        const mintPriceWei = parseEther(MINT_PRICE_ETH);

        currentMintContentIdRef.current = registryContentId;

        // 2. AVVIA IL MINTING tramite sendTransaction
        await sendTransaction(
          SCIENTIFIC_CONTENT_NFT_ADDRESS,
          SCIENTIFIC_CONTENT_NFT_ABI as Abi,
          "mintNFT",
          [registryContentId, metadataURI],
          mintPriceWei,
          "ScientificContentNFT",
          {
            contentId: registryContentId.toString(),
            metadataURI,
            price: MINT_PRICE_ETH,
            type: "NewContentMint",
          }
        );
      } catch (err: any) {
        const errorMessage =
          (err as any)?.message ||
          "Errore sconosciuto durante l'avvio del minting";
        setError(`Errore nell'avvio del minting: ${errorMessage}`);
        toast.error(`Errore: ${errorMessage}`);
        setIsProcessing(false);
        setMintingRevertReason(errorMessage);
      }
    },
    [isProcessing, userAddress, sendTransaction, resetMintingState]
  );

  // PER IL MINTING DI COPIE AGGIUNTIVE (dalla pagina dei contenuti registrati)
  const handleRequestMintForCopy = useCallback(
    async (
      contentId: bigint,
      title: string,
      description: string,
      mainDocumentIpfsHash: string | null,
      previewImageIpfsHash: string | null,
      mintPriceWei: bigint,
      refetchContentDetails?: () => void
    ) => {
      // RESET COMPLETO DELLO STATO PRIMA DI INIZIARE
      resetMintingState();
      setError(null);
      setMintingRevertReason(null);
      hasStartedMintPolling.current = false;

      if (isProcessing) {
        toast("Un'operazione è già in corso. Attendi il completamento.", {
          icon: "ℹ️",
        });
        return;
      }

      setIsProcessing(true);
      toast("Preparazione dei metadati per il minting della copia NFT...", {
        icon: "⏳",
      });

      try {
        // 1. CARICA I METADATI SU IPFS per la copia
        const metadataCid = await uploadMetadataToIpfs(
          userAddress,
          contentId,
          title,
          description,
          mainDocumentIpfsHash,
          previewImageIpfsHash,
          true
        );

        if (!metadataCid) {
          throw new Error(
            "Errore nel caricamento dei metadati per il minting della copia NFT."
          );
        }

        const metadataURI = `ipfs://${metadataCid}`;

        // Salva il CID dell'immagine per il completamento
        currentPreviewImageCidRef.current = previewImageIpfsHash;
        currentMintContentIdRef.current = contentId;

        // 2. AVVIA IL MINTING tramite sendTransaction
        await sendTransaction(
          SCIENTIFIC_CONTENT_NFT_ADDRESS,
          SCIENTIFIC_CONTENT_NFT_ABI as Abi,
          "mintNFT",
          [contentId, metadataURI],
          mintPriceWei,
          "ScientificContentNFT",
          {
            contentId: contentId.toString(),
            metadataURI,
            price: formatUnits(mintPriceWei, 18),
            type: "CopyMint",
          }
        );
      } catch (err: any) {
        const errorMessage =
          (err as any)?.message ||
          "Errore sconosciuto durante l'avvio del minting della copia";
        setError(`Errore nell'avvio del minting della copia: ${errorMessage}`);
        toast.error(`Errore: ${errorMessage}`);
        setIsProcessing(false);
        setMintingRevertReason(errorMessage);
      }
    },
    [userAddress, isProcessing, sendTransaction, resetMintingState]
  );

  // MARKETPLACE: List NFT for Sale
  const handleListNFTForSale = useCallback(
    async (tokenId: bigint, priceEth: string) => {
      const priceWei = parseEther(priceEth);
      await sendTransaction(
        SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        SCIENTIFIC_CONTENT_MARKETPLACE_ABI as Abi,
        "listNFTForSale",
        [tokenId, priceWei],
        BigInt(0),
        "DnAContentMarketplace",
        { tokenId: tokenId.toString(), price: priceEth }
      );
    },
    [sendTransaction]
  );

  // MARKETPLACE: Purchase NFT
  const handlePurchaseNFT = useCallback(
    async (tokenId: bigint, priceEth: string) => {
      const priceWei = parseEther(priceEth);
      await sendTransaction(
        SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        SCIENTIFIC_CONTENT_MARKETPLACE_ABI as Abi,
        "purchaseNFT",
        [tokenId],
        priceWei,
        "DnAContentMarketplace",
        { tokenId: tokenId.toString(), paidAmount: priceEth }
      );
    },
    [sendTransaction]
  );

  // MARKETPLACE: Start Auction
  const handleStartAuction = useCallback(
    async (tokenId: bigint, minPriceEth: string, durationSeconds: number) => {
      const minPriceWei = parseEther(minPriceEth);
      await sendTransaction(
        SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        SCIENTIFIC_CONTENT_MARKETPLACE_ABI as Abi,
        "startAuction",
        [tokenId, minPriceWei, durationSeconds],
        BigInt(0),
        "DnAContentMarketplace",
        {
          tokenId: tokenId.toString(),
          minPrice: minPriceEth,
          duration: durationSeconds,
        }
      );
    },
    [sendTransaction]
  );

  // MARKETPLACE: Place Bid
  const handlePlaceBid = useCallback(
    async (tokenId: bigint, bidAmountEth: string) => {
      const bidAmountWei = parseEther(bidAmountEth);
      await sendTransaction(
        SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        SCIENTIFIC_CONTENT_MARKETPLACE_ABI as Abi,
        "placeBid",
        [tokenId],
        bidAmountWei,
        "DnAContentMarketplace",
        { tokenId: tokenId.toString(), bidAmount: bidAmountEth }
      );
    },
    [sendTransaction]
  );

  // MARKETPLACE: End Auction
  const handleEndAuction = useCallback(
    async (tokenId: bigint) => {
      await sendTransaction(
        SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        SCIENTIFIC_CONTENT_MARKETPLACE_ABI as Abi,
        "endAuction",
        [tokenId],
        BigInt(0),
        "DnAContentMarketplace",
        { tokenId: tokenId.toString() }
      );
    },
    [sendTransaction]
  );

  // MARKETPLACE: Claim Refund
  const handleClaimRefund = useCallback(
    async (tokenId: bigint) => {
      await sendTransaction(
        SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
        SCIENTIFIC_CONTENT_MARKETPLACE_ABI as Abi,
        "claimRefund",
        [tokenId],
        BigInt(0),
        "DnAContentMarketplace",
        { tokenId: tokenId.toString() }
      );
    },
    [sendTransaction]
  );

  useEffect(() => {
    // Controlla se questa è una nuova transazione che non abbiamo ancora processato
    if (
      isNftTxSuccess &&
      nftTxHash &&
      publicClient &&
      !isMintingFulfilled &&
      lastProcessedTxHashRef.current !== nftTxHash
    ) {
      // AGGIUNTA OPZIONALE: Se nftTxHash è undefined o già processato, skippa
      if (!nftTxHash || nftTxHash === lastProcessedTxHashRef.current) {
        return;
      }

      toast.success("Richiesta di Minting inviata con successo!", {
        duration: 7000,
      });

      // Usa il CID salvato per generare l'URL
      if (currentPreviewImageCidRef.current) {
        const PINATA_GATEWAY_SUBDOMAIN =
          process.env.NEXT_PUBLIC_PINATA_GATEWAY_SUBDOMAIN || "your-subdomain";
        const imageUrl = `https://${PINATA_GATEWAY_SUBDOMAIN}.mypinata.cloud/ipfs/${currentPreviewImageCidRef.current}`;

        // Simuliamo il minting completato
        setMintedTokenId(BigInt(0));
        setMintingFulfillmentTxHash(nftTxHash);
        setIsMintingFulfilled(true);
        setMintedNftImageUrl(imageUrl);

        // Marca questa transazione come processata
        lastProcessedTxHashRef.current = nftTxHash;

        toast.success(`🎉 NFT Mintato!`);
        setIsProcessing(false);
        if (onMintingCompleted) {
          onMintingCompleted();
        }
      } else {
        // toast.error("Mancata immagine di preview");
        setIsProcessing(false);
      }
    }
  }, [
    isNftTxSuccess,
    nftTxHash,
    publicClient,
    isMintingFulfilled,
    onMintingCompleted,
  ]);

  // Cleanup finale per assicurarsi che i timer siano sempre cancellati
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      hasStartedMintPolling.current = false;
      lastCheckedBlockNumber.current = null;
    };
  }, []);

  const resetAdminState = useCallback(() => {
    setError(null);
    setMintingRevertReason(null);
    setIsProcessing(false);
    setMintedTokenId(null);
    setIsMintingFulfilled(false);
    setMintingFulfillmentTxHash(null);
    setMintedNftImageUrl(null);
    currentMintContentIdRef.current = null;
    currentPreviewImageCidRef.current = null;
    lastProcessedTxHashRef.current = null;
    lastCheckedBlockNumber.current = null;
    hasStartedMintPolling.current = false;
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
    pollingIntervalRef.current = null;
    pollingTimeoutRef.current = null;
    resetNftWrite();
    resetMarketplaceWrite();
  }, [resetNftWrite, resetMarketplaceWrite]);

  return {
    sendTransaction,
    handleRequestMintForNewContent,
    handleRequestMintForCopy,
    handleListNFTForSale,
    handlePurchaseNFT,
    handleStartAuction,
    handlePlaceBid,
    handleEndAuction,
    handleClaimRefund,
    isProcessing,
    isNftWritePending,
    isNftTxConfirming,
    isNftTxSuccess,
    nftTxHash,
    isMarketplaceWritePending,
    isMarketplaceTxConfirming,
    isMarketplaceTxSuccess,
    marketplaceTxHash,
    error,
    mintingRevertReason,
    mintedTokenId,
    isMintingFulfilled,
    mintingFulfillmentTxHash,
    mintedNftImageUrl,
    resetAdminState,
    MINT_PRICE_ETH,
    resetMintingState,
  };
};

export default useAdminContentManagement;

