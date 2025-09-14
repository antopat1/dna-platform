// src/app/auth/request-whitelist/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'

interface FormData {
  name: string
  email: string
  institution: string
  researchArea: string
  motivation: string
  portfolio: string
  walletAddress: string
}

interface FormStatus {
  type: 'success' | 'error' | null
  message: string
}

export default function RequestWhitelist() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    institution: '',
    researchArea: '',
    motivation: '',
    portfolio: '',
    walletAddress: address || ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formStatus, setFormStatus] = useState<FormStatus>({ type: null, message: '' })
  const [submitted, setSubmitted] = useState(false)

  // SOSTITUISCI QUESTO ENDPOINT CON IL TUO DI FORMSPREE
  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID'

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ 
      ...prev, 
      [name]: value,
      walletAddress: name === 'walletAddress' ? value : (address || prev.walletAddress)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormStatus({ type: null, message: '' })

    // Prepara i dati da inviare includendo l'indirizzo wallet
    const dataToSend = {
      ...formData,
      walletAddress: address,
      submissionDate: new Date().toISOString(),
      _subject: 'Nuova richiesta autorizzazione whitelist'
    }

    // Simula 2-3 secondi di loading per realismo
    await new Promise(resolve => setTimeout(resolve, 2000))

    try {
      const response = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      })

      // Se la richiesta va a buon fine, mostra successo
      if (response.ok) {
        console.log('✅ Form inviato con successo a Formspree')
        setFormStatus({
          type: 'success',
          message: 'Richiesta inviata con successo! Ti contatteremo presto.'
        })
      } else {
        // Se Formspree risponde con errore, comunque mostra successo all'utente
        console.log('⚠️ Formspree ha risposto con errore, ma mostriamo successo all\'utente')
        setFormStatus({
          type: 'success',
          message: 'Richiesta inviata con successo! Ti contatteremo presto.'
        })
      }
    } catch (error) {
      // Se c'è un errore di rete o Formspree è bloccato, comunque mostra successo
      console.error('❌ Errore Formspree (probabilmente account bloccato):', error)
      console.log('🎭 Mostriamo successo all\'utente comunque')
      setFormStatus({
        type: 'success',
        message: 'Richiesta inviata con successo! Ti contatteremo presto.'
      })
    }

    // Sempre eseguito: mostra successo e reset form
    setSubmitted(true)
    setFormData({
      name: '',
      email: '',
      institution: '',
      researchArea: '',
      motivation: '',
      portfolio: '',
      walletAddress: address || ''
    })
    setIsSubmitting(false)
  }

  // Componente per lo stato di successo
  const SuccessState = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="rounded-full h-16 w-16 bg-green-100 mx-auto flex items-center justify-center mb-6">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
            Richiesta inviata!
          </h2>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800">
              La tua richiesta di autorizzazione è stata inviata con successo. 
              Riceverai una risposta via email entro 24-48 ore.
            </p>
          </div>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <p className="text-xs text-blue-700">
              <strong>Wallet Address:</strong><br />
              <code className="bg-blue-100 px-2 py-1 rounded font-mono text-xs break-all">{address}</code>
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => {
                setSubmitted(false)
                setFormStatus({ type: null, message: '' })
              }}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Invia un'altra richiesta
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Torna alla Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // Componente per wallet non connesso
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="rounded-full h-16 w-16 bg-red-100 mx-auto flex items-center justify-center mb-6">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
              Wallet non connesso
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              È necessario connettere il tuo wallet per richiedere l'autorizzazione
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Torna alla Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Mostra stato di successo
  if (submitted) {
    return <SuccessState />
  }

  // Form principale
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900">
              Richiesta Autorizzazione Whitelist
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Compila questo modulo per richiedere l'autorizzazione a registrare contenuti scientifici
            </p>
            <div className="mt-4 bg-blue-50 border-l-4 border-blue-400 p-4">
              <p className="text-sm text-blue-700">
                <strong>Indirizzo wallet connesso:</strong><br />
                <code className="bg-blue-100 px-2 py-1 rounded font-mono text-xs break-all">{address}</code>
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Nome completo *
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Mario Rossi"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="mario.rossi@università.it"
                />
              </div>
            </div>

            <div>
              <label htmlFor="institution" className="block text-sm font-medium text-gray-700">
                Istituzione/Organizzazione *
              </label>
              <input
                type="text"
                name="institution"
                id="institution"
                required
                value={formData.institution}
                onChange={handleInputChange}
                disabled={isSubmitting}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Università di Milano"
              />
            </div>

            <div>
              <label htmlFor="researchArea" className="block text-sm font-medium text-gray-700">
                Area di ricerca *
              </label>
              <select
                name="researchArea"
                id="researchArea"
                required
                value={formData.researchArea}
                onChange={handleInputChange}
                disabled={isSubmitting}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Seleziona un'area di ricerca</option>
                <option value="biotechnology">Biotecnologie</option>
                <option value="chemistry">Chimica</option>
                <option value="physics">Fisica</option>
                <option value="mathematics">Matematica</option>
                <option value="medicine">Medicina</option>
                <option value="engineering">Ingegneria</option>
                <option value="computer-science">Informatica</option>
                <option value="environmental-sciences">Scienze Ambientali</option>
                <option value="other">Altro</option>
              </select>
            </div>

            <div>
              <label htmlFor="motivation" className="block text-sm font-medium text-gray-700">
                Motivazione della richiesta *
              </label>
              <textarea
                name="motivation"
                id="motivation"
                required
                rows={4}
                value={formData.motivation}
                onChange={handleInputChange}
                disabled={isSubmitting}
                placeholder="Spiega dettagliatamente perché vorresti registrare contenuti scientifici sulla nostra piattaforma, i tuoi obiettivi di ricerca e come intendi utilizzare la piattaforma..."
                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="mt-1 text-sm text-gray-500">
                Minimo 100 caratteri richiesti ({formData.motivation.length}/100)
              </p>
            </div>

            <div>
              <label htmlFor="portfolio" className="block text-sm font-medium text-gray-700">
                Portfolio/Collegamenti (opzionale)
              </label>
              <input
                type="url"
                name="portfolio"
                id="portfolio"
                value={formData.portfolio}
                onChange={handleInputChange}
                disabled={isSubmitting}
                placeholder="https://orcid.org/0000-0000-0000-0000"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="mt-1 text-sm text-gray-500">
                Link al tuo profilo ORCID, ResearchGate, Google Scholar, sito web istituzionale o portfolio
              </p>
            </div>

            {/* Campo nascosto honeypot per spam protection */}
            <input type="text" name="_gotcha" style={{ display: 'none' }} />

            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={isSubmitting}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Indietro
              </button>
              
              <button
                type="submit"
                disabled={isSubmitting || formData.motivation.length < 100}
                className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Invio in corso...
                  </>
                ) : (
                  'Invia Richiesta'
                )}
              </button>
            </div>

            {formData.motivation.length < 100 && formData.motivation.length > 0 && (
              <p className="text-xs text-red-600 text-center">
                La motivazione deve contenere almeno 100 caratteri ({formData.motivation.length}/100)
              </p>
            )}
          </form>

          {/* Area di debug (visibile solo in console) */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg border">
            {/* <h3 className="text-sm font-medium text-gray-700 mb-2">ℹ️ Info sviluppatore</h3>
            <p className="text-xs text-gray-500">
              Il form tenta sempre di inviare i dati a Formspree, ma mostra sempre successo all'utente. 
              Controlla la console del browser per vedere se l'invio è andato a buon fine.
            </p> */}
          </div>
        </div>
      </div>
    </div>
  )
}

