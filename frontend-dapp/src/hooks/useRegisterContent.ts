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
  ARBITRUM_SEPOLIA_CHAIN_ID,
} from "@/lib/constants";
import { parseEther, Abi, decodeEventLog, AbiEvent } from "viem";

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

  const {
    data: registryHash,
    writeContract: registerContentContract,
    isPending: isRegisteringPending,
    error: registerContentError,
    reset: resetRegisterContent,
  } = useWriteContract();

  const {
    isLoading: isRegistering,
    isSuccess: isRegistrySuccess,
    isError: isRegistryError,
    error: registryReceiptError,
  } = useWaitForTransactionReceipt({ hash: registryHash });

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

    resetRegisterContent();
  }, [resetRegisterContent]);

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
            fullMetadata = {
                name: options.title || "Scientific Content Copy",
                description: options.description || "Copy of registered scientific content",
                image: options.previewImageIpfsHash ? `ipfs://${options.previewImageIpfsHash}` : undefined,
                external_url: `https://platform-dna.vercel.app/nft-details/${options.contentId?.toString() || "unknown"}`,
                attributes: [
                    { trait_type: "Author Address", value: address },
                    { trait_type: "Registry Content ID", value: options.contentId?.toString() || "N/A" },
                    { trait_type: "Content Type", value: "Copy" },
                ],
                originalDocumentFileCID: options.mainDocumentIpfsHash,
                previewImageFileCID: options.previewImageIpfsHash,
            };

        } else {
          
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
            external_url: `https://platform-dna.vercel.app/nft-details/${
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
      if (registryReceiptError) {
          console.error("Dettagli errore ricevuta registrazione:", registryReceiptError);
          toast.error(`Errore nella registrazione del contenuto on-chain: ${registryReceiptError.message}`);
      } else if (registerContentError) {
          console.error("Dettagli errore writeContract registrazione:", registerContentError);
          toast.error(`Errore nella registrazione del contenuto on-chain: ${registerContentError.message}`);
      } else {
          toast.error("Errore nella registrazione del contenuto on-chain.");
      }
      setIsProcessing(false);
    }
  }, [
    isRegistrySuccess,
    isRegistryError,
    registryHash,
    publicClient,
    registryReceiptError,
    registerContentError
  ]);

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
    originalMetadata,
    nftContractAddressInRegistry,
    isRegisteringPending,
    isRegistering,
    isRegistrySuccess,
    registryHash,
    isSettingNftContract,
    isSetNftContractPending,
    handleFileUpload,
    handleSetNftContract,
    handleRegisterContent,
    resetForm,
    MINT_PRICE_ETH,
    ARBITRUM_SEPOLIA_CHAIN_ID,
    handleMetadataUpload,
    setIpfsPreviewImageCid,
    setIpfsMainDocumentCid,
  };
};


