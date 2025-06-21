// frontend-dapp/src/hooks/useRegisterContent.ts
import { useState, useEffect, useCallback, useRef } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  usePublicClient,
} from "wagmi";
import { toast } from "react-hot-toast";
import {
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
  SCIENTIFIC_CONTENT_REGISTRY_ABI,
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  SCIENTIFIC_CONTENT_NFT_ABI, // Assicurati che questa ABI sia l'ABI COMPLETA del tuo ScientificContentNFT
  ARBITRUM_SEPOLIA_CHAIN_ID,
} from "@/lib/constants";
import { parseEther, Abi, decodeEventLog, GetLogsReturnType, AbiEvent } from "viem"; // Importa AbiEvent

interface NftTemplate {
  _id: string;
  name: string;
  description: string;
  metadataSchema: any;
  royaltyPercentage: number;
  saleOptions: "fixed_price" | "auction" | "both";
  maxCopies: number;
}

// Definisco una struttura per il contenuto dal registro on-chain
interface ContentOnChain {
  author: `0x${string}`;
  title: string;
  description: string;
  maxCopies: bigint;
  mintedCopies: bigint;
  mainDocumentURI: string;
  mintPrice: bigint;
  isAvailable: boolean;
}

const CONTENT_REGISTERED_EVENT_TOPIC =
  "0xb3fb1534604fd9d4678cce38f4708f0b6725d2692cbfb2af0e493612a78944dc";

const NFT_MINTED_EVENT_TOPIC =
  "0xc49622928e6a9619f1efac0300b9a868d077db41c42a37ce78d7774b341e6f79";

const MINT_PRICE_ETH = "0.005"; // Prezzo di mint base per coerenza, anche se viene dal contratto

// Definisci il tipo per gli argomenti dell'evento NFTMinted
interface NFTMintedEventArgs {
  tokenId: bigint;
  contentId: bigint;
  owner: `0x${string}`;
  isSpecial: boolean;
  copyNumber: bigint;
  metadataURI: string;
}

export const useRegisterContent = () => {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: ARBITRUM_SEPOLIA_CHAIN_ID });

  // Form state
  const [templates, setTemplates] = useState<NftTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [contentTitle, setContentTitle] = useState<string>("");
  const [contentDescription, setDescriptionContent] = useState<string>("");
  const [maxCopies, setMaxCopies] = useState<number>(1); // Questo è il maxCopies del template (valore iniziale suggerito)
  const [originalMetadata, setOriginalMetadata] = useState<Record<string, any>>({});

  // File handling
  const [previewImage, setPreviewImage] = useState<File | null>(null);
  const [mainDocument, setMainDocument] = useState<File | null>(null);
  const [metadataInputs, setMetadataInputs] = useState<Record<string, any>>({});

  // IPFS state
  const [ipfsPreviewImageCid, setIpfsPreviewImageCid] = useState<string | null>(null);
  const [ipfsMainDocumentCid, setIpfsMainDocumentCid] = useState<string | null>(null);
  const [ipfsMetadataCid, setIpfsMetadataCid] = useState<string | null>(null);

  // Process state
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [registryContentId, setRegistryContentId] = useState<bigint | null>(null);
  const [mintedTokenId, setMintedTokenId] = useState<bigint | null>(null);
  const [isMintingFulfilled, setIsMintingFulfilled] = useState(false);
  const [mintingFulfillmentTxHash, setMintingFulfillmentTxHash] = useState<`0x${string}` | null>(null);
  const [mintedNftImageUrl, setMintedNftImageUrl] = useState<string | null>(null);
  const [mintingRevertReason, setMintingRevertReason] = useState<string | null>(null);

  // Ref per tracciare se il polling per il minting è già stato avviato per questa richiesta
  const hasStartedMintPolling = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckedBlockNumber = useRef<bigint | null>(null);


  // Contract hooks
  const {
    data: registryHash,
    writeContract: registerContentContract,
    isPending: isRegisteringPending,
  } = useWriteContract();

  const {
    isLoading: isRegistering,
    isSuccess: isRegistrySuccess,
    isError: isRegistryError,
  } = useWaitForTransactionReceipt({ hash: registryHash });

  const {
    data: requestMintHash,
    writeContract: requestMintContract,
    isPending: isRequestMintPending,
    error: requestMintWriteError,
  } = useWriteContract();

  const {
    isLoading: isRequestingMint,
    isSuccess: isRequestMintSuccess,
    isError: isRequestMintError,
    error: requestMintReceiptError,
  } = useWaitForTransactionReceipt({ hash: requestMintHash });

  const { data: nftContractAddressInRegistry } = useReadContract({
    abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
    address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
    functionName: "nftContract",
    chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
    query: {
      enabled: mounted && isConnected && chainId === ARBITRUM_SEPOLIA_CHAIN_ID,
    },
  }) as { data: `0x${string}` | undefined };

  const {
    data: contentDetails, // Nuova lettura per i dettagli del contenuto dal Registry
    isLoading: isLoadingContentDetails,
    isError: isErrorContentDetails,
  } = useReadContract({
    abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
    address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
    functionName: "getContent",
    args: [registryContentId || BigInt(0)], // Usa contentId se presente, altrimenti 0 per disabilitare
    chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
    query: {
      enabled: mounted && !!registryContentId && chainId === ARBITRUM_SEPOLIA_CHAIN_ID, // Abilitato solo se registryContentId esiste
    },
  }) as { data: ContentOnChain | undefined, isLoading: boolean, isError: boolean };


  const {
    data: setNftContractHash,
    writeContract: setNftContractInRegistry,
    isPending: isSetNftContractPending,
  } = useWriteContract();

  const {
    isLoading: isSettingNftContract,
    isSuccess: isSetNftContractSuccess,
    isError: isSetNftContractError,
  } = useWaitForTransactionReceipt({ hash: setNftContractHash });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    if (!mounted) return;

    try {
      const res = await fetch("/api/admin/templates");
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data);
        if (data.data.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(data.data[0]._id);
          setMaxCopies(data.data[0].maxCopies || 1);
        }
      } else {
        toast.error(data.message || "Failed to fetch templates.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error fetching templates.");
    }
  }, [mounted, selectedTemplateId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Initialize metadata fields when template changes
  useEffect(() => {
    const template = templates.find((t) => t._id === selectedTemplateId);
    if (template) {
      if (template.metadataSchema && template.metadataSchema.properties) {
        const initialMetadata: Record<string, any> = {};
        for (const key in template.metadataSchema.properties) {
          initialMetadata[key] = "";
        }
        setMetadataInputs(initialMetadata);
      } else {
        setMetadataInputs({});
      }
      setMaxCopies(template.maxCopies || 1); // Aggiorna maxCopies dal template
    } else {
      setMetadataInputs({});
      setMaxCopies(1);
    }
  }, [selectedTemplateId, templates]);

  // File upload to IPFS
  const handleFileUpload = useCallback(async (file: File, fileType: 'preview' | 'document') => {
    setError(null);
    setIsProcessing(true);

    const fileTypeLabel = fileType === 'preview' ? 'immagine di anteprima' : 'documento principale';
    toast(`Caricamento ${fileTypeLabel} su IPFS in corso...`, { icon: "⏳" });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ipfs-upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        if (fileType === 'preview') {
          setIpfsPreviewImageCid(data.cid);
        } else {
          setIpfsMainDocumentCid(data.cid);
        }
        toast.success(`${fileTypeLabel.charAt(0).toUpperCase() + fileTypeLabel.slice(1)} caricato su IPFS: ${data.cid}`);
      } else {
        throw new Error(data.message || `Errore nel caricamento del ${fileTypeLabel} su IPFS.`);
      }
    } catch (err: any) {
      setError(`Errore nel caricamento del ${fileTypeLabel} su IPFS: ${err.message}`);
      toast.error(`Errore nel caricamento del ${fileTypeLabel} su IPFS: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Metadata upload to IPFS
  const handleMetadataUpload = useCallback(async () => {
    setError(null);
    setIsProcessing(true);
    toast("Caricamento dei metadati su IPFS in corso...", { icon: "⏳" });

    try {
      const template = templates.find((t) => t._id === selectedTemplateId);
      if (!template) {
        throw new Error("Nessun template selezionato.");
      }

      const fullMetadata = {
        name: contentTitle,
        description: contentDescription,
        // Usiamo un placeholder generico per l'immagine nel JSON dei metadati,
        // in quanto l'immagine di anteprima è un concetto del frontend e l'URI finale
        // sarà generato con il tokenURI del contratto o direttamente dal frontend
        image: ipfsPreviewImageCid ? `ipfs://${ipfsPreviewImageCid}` : undefined,
        external_url: `https://tuo-dominio-dapp.com/content/${registryContentId?.toString() || "unknown"}`,
        attributes: [
          { trait_type: "Author Address", value: address },
          { trait_type: "Registry Content ID", value: registryContentId ? registryContentId.toString() : "N/A" },
          { trait_type: "Template Name", value: template.name },
          { trait_type: "Max Copies (Template)", value: template.maxCopies },
          { trait_type: "Royalty Percentage", value: template.royaltyPercentage },
          { trait_type: "Sale Options", value: template.saleOptions },
          ...Object.entries(metadataInputs).map(([key, value]) => ({
            trait_type: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1").trim(),
            value: value,
          })),
        ],
        originalDocumentFileCID: ipfsMainDocumentCid,
        previewImageFileCID: ipfsPreviewImageCid, // Manteniamo il CID originale qui per riferimento
        templateId: selectedTemplateId,
      };
      setOriginalMetadata(fullMetadata);

      const formData = new FormData();
      const metadataBlob = new Blob([JSON.stringify(fullMetadata)], {
        type: "application/json",
      });
      formData.append("file", metadataBlob, "metadata.json");

      const res = await fetch("/api/ipfs-upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setIpfsMetadataCid(data.cid);
        toast.success(`Metadati caricati su IPFS: ${data.cid}`);
        return data.cid;
      } else {
        throw new Error(data.message || "Errore nel caricamento dei metadati su IPFS.");
      }
    } catch (err: any) {
      setError(`Errore nel caricamento dei metadati su IPFS: ${err.message}`);
      toast.error(`Errore nel caricamento dei metadati su IPFS: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [address, contentDescription, contentTitle, ipfsMainDocumentCid, ipfsPreviewImageCid, metadataInputs, registryContentId, selectedTemplateId, templates]);

  // Set NFT contract address in registry
  const handleSetNftContract = useCallback(async () => {
    if (!isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID || !address) {
      toast.error("Connetti il tuo wallet ad Arbitrum Sepolia con un account admin.");
      return;
    }

    if (nftContractAddressInRegistry &&
      nftContractAddressInRegistry.toLowerCase() === SCIENTIFIC_CONTENT_NFT_ADDRESS.toLowerCase()) {
      toast.success("L'indirizzo del Contratto NFT è già impostato correttamente nel Registry.");
      return;
    }

    if (nftContractAddressInRegistry &&
      nftContractAddressInRegistry !== "0x0000000000000000000000000000000000000000" &&
      nftContractAddressInRegistry.toLowerCase() !== SCIENTIFIC_CONTENT_NFT_ADDRESS.toLowerCase()) {
      toast.error("L'indirizzo del Contratto NFT è già impostato su un indirizzo diverso.");
      return;
    }

    try {
      toast("Impostazione dell'indirizzo del contratto NFT nel Registry...", { icon: "⏳" });
      setNftContractInRegistry({
        abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
        address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
        functionName: "setNFTContract",
        args: [SCIENTIFIC_CONTENT_NFT_ADDRESS],
      });
    } catch (err: any) {
      toast.error(`Errore: ${err.message}`);
    }
  }, [address, chainId, isConnected, nftContractAddressInRegistry, setNftContractInRegistry]);

  // Register content on-chain
  const handleRegisterContent = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID || !address) {
      toast.error("Connetti il tuo wallet ad Arbitrum Sepolia.");
      return;
    }

    if (!ipfsMainDocumentCid) {
      setError("Per favore, carica prima il documento principale su IPFS.");
      toast.error("Per favore, carica prima il documento principale su IPFS.");
      return;
    }

    if (!ipfsPreviewImageCid) {
      setError("Per favorc, carica prima l'immagine di anteprima su IPFS.");
      toast.error("Per favorc, carica prima l'immagine di anteprima su IPFS.");
      return;
    }

    if (!nftContractAddressInRegistry ||
      nftContractAddressInRegistry.toLowerCase() !== SCIENTIFIC_CONTENT_NFT_ADDRESS.toLowerCase()) {
      setError("L'indirizzo del Contratto NFT non è impostato correttamente nel Registry.");
      toast.error("L'indirizzo del Contratto NFT non è impostato correttamente nel Registry.");
      return;
    }

    setIsProcessing(true);
    toast("Inizio registrazione del contenuto on-chain...", { icon: "⏳" });

    try {
      registerContentContract({
        abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
        address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
        functionName: "registerContent",
        args: [
          contentTitle,
          contentDescription,
          BigInt(maxCopies), // Passa il maxCopies come BigInt
          `ipfs://${ipfsMainDocumentCid}`,
          parseEther(MINT_PRICE_ETH)
        ],
      });
    } catch (err: any) {
      setError(`Errore nell'inizializzazione della registrazione del contenuto: ${err.message}`);
      toast.error(`Errore nell'inizializzazione della registrazione del contenuto: ${err.message}`);
      setIsProcessing(false);
    }
  }, [address, chainId, contentDescription, contentTitle, ipfsMainDocumentCid, ipfsPreviewImageCid, isConnected, maxCopies, nftContractAddressInRegistry, registerContentContract]);

  // Request NFT minting
  const handleRequestMintNFT = useCallback(async () => {
    setError(null);
    setMintingRevertReason(null);
    hasStartedMintPolling.current = false; // Reset del flag all'inizio di una nuova richiesta di mint
    setIsMintingFulfilled(false); // Reset dello stato di fulfillment
    setMintedTokenId(null);
    setMintingFulfillmentTxHash(null);
    setMintedNftImageUrl(null);

    if (!registryContentId) {
      setError("Contenuto non ancora registrato o ID non recuperato.");
      toast.error("Contenuto non ancora registrato o ID non recuperato.");
      return;
    }

    if (!ipfsMainDocumentCid || !ipfsPreviewImageCid) {
      setError("File non caricati su IPFS.");
      toast.error("File non caricati su IPFS.");
      return;
    }

    // Aggiungi qui la logica di controllo per le copie disponibili
    if (contentDetails && contentDetails.mintedCopies >= contentDetails.maxCopies) {
      setError("Tutte le copie disponibili per questo contenuto sono già state mintate.");
      toast.error("Non ci sono più copie disponibili per questo contenuto.");
      return;
    }


    if (isProcessing || isRequestMintPending || isRequestingMint || isMintingFulfilled) {
      toast("Un'operazione è già in corso o l'NFT è già stato coniato. Attendi il completamento.", { icon: "ℹ️" });
      return;
    }

    setIsProcessing(true);
    toast("Caricamento dei metadati su IPFS per l'NFT...", { icon: "⏳" });

    try {
      const metadataCid = await handleMetadataUpload();
      if (!metadataCid) {
        setIsProcessing(false);
        toast.error("Errore nel caricamento dei metadati per il minting dell'NFT.");
        return;
      }

      setIpfsMetadataCid(metadataCid);
      const nftMetadataURI = `ipfs://${metadataCid}`;

      toast("Inizio transazione di richiesta minting NFT (richiesta VRF)...", { icon: "⏳" });

      requestMintContract({
        abi: SCIENTIFIC_CONTENT_NFT_ABI as Abi,
        address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
        functionName: 'mintNFT',
        args: [registryContentId, nftMetadataURI],
        value: parseEther(MINT_PRICE_ETH),
      });
    } catch (err: any) {
      const errorMessage = err && err.message ? err.message : "Errore sconosciuto durante l'inizializzazione della richiesta di minting NFT.";
      setError(`Errore nell'inizializzazione della richiesta di minting NFT: ${errorMessage}`);
      toast.error(`Errore nell'inizializzazione della richiesta di minting NFT: ${errorMessage}`);
      setIsProcessing(false);
    }
  }, [contentDetails, handleMetadataUpload, ipfsMainDocumentCid, ipfsPreviewImageCid, isMintingFulfilled, isProcessing, isRequestMintPending, isRequestingMint, registryContentId, requestMintContract]);

  // Reset form
  const resetForm = useCallback(() => {
    setRegistryContentId(null);
    setMintedTokenId(null);
    setIpfsPreviewImageCid(null);
    setIpfsMainDocumentCid(null);
    setIpfsMetadataCid(null);
    setContentTitle("");
    setDescriptionContent("");
    setPreviewImage(null);
    setMainDocument(null);
    setMetadataInputs({});
    setError(null);
    setIsProcessing(false);
    setIsMintingFulfilled(false);
    setMintingFulfillmentTxHash(null);
    setMintedNftImageUrl(null);
    setOriginalMetadata({});
    setMintingRevertReason(null);
    hasStartedMintPolling.current = false; // Reset del flag
    if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
    }
    lastCheckedBlockNumber.current = null;
  }, []);

  // Monitor NFT contract setting
  useEffect(() => {
    if (isSetNftContractSuccess) {
      toast.success("Indirizzo del Contratto NFT impostato con successo nel ScientificContentRegistry!");
    }
    if (setNftContractHash && (isSetNftContractSuccess || isSetNftContractError)) {
      if (isSetNftContractSuccess) {
        toast(`Hash della Transazione: ${setNftContractHash}`, { icon: "✅" });
      } else if (isSetNftContractError) {
        toast.error(`Errore nell'impostazione del Contratto NFT. Hash Tx: ${setNftContractHash}`);
      }
      setIsProcessing(false);
    }
  }, [isSetNftContractSuccess, isSetNftContractError, setNftContractHash]);

  // Monitor content registration
  useEffect(() => {
    if (isRegistrySuccess && registryHash && publicClient) {
      toast.success("Transazione di registrazione contenuto confermata!");
      toast(`Hash della Transazione: ${registryHash}`, { icon: "🔗" });

      const getLatestContentId = async () => {
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash: registryHash });
          if (!receipt) {
            setError("Ricevuta della transazione di registrazione non trovata.");
            toast.error("Ricevuta di registrazione non trovata.");
            setIsProcessing(false);
            return;
          }

          const contentRegisteredEvent = receipt.logs.find(
            (log) => log.address.toLowerCase() === SCIENTIFIC_CONTENT_REGISTRY_ADDRESS.toLowerCase() &&
            log.topics[0] === CONTENT_REGISTERED_EVENT_TOPIC
          );

          if (contentRegisteredEvent) {
            // Decodifichiamo l'evento ContentRegistered.
            const decodedLog = decodeEventLog({
              abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
              eventName: "ContentRegistered",
              topics: contentRegisteredEvent.topics,
              data: contentRegisteredEvent.data,
            });

            // Usiamo un type guard per assicurarci che 'args' sia un oggetto e contenga 'contentId'
            // Poi lo castiamo a un Record per accedere in modo tipizzato.
            if (decodedLog.eventName === "ContentRegistered" && decodedLog.args && typeof decodedLog.args === 'object' && 'contentId' in decodedLog.args) {
              const args = decodedLog.args as { contentId: bigint }; // Cast qui per contentId
              const contentIdFromEvent = args.contentId;
              setRegistryContentId(contentIdFromEvent);
              toast.success(`Contenuto registrato con ID: ${contentIdFromEvent.toString()}. Puoi ora procedere al minting dell'NFT.`);
              setIsProcessing(false);
            } else {
              setError("Impossibile recuperare l'ID del contenuto dall'evento o dati non validi.");
              toast.error("ID Contenuto non trovato programmaticamente.");
              setIsProcessing(false);
            }
          } else {
            setError("Impossibile trovare l'evento ContentRegistered nella ricevuta.");
            toast.error("ID Contenuto non trovato programmaticamente.");
            setIsProcessing(false);
          }
        } catch (err: any) {
          setError(`Errore nel recupero della ricevuta/decodifica evento: ${err.message}`);
          toast.error(`Errore nel recupero della ricevuta/decodifica evento: ${err.message}`);
          setIsProcessing(false);
        }
      };
      getLatestContentId();
    }

    if (isRegistryError) {
      setError("Errore nella registrazione del contenuto on-chain.");
      toast.error("Errore nella registrazione del contenuto on-chain.");
      setIsProcessing(false);
    }
  }, [isRegistrySuccess, isRegistryError, registryHash, publicClient]);

  // Monitor mint request fulfillment using polling for NFTMinted event
  useEffect(() => {
    // Gestione errori di scrittura (pre-transazione)
    if (requestMintWriteError) {
      console.error("Errore di scrittura della transazione di minting:", requestMintWriteError);
      const errorMessage = requestMintWriteError.message || "Transazione di minting rifiutata o fallita.";
      setError(`Errore di transazione: ${errorMessage}`);
      toast.error(`Errore di transazione: ${errorMessage}`);
      setIsProcessing(false);
      setMintingRevertReason(errorMessage);
    }

    // Gestione errori della ricevuta (post-transazione, ma ancora nella fase di richiesta VRF)
    if (isRequestMintError && requestMintReceiptError) {
      console.error("Errore nella ricevuta della transazione di richiesta minting (VRF):", requestMintReceiptError);
      const revertReason = requestMintReceiptError.message.includes("reverted with the following reason")
        ? requestMintReceiptError.message.split("reverted with the following reason:")[1]?.trim().split("\n")[0]?.replace(/["']+/g, '') || "Transazione di richiesta VRF fallita on-chain"
        : requestMintReceiptError.message;

      setError(`Errore richiesta VRF: ${revertReason}`);
      toast.error(`Errore Richiesta VRF: ${revertReason}`, { duration: 8000 });
      setIsProcessing(false);
      setMintingRevertReason(revertReason);
    }

    // Se la richiesta di mint (VRF) è andata a buon fine, inizia a cercare l'NFT mintato tramite polling
    if (isRequestMintSuccess && requestMintHash && publicClient && registryContentId && !isMintingFulfilled && !hasStartedMintPolling.current) {
      toast.success("Richiesta di Minting NFT (VRF) inviata con successo! In attesa dell'NFT con i tratti casuali...", { duration: 7000 });
      toast(`Hash Tx Richiesta VRF: ${requestMintHash}`, { icon: "🔗" });

      setIsProcessing(true); // Mantieni processing true finché l'NFT non è coniato
      hasStartedMintPolling.current = true; // Imposta il flag per indicare che abbiamo iniziato a cercare l'NFT
      lastCheckedBlockNumber.current = null; // Resetta il blocco di partenza per il polling dei log

      console.log("Inizio polling per l'evento NFTMinted...");

      const checkMintedNftEvent = async () => {
        try {
          const latestBlock = await publicClient.getBlockNumber();
          let fromBlock: bigint | undefined;

          // Se è la prima volta che polliamo o se il blocco precedente non è definito
          if (!lastCheckedBlockNumber.current) {
            const receipt = await publicClient.getTransactionReceipt({ hash: requestMintHash });
            fromBlock = receipt?.blockNumber;
          } else {
            fromBlock = lastCheckedBlockNumber.current + BigInt(1);
          }
          
          if (!fromBlock || fromBlock > latestBlock) {
              console.log("LOG (Polling): Nessun nuovo blocco da controllare o blocco iniziale non disponibile.");
              return;
          }

          console.log(`LOG (Polling): Cerco eventi NFTMinted da blocco ${fromBlock} a ${latestBlock}`);

          // Ottieni la definizione dell'evento NFTMinted dall'ABI completa
          // Usiamo un cast specifico per assicurare che sia un AbiEvent
          const nftMintedEventAbi = (SCIENTIFIC_CONTENT_NFT_ABI as Abi).find(
            (item): item is AbiEvent => item.type === 'event' && item.name === 'NFTMinted'
          );

          if (!nftMintedEventAbi) {
            console.error("Errore: Definizione dell'evento NFTMinted non trovata nell'ABI del contratto NFT.");
            toast.error("Errore interno: Definizione evento NFTMinted mancante.");
            return;
          }

          const logs = await publicClient.getLogs({
            address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
            event: nftMintedEventAbi, // Ora TypeScript è contento perché sa che è un AbiEvent
            fromBlock: fromBlock,
            toBlock: latestBlock,
          });

          console.log("LOG (Polling): Eventi NFTMinted ricevuti:", logs);

          for (const log of logs) {
            try {
              // Decodifica l'evento. Viem inferirà il tipo restituito.
              const decoded = decodeEventLog({
                abi: SCIENTIFIC_CONTENT_NFT_ABI as Abi,
                eventName: "NFTMinted",
                topics: log.topics,
                data: log.data,
              });
              
              // Applica il type guard per assicurarti che gli argomenti esistano e contengano tutte le proprietà necessarie
              // e che siano del tipo corretto prima del cast finale.
              // Questo pattern è più sicuro del semplice 'in' per tutte le proprietà.
              if (
                decoded.eventName === "NFTMinted" && 
                decoded.args && 
                typeof decoded.args === 'object' && // Assicurati che sia un oggetto
                'tokenId' in decoded.args && typeof decoded.args.tokenId === 'bigint' &&
                'contentId' in decoded.args && typeof decoded.args.contentId === 'bigint' &&
                'owner' in decoded.args && typeof decoded.args.owner === 'string' &&
                'isSpecial' in decoded.args && typeof decoded.args.isSpecial === 'boolean' &&
                'copyNumber' in decoded.args && typeof decoded.args.copyNumber === 'bigint' &&
                'metadataURI' in decoded.args && typeof decoded.args.metadataURI === 'string'
              ) {
                // Ora TypeScript ha abbastanza informazioni per accettare il cast.
                const args = decoded.args as NFTMintedEventArgs;

                console.log("LOG (Polling): Evento NFTMinted decodificato con successo:", args);
                
                const foundTokenId = args.tokenId;
                const foundContentId = args.contentId;
                const foundOwner = args.owner;

                // Verifica che il contentId e l'owner (minter) corrispondano alla nostra richiesta
                if (registryContentId && foundContentId === registryContentId && foundOwner.toLowerCase() === address?.toLowerCase()) {
                  if (!isMintingFulfilled) { // Doppia verifica per evitare race conditions
                    setMintedTokenId(foundTokenId);
                    setMintingFulfillmentTxHash(log.transactionHash); // Questo è l'hash della transazione VRF callback
                    setIsMintingFulfilled(true);

                    if (ipfsPreviewImageCid) {
                      setMintedNftImageUrl(`https://${ipfsPreviewImageCid}.ipfs.dweb.link/`);
                    } else {
                      setMintedNftImageUrl(null);
                    }
                    
                    toast.success(`🎉 NFT Mintato! Token ID: ${foundTokenId.toString()}`);
                    setIsProcessing(false);
                    
                    // Ferma il polling una volta che l'NFT è stato trovato
                    if (pollingIntervalRef.current) {
                      clearInterval(pollingIntervalRef.current);
                      pollingIntervalRef.current = null;
                    }
                    if (pollingTimeoutRef.current) {
                        clearTimeout(pollingTimeoutRef.current);
                        pollingTimeoutRef.current = null;
                    }
                    return; // Esci dalla funzione, abbiamo trovato il nostro NFT
                  }
                } else {
                  console.log(`LOG (Polling): Evento NFTMinted per contentId diverso (${foundContentId}) o owner diverso (${foundOwner}) dal richiesto (${registryContentId} / ${address}). Ignoro.`);
                }
              } else {
                console.warn("LOG (Polling): Evento NFTMinted decodificato ma argomenti mancanti o tipi non corrispondenti.", decoded);
              }
            } catch (decodeErr) {
              console.error("ERRORE (Polling): Fallimento nella decodifica di un log NFTMinted:", decodeErr, log);
              // Non propagare questo errore come un errore fatale, il polling potrebbe trovare altri log o tentare di nuovo.
            }
          }
          lastCheckedBlockNumber.current = latestBlock; // Aggiorna l'ultimo blocco controllato
        } catch (err: any) {
          console.error("ERRORE (Polling): Errore durante il recupero dei log per NFTMinted:", err);
          // Non visualizzare un toast di errore per ogni fallimento di polling,
          // solo se persistono o se c'è un errore grave.
        }
      };

      // Inizia il polling
      // Aumentato il tempo a 15 secondi per dare più respiro alla rete e al VRF
      pollingIntervalRef.current = setInterval(checkMintedNftEvent, 15 * 1000); 

      // Imposta un timeout generale per il caso in cui l'NFTMinted non arrivi mai
      // Aumentato a 5 minuti (300 secondi) per la massima tolleranza al VRF
      pollingTimeoutRef.current = setTimeout(() => {
        if (!isMintingFulfilled) {
          console.warn("ATTENZIONE: Timeout raggiunto. L'evento NFTMinted non è stato rilevato entro il tempo limite.");
          setError("La transazione di minting non è stata confermata in tempo. Potrebbe esserci un ritardo on-chain o un problema col VRF.");
          toast.error("Minting non confermato. Controlla il block explorer per l'hash di richiesta VRF. Potrebbe essere necessario riprovare.", { duration: 15000 });
          setIsProcessing(false);
          // Cleanup dei timer al timeout
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      }, 300 * 1000); 

      // Funzione di cleanup per disiscriversi dal polling e pulire i timer
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
        console.log("Cleanup: Polling per NFTMinted e timeout rimossi.");
      };
    }
  }, [
    isRequestMintSuccess,
    requestMintHash,
    publicClient,
    registryContentId,
    ipfsPreviewImageCid,
    isMintingFulfilled,
    requestMintWriteError,
    isRequestMintError,
    requestMintReceiptError,
    address, // Aggiunto per il controllo dell'owner
  ]);

  // Cleanup generale per i ref del polling quando il componente si smonta
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


  return {
    // State
    mounted,
    isConnected,
    chainId,
    address,
    templates,
    selectedTemplateId,
    setSelectedTemplateId,
    contentTitle,
    setContentTitle,
    contentDescription,
    setDescriptionContent,
    maxCopies, // Questo è il maxCopies del template (input dell'autore)
    setMaxCopies,
    previewImage,
    setPreviewImage,
    mainDocument,
    setMainDocument,
    metadataInputs,
    setMetadataInputs,
    ipfsPreviewImageCid,
    ipfsMainDocumentCid,
    ipfsMetadataCid,
    error,
    isProcessing,
    registryContentId,
    mintedTokenId,
    isMintingFulfilled,
    mintingFulfillmentTxHash,
    mintedNftImageUrl,
    originalMetadata,
    mintingRevertReason,
    contentDetails, // Esposto i dettagli del contenuto on-chain
    isLoadingContentDetails,
    isErrorContentDetails,

    // Contract state
    nftContractAddressInRegistry,
    isRegisteringPending,
    isRegistering,
    isRegistrySuccess,
    registryHash,
    isRequestMintPending,
    isRequestingMint,
    isRequestMintSuccess,
    requestMintHash,
    isSettingNftContract,
    isSetNftContractPending,

    // Actions
    handleFileUpload,
    handleSetNftContract,
    handleRegisterContent,
    handleRequestMintNFT,
    resetForm,

    // Constants
    MINT_PRICE_ETH,
    ARBITRUM_SEPOLIA_CHAIN_ID,
    SCIENTIFIC_CONTENT_NFT_ADDRESS,
  };
};
