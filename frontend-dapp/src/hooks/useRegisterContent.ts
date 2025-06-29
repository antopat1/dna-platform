//frontend-dapp\src\hooks\useRegisterContent.ts#
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
  SCIENTIFIC_CONTENT_NFT_ABI,
  ARBITRUM_SEPOLIA_CHAIN_ID,
} from "@/lib/constants";
import { parseEther, Abi, decodeEventLog, AbiEvent, getContract } from "viem";

interface NftTemplate {
  _id: string;
  name: string;
  description: string;
  metadataSchema: any;
  royaltyPercentage: number;
  saleOptions: "fixed_price" | "auction" | "both";
  maxCopies: number;
}

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

const MINT_PRICE_ETH = "0.005";

interface NFTMintedEventArgs {
  tokenId: bigint;
  contentId: bigint;
  owner: `0x${string}`;
  isSpecial: boolean;
  copyNumber: bigint;
  metadataURI: string;
}

// Aggiungi un ref per tracciare il contentId durante il polling

export const useRegisterContent = () => {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: ARBITRUM_SEPOLIA_CHAIN_ID });

  const [templates, setTemplates] = useState<NftTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [contentTitle, setContentTitle] = useState<string>("");
  const [contentDescription, setDescriptionContent] = useState<string>("");
  const [maxCopies, setMaxCopies] = useState<number>(1);
  const [originalMetadata, setOriginalMetadata] = useState<Record<string, any>>(
    {}
  );

  const [previewImage, setPreviewImage] = useState<File | null>(null);
  const [mainDocument, setMainDocument] = useState<File | null>(null);
  const [metadataInputs, setMetadataInputs] = useState<Record<string, any>>({});

  const [ipfsPreviewImageCid, setIpfsPreviewImageCid] = useState<string | null>(
    null
  );
  const [ipfsMainDocumentCid, setIpfsMainDocumentCid] = useState<string | null>(
    null
  );
  const [ipfsMetadataCid, setIpfsMetadataCid] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [registryContentId, setRegistryContentId] = useState<bigint | null>(
    null
  );
  const [mintedTokenId, setMintedTokenId] = useState<bigint | null>(null);
  const [isMintingFulfilled, setIsMintingFulfilled] = useState(false);
  const [mintingFulfillmentTxHash, setMintingFulfillmentTxHash] = useState<
    `0x${string}` | null
  >(null);
  const [mintedNftImageUrl, setMintedNftImageUrl] = useState<string | null>(
    null
  );
  const [mintingRevertReason, setMintingRevertReason] = useState<string | null>(
    null
  );

  const hasStartedMintPolling = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckedBlockNumber = useRef<bigint | null>(null);

  const currentMintContentIdRef = useRef<bigint | null>(null);

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
    reset: resetRequestMintContract,
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
    data: contentDetails,
    isLoading: isLoadingContentDetails,
    isError: isErrorContentDetails,
    refetch: refetchContentDetails,
  } = useReadContract({
    abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
    address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
    functionName: "getContent",
    args: [registryContentId || BigInt(0)],
    chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
    query: {
      enabled:
        mounted && !!registryContentId && chainId === ARBITRUM_SEPOLIA_CHAIN_ID,
    },
  }) as {
    data: ContentOnChain | undefined;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  };

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
      setMaxCopies(template.maxCopies || 1);
    } else {
      setMetadataInputs({});
      setMaxCopies(1);
    }
  }, [selectedTemplateId, templates]);

  const resetMintingState = useCallback(() => {
    setError(null);
    setMintingRevertReason(null);
    setIsMintingFulfilled(false);
    setMintedTokenId(null);
    setMintingFulfillmentTxHash(null);
    setMintedNftImageUrl(null);
    resetRequestMintContract();
  }, [resetRequestMintContract]);

  const handleFileUpload = useCallback(
    async (file: File, fileType: "preview" | "document") => {
      setError(null);
      setIsProcessing(true);

      const fileTypeLabel =
        fileType === "preview"
          ? "immagine di anteprima"
          : "documento principale";
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
          if (fileType === "preview") {
            setIpfsPreviewImageCid(data.cid);
          } else {
            setIpfsMainDocumentCid(data.cid);
          }
          toast.success(
            `${
              fileTypeLabel.charAt(0).toUpperCase() + fileTypeLabel.slice(1)
            } caricato su IPFS: ${data.cid}`
          );
        } else {
          throw new Error(
            data.message ||
              `Errore nel caricamento del ${fileTypeLabel} su IPFS.`
          );
        }
      } catch (err: any) {
        setError(
          `Errore nel caricamento del ${fileTypeLabel} su IPFS: ${err.message}`
        );
        toast.error(
          `Errore nel caricamento del ${fileTypeLabel} su IPFS: ${err.message}`
        );
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const handleMetadataUpload = useCallback(
    async (
      options: {
        isCopy?: boolean;
        contentId?: bigint;
        title?: string;
        description?: string;
        mainDocumentIpfsHash?: string;
        previewImageIpfsHash?: string;
      } = { isCopy: false }
    ) => {
      setError(null);
      setIsProcessing(true);
      toast("Caricamento dei metadati su IPFS in corso...", { icon: "⏳" });

      try {
        let fullMetadata: any;

        if (options.isCopy) {
          // METADATI PER COPIA NFT
          fullMetadata = {
            name: options.title || "Scientific Content Copy",
            description:
              options.description || "Copy of registered scientific content",
            image: options.previewImageIpfsHash
              ? `ipfs://${options.previewImageIpfsHash}`
              : undefined,
            external_url: `https://tuo-dominio-dapp.com/content/${
              options.contentId?.toString() || "unknown"
            }`,
            attributes: [
              { trait_type: "Author Address", value: address },
              {
                trait_type: "Registry Content ID",
                value: options.contentId?.toString() || "N/A",
              },
              { trait_type: "Content Type", value: "Copy" },
            ],
            originalDocumentFileCID: options.mainDocumentIpfsHash,
            previewImageFileCID: options.previewImageIpfsHash,
          };
        } else {
          // METADATI PER REGISTRAZIONE INIZIALE (comportamento originale)
          const template = templates.find((t) => t._id === selectedTemplateId);
          if (!template) {
            throw new Error("Nessun template selezionato.");
          }

          fullMetadata = {
            name: contentTitle,
            description: contentDescription,
            image: ipfsPreviewImageCid
              ? `ipfs://${ipfsPreviewImageCid}`
              : undefined,
            external_url: `https://tuo-dominio-dapp.com/content/${
              registryContentId?.toString() || "unknown"
            }`,
            attributes: [
              { trait_type: "Author Address", value: address },
              {
                trait_type: "Registry Content ID",
                value: registryContentId ? registryContentId.toString() : "N/A",
              },
              { trait_type: "Template Name", value: template.name },
              {
                trait_type: "Max Copies (Template)",
                value: template.maxCopies,
              },
              {
                trait_type: "Royalty Percentage",
                value: template.royaltyPercentage,
              },
              { trait_type: "Sale Options", value: template.saleOptions },
              ...Object.entries(metadataInputs).map(([key, value]) => ({
                trait_type:
                  key.charAt(0).toUpperCase() +
                  key
                    .slice(1)
                    .replace(/([A-Z])/g, " $1")
                    .trim(),
                value: value,
              })),
            ],
            originalDocumentFileCID: ipfsMainDocumentCid,
            previewImageFileCID: ipfsPreviewImageCid,
            templateId: selectedTemplateId,
          };
        }

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
          throw new Error(
            data.message || "Errore nel caricamento dei metadati su IPFS."
          );
        }
      } catch (err: any) {
        setError(`Errore nel caricamento dei metadati su IPFS: ${err.message}`);
        toast.error(
          `Errore nel caricamento dei metadati su IPFS: ${err.message}`
        );
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [
      address,
      contentDescription,
      contentTitle,
      ipfsMainDocumentCid,
      ipfsPreviewImageCid,
      metadataInputs,
      registryContentId,
      selectedTemplateId,
      templates,
    ]
  );

  const handleSetNftContract = useCallback(async () => {
    if (!isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID || !address) {
      toast.error(
        "Connetti il tuo wallet ad Arbitrum Sepolia con un account admin."
      );
      return;
    }

    if (
      nftContractAddressInRegistry &&
      nftContractAddressInRegistry.toLowerCase() ===
        SCIENTIFIC_CONTENT_NFT_ADDRESS.toLowerCase()
    ) {
      toast.success(
        "L'indirizzo del Contratto NFT è già impostato correttamente nel Registry."
      );
      return;
    }

    if (
      nftContractAddressInRegistry &&
      nftContractAddressInRegistry !==
        "0x0000000000000000000000000000000000000000" &&
      nftContractAddressInRegistry.toLowerCase() !==
        SCIENTIFIC_CONTENT_NFT_ADDRESS.toLowerCase()
    ) {
      toast.error(
        "L'indirizzo del Contratto NFT è già impostato su un indirizzo diverso."
      );
      return;
    }

    try {
      toast("Impostazione dell'indirizzo del contratto NFT nel Registry...", {
        icon: "⏳",
      });
      setNftContractInRegistry({
        abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
        address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
        functionName: "setNFTContract",
        args: [SCIENTIFIC_CONTENT_NFT_ADDRESS],
      });
    } catch (err: any) {
      toast.error(`Errore: ${err.message}`);
    }
  }, [
    address,
    chainId,
    isConnected,
    nftContractAddressInRegistry,
    setNftContractInRegistry,
  ]);

  const handleRegisterContent = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID || !address) {
        toast.error("Connetti il tuo wallet ad Arbitrum Sepolia.");
        return;
      }

      if (!ipfsMainDocumentCid) {
        setError("Per favore, carica prima il documento principale su IPFS.");
        toast.error(
          "Per favore, carica prima il documento principale su IPFS."
        );
        return;
      }

      if (!ipfsPreviewImageCid) {
        setError("Per favore, carica prima l'immagine di anteprima su IPFS.");
        toast.error(
          "Per favore, carica prima l'immagine di anteprima su IPFS."
        );
        return;
      }

      if (
        !nftContractAddressInRegistry ||
        nftContractAddressInRegistry.toLowerCase() !==
          SCIENTIFIC_CONTENT_NFT_ADDRESS.toLowerCase()
      ) {
        setError(
          "L'indirizzo del Contratto NFT non è impostato correttamente nel Registry."
        );
        toast.error(
          "L'indirizzo del Contratto NFT non è impostato correttamente nel Registry."
        );
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
            BigInt(maxCopies),
            `ipfs://${ipfsMainDocumentCid}`,
            parseEther(MINT_PRICE_ETH),
          ],
        });
      } catch (err: any) {
        setError(
          `Errore nell'inizializzazione della registrazione del contenuto: ${err.message}`
        );
        toast.error(
          `Errore nell'inizializzazione della registrazione del contenuto: ${err.message}`
        );
        setIsProcessing(false);
      }
    },
    [
      address,
      chainId,
      contentDescription,
      contentTitle,
      ipfsMainDocumentCid,
      ipfsPreviewImageCid,
      isConnected,
      maxCopies,
      nftContractAddressInRegistry,
      registerContentContract,
    ]
  );



  // PER IL MINTING INIZIALE (dopo registrazione)
  const handleRequestMintForNewContent = useCallback(async () => {
    // Reset stato precedente
    resetRequestMintContract();
    setError(null);
    setMintingRevertReason(null);
    hasStartedMintPolling.current = false;
    setIsMintingFulfilled(false);
    setMintedTokenId(null);
    setMintingFulfillmentTxHash(null);
    setMintedNftImageUrl(null);

    // Controlli preliminari
    if (isRequestMintPending || isRequestingMint || isProcessing) {
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
      const metadataCid = await handleMetadataUpload({ isCopy: false });

      if (!metadataCid) {
        throw new Error(
          "Errore nel caricamento dei metadati per il minting dell'NFT."
        );
      }

      const metadataURI = `ipfs://${metadataCid}`;
      const mintPriceWei = parseEther(MINT_PRICE_ETH);

      // Imposta il contentId corrente per il polling
      currentMintContentIdRef.current = registryContentId;
      console.log("Avvio minting per contentId:", registryContentId.toString());

      // 2. AVVIA IL MINTING
      requestMintContract({
        abi: SCIENTIFIC_CONTENT_NFT_ABI as Abi,
        address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
        functionName: "mintNFT",
        args: [registryContentId, metadataURI],
        value: mintPriceWei,
      });
    } catch (err: any) {
      const errorMessage =
        err.message || "Errore sconosciuto durante l'avvio del minting";
      setError(`Errore nell'avvio del minting: ${errorMessage}`);
      toast.error(`Errore: ${errorMessage}`);
      setIsProcessing(false);
      setMintingRevertReason(errorMessage);
    }
  }, [
    isRequestMintPending,
    isRequestingMint,
    isProcessing,
    resetRequestMintContract,
    registryContentId,
    handleMetadataUpload,
    requestMintContract,
  ]);

  // PER IL MINTING DI COPIE AGGIUNTIVE (dalla pagina dei contenuti registrati)
  const handleRequestMintForCopy = useCallback(
    async (contentId: bigint, metadataURI: string, mintPriceWei: bigint) => {
      // Reset stato precedente
      resetRequestMintContract();
      setError(null);
      setMintingRevertReason(null);
      hasStartedMintPolling.current = false;
      setIsMintingFulfilled(false);
      setMintedTokenId(null);
      setMintingFulfillmentTxHash(null);
      setMintedNftImageUrl(null);

      // Imposta il contentId corrente
      currentMintContentIdRef.current = contentId;

      setIsProcessing(true);

      try {
        requestMintContract({
          abi: SCIENTIFIC_CONTENT_NFT_ABI as Abi,
          address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
          functionName: "mintNFT",
          args: [contentId, metadataURI],
          value: mintPriceWei,
        });
      } catch (err: any) {
        const errorMessage =
          err.message || "Errore sconosciuto durante l'avvio del minting";
        setError(`Errore nell'avvio del minting: ${errorMessage}`);
        toast.error(`Errore: ${errorMessage}`);
        setIsProcessing(false);
        setMintingRevertReason(errorMessage);
      }
    },
    [requestMintContract, resetRequestMintContract]
  );

  const resetForm = useCallback(() => {
    setSelectedTemplateId("");
    setContentTitle("");
    setDescriptionContent("");
    setMaxCopies(1);
    setPreviewImage(null);
    setMainDocument(null);
    setMetadataInputs({});
    setOriginalMetadata({});

    setIpfsPreviewImageCid(null);
    setIpfsMainDocumentCid(null);
    setIpfsMetadataCid(null);

    setError(null);
    setIsProcessing(false);
    setRegistryContentId(null);
    setMintedTokenId(null);
    setIsMintingFulfilled(false);
    setMintingFulfillmentTxHash(null);
    setMintedNftImageUrl(null);
    setMintingRevertReason(null);

    resetRequestMintContract();

    hasStartedMintPolling.current = false;
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
    pollingIntervalRef.current = null;
    pollingTimeoutRef.current = null;
    lastCheckedBlockNumber.current = null;
    currentMintContentIdRef.current = null;
  }, [resetRequestMintContract]);

  useEffect(() => {
    if (isSetNftContractSuccess) {
      toast.success(
        "Indirizzo del Contratto NFT impostato con successo nel ScientificContentRegistry!"
      );
    }
    if (
      setNftContractHash &&
      (isSetNftContractSuccess || isSetNftContractError)
    ) {
      if (isSetNftContractSuccess) {
        toast(`Hash della Transazione: ${setNftContractHash}`, { icon: "✅" });
      } else if (isSetNftContractError) {
        toast.error(
          `Errore nell'impostazione del Contratto NFT. Hash Tx: ${setNftContractHash}`
        );
      }
      setIsProcessing(false);
    }
  }, [isSetNftContractSuccess, isSetNftContractError, setNftContractHash]);

  useEffect(() => {
    if (isRegistrySuccess && registryHash && publicClient) {
      toast.success("Transazione di registrazione contenuto confermata!");
      toast(`Hash della Transazione: ${registryHash}`, { icon: "🔗" });

      const getLatestContentId = async () => {
        try {
          const receipt = await publicClient.getTransactionReceipt({
            hash: registryHash,
          });
          if (!receipt) {
            setError(
              "Ricevuta della transazione di registrazione non trovata."
            );
            toast.error("Ricevuta di registrazione non trovata.");
            setIsProcessing(false);
            return;
          }

          const contentRegisteredEvent = receipt.logs.find(
            (log) =>
              log.address.toLowerCase() ===
                SCIENTIFIC_CONTENT_REGISTRY_ADDRESS.toLowerCase() &&
              log.topics[0] === CONTENT_REGISTERED_EVENT_TOPIC
          );

          if (contentRegisteredEvent) {
            const decodedLog = decodeEventLog({
              abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
              eventName: "ContentRegistered",
              topics: contentRegisteredEvent.topics,
              data: contentRegisteredEvent.data,
            });

            if (
              decodedLog.eventName === "ContentRegistered" &&
              decodedLog.args &&
              typeof decodedLog.args === "object" &&
              "contentId" in decodedLog.args
            ) {
              const args = decodedLog.args as { contentId: bigint };
              const contentIdFromEvent = args.contentId;
              setRegistryContentId(contentIdFromEvent);
              toast.success(
                `Contenuto registrato con ID: ${contentIdFromEvent.toString()}. Puoi ora procedere al minting dell'NFT.`
              );
              setIsProcessing(false);
            } else {
              setError(
                "Impossibile recuperare l'ID del contenuto dall'evento o dati non validi."
              );
              toast.error("ID Contenuto non trovato programmaticamente.");
              setIsProcessing(false);
            }
          } else {
            setError(
              "Impossibile trovare l'evento ContentRegistered nella ricevuta."
            );
            toast.error("ID Contenuto non trovato programmaticamente.");
            setIsProcessing(false);
          }
        } catch (err: any) {
          setError(
            `Errore nel recupero della ricevuta/decodifica evento: ${err.message}`
          );
          toast.error(
            `Errore nel recupero della ricevuta/decodifica evento: ${err.message}`
          );
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

  useEffect(() => {
    if (requestMintWriteError) {
      console.error(
        "Errore di scrittura della transazione di minting:",
        requestMintWriteError
      );
      const errorMessage =
        requestMintWriteError.message ||
        "Transazione di minting rifiutata o fallita.";
      setError(`Errore di transazione: ${errorMessage}`);
      toast.error(`Errore di transazione: ${errorMessage}`);
      setIsProcessing(false);
      setMintingRevertReason(errorMessage);
    }

    if (isRequestMintError && requestMintReceiptError) {
      console.error(
        "Errore nella ricevuta della transazione di richiesta minting (VRF):",
        requestMintReceiptError
      );
      const revertReason = requestMintReceiptError.message.includes(
        "reverted with the following reason"
      )
        ? requestMintReceiptError.message
            .split("reverted with the following reason:")[1]
            ?.trim()
            .split("\n")[0]
            ?.replace(/["']+/g, "") ||
          "Transazione di richiesta VRF fallita on-chain"
        : requestMintReceiptError.message;

      setError(`Errore richiesta VRF: ${revertReason}`);
      toast.error(`Errore Richiesta VRF: ${revertReason}`, { duration: 8000 });
      setIsProcessing(false);
      setMintingRevertReason(revertReason);
    }

    if (
      isRequestMintSuccess &&
      requestMintHash &&
      publicClient &&
      registryContentId &&
      !isMintingFulfilled &&
      !hasStartedMintPolling.current
    ) {
      toast.success(
        "Richiesta di Minting NFT (VRF) inviata con successo! In attesa dell'NFT con i tratti casuali...",
        { duration: 7000 }
      );
      toast(`Hash Tx Richiesta VRF: ${requestMintHash}`, { icon: "🔗" });

      setIsProcessing(true);
      hasStartedMintPolling.current = true;
      lastCheckedBlockNumber.current = null;

      console.log("Inizio polling per l'evento NFTMinted...");

      const checkMintedNftEvent = async () => {
        try {
          const latestBlock = await publicClient.getBlockNumber();
          let fromBlock: bigint | undefined;

          if (!lastCheckedBlockNumber.current) {
            const receipt = await publicClient.getTransactionReceipt({
              hash: requestMintHash,
            });
            fromBlock = receipt?.blockNumber;
          } else {
            fromBlock = lastCheckedBlockNumber.current + BigInt(1);
          }

          if (!fromBlock || fromBlock > latestBlock) {
            console.log(
              "LOG (Polling): Nessun nuovo blocco da controllare o blocco iniziale non disponibile."
            );
            return;
          }

          console.log(
            `LOG (Polling): Cerco eventi NFTMinted da blocco ${fromBlock} a ${latestBlock}`
          );

          const nftMintedEventAbi = (SCIENTIFIC_CONTENT_NFT_ABI as Abi).find(
            (item): item is AbiEvent =>
              item.type === "event" && item.name === "NFTMinted"
          );

          if (!nftMintedEventAbi) {
            console.error(
              "Errore: Definizione dell'evento NFTMinted non trovata nell'ABI del contratto NFT."
            );
            toast.error(
              "Errore interno: Definizione evento NFTMinted mancante."
            );
            return;
          }

          const logs = await publicClient.getLogs({
            address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
            event: nftMintedEventAbi,
            fromBlock: fromBlock,
            toBlock: latestBlock,
          });

          console.log("LOG (Polling): Eventi NFTMinted ricevuti:", logs);

          for (const log of logs) {
            try {
              const decoded = decodeEventLog({
                abi: SCIENTIFIC_CONTENT_NFT_ABI as Abi,
                eventName: "NFTMinted",
                topics: log.topics,
                data: log.data,
              });

              if (
                decoded.eventName === "NFTMinted" &&
                decoded.args &&
                typeof decoded.args === "object" &&
                "tokenId" in decoded.args &&
                typeof decoded.args.tokenId === "bigint" &&
                "contentId" in decoded.args &&
                typeof decoded.args.contentId === "bigint" &&
                "owner" in decoded.args &&
                typeof decoded.args.owner === "string" &&
                "isSpecial" in decoded.args &&
                typeof decoded.args.isSpecial === "boolean" &&
                "copyNumber" in decoded.args &&
                typeof decoded.args.copyNumber === "bigint" &&
                "metadataURI" in decoded.args &&
                typeof decoded.args.metadataURI === "string"
              ) {
                const args = decoded.args as NFTMintedEventArgs;

                console.log(
                  "LOG (Polling): Evento NFTMinted decodificato con successo:",
                  args
                );

                const foundTokenId = args.tokenId;
                const foundContentId = args.contentId;
                const foundOwner = args.owner;

                if (
                  currentMintContentIdRef.current &&
                  foundContentId === currentMintContentIdRef.current &&
                  foundOwner.toLowerCase() === address?.toLowerCase()
                ) {
                  if (!isMintingFulfilled) {
                    setMintedTokenId(foundTokenId);
                    setMintingFulfillmentTxHash(log.transactionHash);
                    setIsMintingFulfilled(true);

                    if (ipfsPreviewImageCid) {
                      setMintedNftImageUrl(ipfsPreviewImageCid);
                    } else {
                      setMintedNftImageUrl(null);
                    }

                    toast.success(
                      `🎉 NFT Mintato! Token ID: ${foundTokenId.toString()}`
                    );
                    setIsProcessing(false);
                    refetchContentDetails();

                    if (pollingIntervalRef.current) {
                      clearInterval(pollingIntervalRef.current);
                      pollingIntervalRef.current = null;
                    }
                    if (pollingTimeoutRef.current) {
                      clearTimeout(pollingTimeoutRef.current);
                      pollingTimeoutRef.current = null;
                    }
                    return;
                  }
                } else {
                  console.log(
                    `LOG (Polling): Evento NFTMinted per contentId diverso (${foundContentId}) o owner diverso (${foundOwner}) dal richiesto (${registryContentId} / ${address}). Ignoro.`
                  );
                }
              } else {
                console.warn(
                  "LOG (Polling): Evento NFTMinted decodificato ma argomenti mancanti o tipi non corrispondenti.",
                  decoded
                );
              }
            } catch (decodeErr) {
              console.error(
                "ERRORE (Polling): Fallimento nella decodifica di un log NFTMinted:",
                decodeErr,
                log
              );
            }
          }
          lastCheckedBlockNumber.current = latestBlock;
        } catch (err: any) {
          console.error(
            "ERRORE (Polling): Errore durante il recupero dei log per NFTMinted:",
            err
          );
        }
      };

      pollingIntervalRef.current = setInterval(checkMintedNftEvent, 15 * 1000);

      pollingTimeoutRef.current = setTimeout(() => {
        if (!isMintingFulfilled) {
          console.warn(
            "ATTENZIONE: Timeout raggiunto. L'evento NFTMinted non è stato rilevato entro il tempo limite."
          );
          setError(
            "La transazione di minting non è stata confermata in tempo. Potrebbe esserci un ritardo on-chain o un problema col VRF."
          );
          toast.error(
            "Minting non confermato. Controlla il block explorer per l'hash di richiesta VRF. Potrebbe essere necessario riprovare.",
            { duration: 15000 }
          );
          setIsProcessing(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      }, 300 * 1000);

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
    address,
    refetchContentDetails,
  ]);

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
    maxCopies,
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
    contentDetails,
    isLoadingContentDetails,
    isErrorContentDetails,
    handleMetadataUpload,
    setIpfsPreviewImageCid,
    setIpfsMainDocumentCid,
    setRegistryContentId,
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
    handleFileUpload,
    handleSetNftContract,
    handleRegisterContent,
    handleRequestMintForNewContent,
    handleRequestMintForCopy,
    resetForm,
    MINT_PRICE_ETH,
    ARBITRUM_SEPOLIA_CHAIN_ID,
    SCIENTIFIC_CONTENT_NFT_ADDRESS,
    resetMintingState,
  };
};
