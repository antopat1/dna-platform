'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { toast } from 'react-hot-toast';

// Importa gli indirizzi dei contratti dalle variabili d'ambiente
const SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_NFT_ADDRESS as `0x${string}`;
const SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`;

// ABI per le funzioni necessarie
const WITHDRAW_ABI = [
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
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

    // Legge l'indirizzo dell'owner del contratto NFT
    const { data: nftOwner, isLoading: isNftOwnerLoading } = useReadContract({
        abi: WITHDRAW_ABI,
        address: SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS,
        functionName: 'owner',
    });
    
    // Legge l'indirizzo dell'owner del contratto Marketplace
    const { data: marketplaceOwner, isLoading: isMarketplaceOwnerLoading } = useReadContract({
        abi: WITHDRAW_ABI,
        address: SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS,
        functionName: 'owner',
    });
    
    // Hook per la scrittura del contratto
    const { writeContract, isPending, data: txHash } = useWriteContract();
    
    // Gestione della conferma della transazione
    const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } = useWaitForTransactionReceipt({
        hash: txHash,
    });
    
    // Controlla se l'utente connesso è l'owner di entrambi i contratti
    const isContractOwner = connectedAddress && nftOwner && marketplaceOwner &&
        connectedAddress.toLowerCase() === nftOwner.toLowerCase() &&
        connectedAddress.toLowerCase() === marketplaceOwner.toLowerCase();

    // Funzione per aggiornare i saldi
    const fetchBalances = async () => {
        if (!publicClient) return;

        try {
            const nftBal = await publicClient.getBalance({ address: SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS });
            setNftBalance(nftBal);
            const marketplaceBal = await publicClient.getBalance({ address: SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS });
            setMarketplaceBalance(marketplaceBal);
        } catch (err) {
            console.error("Errore nel recupero dei saldi:", err);
            setNftBalance(null);
            setMarketplaceBalance(null);
        }
    };
    
    useEffect(() => {
        // Aggiorna i saldi all'inizio e dopo la conferma di una transazione
        if (isConnected) {
            fetchBalances();
        }
    }, [isConnected, publicClient, isConfirmed]);

    const handleWithdraw = async () => {
        if (!isContractOwner) {
            toast.error("Non sei l'owner del contratto. Non puoi prelevare i fondi.");
            return;
        }

        const promises = [];

        // Prelievo dal Marketplace se ha fondi
        if (marketplaceBalance && marketplaceBalance > 0n) {
            promises.push(
                writeContract({
                    abi: WITHDRAW_ABI,
                    address: SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS,
                    functionName: 'withdrawProtocolFees',
                })
            );
        }

        // Prelievo da NFT se ha fondi
        if (nftBalance && nftBalance > 0n) {
            promises.push(
                writeContract({
                    abi: WITHDRAW_ABI,
                    address: SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS,
                    functionName: 'withdrawProtocolFees',
                })
            );
        }
    };

    const isLoading = isNftOwnerLoading || isMarketplaceOwnerLoading || isPending || isConfirming;
    const hasFundsToWithdraw = (nftBalance !== null && nftBalance > 0n) || (marketplaceBalance !== null && marketplaceBalance > 0n);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Ritira Commissioni di Protocollo</h1>

            {!isConnected && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <p>Connetti il tuo wallet per ritirare le commissioni.</p>
                </div>
            )}
            
            {isConnected && !isNftOwnerLoading && !isMarketplaceOwnerLoading && !isContractOwner && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <p>Solo l'owner del contratto può ritirare i fondi. Assicurati che il tuo wallet sia l'owner di ENTRAMBI i contratti.</p>
                </div>
            )}
            
            {isConnected && isContractOwner && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-2xl font-semibold mb-4">Stato dei Fondi</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-50 p-4 rounded-md shadow-inner">
                            <h3 className="text-lg font-medium text-gray-900">NFT Contract</h3>
                            <p className="text-gray-600">
                                Saldo: 
                                <strong> {nftBalance !== null ? formatEther(nftBalance) : 'Caricamento...'} ETH</strong>
                            </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-md shadow-inner">
                            <h3 className="text-lg font-medium text-gray-900">Marketplace Contract</h3>
                            <p className="text-gray-600">
                                Saldo: 
                                <strong> {marketplaceBalance !== null ? formatEther(marketplaceBalance) : 'Caricamento...'} ETH</strong>
                            </p>
                        </div>
                    </div>

                    <h2 className="text-2xl font-semibold mb-4">Ritira Tutti i Fondi</h2>
                    <p className="mb-4 text-gray-700">
                        Clicca sul pulsante qui sotto per avviare il prelievo delle commissioni accumulate. Sarà richiesta una transazione per ogni contratto con fondi da ritirare.
                    </p>
                    <button
                        onClick={handleWithdraw}
                        disabled={isLoading || !hasFundsToWithdraw}
                        className="inline-flex justify-center items-center py-3 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                In attesa di conferma...
                            </>
                        ) : 'Ritira tutti i fondi'}
                    </button>
                    
                    {!hasFundsToWithdraw && (
                        <p className="text-green-600 mt-4 font-medium">Nessun fondo da ritirare al momento. I saldi dei contratti sono a zero.</p>
                    )}

                    {txHash && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
                            <h3 className="text-sm font-medium text-blue-800">
                                Transazione in corso
                            </h3>
                            <p className="mt-2 text-sm text-blue-700">
                                Hash: <code className="bg-blue-100 px-2 py-1 rounded text-xs">{txHash}</code>
                            </p>
                            <p className="mt-1 text-sm text-blue-700">
                                {isConfirming ? 'In attesa di conferma...' : isConfirmed ? 'Confermata ✓' : 'In elaborazione...'}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}



// 'use client';

// import React, { useState, useEffect } from 'react';
// import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
// import { toast } from 'react-hot-toast';

// // Importa gli indirizzi dei contratti dalle variabili d'ambiente
// const SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_NFT_ADDRESS as `0x${string}`;
// const SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`;

// // ABI per le funzioni necessarie
// // Nota: è cruciale che questi ABIs contengano le funzioni 'owner' e 'withdrawProtocolFees'
// const WITHDRAW_ABI = [
//     {
//         "inputs": [],
//         "name": "owner",
//         "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
//         "stateMutability": "view",
//         "type": "function"
//     },
//     {
//         "inputs": [],
//         "name": "withdrawProtocolFees",
//         "outputs": [],
//         "stateMutability": "nonpayable",
//         "type": "function"
//     }
// ] as const;

// export default function WithdrawFundsPage() {
//     const { address: connectedAddress, isConnected } = useAccount();

//     const [processingContract, setProcessingContract] = useState<'NFT' | 'Marketplace' | null>(null);

//     // Legge l'indirizzo dell'owner e il saldo del contratto NFT
//     const { data: nftOwner, isLoading: isNftOwnerLoading } = useReadContract({
//         abi: WITHDRAW_ABI,
//         address: SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS,
//         functionName: 'owner',
//     });

//     // Legge l'indirizzo dell'owner e il saldo del contratto Marketplace
//     const { data: marketplaceOwner, isLoading: isMarketplaceOwnerLoading } = useReadContract({
//         abi: WITHDRAW_ABI,
//         address: SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS,
//         functionName: 'owner',
//     });
    
//     // Hook per la scrittura del contratto
//     const {
//         writeContract,
//         data: txHash,
//         isPending: isWritePending,
//         error: writeError,
//         reset: resetWrite
//     } = useWriteContract({
//         mutation: {
//             onError: (error) => {
//                 toast.error(`Transazione fallita: ${error.message}`);
//                 setProcessingContract(null);
//             }
//         }
//     });

//     // Controlla lo stato della transazione
//     const {
//         isLoading: isConfirming,
//         isSuccess: isConfirmed,
//         error: receiptError
//     } = useWaitForTransactionReceipt({
//         hash: txHash,
//     });

//     // Controlla se l'utente connesso è l'owner di entrambi i contratti
//     const isContractOwner = connectedAddress && nftOwner && marketplaceOwner &&
//         connectedAddress.toLowerCase() === nftOwner.toLowerCase() &&
//         connectedAddress.toLowerCase() === marketplaceOwner.toLowerCase();
        
//     const isLoading = isNftOwnerLoading || isMarketplaceOwnerLoading || isWritePending || isConfirming;

//     const handleWithdraw = async () => {
//         if (!isContractOwner) {
//             toast.error("Non sei l'owner del contratto. Non puoi prelevare i fondi.");
//             return;
//         }

//         try {
//             resetWrite();
//             setProcessingContract('Marketplace');
            
//             // Richiama la transazione per il Marketplace
//             writeContract({
//                 abi: WITHDRAW_ABI,
//                 address: SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS,
//                 functionName: 'withdrawProtocolFees',
//             });
            
//             // Nota: wagmi@2.x gestisce la coda delle transazioni in modo asincrono.
//             // La seconda transazione partirà solo dopo che la prima sarà completata o fallita.
//             // Qui ci limitiamo a lanciare la prima.
//             // La logica per la seconda transazione (NFT) andrebbe gestita in un useEffect
//             // che si attiva al successo della prima. Per semplicità, faremo due chiamate
//             // separate che l'utente dovrà confermare singolarmente.
//         } catch (error) {
//             console.error('Errore nella preparazione della transazione:', error);
//             toast.error('Errore nella preparazione della transazione.');
//             setProcessingContract(null);
//         }
//     };
    
//     // Gestione dei risultati delle transazioni
//     useEffect(() => {
//         if (isConfirmed && txHash) {
//             toast.success(`Prelievo da ${processingContract} completato con successo!`);
            
//             // Dopo il prelievo del marketplace, avvia il prelievo da NFT
//             if (processingContract === 'Marketplace') {
//                 setProcessingContract('NFT');
//                 writeContract({
//                     abi: WITHDRAW_ABI,
//                     address: SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS,
//                     functionName: 'withdrawProtocolFees',
//                 });
//             } else if (processingContract === 'NFT') {
//                 setProcessingContract(null); // Tutte le operazioni completate
//             }
//         }
        
//         if (receiptError) {
//             toast.error('Errore nella conferma della transazione.');
//             setProcessingContract(null);
//         }

//         if (writeError) {
//              console.error('Errore writeContract:', writeError);
//              setProcessingContract(null);
//         }
//     }, [isConfirmed, receiptError, writeError, txHash, processingContract, writeContract]);

//     return (
//         <div className="container mx-auto p-4">
//             <h1 className="text-3xl font-bold mb-6 text-gray-800">Ritira Commissioni di Protocollo</h1>

//             {!isConnected && (
//                 <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
//                     <p>Connetti il tuo wallet per ritirare le commissioni.</p>
//                 </div>
//             )}
            
//             {isConnected && !isNftOwnerLoading && !isMarketplaceOwnerLoading && !isContractOwner && (
//                 <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
//                     <p>Solo l'owner del contratto può ritirare i fondi. Assicurati che il tuo wallet sia l'owner di ENTRAMBI i contratti.</p>
//                 </div>
//             )}
            
//             {isConnected && isContractOwner && (
//                 <div className="bg-white p-6 rounded-lg shadow-md">
//                     <h2 className="text-2xl font-semibold mb-4">Ritira Tutti i Fondi</h2>
//                     <p className="mb-4 text-gray-700">
//                         Clicca sul pulsante qui sotto per avviare il prelievo delle commissioni accumulate. Saranno richieste due transazioni separate: una per il **Marketplace** e una per il contratto che gestisce il Mint e la gestione **NFT**.
//                     </p>
//                     <button
//                         onClick={handleWithdraw}
//                         disabled={isLoading}
//                         className="inline-flex justify-center items-center py-3 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
//                     >
//                         {isLoading ? (
//                             <>
//                                 <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
//                                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//                                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
//                                 </svg>
//                                 {processingContract ? `Elaborazione ${processingContract}...` : 'Caricamento...'}
//                             </>
//                         ) : 'Ritira tutti i fondi'}
//                     </button>

//                     {txHash && (
//                         <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
//                             <h3 className="text-sm font-medium text-blue-800">
//                                 Transazione in corso
//                             </h3>
//                             <p className="mt-2 text-sm text-blue-700">
//                                 Hash: <code className="bg-blue-100 px-2 py-1 rounded text-xs">{txHash}</code>
//                             </p>
//                             <p className="mt-1 text-sm text-blue-700">
//                                 {isConfirming ? 'In attesa di conferma...' : isConfirmed ? 'Confermata ✓' : 'In elaborazione...'}
//                             </p>
//                         </div>
//                     )}
//                 </div>
//             )}
//         </div>
//     );
// }