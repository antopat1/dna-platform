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
    portfolio: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // TODO: Implementa la logica di invio richiesta
      await new Promise(resolve => setTimeout(resolve, 2000))
      setSubmitted(true)
    } catch (error) {
      console.error('Error submitting request:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Wallet non connesso
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Connetti il tuo wallet per richiedere l'autorizzazione
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Torna alla Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="rounded-full h-12 w-12 bg-green-100 mx-auto flex items-center justify-center">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Richiesta inviata!
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              La tua richiesta di autorizzazione è stata inviata agli amministratori. 
              Riceverai una notifica quando sarà processata.
            </p>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => router.push('/')}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Torna alla Home
              </button>
              <button
                onClick={() => router.push('/auth/whitelist-check?redirect=/dashboard/register-content')}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Controlla Stato Autorizzazione
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900">
              Richiesta Autorizzazione
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Compila questo modulo per richiedere l'autorizzazione a registrare contenuti scientifici
            </p>
            <div className="mt-4 bg-blue-50 border-l-4 border-blue-400 p-4">
              <p className="text-sm text-blue-700">
                <strong>Indirizzo wallet:</strong> <code className="bg-blue-100 px-2 py-1 rounded font-mono">{address}</code>
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
                  className="mt-1 block w-full px-3 py-2 border border-gray-700  text-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                  className="mt-1 block w-full px-3 py-2 border border-gray-700  text-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                className="mt-1 block w-full px-3 py-2 border border-gray-700  text-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                className="mt-1 block w-full px-3 py-2 border text-gray-600 border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Seleziona un'area</option>
                <option value="biotechnology">Biotecnologie</option>
                <option value="chemistry">Chimica</option>
                <option value="physics">Fisica</option>
                <option value="mathematics">Matematica</option>
                <option value="medicine">Medicina</option>
                <option value="engineering">Ingegneria</option>
                <option value="computer-science">Informatica</option>
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
                placeholder="Spiega perché vorresti registrare contenuti scientifici sulla nostra piattaforma..."
                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
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
                placeholder="https://..."
                className="mt-1 block w-full px-3 py-2 border border-gray-700  text-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Link al tuo profilo accademico, sito web, o portfolio
              </p>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Indietro
              </button>
              
              <button
                type="submit"
                disabled={isSubmitting}
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
          </form>
        </div>
      </div>
    </div>
  )
}