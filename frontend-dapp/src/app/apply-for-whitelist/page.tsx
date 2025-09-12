"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Link from "next/link";

interface FormData {
  name: string;
  email: string;
  institution: string;
  researchArea: string;
  biography: string;
  publicationsLink: string;
  linkedinProfile: string;
}

interface SubmissionResult {
  success: boolean;
  message: string;
  applicationId?: string;
  status?: "APPROVED" | "REJECTED" | "REVIEW_REQUIRED" | "PENDING" | "ERROR";
  llmScore?: number;
  llmComment?: string;
  approved?: boolean;
  transactionHash?: string;
}

const ARBISCAN_URL = "https://sepolia.arbiscan.io/tx/";
const ADMIN_EMAIL = "admin@tuodominio.com"; // SOSTITUISCI CON LA TUA EMAIL

// --- NUOVO COMPONENTE PER LA SCHERMATA DI CARICAMENTO ---
const PollingScreen = ({ applicationId }: { applicationId: string | null }) => {
  const loadingMessages = [
    "L'intelligenza artificiale sta analizzando la tua candidatura...",
    "Verifica delle credenziali accademiche in corso...",
    "Confronto con i criteri di approvazione...",
    "Se approvata, verrà preparata la transazione on-chain...",
    "La sicurezza e la verifica richiedono qualche istante...",
    "Grazie per la tua pazienza, stiamo quasi per concludere.",
  ];

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentMessageIndex(
        (prevIndex) => (prevIndex + 1) % loadingMessages.length
      );
    }, 4000); // Cambia messaggio ogni 4 secondi

    return () => clearInterval(intervalId); // Pulisce l'intervallo quando il componente viene smontato
  }, [loadingMessages.length]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white p-8 sm:p-12 rounded-2xl shadow-xl text-center">
        {/* Spinner migliorato */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
          <div className="absolute inset-0 border-t-4 border-blue-600 rounded-full animate-spin"></div>
          <div
            className="absolute inset-2 border-r-4 border-purple-500 rounded-full animate-spin"
            style={{ animationDuration: "1.2s" }}
          ></div>
        </div>

        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Elaborazione in Corso
        </h2>
        <p className="text-gray-600 mb-6">
          Il nostro sistema sta valutando la tua richiesta. Questo processo può
          richiedere dai 30 ai 60 secondi.
        </p>

        {/* Messaggio dinamico */}
        <div className="h-12 flex items-center justify-center p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700 transition-opacity duration-500">
            {loadingMessages[currentMessageIndex]}
          </p>
        </div>

        {applicationId && (
          <p className="text-xs text-gray-400 mt-8">
            ID Applicazione: <span className="font-mono">{applicationId}</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default function ApplyForWhitelist() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    institution: "",
    researchArea: "",
    biography: "",
    publicationsLink: "",
    linkedinProfile: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const checkApplicationStatus = async (appId: string) => {
    try {
      const response = await fetch(`/api/authors/status/${appId}`);
      if (response.ok) {
        const statusData = await response.json();
        if (statusData.status !== "PENDING") {
          setResult({
            success: statusData.status === "APPROVED",
            message: statusData.message || `Valutazione completata.`,
            applicationId: appId,
            llmScore: statusData.llmScore,
            llmComment: statusData.llmComment,
            approved: statusData.llmApproved,
            status: statusData.status,
            transactionHash: statusData.transactionHash,
          });
          setIsPolling(false);
          setSubmitted(true);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error("❌ Errore controllo stato:", error);
      return false;
    }
  };

  const startPolling = (appId: string) => {
    setIsPolling(true);
    setApplicationId(appId);

    const pollInterval = setInterval(async () => {
      const isCompleted = await checkApplicationStatus(appId);
      if (isCompleted) {
        clearInterval(pollInterval);
      }
    }, 3000); // Controlla ogni 3 secondi

    setTimeout(() => {
      // Non impostare errore se il polling è già terminato
      if (isPolling && !submitted) {
        clearInterval(pollInterval);
        setIsPolling(false);
        setError(
          "Timeout: l'elaborazione sta richiedendo più tempo del previsto. Ricarica la pagina per verificare lo stato."
        );
      }
    }, 120000); // Timeout 2 minuti
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) {
      setError("Indirizzo wallet non trovato. Assicurati di essere connesso.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/authors/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, walletAddress: address }),
      });
      const responseData = await response.json();
      if (!response.ok)
        throw new Error(responseData.message || "Si è verificato un errore.");

      if (responseData.applicationId) {
        startPolling(responseData.applicationId);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Componenti UI ----
  const renderResult = () => {
    if (!result) return null;

    let bgColor, borderColor, titleColor, title, icon;

    switch (result.status) {
      case "APPROVED":
        bgColor = "bg-green-50 border-green-200";
        titleColor = "text-green-800";
        title = "CANDIDATURA APPROVATA!";
        icon = "✅";
        break;
      case "REJECTED":
        bgColor = "bg-red-50 border-red-200";
        titleColor = "text-red-800";
        title = "CANDIDATURA RIFIUTATA";
        icon = "❌";
        break;
      case "REVIEW_REQUIRED":
        bgColor = "bg-yellow-50 border-yellow-200";
        titleColor = "text-yellow-800";
        title = "REVISIONE MANUALE RICHIESTA";
        icon = "⚠️";
        break;
      default:
        bgColor = "bg-gray-50 border-gray-200";
        titleColor = "text-gray-800";
        title = "STATO SCONOSCIUTO";
        icon = "❓";
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md text-center">
          <div className={`mb-6 p-4 rounded-lg border ${bgColor}`}>
            <h2 className={`text-3xl font-extrabold mb-2 ${titleColor}`}>
              {icon} {title}
            </h2>
            {result.llmScore !== undefined && (
              <div className="mt-4 text-left">
                <p className="font-semibold text-gray-700">
                  Score IA: {result.llmScore}/100
                </p>
                {result.llmComment && (
                  <div className="mt-2 p-3 bg-gray-100 rounded text-sm text-gray-700">
                    <strong>Commento IA:</strong> {result.llmComment}
                  </div>
                )}
              </div>
            )}
          </div>

          {result.status === "APPROVED" && (
            <div className="text-sm text-gray-600 mb-4">
              <p>
                Congratulazioni! La tua candidatura è stata approvata e il tuo
                indirizzo è stato aggiunto alla whitelist on-chain.
              </p>
              {result.transactionHash && (
                <p className="mt-2">
                  <strong>Hash Transazione:</strong>
                  <a
                    href={`${ARBISCAN_URL}${result.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 font-mono text-xs break-all text-blue-600 hover:underline"
                  >
                    {result.transactionHash}
                  </a>
                </p>
              )}
            </div>
          )}
          {result.status === "REJECTED" && (
            <div className="text-sm text-gray-600 mb-4">
              <p>
                Siamo spiacenti, ma la tua candidatura non ha raggiunto il
                punteggio minimo per l'approvazione automatica.
              </p>
              <p className="mt-2">
                Se credi ci sia stato un errore, puoi richiedere una revisione
                manuale.
              </p>
              <a
                href={`mailto:${ADMIN_EMAIL}?subject=Richiesta Revisione Candidatura: ${result.applicationId}&body=Vorrei richiedere una revisione manuale della mia candidatura con ID: ${result.applicationId}. Wallet: ${address}`}
                className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Richiedi Revisione Manuale
              </a>
            </div>
          )}
          {result.status === "REVIEW_REQUIRED" && (
            <div className="text-sm text-gray-600 mb-4">
              <p>
                La valutazione dell'IA non è stata conclusiva. Un membro del
                nostro team esaminerà la tua candidatura al più presto.
              </p>
              <p className="mt-2">
                Se non ricevi notizie entro 48 ore, puoi contattare il supporto.
              </p>
              <a
                href={`mailto:${ADMIN_EMAIL}?subject=Info su Candidatura in Revisione: ${result.applicationId}`}
                className="mt-4 inline-block px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
              >
                Contatta il Supporto
              </a>
            </div>
          )}

          {result.applicationId && (
            <p className="text-xs text-gray-500 my-6">
              ID Applicazione: {result.applicationId}
            </p>
          )}
          <Link
            href="/"
            className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Torna alla Home
          </Link>
        </div>
      </div>
    );
  };

  // --- Rendering Condizionale ---
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Wallet non connesso
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Per accedere a questa sezione, connetti prima il tuo wallet.
          </p>
        </div>
      </div>
    );
  }

  if (isPolling) {
    return <PollingScreen applicationId={applicationId} />;
  }

  if (submitted) return renderResult();

  // --- Form di Candidatura (invariato) ---
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900">
              Candidatura Autore Verificato
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Compila questo modulo per avviare il processo di verifica
              automatica con AI.
            </p>
            <div className="mt-4 p-3 bg-blue-50 rounded-md text-sm text-blue-800">
              <strong>Wallet connesso:</strong>{" "}
              <span className="font-mono text-xs break-all">{address}</span>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                Nome e Cognome *
              </label>
              <input
                type="text"
                name="name"
                id="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Indirizzo Email *
              </label>
              <input
                type="email"
                name="email"
                id="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="institution"
                className="block text-sm font-medium text-gray-700"
              >
                Istituzione/Università *
              </label>
              <input
                type="text"
                name="institution"
                id="institution"
                required
                value={formData.institution}
                onChange={handleInputChange}
                placeholder="es. Università di Roma, Dipartimento di Informatica"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="researchArea"
                className="block text-sm font-medium text-gray-700"
              >
                Area di Ricerca *
              </label>
              <input
                type="text"
                name="researchArea"
                id="researchArea"
                required
                value={formData.researchArea}
                onChange={handleInputChange}
                placeholder="es. Intelligenza Artificiale, Bioinformatica"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="biography"
                className="block text-sm font-medium text-gray-700"
              >
                Biografia Professionale *{" "}
                <span className="text-xs text-gray-500">
                  (min. 200 caratteri - {formData.biography.length}/200)
                </span>
              </label>
              <textarea
                name="biography"
                id="biography"
                required
                rows={6}
                value={formData.biography}
                onChange={handleInputChange}
                minLength={200}
                placeholder="Descrivi la tua carriera accademica..."
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 ${
                  formData.biography.length < 200
                    ? "border-red-300"
                    : "border-gray-300"
                }`}
              />
              {formData.biography.length < 200 && (
                <p className="text-xs text-red-600 mt-1">
                  Ancora {200 - formData.biography.length} caratteri necessari
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="publicationsLink"
                className="block text-sm font-medium text-gray-700"
              >
                Link a Pubblicazioni
              </label>
              <input
                type="url"
                name="publicationsLink"
                id="publicationsLink"
                value={formData.publicationsLink}
                onChange={handleInputChange}
                placeholder="https://scholar.google.com/citations?user=..."
                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm"
              />
            </div>
            <div>
              <label
                htmlFor="linkedinProfile"
                className="block text-sm font-medium text-gray-700"
              >
                Profilo LinkedIn
              </label>
              <input
                type="url"
                name="linkedinProfile"
                id="linkedinProfile"
                value={formData.linkedinProfile}
                onChange={handleInputChange}
                placeholder="https://www.linkedin.com/in/..."
                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm"
              />
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <div className="text-xs text-gray-500">* Campi obbligatori</div>
              <button
                type="submit"
                disabled={isSubmitting || formData.biography.length < 200}
                className="px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? "⏳ In elaborazione..."
                  : "🚀 Invia per Valutazione AI"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
