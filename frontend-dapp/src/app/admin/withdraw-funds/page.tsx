'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { toast } from 'react-hot-toast';

// Importa gli indirizzi dei contratti dalle variabili d'ambiente
const SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_NFT_ADDRESS as `0x${string}`;
const SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`;

// ABI completo per AccessControl e funzioni necessarie
const MARKETPLACE_ABI = [
    {
        "inputs": [
            { "internalType": "bytes32", "name": "role", "type": "bytes32" },
            { "internalType": "address", "name": "account", "type": "address" }
        ],
        "name": "hasRole",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "ADMIN_ROLE",
        "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "withdrawProtocolFees",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "accumulatedFees",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "protocolFeeReceiver",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

// ABI per il contratto NFT (se diverso)
const NFT_ABI = [
    {
        "inputs": [
            { "internalType": "bytes32", "name": "role", "type": "bytes32" },
            { "internalType": "address", "name": "account", "type": "address" }
        ],
        "name": "hasRole",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "ADMIN_ROLE",
        "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "withdrawProtocolFees",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

export default function WithdrawFundsPage() {
    const { address: connectedAddress, isConnected } = useAccount();
    const publicClient = usePublicClient();
    
    // Stato per i saldi dei contratti
    const [nftBalance, setNftBalance] = useState<bigint | null>(null);
    const [marketplaceBalance, setMarketplaceBalance] = useState<bigint | null>(null);
    const [marketplaceAccumulatedFees, setMarketplaceAccumulatedFees] = useState<bigint | null>(null);

    // 1. Legge il valore costante di ADMIN_ROLE
    const { data: adminRole, isLoading: isAdminRoleLoading } = useReadContract({
        abi: MARKETPLACE_ABI,
        address: SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS,
        functionName: 'ADMIN_ROLE',
    });

    // 2. Controlla se l'utente connesso ha l'ADMIN_ROLE sul contratto NFT
    const { data: hasNftAdminRole, isLoading: isNftRoleLoading } = useReadContract({
        abi: NFT_ABI,
        address: SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS,
        functionName: 'hasRole',
        args: [adminRole!, connectedAddress!],
        query: {
            enabled: !!adminRole && !!connectedAddress,
        },
    });

    // 3. Controlla se l'utente connesso ha l'ADMIN_ROLE sul contratto Marketplace
    const { data: hasMarketplaceAdminRole, isLoading: isMarketplaceRoleLoading } = useReadContract({
        abi: MARKETPLACE_ABI,
        address: SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS,
        functionName: 'hasRole',
        args: [adminRole!, connectedAddress!],
        query: {
            enabled: !!adminRole && !!connectedAddress,
        },
    });

    // 4. Legge le commissioni accumulate nel Marketplace
    const { data: accumulatedFeesData, isLoading: isAccumulatedFeesLoading, error: accumulatedFeesError } = useReadContract({
        abi: MARKETPLACE_ABI,
        address: SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS,
        functionName: 'accumulatedFees',
        query: {
            enabled: !!connectedAddress && !!adminRole, // Cambiato: non serve essere admin per leggere
        },
    });
    
    const { writeContract, isPending, data: txHash } = useWriteContract();
    
    const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } = useWaitForTransactionReceipt({
        hash: txHash,
    });
    
    // L'utente è un admin autorizzato se ha il ruolo su ENTRAMBI i contratti
    const isAuthorizedAdmin = hasNftAdminRole && hasMarketplaceAdminRole;

    // Funzione per aggiornare i saldi
    const fetchBalances = async () => {
        if (!publicClient) return;

        try {
            const [nftBal, marketplaceBal] = await Promise.all([
                publicClient.getBalance({ address: SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS }),
                publicClient.getBalance({ address: SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS })
            ]);
            setNftBalance(nftBal);
            setMarketplaceBalance(marketplaceBal);
            
        } catch (err) {
            console.error("Errore nel recupero dei saldi:", err);
            toast.error("Impossibile recuperare i saldi dei contratti.");
            setNftBalance(null);
            setMarketplaceBalance(null);
        }
    };
    
    useEffect(() => {
        if (isConnected) {
            fetchBalances();
        }
        
        // Aggiorna le commissioni accumulate quando i dati sono disponibili
        if (accumulatedFeesData !== undefined) {
            setMarketplaceAccumulatedFees(accumulatedFeesData);
        }
    }, [isConnected, isConfirmed, publicClient, accumulatedFeesData]);

    // Funzione di prelievo migliorata con controlli aggiuntivi
    const handleWithdraw = async (contractAddress: `0x${string}`, contractType: 'nft' | 'marketplace') => {
        if (!isAuthorizedAdmin) {
            toast.error("Non hai il ruolo ADMIN per eseguire questa operazione.");
            return;
        }

        // Per il marketplace, controlla prima se ci sono fondi da ritirare
        if (contractType === 'marketplace') {
            // Se abbiamo i dati delle commissioni accumulate, controlliamo
            if (accumulatedFeesData !== undefined && accumulatedFeesData === 0n) {
                toast.error("Non ci sono commissioni accumulate da ritirare nel Marketplace.");
                return;
            }
            
            // Se non abbiamo i dati delle commissioni ma il saldo è 0, probabile che non ci siano fondi
            if (accumulatedFeesData === undefined && marketplaceBalance === 0n) {
                toast.error("Il contratto Marketplace non sembra avere fondi disponibili.");
                return;
            }
        }

        try {
            const abi = contractType === 'marketplace' ? MARKETPLACE_ABI : NFT_ABI;
            
            // Log per debug
            console.log(`Attempting to withdraw from ${contractType}:`, {
                contractAddress,
                connectedAddress,
                hasAdminRole: contractType === 'marketplace' ? hasMarketplaceAdminRole : hasNftAdminRole,
                accumulatedFees: contractType === 'marketplace' ? accumulatedFeesData?.toString() : 'N/A'
            });
            
            writeContract({
                abi: abi,
                address: contractAddress,
                functionName: 'withdrawProtocolFees',
            });
            
            toast.success("Richiesta di prelievo inviata. Conferma la transazione nel tuo wallet.");
        } catch (error) {
            console.error("Errore durante il prelievo:", error);
            const errorMessage = error instanceof Error ? error.message : "Errore sconosciuto.";
            toast.error(`Si è verificato un errore: ${errorMessage}`);
        }
    };
    
    // Gestione degli stati di caricamento globali
    const isLoading = isAdminRoleLoading || isNftRoleLoading || isMarketplaceRoleLoading;
    const isTransactionInProgress = isPending || isConfirming;

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Ritira Commissioni di Protocollo</h1>

            {!isConnected && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
                    <p>Connetti il tuo wallet per gestire le commissioni.</p>
                </div>
            )}
            
            {isConnected && !isLoading && !isAuthorizedAdmin && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <p>Solo gli amministratori possono ritirare i fondi. Assicurati di essere connesso con un wallet che detiene il ruolo `ADMIN_ROLE` su entrambi i contratti.</p>
                </div>
            )}
            
            {isConnected && isAuthorizedAdmin && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-800">Stato dei Fondi</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-50 p-4 rounded-md shadow-inner">
                            <h3 className="text-lg font-medium text-gray-900">NFT Contract</h3>
                            <p className="text-lg text-gray-600 mb-2">Saldo totale del contratto:</p>
                            <p className="text-2xl font-mono text-gray-800">
                                {nftBalance !== null ? `${formatEther(nftBalance)} ETH` : 'Caricamento...'}
                            </p>
                            <button
                                onClick={() => handleWithdraw(SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS, 'nft')}
                                disabled={isTransactionInProgress || !nftBalance || nftBalance === 0n}
                                className="mt-4 w-full inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                                {isTransactionInProgress ? 'In corso...' : 'Ritira da NFT Contract'}
                            </button>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-md shadow-inner">
                            <h3 className="text-lg font-medium text-gray-900">Marketplace Contract</h3>
                            <p className="text-lg text-gray-600 mb-1">Saldo totale del contratto:</p>
                            <p className="text-xl font-mono text-gray-800 mb-2">
                                {marketplaceBalance !== null ? `${formatEther(marketplaceBalance)} ETH` : 'Caricamento...'}
                            </p>
                            <p className="text-lg text-gray-600 mb-1">Commissioni accumulate:</p>
                            <p className="text-2xl font-mono text-green-600 font-bold">
                                {marketplaceAccumulatedFees !== null ? `${formatEther(marketplaceAccumulatedFees)} ETH` : 'Caricamento...'}
                            </p>
                            <button
                                onClick={() => handleWithdraw(SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS, 'marketplace')}
                                disabled={
                                    isTransactionInProgress || 
                                    isAccumulatedFeesLoading ||
                                    (accumulatedFeesData !== undefined && accumulatedFeesData === 0n)
                                }
                                className="mt-4 w-full inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                                {isTransactionInProgress ? 'In corso...' : 
                                 isAccumulatedFeesLoading ? 'Caricamento...' : 
                                 'Ritira da Marketplace'}
                            </button>
                            {accumulatedFeesData === 0n && (
                                <p className="text-sm text-gray-500 mt-2">
                                    Nessuna commissione disponibile per il prelievo
                                </p>
                            )}
                            {accumulatedFeesError && (
                                <p className="text-sm text-red-500 mt-2">
                                    Errore nel caricamento commissioni: {accumulatedFeesError.message}
                                </p>
                            )}
                        </div>
                    </div>

                    {isTransactionInProgress && (
                         <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
                            <div className="flex items-center">
                                <svg className="animate-spin h-5 w-5 text-blue-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <div>
                                    <h3 className="text-sm font-medium text-blue-800">
                                        {isPending ? 'In attesa di firma...' : 'Transazione in corso di conferma...'}
                                    </h3>
                                    {txHash && (
                                        <p className="mt-1 text-sm text-blue-700">
                                            Hash: <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">{`${txHash.slice(0, 6)}...${txHash.slice(-4)}`}</code>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {isConfirmed && (
                        <div className="bg-green-50 border border-green-200 rounded-md p-4 mt-4">
                             <h3 className="text-sm font-medium text-green-800">
                                Transazione confermata con successo! I saldi verranno aggiornati a breve.
                            </h3>
                        </div>
                    )}

                    {receiptError && (
                         <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
                             <h3 className="text-sm font-medium text-red-800">
                                Errore nella transazione: {receiptError.message}
                            </h3>
                        </div>
                    )}

                    {/* Debug info - rimuovi in produzione */}
                    <div className="mt-6 p-4 bg-gray-100 rounded-md">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Info Debug:</h4>
                        <p className="text-xs text-gray-600">Admin Role: {adminRole?.toString()}</p>
                        <p className="text-xs text-gray-600">Has NFT Admin: {hasNftAdminRole?.toString()}</p>
                        <p className="text-xs text-gray-600">Has Marketplace Admin: {hasMarketplaceAdminRole?.toString()}</p>
                        <p className="text-xs text-gray-600">Accumulated Fees: {accumulatedFeesData?.toString() ?? 'undefined'}</p>
                        <p className="text-xs text-gray-600">Accumulated Fees Loading: {isAccumulatedFeesLoading.toString()}</p>
                        <p className="text-xs text-gray-600">Accumulated Fees Error: {accumulatedFeesError?.message ?? 'none'}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
