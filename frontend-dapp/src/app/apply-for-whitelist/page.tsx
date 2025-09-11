'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import Link from 'next/link'

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
  llmScore?: number;
  llmComment?: string;
  approved?: boolean;
}

export default function ApplyForWhitelist() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    institution: '',
    researchArea: '',
    biography: '',
    publicationsLink: '',
    linkedinProfile: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<SubmissionResult | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [applicationId, setApplicationId] = useState<string | null>(null)

  // Funzione per controllare lo stato dell'applicazione
  const checkApplicationStatus = async (appId: string) => {
    try {
      console.log('🔄 Checking status for application:', appId);
      
      const response = await fetch(`/api/authors/status/${appId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const statusData = await response.json();
        console.log('📊 Status data:', statusData);
        
        if (statusData.status !== 'PENDING') {
          // L'elaborazione è completata
          setResult({
            success: true,
            message: `Candidatura ${statusData.status === 'APPROVED' ? 'APPROVATA' : 'RIFIUTATA'} dall'IA.`,
            applicationId: appId,
            llmScore: statusData.llmScore,
            llmComment: statusData.llmComment,
            approved: statusData.status === 'APPROVED'
          });
          setIsPolling(false);
          setSubmitted(true);
          return true; // Elaborazione completata
        }
      }
      return false; // Ancora in elaborazione
    } catch (error) {
      console.error('❌ Error checking status:', error);
      return false;
    }
  };

  // Polling per controllare lo stato
  const startPolling = (appId: string) => {
    setIsPolling(true);
    setApplicationId(appId);
    
    const pollInterval = setInterval(async () => {
      const isCompleted = await checkApplicationStatus(appId);
      if (isCompleted) {
        clearInterval(pollInterval);
      }
    }, 2000); // Controlla ogni 2 secondi

    // Timeout dopo 2 minuti
    setTimeout(() => {
      clearInterval(pollInterval);
      if (isPolling) {
        setIsPolling(false);
        setError('Timeout: l\'elaborazione sta richiedendo più tempo del previsto.');
      }
    }, 120000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address) {
        setError("Indirizzo wallet non trovato. Assicurati di essere connesso.");
        return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
      console.log('📤 Invio candidatura per wallet:', address);
      
      const response = await fetch('/api/authors/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          ...formData, 
          walletAddress: address 
        }),
      });

      const responseData = await response.json();
      console.log('📥 Risposta API:', responseData);

      if (!response.ok) {
        throw new Error(responseData.message || 'Si è verificato un errore.');
      }

      // Controlla se abbiamo già il risultato finale (chiamata da Make)
      if (responseData.llmScore !== undefined) {
        // Risultato finale già disponibile
        setResult(responseData);
        setSubmitted(true);
      } else if (responseData.applicationId) {
        // Inizia il polling per controllare lo stato
        console.log('🔄 Iniziando polling per applicationId:', responseData.applicationId);
        startPolling(responseData.applicationId);
      }
      
    } catch (err: any) {
      console.error('❌ Error submitting application:', err);
      setError(err.message);
      setIsPolling(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-3xl font-extrabold text-gray-900">Wallet non connesso</h2>
          <p className="mt-2 text-sm text-gray-600">
            Per accedere a questa sezione, connetti prima il tuo wallet.
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Torna alla Home
          </button>
        </div>
      </div>
    );
  }
  
  // Schermata di caricamento durante il polling
  if (isPolling && applicationId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Elaborazione in corso...</h2>
          <p className="text-gray-600 mb-4">
            L'IA sta valutando la tua candidatura. Questo potrebbe richiedere alcuni secondi.
          </p>
          <p className="text-xs text-gray-500">
            ID Applicazione: {applicationId}
          </p>
          <button
            onClick={() => {
              setIsPolling(false);
              setApplicationId(null);
            }}
            className="mt-4 px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            Annulla
          </button>
        </div>
      </div>
    );
  }

  if (submitted && result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md text-center">
          <div className={`mb-6 p-4 rounded-lg ${
            result.approved ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <h2 className={`text-3xl font-extrabold mb-2 ${
              result.approved ? 'text-green-800' : 'text-red-800'
            }`}>
              {result.approved ? '✅ CANDIDATURA APPROVATA!' : '❌ CANDIDATURA RIFIUTATA'}
            </h2>
            
            {result.llmScore !== undefined && (
              <div className="mt-4 text-left">
                <p className="font-semibold text-gray-700">Score IA: {result.llmScore}/100</p>
                {result.llmComment && (
                  <div className="mt-2 p-3 bg-gray-100 rounded text-sm text-gray-700">
                    <strong>Commento IA:</strong> {result.llmComment}
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-4">
            {result.message}
          </p>
          
          {result.applicationId && (
            <p className="text-xs text-gray-500 mb-6">
              ID Applicazione: {result.applicationId}
            </p>
          )}

          <div className="flex gap-4 justify-center">
            <Link 
              href="/" 
              className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Torna alla Home
            </Link>
            
            <button
              onClick={() => {
                setSubmitted(false);
                setResult(null);
                setIsPolling(false);
                setApplicationId(null);
                setFormData({
                  name: '',
                  email: '',
                  institution: '',
                  researchArea: '',
                  biography: '',
                  publicationsLink: '',
                  linkedinProfile: '',
                });
              }}
              className="px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Nuova Candidatura
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900">Candidatura Autore Verificato</h1>
            <p className="mt-2 text-sm text-gray-600">
              Compila questo modulo per avviare il processo di verifica automatica con AI.
            </p>
            <div className="mt-4 p-3 bg-blue-50 rounded-md text-sm text-blue-800">
                <strong>Wallet connesso:</strong> <span className="font-mono text-xs break-all">{address}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
              <label htmlFor="institution" className="block text-sm font-medium text-gray-700">
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
              <label htmlFor="researchArea" className="block text-sm font-medium text-gray-700">
                Area di Ricerca *
              </label>
              <input 
                type="text" 
                name="researchArea" 
                id="researchArea" 
                required 
                value={formData.researchArea} 
                onChange={handleInputChange} 
                placeholder="es. Intelligenza Artificiale, Bioinformatica, Machine Learning"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
              />
            </div>
            
            <div>
              <label htmlFor="biography" className="block text-sm font-medium text-gray-700">
                Biografia Professionale * 
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
                placeholder="Descrivi la tua carriera accademica, specializzazioni, pubblicazioni, esperienze di ricerca e risultati ottenuti. Includi dettagli su titoli di studio, posizioni attuali e passate, aree di expertise..."
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                  formData.biography.length < 200 ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {formData.biography.length < 200 && (
                <p className="text-xs text-red-600 mt-1">
                  Ancora {200 - formData.biography.length} caratteri necessari
                </p>
              )}
            </div>

            <div>
              <label htmlFor="publicationsLink" className="block text-sm font-medium text-gray-700">
                Link a Pubblicazioni (Google Scholar, ResearchGate, etc.)
              </label>
              <input
                type="url" 
                name="publicationsLink" 
                id="publicationsLink"
                value={formData.publicationsLink} 
                onChange={handleInputChange}
                placeholder="https://scholar.google.com/citations?user=..."
                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="linkedinProfile" className="block text-sm font-medium text-gray-700">
                Profilo LinkedIn
              </label>
              <input
                type="url" 
                name="linkedinProfile" 
                id="linkedinProfile"
                value={formData.linkedinProfile} 
                onChange={handleInputChange}
                placeholder="https://www.linkedin.com/in/..."
                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                * Campi obbligatori
              </div>
              <button
                type="submit"
                disabled={isSubmitting || formData.biography.length < 200}
                className="px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '⏳ Elaborazione in corso...' : '🚀 Invia per Valutazione AI'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}




// // frontend-dapp\src\app\apply-for-whitelist\page.tsx

// 'use client'

// import { useState } from 'react'
// import { useRouter } from 'next/navigation'
// import { useAccount } from 'wagmi'
// import Link from 'next/link'

// interface FormData {
//   name: string;
//   email: string;
//   institution: string;
//   researchArea: string;
//   biography: string;
//   publicationsLink: string;
//   linkedinProfile: string;
// }

// interface SubmissionResult {
//   success: boolean;
//   message: string;
//   applicationId?: string;
//   llmScore?: number;
//   llmComment?: string;
//   approved?: boolean;
// }

// export default function ApplyForWhitelist() {
//   const router = useRouter()
//   const { address, isConnected } = useAccount()
//   const [formData, setFormData] = useState<FormData>({
//     name: '',
//     email: '',
//     institution: '',
//     researchArea: '',
//     biography: '',
//     publicationsLink: '',
//     linkedinProfile: '',
//   })
//   const [isSubmitting, setIsSubmitting] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [submitted, setSubmitted] = useState(false)
//   const [result, setResult] = useState<SubmissionResult | null>(null)

//   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
//     const { name, value } = e.target
//     setFormData(prev => ({ ...prev, [name]: value }))
//   }

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
    
//     if (!address) {
//         setError("Indirizzo wallet non trovato. Assicurati di essere connesso.");
//         return;
//     }
    
//     setIsSubmitting(true);
//     setError(null);

//     try {
//       console.log('📤 Invio candidatura per wallet:', address);
      
//       const response = await fetch('/api/authors/apply', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ 
//           ...formData, 
//           walletAddress: address 
//         }),
//       });

//       const responseData = await response.json();
//       console.log('📥 Risposta API:', responseData);

//       if (!response.ok) {
//         throw new Error(responseData.message || 'Si è verificato un errore.');
//       }

//       setResult(responseData);
//       setSubmitted(true);
      
//     } catch (err: any) {
//       console.error('❌ Error submitting application:', err);
//       setError(err.message);
//     } finally {
//       setIsSubmitting(false);
//     }
//   }

//   if (!isConnected) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center">
//         <div className="bg-white p-8 rounded-lg shadow-md">
//           <h2 className="text-3xl font-extrabold text-gray-900">Wallet non connesso</h2>
//           <p className="mt-2 text-sm text-gray-600">
//             Per accedere a questa sezione, connetti prima il tuo wallet.
//           </p>
//           <button
//             onClick={() => router.push('/')}
//             className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
//           >
//             Torna alla Home
//           </button>
//         </div>
//       </div>
//     );
//   }
  
//   if (submitted && result) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md text-center">
//           <div className={`mb-6 p-4 rounded-lg ${
//             result.approved ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
//           }`}>
//             <h2 className={`text-3xl font-extrabold mb-2 ${
//               result.approved ? 'text-green-800' : 'text-red-800'
//             }`}>
//               {result.approved ? '✅ CANDIDATURA APPROVATA!' : '❌ CANDIDATURA RIFIUTATA'}
//             </h2>
            
//             {result.llmScore !== undefined && (
//               <div className="mt-4 text-left">
//                 <p className="font-semibold text-gray-700">Score IA: {result.llmScore}/100</p>
//                 {result.llmComment && (
//                   <div className="mt-2 p-3 bg-gray-100 rounded text-sm text-gray-700">
//                     <strong>Commento IA:</strong> {result.llmComment}
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>

//           <p className="text-sm text-gray-600 mb-4">
//             {result.message}
//           </p>
          
//           {result.applicationId && (
//             <p className="text-xs text-gray-500 mb-6">
//               ID Applicazione: {result.applicationId}
//             </p>
//           )}

//           <div className="flex gap-4 justify-center">
//             <Link 
//               href="/" 
//               className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
//             >
//               Torna alla Home
//             </Link>
            
//             <button
//               onClick={() => {
//                 setSubmitted(false);
//                 setResult(null);
//                 setFormData({
//                   name: '',
//                   email: '',
//                   institution: '',
//                   researchArea: '',
//                   biography: '',
//                   publicationsLink: '',
//                   linkedinProfile: '',
//                 });
//               }}
//               className="px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
//             >
//               Nuova Candidatura
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
//       <div className="max-w-3xl mx-auto">
//         <div className="bg-white shadow-xl rounded-lg p-8">
//           <div className="text-center mb-8">
//             <h1 className="text-3xl font-extrabold text-gray-900">Candidatura Autore Verificato</h1>
//             <p className="mt-2 text-sm text-gray-600">
//               Compila questo modulo per avviare il processo di verifica automatica con AI.
//             </p>
//             <div className="mt-4 p-3 bg-blue-50 rounded-md text-sm text-blue-800">
//                 <strong>Wallet connesso:</strong> <span className="font-mono text-xs break-all">{address}</span>
//             </div>
//           </div>

//           <form onSubmit={handleSubmit} className="space-y-6">
//             <div>
//               <label htmlFor="name" className="block text-sm font-medium text-gray-700">
//                 Nome e Cognome *
//               </label>
//               <input 
//                 type="text" 
//                 name="name" 
//                 id="name" 
//                 required 
//                 value={formData.name} 
//                 onChange={handleInputChange} 
//                 className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
//               />
//             </div>

//             <div>
//               <label htmlFor="email" className="block text-sm font-medium text-gray-700">
//                 Indirizzo Email *
//               </label>
//               <input 
//                 type="email" 
//                 name="email" 
//                 id="email" 
//                 required 
//                 value={formData.email} 
//                 onChange={handleInputChange} 
//                 className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
//               />
//             </div>

//             <div>
//               <label htmlFor="institution" className="block text-sm font-medium text-gray-700">
//                 Istituzione/Università *
//               </label>
//               <input 
//                 type="text" 
//                 name="institution" 
//                 id="institution" 
//                 required 
//                 value={formData.institution} 
//                 onChange={handleInputChange} 
//                 placeholder="es. Università di Roma, Dipartimento di Informatica"
//                 className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
//               />
//             </div>

//             <div>
//               <label htmlFor="researchArea" className="block text-sm font-medium text-gray-700">
//                 Area di Ricerca *
//               </label>
//               <input 
//                 type="text" 
//                 name="researchArea" 
//                 id="researchArea" 
//                 required 
//                 value={formData.researchArea} 
//                 onChange={handleInputChange} 
//                 placeholder="es. Intelligenza Artificiale, Bioinformatica, Machine Learning"
//                 className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
//               />
//             </div>
            
//             <div>
//               <label htmlFor="biography" className="block text-sm font-medium text-gray-700">
//                 Biografia Professionale * 
//                 <span className="text-xs text-gray-500">
//                   (min. 200 caratteri - {formData.biography.length}/200)
//                 </span>
//               </label>
//               <textarea
//                 name="biography"
//                 id="biography"
//                 required
//                 rows={6}
//                 value={formData.biography}
//                 onChange={handleInputChange}
//                 minLength={200}
//                 placeholder="Descrivi la tua carriera accademica, specializzazioni, pubblicazioni, esperienze di ricerca e risultati ottenuti. Includi dettagli su titoli di studio, posizioni attuali e passate, aree di expertise..."
//                 className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
//                   formData.biography.length < 200 ? 'border-red-300' : 'border-gray-300'
//                 }`}
//               />
//               {formData.biography.length < 200 && (
//                 <p className="text-xs text-red-600 mt-1">
//                   Ancora {200 - formData.biography.length} caratteri necessari
//                 </p>
//               )}
//             </div>

//             <div>
//               <label htmlFor="publicationsLink" className="block text-sm font-medium text-gray-700">
//                 Link a Pubblicazioni (Google Scholar, ResearchGate, etc.)
//               </label>
//               <input
//                 type="url" 
//                 name="publicationsLink" 
//                 id="publicationsLink"
//                 value={formData.publicationsLink} 
//                 onChange={handleInputChange}
//                 placeholder="https://scholar.google.com/citations?user=..."
//                 className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
//               />
//             </div>
            
//             <div>
//               <label htmlFor="linkedinProfile" className="block text-sm font-medium text-gray-700">
//                 Profilo LinkedIn
//               </label>
//               <input
//                 type="url" 
//                 name="linkedinProfile" 
//                 id="linkedinProfile"
//                 value={formData.linkedinProfile} 
//                 onChange={handleInputChange}
//                 placeholder="https://www.linkedin.com/in/..."
//                 className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
//               />
//             </div>
            
//             {error && (
//               <div className="p-3 bg-red-50 border border-red-200 rounded-md">
//                 <p className="text-sm text-red-600">{error}</p>
//               </div>
//             )}

//             <div className="flex items-center justify-between pt-6 border-t border-gray-200">
//               <div className="text-xs text-gray-500">
//                 * Campi obbligatori
//               </div>
//               <button
//                 type="submit"
//                 disabled={isSubmitting || formData.biography.length < 200}
//                 className="px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
//               >
//                 {isSubmitting ? '⏳ Elaborazione in corso...' : '🚀 Invia per Valutazione AI'}
//               </button>
//             </div>
//           </form>
//         </div>
//       </div>
//     </div>
//   )
// }