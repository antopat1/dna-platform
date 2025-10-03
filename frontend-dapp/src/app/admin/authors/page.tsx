'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { isAddress } from 'viem';
import { toast } from 'react-hot-toast';


const SCIENTIFIC_CONTENT_REGISTRY_ABI = [
    {
        "inputs": [{"internalType": "bytes32", "name": "role", "type": "bytes32"}, {"internalType": "address", "name": "account", "type": "address"}],
        "name": "hasRole",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "ADMIN_ROLE",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
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

const contractAddress = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_REGISTRY_ADDRESS;


console.log("Indirizzo del contratto letto da .env.local:", contractAddress);


if (!contractAddress || contractAddress === "") {
    throw new Error(
        "Errore: NEXT_PUBLIC_SCIENTIFIC_CONTENT_REGISTRY_ADDRESS non è definito. " +
        "Assicurati che sia presente in .env.local e di aver riavviato il server di sviluppo."
    );
}

const SCIENTIFIC_CONTENT_REGISTRY_ADDRESS = contractAddress as `0x${string}`;

export default function WhitelistedAuthorsPage() {
    const { address: connectedAddress, isConnected } = useAccount();
    const [authorAddress, setAuthorAddress] = useState('');

   
    const { 
        data: adminRoleHash, 
        isLoading: isAdminRoleLoading,
        error: adminRoleError
    } = useReadContract({
        abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
        address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
        functionName: 'ADMIN_ROLE',
    });

    
    const { 
        data: hasAdminRole, 
        isLoading: isAdminCheckLoading, 
        error: adminCheckError,
        refetch: refetchAdminRole
    } = useReadContract({
        abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
        address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
        functionName: 'hasRole',
        args: adminRoleHash && connectedAddress ? [adminRoleHash, connectedAddress] : undefined,
    });

    
    const { 
        data: isWhitelisted, 
        refetch: refetchWhitelisted,
        isLoading: isWhitelistCheckLoading
    } = useReadContract({
        abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
        address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
        functionName: 'isAuthorWhitelisted',
        args: authorAddress && isAddress(authorAddress) ? [authorAddress as `0x${string}`] : undefined,
    });

    const isAdmin = Boolean(hasAdminRole);

    
    const { 
        writeContract, 
        data: txHash, 
        isPending: isWritePending, 
        error: writeError,
        reset: resetWrite
    } = useWriteContract({
        mutation: {
            onError: (error) => {
                console.error('Write contract error:', error);
                toast.error(`Transazione fallita: ${error.message}`);
            },
            onSuccess: (hash) => {
                console.log('Transaction hash:', hash);
            }
        }
    });

    
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

        if (!isAdmin) {
            toast.error('Solo gli amministratori possono eseguire questa azione.');
            return;
        }

        try {
            resetWrite();
            
            console.log('Adding author to whitelist:', authorAddress);
            
            writeContract({
                abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
                address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
                functionName: 'addAuthorToWhitelist',
                args: [authorAddress as `0x${string}`],
            });
        } catch (error) {
            console.error('Error in handleAddAuthor:', error);
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

        if (!isAdmin) {
            toast.error('Solo gli amministratori possono eseguire questa azione.');
            return;
        }

        try {
            resetWrite();
            
            console.log('Removing author from whitelist:', authorAddress);
            
            writeContract({
                abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
                address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
                functionName: 'removeAuthorFromWhitelist',
                args: [authorAddress as `0x${string}`],
            });
        } catch (error) {
            console.error('Error in handleRemoveAuthor:', error);
            toast.error('Errore nella preparazione della transazione.');
        }
    };

    
    useEffect(() => {
        if (isConfirmed && txHash) {
            toast.success('Operazione completata con successo!');
            
            // Aggiorna lo stato della whitelist
            setTimeout(() => {
                refetchWhitelisted();
                refetchAdminRole();
            }, 1000);
        }
        
        if (receiptError) {
            console.error('Transaction receipt error:', receiptError);
            toast.error('Errore nella conferma della transazione.');
        }
    }, [isConfirmed, receiptError, txHash, refetchWhitelisted, refetchAdminRole]);

    
    useEffect(() => {
        console.log('Connected address:', connectedAddress);
        console.log('Admin role hash:', adminRoleHash);
        console.log('Has admin role:', hasAdminRole);
        console.log('Is admin:', isAdmin);
        console.log('Admin check error:', adminCheckError);
        console.log('Admin role error:', adminRoleError);
    }, [connectedAddress, adminRoleHash, hasAdminRole, isAdmin, adminCheckError, adminRoleError]);

    const isLoading = isAdminRoleLoading || isAdminCheckLoading || isWritePending || isConfirming;
    const hasErrors = adminRoleError || adminCheckError;

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Gestione Autori Autorizzati</h1>
            
            {!isConnected && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <p>Connetti il tuo wallet per gestire gli autori.</p>
                </div>
            )}

            {hasErrors && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
                    <p>Errore nel caricamento delle informazioni del contratto:</p>
                    {adminRoleError && <p className="text-sm mt-1">Admin Role Error: {adminRoleError.message}</p>}
                    {adminCheckError && <p className="text-sm mt-1">Admin Check Error: {adminCheckError.message}</p>}
                </div>
            )}

            {isConnected && !isAdminCheckLoading && !hasErrors && !isAdmin && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <p>Solo gli amministratori del contratto possono gestire la whitelist degli autori.</p>
                    <p className="text-sm mt-1">Il tuo indirizzo: {connectedAddress}</p>
                    <p className="text-sm">Stato admin: {hasAdminRole ? 'Amministratore' : 'Non amministratore'}</p>
                </div>
            )}

            {isConnected && isAdmin && !hasErrors && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                    <p>✓ Sei connesso come amministratore del contratto.</p>
                    <p className="text-sm mt-1">Il tuo indirizzo: {connectedAddress}</p>
                </div>
            )}

            {isConnected && isAdmin && !hasErrors && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-800">Gestisci Autori Autorizzati</h2>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                                Indirizzo Ethereum dell'Autore
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
                                <div className="mt-2">
                                    {isWhitelistCheckLoading ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            Controllo in corso...
                                        </span>
                                    ) : (
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            isWhitelisted 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                            {isWhitelisted ? '✓ Autorizzato' : '✗ Non autorizzato'}
                                        </span>
                                    )}
                                </div>
                            )}
                            {authorAddress && !isAddress(authorAddress) && (
                                <p className="mt-2 text-sm text-red-600">
                                    Formato indirizzo non valido
                                </p>
                            )}
                        </div>
                        
                        <div className="flex space-x-4">
                            <button
                                onClick={handleAddAuthor}
                                disabled={isLoading || !isAddress(authorAddress) || !isConnected || isWhitelisted}
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
                                    'Autorizza Autore'
                                )}
                            </button>
                            <button
                                onClick={handleRemoveAuthor}
                                disabled={isLoading || !isAddress(authorAddress) || !isConnected || !isWhitelisted}
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
                                    'Rimuovi Autorizzazione'
                                )}
                            </button>
                        </div>

                        <div className="text-sm text-gray-600">
                            <p><strong>Nota:</strong></p>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                                <li>Solo gli amministratori del contratto possono gestire le autorizzazioni</li>
                                <li>Gli autori autorizzati possono registrare contenuti sulla piattaforma</li>
                                <li>Il bottone "Autorizza" è disabilitato se l'autore è già autorizzato</li>
                                <li>Il bottone "Rimuovi" è disabilitato se l'autore non è autorizzato</li>
                            </ul>
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
                                            Stato Transazione
                                        </h3>
                                        <div className="mt-2 text-sm text-blue-700">
                                            <p>Hash: <code className="bg-blue-100 px-2 py-1 rounded text-xs font-mono">{txHash}</code></p>
                                            <p className="mt-1">
                                                {isConfirming ? (
                                                    <>
                                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-700 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        In attesa di conferma...
                                                    </>
                                                ) : isConfirmed ? (
                                                    <>
                                                        <span className="text-green-700">✓ Transazione confermata</span>
                                                    </>
                                                ) : (
                                                    'Transazione inviata...'
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {writeError && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">
                                            Errore nella Transazione
                                        </h3>
                                        <div className="mt-2 text-sm text-red-700">
                                            <p>{writeError.message}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {(isAdminCheckLoading || isAdminRoleLoading) && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-blue-800">Verifica dei permessi in corso...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
