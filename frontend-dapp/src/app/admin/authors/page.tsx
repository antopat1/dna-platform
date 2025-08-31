'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { isAddress } from 'viem';
import { toast } from 'react-hot-toast';

// ABI per le funzioni necessarie
const SCIENTIFIC_CONTENT_REGISTRY_ABI = [
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "_authorAddress", "type": "address"}],
        "name": "addAuthorToWhitelist",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "_authorAddress", "type": "address"}],
        "name": "removeAuthorFromWhitelist",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "isAuthorWhitelisted",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [{"indexed": true, "internalType": "address", "name": "author", "type": "address"}],
        "name": "AuthorWhitelisted",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [{"indexed": true, "internalType": "address", "name": "author", "type": "address"}],
        "name": "AuthorRemovedFromWhitelist",
        "type": "event"
    }
] as const;

const SCIENTIFIC_CONTENT_REGISTRY_ADDRESS = '0x43c175ec5b9fd5c80596a5556a2e79eed73d421e' as `0x${string}`;

export default function WhitelistedAuthorsPage() {
    const { address: connectedAddress, isConnected } = useAccount();
    const [authorAddress, setAuthorAddress] = useState('');

    // Legge l'indirizzo dell'owner del contratto
    const { 
        data: contractOwner, 
        isLoading: isOwnerLoading, 
        error: ownerError
    } = useReadContract({
        abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
        address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
        functionName: 'owner',
    });

    // Controlla se un indirizzo è whitelisted
    const { 
        data: isWhitelisted, 
        refetch: refetchWhitelisted 
    } = useReadContract({
        abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
        address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
        functionName: 'isAuthorWhitelisted',
        args: authorAddress && isAddress(authorAddress) ? [authorAddress as `0x${string}`] : undefined,
    });

    const isContractOwner = connectedAddress && contractOwner && 
        connectedAddress.toLowerCase() === contractOwner.toLowerCase();

    // Hook per la scrittura del contratto
    const { 
        writeContract, 
        data: txHash, 
        isPending: isWritePending, 
        error: writeError,
        reset: resetWrite
    } = useWriteContract({
        mutation: {
            onError: (error) => {
                toast.error(`Transazione fallita: ${error.message}`);
            }
        }
    });

    // Controlla lo stato della transazione
    const { 
        isLoading: isConfirming, 
        isSuccess: isConfirmed,
        error: receiptError 
    } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    const handleAddAuthor = async () => {
        if (!isAddress(authorAddress)) {
            toast.error('Indirizzo Ethereum non valido.');
            return;
        }

        if (!isConnected) {
            toast.error('Wallet non connesso.');
            return;
        }

        if (!isContractOwner) {
            toast.error('Solo l\'owner può eseguire questa azione.');
            return;
        }

        try {
            resetWrite();
            
            writeContract({
                abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
                address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
                functionName: 'addAuthorToWhitelist',
                args: [authorAddress as `0x${string}`],
            });
        } catch (error) {
            toast.error('Errore nella preparazione della transazione.');
        }
    };

    const handleRemoveAuthor = async () => {
        if (!isAddress(authorAddress)) {
            toast.error('Indirizzo Ethereum non valido.');
            return;
        }

        if (!isConnected) {
            toast.error('Wallet non connesso.');
            return;
        }

        if (!isContractOwner) {
            toast.error('Solo l\'owner può eseguire questa azione.');
            return;
        }

        try {
            resetWrite();
            
            writeContract({
                abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
                address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
                functionName: 'removeAuthorFromWhitelist',
                args: [authorAddress as `0x${string}`],
            });
        } catch (error) {
            toast.error('Errore nella preparazione della transazione.');
        }
    };

    // Gestione dei risultati delle transazioni
    useEffect(() => {
        if (isConfirmed && txHash) {
            toast.success('Operazione completata con successo!');
            setAuthorAddress('');
            
            // Aggiorna lo stato della whitelist
            if (isAddress(authorAddress)) {
                refetchWhitelisted();
            }
        }
        
        if (receiptError) {
            toast.error('Errore nella conferma della transazione.');
        }
    }, [isConfirmed, receiptError, txHash, authorAddress, refetchWhitelisted]);

    const isLoading = isOwnerLoading || isWritePending || isConfirming;

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Whitelisted Authors Management</h1>
            
            {!isConnected && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <p>Connetti il tuo wallet per gestire gli autori.</p>
                </div>
            )}

            {isConnected && !isOwnerLoading && !isContractOwner && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <p>Solo l'owner del contratto può gestire la whitelist.</p>
                </div>
            )}

            {ownerError && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
                    <p>Errore nel caricamento delle informazioni del contratto. Riprova più tardi.</p>
                </div>
            )}

            {isConnected && isContractOwner && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-800">Gestisci Autori Whitelistati</h2>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                                Indirizzo Ethereum
                            </label>
                            <input
                                type="text"
                                id="address"
                                value={authorAddress}
                                onChange={(e) => setAuthorAddress(e.target.value)}
                                className="w-full border border-gray-300 text-gray-600 rounded-md shadow-sm p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="0x..."
                                required
                            />
                            {authorAddress && isAddress(authorAddress) && (
                                <p className="mt-2 text-sm text-gray-600">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        isWhitelisted 
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-red-100 text-red-800'
                                    }`}>
                                        {isWhitelisted ? '✓ Whitelisted' : '✗ Non whitelisted'}
                                    </span>
                                </p>
                            )}
                        </div>
                        
                        <div className="flex space-x-4">
                            <button
                                onClick={handleAddAuthor}
                                disabled={isLoading || !isAddress(authorAddress) || !isConnected}
                                className="flex-1 inline-flex justify-center items-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                                {isWritePending || isConfirming ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Elaborazione...
                                    </>
                                ) : (
                                    'Aggiungi Autore'
                                )}
                            </button>
                            <button
                                onClick={handleRemoveAuthor}
                                disabled={isLoading || !isAddress(authorAddress) || !isConnected}
                                className="flex-1 inline-flex justify-center items-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                                {isWritePending || isConfirming ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Elaborazione...
                                    </>
                                ) : (
                                    'Rimuovi Autore'
                                )}
                            </button>
                        </div>

                        {txHash && (
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-blue-800">
                                            Transazione in corso
                                        </h3>
                                        <div className="mt-2 text-sm text-blue-700">
                                            <p>Hash: <code className="bg-blue-100 px-2 py-1 rounded text-xs">{txHash}</code></p>
                                            <p className="mt-1">
                                                {isConfirming ? 'In attesa di conferma...' : isConfirmed ? 'Confermata ✓' : 'In elaborazione...'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

