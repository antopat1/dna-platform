// frontend-dapp/src/app/admin/register-content/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { toast } from "react-hot-toast";
import { useRegisterContent } from "@/hooks/useRegisterContent";
import { useIsMounted } from "@/hooks/useIsMounted";
import { useRouter } from "next/navigation";
import { parseEther } from "viem";
import {
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  ARBITRUM_SEPOLIA_CHAIN_ID,
} from "@/lib/constants";
import {
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

console.log("Componente RegisterContentPage caricato.");

export default function RegisterContentPage() {
  const mounted = useIsMounted();
  const router = useRouter();

  console.log("RegisterContentPage: Inizio del render.");

  const {
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
    resetForm,
    MINT_PRICE_ETH,
  } = useRegisterContent();

  const [showOptionalMetadata, setShowOptionalMetadata] = useState(false);
  const [currentMintedCount, setCurrentMintedCount] = useState(0);

  console.log("RegisterContentPage: Stati attuali:", {
    isConnected,
    chainId,
    address,
    isProcessing,
    registryContentId: registryContentId?.toString(),
    mintedTokenId: mintedTokenId?.toString(),
    isMintingFulfilled,
    mintingFulfillmentTxHash,
    error,
    mintingRevertReason,
    currentMintedCount,
    maxCopies,
  });

  const PINATA_GATEWAY_SUBDOMAIN =
    process.env.NEXT_PUBLIC_PINATA_GATEWAY_SUBDOMAIN ||
    "your-default-subdomain";

  useEffect(() => {
    console.log("RegisterContentPage: useEffect - Mounted status:", mounted);
  }, [mounted]);

  // Effetto per aggiornare il conteggio dei mint quando un mint è completato con successo
  useEffect(() => {
    console.log(
      "RegisterContentPage: useEffect - Checking isMintingFulfilled and mintedTokenId for count update."
    );
    if (isMintingFulfilled && mintedTokenId) {
      console.log(
        `RegisterContentPage: Minting Fulfilled! Token ID: ${mintedTokenId.toString()}. Aggiornamento conteggio.`
      );
      setCurrentMintedCount((prev) => prev + 1);
      console.log(
        `RegisterContentPage: Nuovo conteggio mintati: ${
          currentMintedCount + 1
        }`
      );
    }
  }, [isMintingFulfilled, mintedTokenId]); // Dipende solo dallo stato dell'ultimo mint

  const isNftContractSetCorrectly =
    nftContractAddressInRegistry?.toLowerCase() ===
    SCIENTIFIC_CONTENT_NFT_ADDRESS.toLowerCase();

  const isFormReadyForRegistration =
    ipfsMainDocumentCid &&
    ipfsPreviewImageCid &&
    contentTitle &&
    contentDescription &&
    selectedTemplateId &&
    maxCopies >= 1 &&
    maxCopies <= 5 &&
    isNftContractSetCorrectly;

  const isReadyForMinting =
    registryContentId &&
    ipfsMainDocumentCid &&
    ipfsPreviewImageCid &&
    isRegistrySuccess &&
    currentMintedCount < maxCopies;

  const buildIpfsUrl = (cid: string | undefined | null) => {
    if (!cid) return "";
    if (
      cid.startsWith("http://") ||
      cid.startsWith("https://") ||
      cid.startsWith("ipfs://")
    ) {
      return cid;
    }
    return `https://${PINATA_GATEWAY_SUBDOMAIN}.mypinata.cloud/ipfs/${cid}`;
  };

  const handleFullReset = () => {
    console.log(
      "RegisterContentPage: handleFullReset chiamato. Resetto form e contatore."
    );
    resetForm();
    setCurrentMintedCount(0);
  };

  // Funzione di reset che ricarica completamente la pagina
  const resetAll = () => {
    window.location.reload();
  };

  const renderMetadataFields = () => {
    const template = templates.find((t) => t._id === selectedTemplateId);
    if (
      !template ||
      !template.metadataSchema ||
      !template.metadataSchema.properties
    ) {
      console.log(
        "RegisterContentPage: Nessun template selezionato o schema metadati non valido."
      );
      return null;
    }
    console.log(
      "RegisterContentPage: Rendering campi metadati per template:",
      template.name
    );

    const properties = template.metadataSchema.properties;
    const requiredFields = template.metadataSchema.required || [];

    const fieldsToRender = Object.entries(properties).filter(([key]) => {
      const isRequired = requiredFields.includes(key);
      return isRequired || showOptionalMetadata;
    });

    if (fieldsToRender.length === 0 && !showOptionalMetadata) {
      return (
        <p className="text-gray-500 italic text-sm">
          Nessun campo metadato specifico richiesto per questo template, o i
          campi opzionali sono nascosti.
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {fieldsToRender.map(([key, value]: [string, any]) => (
          <div key={key}>
            <label
              htmlFor={`metadata-${key}`}
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              {value.title ||
                key.charAt(0).toUpperCase() +
                  key
                    .slice(1)
                    .replace(/([A-Z])/g, " $1")
                    .trim()}
              {requiredFields.includes(key) && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            <p className="text-sm text-gray-500 mb-2">{value.description}</p>
            {key === "image" && (
              <p className="text-xs text-blue-600 mb-2 bg-blue-50 p-2 rounded-md border border-blue-200">
                **Importante:** Inserisci solo il **CID** dell'immagine IPFS. Il
                link completo verrà generato automaticamente. (es. per
                `https://bafkreiglnzp25a5vvqnwldex7x77kvowdxwhnhhemrleoq4rsce77xkfiq.ipfs.dweb.link/`
                inserisci solo
                `bafkreiglnzp25a5vvqnwldex7x77kvowdxwhnhhemrleoq4rsce77xkfiq`)
              </p>
            )}
            {value.type === "string" && (
              <input
                type="text"
                id={`metadata-${key}`}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                value={metadataInputs[key] || ""}
                onChange={(e) =>
                  setMetadataInputs({
                    ...metadataInputs,
                    [key]: e.target.value,
                  })
                }
                required={requiredFields.includes(key)}
                disabled={isProcessing || isRegistrySuccess}
              />
            )}
            {value.type === "number" && (
              <input
                type="number"
                id={`metadata-${key}`}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                value={metadataInputs[key] || ""}
                onChange={(e) =>
                  setMetadataInputs({
                    ...metadataInputs,
                    [key]: parseFloat(e.target.value) || "",
                  })
                }
                required={requiredFields.includes(key)}
                disabled={isProcessing || isRegistrySuccess}
              />
            )}
          </div>
        ))}
        {Object.entries(properties).some(
          ([key]) => !requiredFields.includes(key)
        ) && (
          <button
            type="button"
            onClick={() => {
              setShowOptionalMetadata(!showOptionalMetadata);
              console.log(
                `RegisterContentPage: Toggling optional metadata. Now: ${!showOptionalMetadata}`
              );
            }}
            className="text-blue-600 hover:underline text-sm mt-4 flex items-center"
            disabled={isProcessing || isRegistrySuccess}
          >
            {showOptionalMetadata
              ? "Nascondi campi opzionali"
              : "Mostra campi opzionali"}
            <InformationCircleIcon className="w-4 h-4 ml-1" />
          </button>
        )}
      </div>
    );
  };

  const currentChainIsArbitrumSepolia = chainId === ARBITRUM_SEPOLIA_CHAIN_ID;
  console.log(
    `RegisterContentPage: Chain ID: ${chainId}, Is Arbitrum Sepolia: ${currentChainIsArbitrumSepolia}`
  );

  console.log("RegisterContentPage: Fine del render.");

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <Toaster position="bottom-right" reverseOrder={false} />

      <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">
        Registra Contenuto & Minting NFT
      </h1>

      {/* Pulsanti Globali di Navigazione */}
      <div className="flex justify-center space-x-4 mb-8">
        <button
          onClick={() => {
            router.push("/admin/registered-content");
            console.log(
              "RegisterContentPage: Cliccato 'Accedi ai Contenuti Registrati'."
            );
          }}
          className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-all duration-300"
        >
          Accedi ai Contenuti Registrati
        </button>
        <button
          onClick={handleFullReset}
          className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-300"
        >
          Azzera Form
        </button>
      </div>

      {!mounted && (
        <div className="bg-white p-6 rounded-xl shadow-lg text-center text-lg text-gray-600">
          Caricamento...
        </div>
      )}

      {mounted && (
        <>
          {!isConnected && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl shadow-md text-center">
              <p className="font-semibold text-lg mb-2">Wallet non Connesso</p>
              <p>
                Per favore, connetti il tuo wallet per accedere a questa
                funzionalità.
              </p>
            </div>
          )}

          {isConnected && !currentChainIsArbitrumSepolia && (
            <div className="bg-orange-50 border border-orange-200 text-orange-700 p-4 rounded-xl shadow-md text-center">
              <p className="font-semibold text-lg mb-2">Rete Sbagliata</p>
              <p>Connettiti alla rete Arbitrum Sepolia per procedere.</p>
            </div>
          )}

          {isConnected && currentChainIsArbitrumSepolia && (
            <div className="max-w-4xl mx-auto space-y-8">
              {/* NFT Contract Registry Status */}
              <div className="bg-white p-8 rounded-xl shadow-2xl border border-blue-100 relative">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                  <span className="bg-blue-500 text-white rounded-full p-2 mr-3 shadow-md">
                    <InformationCircleIcon className="w-6 h-6" />
                  </span>
                  Stato del Contratto NFT nel Registry
                </h2>
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-md text-gray-700 font-medium flex items-center">
                    Indirizzo NFT nel Registry:
                    <span className="ml-2 font-mono bg-gray-200 px-3 py-1 rounded-md text-sm text-gray-800 break-all">
                      {nftContractAddressInRegistry || "Non impostato"}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          nftContractAddressInRegistry || ""
                        );
                        console.log(
                          "RegisterContentPage: Copia indirizzo NFT Registry."
                        );
                      }}
                      className="ml-2 p-1 rounded-full text-gray-500 hover:bg-gray-200 transition"
                      title="Copia Indirizzo"
                      disabled={!nftContractAddressInRegistry}
                    >
                      <DocumentDuplicateIcon className="w-5 h-5" />
                    </button>
                  </p>
                  <div className="flex items-center space-x-2">
                    {isNftContractSetCorrectly ? (
                      <span className="text-green-600 flex items-center">
                        <CheckCircleIcon className="w-6 h-6 mr-1" /> Corretto
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center">
                        <XCircleIcon className="w-6 h-6 mr-1" /> Non Corretto /
                        Non impostato
                      </span>
                    )}
                  </div>
                </div>
                {!isNftContractSetCorrectly && (
                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
                    <p className="text-yellow-800 text-sm">
                      L'indirizzo del contratto NFT non è impostato
                      correttamente nel Registry. È necessario impostarlo per
                      poter registrare contenuti.
                    </p>
                    <button
                      onClick={() => {
                        handleSetNftContract();
                        console.log(
                          "RegisterContentPage: Cliccato 'Imposta NFT Contract'."
                        );
                      }}
                      disabled={isSetNftContractPending || isSettingNftContract}
                      className="ml-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {isSetNftContractPending || isSettingNftContract ? (
                        <>
                          <ArrowPathIcon className="animate-spin w-5 h-5 mr-2" />
                          Impostazione...
                        </>
                      ) : (
                        "Imposta NFT Contract"
                      )}
                    </button>
                  </div>
                )}
                {nftContractAddressInRegistry && !isNftContractSetCorrectly && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                    **Attenzione:** L'indirizzo del Contratto NFT nel Registry
                    è:{" "}
                    <span className="font-mono break-all">
                      {nftContractAddressInRegistry}
                    </span>
                    <br />
                    L'indirizzo atteso è:{" "}
                    <span className="font-mono break-all">
                      {SCIENTIFIC_CONTENT_NFT_ADDRESS}
                    </span>
                    <br />
                    **Non corrispondono.** Per favore, imposta l'indirizzo
                    corretto.
                  </div>
                )}
              </div>

              {/* Registration Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRegisterContent(e);
                  console.log(
                    "RegisterContentPage: Cliccato 'Registra Contenuto'."
                  );
                }}
                className="bg-white p-8 rounded-xl shadow-2xl border border-indigo-100"
              >
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                  <span className="bg-indigo-500 text-white rounded-full p-2 mr-3 shadow-md">
                    <InformationCircleIcon className="w-6 h-6" />
                  </span>
                  Dettagli Contenuto
                </h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Contenuto principale */}
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="contentTitle"
                        className="block text-sm font-semibold text-gray-700 mb-1"
                      >
                        Titolo del Contenuto{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="contentTitle"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 disabled:bg-gray-100 disabled:text-gray-500"
                        value={contentTitle}
                        onChange={(e) => setContentTitle(e.target.value)}
                        required
                        disabled={isProcessing || isRegistrySuccess}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="contentDescription"
                        className="block text-sm font-semibold text-gray-700 mb-1"
                      >
                        Descrizione del Contenuto{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="contentDescription"
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 disabled:bg-gray-100 disabled:text-gray-500"
                        value={contentDescription}
                        onChange={(e) => setDescriptionContent(e.target.value)}
                        required
                        disabled={isProcessing || isRegistrySuccess}
                      ></textarea>
                    </div>
                    <div>
                      <label
                        htmlFor="maxCopies"
                        className="block text-sm font-semibold text-gray-700 mb-1"
                      >
                        Numero Massimo di Copie (NFT){" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        id="maxCopies"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 disabled:bg-gray-100 disabled:text-gray-500"
                        value={maxCopies}
                        onChange={(e) =>
                          setMaxCopies(
                            Math.min(
                              5,
                              Math.max(1, parseInt(e.target.value) || 1)
                            )
                          )
                        }
                        min="1"
                        max="5"
                        required
                        disabled={isProcessing || isRegistrySuccess}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Il numero massimo di copie deve essere tra 1 e 5.
                      </p>
                    </div>
                  </div>

                  {/* Selezione Template e Caricamento File */}
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="templateSelect"
                        className="block text-sm font-semibold text-gray-700 mb-1"
                      >
                        Seleziona un Template NFT{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="templateSelect"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                        value={selectedTemplateId}
                        onChange={(e) => {
                          setSelectedTemplateId(e.target.value);
                          console.log(
                            "RegisterContentPage: Selezionato template ID:",
                            e.target.value
                          );
                        }}
                        required
                        disabled={isProcessing || isRegistrySuccess}
                      >
                        <option value="">Seleziona un template...</option>
                        {templates.map((template) => (
                          <option key={template._id} value={template._id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Caricamento Immagine di Anteprima */}
                    <div>
                      <label
                        htmlFor="previewImage"
                        className="block text-sm font-semibold text-gray-700 mb-1"
                      >
                        Immagine di Anteprima (Copertina NFT){" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="file"
                        id="previewImage"
                        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:file:bg-gray-200"
                        accept="image/*"
                        onChange={(e) => {
                          setPreviewImage(
                            e.target.files ? e.target.files[0] : null
                          );
                          console.log(
                            "RegisterContentPage: File previewImage selezionato:",
                            e.target.files ? e.target.files[0].name : "Nessuno"
                          );
                        }}
                        disabled={isProcessing || isRegistrySuccess}
                        required
                      />
                      {previewImage && (
                        <button
                          type="button"
                          onClick={() => {
                            handleFileUpload(previewImage, "preview");
                            console.log(
                              "RegisterContentPage: Cliccato 'Carica Anteprima su IPFS'."
                            );
                          }}
                          disabled={
                            isProcessing ||
                            ipfsPreviewImageCid !== null ||
                            isRegistrySuccess
                          }
                          className="mt-2 px-4 py-2 bg-green-500 text-white rounded-lg shadow hover:bg-green-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {ipfsPreviewImageCid
                            ? "Caricato!"
                            : isProcessing
                            ? "Caricamento..."
                            : "Carica Anteprima su IPFS"}
                        </button>
                      )}
                      {ipfsPreviewImageCid && (
                        <p className="mt-2 text-sm text-gray-600 flex items-center">
                          CID Immagine:{" "}
                          <span className="font-mono text-xs ml-2 break-all">
                            {ipfsPreviewImageCid}
                          </span>
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(
                                buildIpfsUrl(ipfsPreviewImageCid)
                              )
                            }
                            className="ml-2 p-1 rounded-full text-gray-500 hover:bg-gray-200 transition"
                            title="Copia URL IPFS"
                          >
                            <DocumentDuplicateIcon className="w-4 h-4" />
                          </button>
                          <a
                            href={buildIpfsUrl(ipfsPreviewImageCid)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-500 hover:underline text-xs"
                          >
                            Vedi
                          </a>
                        </p>
                      )}
                    </div>

                    {/* Caricamento Documento Principale */}
                    <div>
                      <label
                        htmlFor="mainDocument"
                        className="block text-sm font-semibold text-gray-700 mb-1"
                      >
                        Documento Principale (PDF, etc.){" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="file"
                        id="mainDocument"
                        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:file:bg-gray-200"
                        accept="application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e) => {
                          setMainDocument(
                            e.target.files ? e.target.files[0] : null
                          );
                          console.log(
                            "RegisterContentPage: File mainDocument selezionato:",
                            e.target.files ? e.target.files[0].name : "Nessuno"
                          );
                        }}
                        disabled={isProcessing || isRegistrySuccess}
                        required
                      />
                      {mainDocument && (
                        <button
                          type="button"
                          onClick={() => {
                            handleFileUpload(mainDocument, "document");
                            console.log(
                              "RegisterContentPage: Cliccato 'Carica Documento su IPFS'."
                            );
                          }}
                          disabled={
                            isProcessing ||
                            ipfsMainDocumentCid !== null ||
                            isRegistrySuccess
                          }
                          className="mt-2 px-4 py-2 bg-green-500 text-white rounded-lg shadow hover:bg-green-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {ipfsMainDocumentCid
                            ? "Caricato!"
                            : isProcessing
                            ? "Caricamento..."
                            : "Carica Documento su IPFS"}
                        </button>
                      )}
                      {ipfsMainDocumentCid && (
                        <p className="mt-2 text-sm text-gray-600 flex items-center">
                          CID Documento:{" "}
                          <span className="font-mono text-xs ml-2 break-all">
                            {ipfsMainDocumentCid}
                          </span>
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(
                                buildIpfsUrl(ipfsMainDocumentCid)
                              )
                            }
                            className="ml-2 p-1 rounded-full text-gray-500 hover:bg-gray-200 transition"
                            title="Copia URL IPFS"
                          >
                            <DocumentDuplicateIcon className="w-4 h-4" />
                          </button>
                          <a
                            href={buildIpfsUrl(ipfsMainDocumentCid)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-500 hover:underline text-xs"
                          >
                            Vedi
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metadati Specifici del Template */}
                {selectedTemplateId && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                      <span className="bg-purple-500 text-white rounded-full p-1.5 mr-2 shadow-md">
                        <InformationCircleIcon className="w-5 h-5" />
                      </span>
                      Metadati Specifici del Template
                    </h3>
                    {renderMetadataFields()}
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <div
                    className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-sm text-sm"
                    role="alert"
                  >
                    <p className="font-semibold">Errore:</p>
                    <p>{error}</p>
                  </div>
                )}
                {mintingRevertReason && (
                  <div
                    className="mt-6 p-4 bg-orange-100 border border-orange-400 text-orange-700 rounded-lg shadow-sm text-sm"
                    role="alert"
                  >
                    <p className="font-semibold">Errore di Minting:</p>
                    <p>{mintingRevertReason}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-8 flex justify-end space-x-4">
                  <button
                    type="submit"
                    disabled={
                      !isFormReadyForRegistration ||
                      isProcessing ||
                      isRegistrySuccess ||
                      isRegisteringPending ||
                      isRegistering
                    }
                    className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isRegisteringPending || isRegistering ? (
                      <>
                        <ArrowPathIcon className="animate-spin w-5 h-5 mr-3" />
                        Registrazione in corso...
                      </>
                    ) : (
                      "Registra Contenuto"
                    )}
                  </button>
                </div>
              </form>

              {/* Minting Section (conditionally rendered) */}
              {registryContentId && isRegistrySuccess && (
                <div className="bg-white p-8 rounded-xl shadow-2xl border border-green-100">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                    <span className="bg-green-500 text-white rounded-full p-2 mr-3 shadow-md">
                      <CheckCircleIcon className="w-6 h-6" />
                    </span>
                    Minting NFT
                  </h2>
                  <div className="mb-4 bg-green-50 p-4 rounded-lg border border-green-200 text-green-800 flex items-center">
                    <InformationCircleIcon className="w-6 h-6 mr-3 text-green-600" />
                    <p className="text-lg font-medium">
                      Contenuto Registrato! ID:{" "}
                      <span className="font-mono">
                        {registryContentId.toString()}
                      </span>
                    </p>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          registryContentId.toString()
                        )
                      }
                      className="ml-2 p-1 rounded-full text-green-700 hover:bg-green-100 transition"
                      title="Copia Content ID"
                    >
                      <DocumentDuplicateIcon className="w-5 h-5" />
                    </button>
                  </div>

                  {!ipfsMetadataCid && (
                    <p className="text-gray-700 mb-4">
                      Ora che il contenuto è registrato, possiamo procedere al
                      minting del tuo NFT. Il processo includerà il caricamento
                      dei metadati su IPFS.
                    </p>
                  )}
                  {ipfsMetadataCid && (
                    <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-200 text-blue-800 text-sm flex items-center">
                      <InformationCircleIcon className="w-5 h-5 mr-2 text-blue-600" />
                      Metadati NFT caricati su IPFS:{" "}
                      <span className="font-mono ml-2 break-all">
                        {ipfsMetadataCid}
                      </span>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(
                            buildIpfsUrl(ipfsMetadataCid)
                          )
                        }
                        className="ml-2 p-1 rounded-full text-blue-700 hover:bg-blue-100 transition"
                        title="Copia URL Metadati"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                      </button>
                      <a
                        href={buildIpfsUrl(ipfsMetadataCid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-500 hover:underline text-xs"
                      >
                        Vedi
                      </a>
                    </div>
                  )}
                  <div className="mt-6 flex justify-end space-x-4">
                    {/* Visualizza il conteggio dei mint */}
                    <p className="flex items-center text-gray-700 font-semibold text-lg">
                      Mintati: {currentMintedCount} / {maxCopies}
                    </p>
                    <button
                      onClick={() => {
                        handleRequestMintForNewContent();
                        console.log(
                          "RegisterContentPage: Cliccato 'Richiedi Minting NFT'."
                        );
                      }}
                      disabled={
                        !isReadyForMinting ||
                        isProcessing ||
                        isRequestMintPending ||
                        isRequestingMint
                      }
                      className="px-8 py-3 bg-purple-600 text-white font-bold rounded-lg shadow-xl hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isRequestMintPending || isRequestingMint ? (
                        <>
                          <ArrowPathIcon className="animate-spin w-5 h-5 mr-3" />
                          Richiesta Minting in corso...
                        </>
                      ) : (
                        `Richiedi Minting NFT (${MINT_PRICE_ETH} ETH)`
                      )}
                    </button>
                  </div>

                  {isMintingFulfilled && (
                    <div className="mt-6 p-6 bg-green-100 border border-green-400 text-green-800 rounded-lg shadow-lg">
                      <p className="font-bold text-2xl mb-4 flex items-center">
                        <CheckCircleIcon className="w-8 h-8 mr-3 text-green-600" />
                        NFT Mintato con Successo!
                      </p>
                      <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
                        {mintedNftImageUrl && (
                          <div className="flex-shrink-0">
                            <img
                              src={buildIpfsUrl(mintedNftImageUrl)}
                              alt={originalMetadata.name || "NFT Preview"}
                              className="w-32 h-32 object-cover rounded-lg shadow-md border border-green-300"
                            />
                          </div>
                        )}
                        <div className="text-lg">
                          <p>
                            **Titolo:**{" "}
                            <span className="font-semibold">
                              {originalMetadata.name || contentTitle}
                            </span>
                          </p>
                          <p className="mt-2">
                            **Token ID:**{" "}
                            <span className="font-mono font-bold text-green-900">
                              {mintedTokenId?.toString()}
                            </span>
                            <button
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  mintedTokenId?.toString() || ""
                                )
                              }
                              className="ml-2 p-1 rounded-full text-green-700 hover:bg-green-200 transition"
                              title="Copia Token ID"
                            >
                              <DocumentDuplicateIcon className="w-5 h-5" />
                            </button>
                          </p>
                          {mintingFulfillmentTxHash && (
                            <p className="mt-2 text-sm text-gray-700">
                              Hash Transazione Minting:{" "}
                              <a
                                href={`https://sepolia.arbiscan.io/tx/${mintingFulfillmentTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline font-mono break-all"
                              >
                                {mintingFulfillmentTxHash.substring(0, 10)}...
                                {mintingFulfillmentTxHash.length > 18
                                  ? mintingFulfillmentTxHash.substring(
                                      mintingFulfillmentTxHash.length - 8
                                    )
                                  : mintingFulfillmentTxHash}
                              </a>
                            </p>
                          )}
                          <p className="mt-4 text-gray-700">
                            Il tuo NFT è ora disponibile sulla blockchain di
                            Arbitrum Sepolia.
                          </p>
                        </div>
                      </div>
                      {/* Messaggio per mint multipli */}
                      {currentMintedCount < maxCopies && (
                        <p className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm flex items-center">
                          <InformationCircleIcon className="w-5 h-5 mr-2" />
                          Puoi mintare ancora {maxCopies -
                            currentMintedCount}{" "}
                          copia/e di questo contenuto. Premi "Richiedi Minting
                          NFT" nuovamente.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-center mt-6">
                {" "}
                {/* Aggiungi un div per centrare il pulsante */}
                <button
                  onClick={resetAll}
                  className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-all duration-300"
                >
                  Riavvia processo registrazione Contenuto
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
