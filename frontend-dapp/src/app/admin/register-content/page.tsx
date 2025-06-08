// frontend-dapp/src/app/admin/register-content/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { toast, Toaster } from 'react-hot-toast';
import {
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
  SCIENTIFIC_CONTENT_REGISTRY_ABI,
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  SCIENTIFIC_CONTENT_NFT_ABI,
  ARBITRUM_SEPOLIA_CHAIN_ID,
} from '@/lib/constants';
import { parseEther, isAddress, Abi } from 'viem';

// Interfaccia per il modello NftTemplate (assicurati che sia consistente con il tuo schema MongoDB)
interface NftTemplate {
  _id: string;
  name: string;
  description: string;
  metadataSchema: any;
  royaltyPercentage: number;
  saleOptions: 'fixed_price' | 'auction' | 'both';
  maxCopies: number;
}

export default function RegisterContentPage() {
  const [mounted, setMounted] = useState(false); // Nuovo stato per l'idratazione

  // Questo useEffect si esegue solo sul client, dopo il montaggio
  useEffect(() => {
    setMounted(true); // Imposta mounted a true una volta che il componente è sul client
  }, []);

  const { address, isConnected, chainId } = useAccount();
  const [templates, setTemplates] = useState<NftTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [contentTitle, setContentTitle] = useState<string>('');
  const [contentDescription, setContentDescription] = useState<string>('');
  const [maxCopies, setMaxCopies] = useState<number>(1);
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [metadataInputs, setMetadataInputs] = useState<Record<string, any>>({});
  const [ipfsMainFileCid, setIpfsMainFileCid] = useState<string | null>(null);
  const [ipfsMetadataCid, setIpfsMetadataCid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [registryContentId, setRegistryContentId] = useState<bigint | null>(null);

  // Wagmi hook per registrare contenuto nel ScientificContentRegistry
  const { data: registryHash, writeContract: registerContentContract } = useWriteContract();
  const { isLoading: isRegistering, isSuccess: isRegistrySuccess, isError: isRegistryError } = useWaitForTransactionReceipt({ hash: registryHash });

  // Wagmi hook per mintare NFT dal ScientificContentNFT
  const { data: mintHash, writeContract: mintNFTContract } = useWriteContract();
  const { isLoading: isMinting, isSuccess: isMintSuccess, isError: isMintError } = useWaitForTransactionReceipt({ hash: mintHash });

  // Per ottenere lo stato del ScientificContentRegistry e verificare che il NFT Contract sia impostato
  const { data: nftContractAddressInRegistry } = useReadContract({
      abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
      address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
      functionName: 'nftContract',
      chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
      query: {
          enabled: mounted && isConnected && chainId === ARBITRUM_SEPOLIA_CHAIN_ID, // Abilita solo se mounted
      },
  }) as { data: `0x${string}` | undefined };

  // Per un Admin, può voler impostare l'indirizzo del NFT contract nel Registry
  const { data: setNftContractHash, writeContract: setNftContractInRegistry } = useWriteContract();
  const { isLoading: isSettingNftContract, isSuccess: isSetNftContractSuccess } = useWaitForTransactionReceipt({ hash: setNftContractHash });

  // Fetch templates
  useEffect(() => {
    // Solo se mounted e c'è una connessione (se necessario)
    if (!mounted) return;

    const fetchTemplates = async () => {
      try {
        const res = await fetch('/api/admin/templates');
        const data = await res.json();
        if (data.success) {
          setTemplates(data.data);
          if (data.data.length > 0 && !selectedTemplateId) {
            setSelectedTemplateId(data.data[0]._id);
            setMaxCopies(data.data[0].maxCopies || 1);
          }
        } else {
          toast.error(data.message || 'Failed to fetch templates.');
        }
      } catch (err: any) {
        toast.error(err.message || 'Network error fetching templates.');
      }
    };
    fetchTemplates();
  }, [mounted]); // Aggiunto mounted come dipendenza

  // Quando un template è selezionato, inizializza i campi dei metadati e maxCopies
  useEffect(() => {
    const template = templates.find(t => t._id === selectedTemplateId);
    if (template) {
      if (template.metadataSchema && template.metadataSchema.properties) {
        const initialMetadata: Record<string, any> = {};
        for (const key in template.metadataSchema.properties) {
          initialMetadata[key] = '';
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

  // Handle file upload to IPFS via API Route
  const handleFileUpload = async (file: File) => {
    setError(null);
    setIsProcessing(true);
    toast('Uploading file to IPFS...', { icon: '⏳' });
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ipfs-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setIpfsMainFileCid(data.cid);
        toast.success(`File uploaded to IPFS: ${data.cid}`);
      } else {
        throw new Error(data.message || 'Failed to upload file to IPFS.');
      }
    } catch (err: any) {
      console.error('IPFS upload error:', err);
      setError(`Failed to upload file to IPFS: ${err.message}`);
      toast.error(`Failed to upload file to IPFS: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle metadata upload to IPFS via API Route
  const handleMetadataUpload = async () => {
    setError(null);
    setIsProcessing(true);
    toast('Uploading metadata to IPFS...', { icon: '⏳' });
    try {
      const template = templates.find(t => t._id === selectedTemplateId);
      if (!template) {
        throw new Error("No template selected.");
      }

      const fullMetadata = {
        name: contentTitle,
        description: contentDescription,
        authorAddress: address,
        authorName: 'Admin DnA',
        contentRegistryId: registryContentId ? registryContentId.toString() : 'N/A',
        ipfsMainFileCid: ipfsMainFileCid,
        templateId: selectedTemplateId,
        templateName: template.name,
        royaltyPercentage: template.royaltyPercentage,
        saleOptions: template.saleOptions,
        maxCopies: template.maxCopies,
        ...metadataInputs,
      };

      const formData = new FormData();
      const metadataBlob = new Blob([JSON.stringify(fullMetadata)], { type: 'application/json' });
      formData.append('file', metadataBlob, 'metadata.json');

      const res = await fetch('/api/ipfs-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setIpfsMetadataCid(data.cid);
        toast.success(`Metadata uploaded to IPFS: ${data.cid}`);
        return data.cid;
      } else {
        throw new Error(data.message || 'Failed to upload metadata to IPFS.');
      }
    } catch (err: any) {
      console.error('IPFS metadata upload error:', err);
      setError(`Failed to upload metadata to IPFS: ${err.message}`);
      toast.error(`Failed to upload metadata to IPFS: ${err.message}`);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  // Funzione per impostare l'indirizzo del ScientificContentNFT nel ScientificContentRegistry
  const handleSetNftContract = async () => {
      if (!isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID || !address) {
          toast.error("Connect to Arbitrum Sepolia with an admin account.");
          return;
      }
      if (nftContractAddressInRegistry && nftContractAddressInRegistry.toLowerCase() === SCIENTIFIC_CONTENT_NFT_ADDRESS.toLowerCase()) {
          toast.success("NFT Contract is already correctly set in Registry.");
          return;
      }
      if (nftContractAddressInRegistry && nftContractAddressInRegistry !== '0x0000000000000000000000000000000000000000') {
         toast.error("NFT Contract already set to a different address. Manual action needed if incorrect.");
         return;
      }

      try {
          toast('Setting NFT contract in Registry...', { icon: '⏳' });
          setNftContractInRegistry({
              abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
              address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
              functionName: 'setNFTContract',
              args: [SCIENTIFIC_CONTENT_NFT_ADDRESS],
          });
      } catch (err: any) {
          console.error("Error setting NFT contract in Registry:", err);
          toast.error(`Error: ${err.message}`);
      }
  };

  useEffect(() => {
      if (isSetNftContractSuccess) {
          toast.success('NFT Contract address set in ScientificContentRegistry successfully!');
      }
      if (setNftContractHash && isSetNftContractSuccess) {
          toast(`Transaction Hash: ${setNftContractHash}`, { icon: '✅' });
      }
  }, [isSetNftContractSuccess, setNftContractHash]);

  // Passaggio 1: Registra il contenuto nel Registry
  const handleRegisterContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID || !address) {
      toast.error("Connect to Arbitrum Sepolia with an admin account.");
      return;
    }
    if (!ipfsMainFileCid) {
      setError("Please upload the main content file to IPFS first.");
      toast.error("Please upload the main content file to IPFS first.");
      return;
    }
    if (!nftContractAddressInRegistry || nftContractAddressInRegistry.toLowerCase() !== SCIENTIFIC_CONTENT_NFT_ADDRESS.toLowerCase()) {
        setError("NFT Contract address not correctly set in Registry. Please set it first.");
        toast.error("NFT Contract address not correctly set in Registry. Please set it first.");
        return;
    }

    setIsProcessing(true);
    toast('Registering content on-chain...', { icon: '⏳' });

    try {
      registerContentContract({
        abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
        address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
        functionName: 'registerContent',
        args: [contentTitle, contentDescription, BigInt(maxCopies)],
      });
    } catch (err: any) {
      console.error("Error initiating registerContent:", err);
      setError(`Error initiating content registration: ${err.message}`);
      toast.error(`Error initiating content registration: ${err.message}`);
      setIsProcessing(false);
    }
  };

  // Monitora la transazione di registrazione del contenuto
  useEffect(() => {
    if (isRegistrySuccess && registryHash) {
      toast.success('Content registration transaction confirmed!');
      toast(`Tx Hash: ${registryHash}`, { icon: '🔗' });
      const getLatestContentId = async () => {
          try {
              const receipt = await (window as any).wagmiConfig.getClient().getPublicClient().getTransactionReceipt({ hash: registryHash });
              const contentRegisteredEvent = receipt.logs.find((log: { address: string; topics: string[]; data: string; }) =>
                  log.address.toLowerCase() === SCIENTIFIC_CONTENT_REGISTRY_ADDRESS.toLowerCase() &&
                  log.topics[0] === '0x995392576b51c1c11090333246738b8167f516a2c222df07b9a2444317f22ddb'
              );
              if (contentRegisteredEvent) {
                  const decodedLog = (window as any).wagmiConfig.getClient().getPublicClient().decodeEventLog({
                      abi: SCIENTIFIC_CONTENT_REGISTRY_ABI as Abi,
                      eventName: 'ContentRegistered',
                      topics: contentRegisteredEvent.topics,
                      data: contentRegisteredEvent.data
                  });
                  setRegistryContentId(decodedLog.args.contentId);
                  toast.success(`Content registered with ID: ${decodedLog.args.contentId.toString()}`);
                  setIsProcessing(false);
              } else {
                  console.warn("Could not find ContentRegistered event in transaction receipt. Please find content ID manually if needed.");
                  setError("Could not find ContentRegistered event. Manual check for content ID needed.");
                  toast.error("Content ID not found programmatically.");
                  setIsProcessing(false);
              }
          } catch (err: any) {
              console.error("Error fetching transaction receipt or decoding event:", err);
              setError(`Error fetching receipt/decoding event: ${err.message}`);
              toast.error(`Error fetching receipt/decoding event: ${err.message}`);
              setIsProcessing(false);
          }
      }
      getLatestContentId();
    }

    if (isRegistryError) {
      setError("Error registering content on-chain.");
      toast.error("Error registering content on-chain.");
      setIsProcessing(false);
    }
  }, [isRegistrySuccess, isRegistryError, registryHash]);

  // Passaggio 2: Mint dell'NFT (dopo aver registrato il contenuto)
  const handleMintNFT = async () => {
    setError(null);
    if (!registryContentId) {
      setError("Content not yet registered or ID not retrieved.");
      toast.error("Content not yet registered or ID not retrieved.");
      return;
    }
    if (!ipfsMainFileCid) {
        setError("Main content file not uploaded to IPFS.");
        toast.error("Main content file not uploaded to IPFS.");
        return;
    }

    setIsProcessing(true);
    toast('Minting NFT...', { icon: '⏳' });

    try {
      const metadataCid = await handleMetadataUpload();
      if (!metadataCid) {
        setIsProcessing(false);
        return;
      }
      setIpfsMetadataCid(metadataCid);

      mintNFTContract({
        abi: SCIENTIFIC_CONTENT_NFT_ABI as Abi,
        address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
        functionName: 'mintNFT',
        args: [registryContentId],
        value: parseEther('0.05'),
      });

    } catch (err: any) {
      console.error("Error initiating mintNFT:", err);
      setError(`Error initiating NFT mint: ${err.message}`);
      toast.error(`Error initiating NFT mint: ${err.message}`);
      setIsProcessing(false);
    }
  };

  // Monitora la transazione di minting dell'NFT
  useEffect(() => {
    if (isMintSuccess && mintHash) {
      toast.success('NFT Minting transaction confirmed!');
      toast(`Tx Hash: ${mintHash}`, { icon: '🔗' });
      setIsProcessing(false);
    }

    if (isMintError) {
      setError("Error minting NFT.");
      toast.error("Error minting NFT.");
      setIsProcessing(false);
    }
  }, [isMintSuccess, isMintError, mintHash]);

  // Helper per rendere i campi del form dinamici basati sullo schema del template
  const renderMetadataFields = () => {
    const template = templates.find(t => t._id === selectedTemplateId);
    if (!template || !template.metadataSchema || !template.metadataSchema.properties) return null;

    return Object.entries(template.metadataSchema.properties).map(([key, value]: [string, any]) => (
      <div key={key}>
        <label htmlFor={`metadata-${key}`} className="block text-sm font-medium text-gray-700">
          {key.charAt(0).toUpperCase() + key.slice(1)} ({value.type})
        </label>
        <input
          type={value.type === 'number' ? 'number' : 'text'}
          id={`metadata-${key}`}
          value={metadataInputs[key] || ''}
          onChange={(e) => setMetadataInputs({ ...metadataInputs, [key]: value.type === 'number' ? parseFloat(e.target.value) : e.target.value })}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          required={value.required}
        />
      </div>
    ));
  };

  // Se il componente non è ancora montato sul client, non renderizzare il contenuto dinamico.
  // Questo previene l'errore di idratazione iniziale.
  if (!mounted) {
    return (
      <div className="text-center p-8 bg-white rounded shadow-md">
        <p className="text-gray-700">Caricamento delle funzionalità di amministrazione...</p>
      </div>
    );
  }

  // Controllo preliminare per la connessione e la rete (solo dopo mounted)
  if (!isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
    return (
      <div className="text-center p-8 bg-white rounded shadow-md">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Wallet Non Connesso o Rete Errata</h2>
        <p className="text-gray-700">Connetti il tuo wallet MetaMask e assicurati che sia sulla testnet Arbitrum Sepolia per accedere alle funzioni di amministrazione.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Registra Contenuto e Minta NFT</h1>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* Sezione per impostare l'indirizzo del NFT Contract nel Registry */}
      <div className="bg-white p-6 rounded shadow-md mb-8">
            <h2 className="text-2xl font-semibold mb-4">Setup NFT Contract in ScientificContentRegistry (Solo Admin)</h2>
            <p className="mb-4">
                Contratto NFT Corrente nel Registry: <strong className={nftContractAddressInRegistry && nftContractAddressInRegistry !== '0x0000000000000000000000000000000000000000' ? 'text-green-600' : 'text-red-600'}>
                    {nftContractAddressInRegistry || 'Non Impostato'}
                </strong>
            </p>
            {/* Solo se l'indirizzo non è ancora impostato correttamente */}
            {(!nftContractAddressInRegistry || nftContractAddressInRegistry.toLowerCase() !== SCIENTIFIC_CONTENT_NFT_ADDRESS.toLowerCase()) && (
                <button
                    onClick={handleSetNftContract}
                    disabled={isSettingNftContract || !isConnected || chainId !== ARBITRUM_SEPOLIA_CHAIN_ID}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                    {isSettingNftContract ? 'Impostando...' : 'Imposta Indirizzo ScientificContentNFT nel Registry'}
                </button>
            )}
            {isSettingNftContract && <p className="mt-2 text-blue-500">Transazione in corso: {setNftContractHash}</p>}
            {isSetNftContractSuccess && <p className="mt-2 text-green-500">Contratto NFT impostato con successo!</p>}
            {/* Avviso se l'indirizzo è diverso da quello previsto ma non null */}
            {(nftContractAddressInRegistry && nftContractAddressInRegistry !== '0x0000000000000000000000000000000000000000' && nftContractAddressInRegistry.toLowerCase() !== SCIENTIFIC_CONTENT_NFT_ADDRESS.toLowerCase()) && (
                <p className="mt-2 text-red-500">Avviso: Il Contratto NFT è impostato su un indirizzo diverso. Potrebbe essere necessaria una correzione manuale tramite chiamata al contratto se questo è errato.</p>
            )}
      </div>


      <div className="bg-white p-6 rounded shadow-md mb-8">
        <h2 className="text-2xl font-semibold mb-4">Dettagli Contenuto e Minting NFT</h2>
        <form onSubmit={handleRegisterContent} className="space-y-4">
          <div>
            <label htmlFor="contentTitle" className="block text-sm font-medium text-gray-700">Titolo Contenuto</label>
            <input
              type="text"
              id="contentTitle"
              value={contentTitle}
              onChange={(e) => setContentTitle(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
          <div>
            <label htmlFor="contentDescription" className="block text-sm font-medium text-gray-700">Descrizione Contenuto</label>
            <textarea
              id="contentDescription"
              value={contentDescription}
              onChange={(e) => setContentDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            ></textarea>
          </div>

          {/* Il campo Max Copies ora viene popolato dal template, ma se non c'è template lo mostriamo comunque */}
          {(!selectedTemplateId) && ( // Mostra solo se nessun template selezionato
            <div>
              <label htmlFor="maxCopies" className="block text-sm font-medium text-gray-700">Copie Massime (NFTs)</label>
              <input
                type="number"
                id="maxCopies"
                value={maxCopies}
                onChange={(e) => setMaxCopies(parseInt(e.target.value, 10))}
                min="1"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                required
              />
            </div>
          )}


          {/* File Upload to IPFS */}
          <div>
            <label htmlFor="mainFile" className="block text-sm font-medium text-gray-700">File Principale Contenuto (es. PDF, Ricerca)</label>
            <input
              type="file"
              id="mainFile"
              onChange={(e) => setMainFile(e.target.files ? e.target.files[0] : null)}
              className="mt-1 block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
            />
            {mainFile && (
              <button
                type="button"
                onClick={() => mainFile && handleFileUpload(mainFile)}
                disabled={isProcessing || !mainFile}
                className="mt-2 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {isProcessing ? 'Caricando...' : 'Carica File su IPFS'}
              </button>
            )}
            {ipfsMainFileCid && <p className="mt-2 text-sm text-green-600">CID File: {ipfsMainFileCid}</p>}
          </div>

          {/* Template Selection and Dynamic Metadata Fields */}
          <div>
            <label htmlFor="template" className="block text-sm font-medium text-gray-700">Seleziona Template NFT</label>
            <select
              id="template"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            >
              <option value="">-- Seleziona un Template --</option>
              {templates.map((template) => (
                <option key={template._id} value={template._id}>{template.name} (Copie Max: {template.maxCopies}, Vendita: {template.saleOptions.replace('_', ' ')})</option>
              ))}
            </select>
          </div>
          {selectedTemplateId && (
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <h3 className="text-lg font-medium text-gray-800 mb-3">Metadati Specifici del Template</h3>
              {renderMetadataFields()}
            </div>
          )}

          <button
            type="submit"
            disabled={isProcessing || isRegistering || !ipfsMainFileCid || !selectedTemplateId || !nftContractAddressInRegistry || nftContractAddressInRegistry.toLowerCase() !== SCIENTIFIC_CONTENT_NFT_ADDRESS.toLowerCase()}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
          >
            {isRegistering ? 'Registrando Contenuto...' : 'Registra Contenuto On-Chain'}
          </button>
          {isRegistering && <p className="mt-2 text-blue-500">Transazione in corso: {registryHash}</p>}
        </form>

        {/* Mint NFT Button (appears after content registration) */}
        {registryContentId && !isProcessing && (
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h2 className="text-2xl font-semibold mb-4">Minta NFT per Contenuto Registrato (ID: {registryContentId.toString()})</h2>
            <button
              onClick={handleMintNFT}
              disabled={isProcessing || isMinting || !registryContentId || !ipfsMainFileCid}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isMinting ? 'Minting NFT...' : 'Minta NFT (0.05 ETH)'}
            </button>
            {isMinting && <p className="mt-2 text-blue-500">Transazione in corso: {mintHash}</p>}
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}