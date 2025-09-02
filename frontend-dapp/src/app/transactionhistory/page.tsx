'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { toast } from 'react-hot-toast';
import { formatEther } from 'viem';

interface TransactionEvent {
    _id: string;
    event?: string;
    transactionHash: string;
    address?: string;
    blockNumber?: number;
    chainId?: number;
    contractName?: string;
    createdAt?: string;
    errorMessage?: string;
    from?: string;
    to?: string;
    gasPrice?: string;
    gasUsed?: string;
    logIndex?: number;
    transactionIndex?: number;
    methodName?: string;
    source?: string;
    status?: 'pending' | 'success' | 'failed';
    timestamp?: string;
    timestamp_processed?: { $date: string };
    value?: string;
    args?: {
        [key: string]: any;
        tokenId?: number;
        seller?: string;
        buyer?: string;
        price?: { $numberLong: string };
        bidder?: string;
        winner?: string;
        from?: string;
        to?: string;
        author?: string;
        operator?: string;
        owner?: string;
        approved?: boolean;
        newBaseURI?: string;
        coordinator?: string;
        contentId?: string;
        previousOwner?: string;
        newOwner?: string;
        newReceiver?: string;
        newFee?: number;
        recipient?: string;
        amount?: string;
    };
    metadata_frontend_tx?: {
        tokenId?: string;
        priceEth?: string;
        contentId?: string;
        type?: string;
        recipient?: string;
        saleType?: string;
    };
}

type QueryType = 'all' | 'purchases' | 'minting' | 'sales' | 'auctions' | 'transfers';

export default function MyTransactionHistoryPage() {
    const { address: connectedAddress, isConnected } = useAccount();
    const [transactions, setTransactions] = useState<TransactionEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedQuery, setSelectedQuery] = useState<QueryType>('purchases');
    const [fetchError, setFetchError] = useState<string | null>(null);

    const fetchTransactions = async (queryType: QueryType) => {
        setFetchError(null);
        if (!connectedAddress) {
            setFetchError("Nessun indirizzo connesso. Connetti il tuo wallet.");
            return;
        }

        setIsLoading(true);
        try {
            const url = `/api/transaction-history?address=${connectedAddress}&queryType=${queryType}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error || `Errore HTTP ${response.status} nel recupero dello storico.`;
                setFetchError(errorMessage);
                throw new Error(errorMessage);
            }
            
            const data: TransactionEvent[] = await response.json();
            setTransactions(data);
            if (data.length === 0) {
                setFetchError('Nessuna transazione trovata per questa query.');
            }

        } catch (error: any) {
            toast.error(`Impossibile caricare lo storico: ${error.message || 'Errore generico'}.`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected && connectedAddress) {
            fetchTransactions(selectedQuery);
        } else {
            setTransactions([]);
            setFetchError("Connetti il tuo wallet per visualizzare lo storico.");
        }
    }, [isConnected, connectedAddress, selectedQuery]);

    const formatAddress = (address?: string) => {
        if (!address) return 'N/D';
        if (address === '0x0000000000000000000000000000000000000000') return 'Indirizzo Zero';
        if (address.length < 10) return address;
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    const getTransactionDescription = (tx: TransactionEvent): string => {
        const args = tx.args || {};
        const metadata = tx.metadata_frontend_tx || {};

        const tokenId = metadata.tokenId || args.tokenId || 'N/D';
        
        let priceDisplay = 'N/D ETH';
        if (metadata.priceEth) {
            priceDisplay = `${metadata.priceEth} ETH`;
        } else if (args.price?.$numberLong) {
            try {
                priceDisplay = `${formatEther(BigInt(args.price.$numberLong))} ETH`;
            } catch (e) {
                priceDisplay = `Errore Prezzo`;
            }
        } else if (tx.value && tx.value !== '0') {
            priceDisplay = `${tx.value} ETH`;
        }

        const fromAddr = formatAddress(tx.from || args.from);
        const toAddr = formatAddress(tx.to || args.to);
        const authorAddr = formatAddress(args.author);
        const buyerAddr = formatAddress(args.buyer);
        const sellerAddr = formatAddress(args.seller);
        const bidderAddr = formatAddress(args.bidder);
        const winnerAddr = formatAddress(args.winner);
        const ownerAddr = formatAddress(args.owner);
        const operatorAddr = formatAddress(args.operator);
        const newOwnerAddr = formatAddress(args.newOwner);
        const previousOwnerAddr = formatAddress(args.previousOwner);
        const recipientAddr = formatAddress(args.recipient);

        const mainIdentifier = tx.methodName || tx.event;

        switch (mainIdentifier) {
            case 'purchaseNFT':
                return `Acquisto NFT id ${tokenId} per ${priceDisplay} (da: ${fromAddr})`;
            case 'listNFTForSale':
                return `Messa in vendita NFT id ${tokenId} per ${priceDisplay} (da: ${fromAddr})`;
            case 'mintNFT':
                return `Minting Contenuto ${tokenId} (da: ${fromAddr})`;
            case 'safeTransferFrom':
                return `Trasferimento NFT id ${tokenId} da ${fromAddr} a ${toAddr}`;
            case 'AuctionStarted':
                return `Asta iniziata per NFT id ${tokenId} (min. ${priceDisplay}) da ${sellerAddr}`;
            case 'NewBid':
                return `Nuova offerta per ${tokenId} di ${priceDisplay} (da: ${bidderAddr})`;
            case 'AuctionEnded':
                return `Asta terminata per ${tokenId}. Vincitore: ${winnerAddr}`;
            case 'ProtocolFeesWithdrawn':
                return `Prelievo commissioni (da: ${fromAddr})`;
            case 'NFTMinted':
                return `NFT ${tokenId} mintato (Autore: ${authorAddr || fromAddr})`;
            case 'ApprovalForAll':
                return `Approvazione totale per ${operatorAddr} da ${ownerAddr} (${args.approved ? 'concessa' : 'revocata'})`;
            case 'Approval':
                return `Approvazione ${tokenId} per ${operatorAddr} da ${ownerAddr}`;
            case 'BaseURIUpdated':
                return `Base URI NFT aggiornata a: ${String(args.newBaseURI || '').substring(0, 30)}...`;
            case 'CoordinatorSet':
                return `Coordinator Chainlink VRF impostato a: ${formatAddress(args.coordinator)}`;
            case 'MintingFailed':
                return `Minting fallito per contentId ${metadata.contentId || args.contentId || 'N/D'}.`;
            case 'OwnershipTransferRequested':
                return `Richiesto trasferimento ownership da ${previousOwnerAddr} a ${newOwnerAddr}.`;
            case 'OwnershipTransferred':
                return `Ownership trasferita da ${previousOwnerAddr} a ${newOwnerAddr}.`;
            case 'ProtocolFeeReceiverUpdated':
                return `Indirizzo ricevente commissioni aggiornato a ${recipientAddr}`;
            case 'ProtocolFeeUpdated':
                return `Percentuale commissioni aggiornata a ${args.newFee}%`;
            case 'RefundProcessed':
                return `Rimborso processato per ${recipientAddr} di ${args.amount ? formatEther(BigInt(args.amount)) : 'N/D'} ETH`;
            default:
                return `Transazione: ${mainIdentifier || 'Sconosciuto'} (Hash: ${tx.transactionHash.substring(0, 6)}...)`;
        }
    };

    const renderEventCard = (tx: TransactionEvent) => (
        <div key={tx._id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
            <p className="font-bold text-lg text-gray-800">{getTransactionDescription(tx)}</p>
            <p className="text-sm text-gray-500 mt-1">
                Hash Transazione: <a href={`https://sepolia.arbiscan.io/tx/${tx.transactionHash}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-500">{tx.transactionHash.substring(0, 10)}...</a>
            </p>
            {tx.timestamp && (
                <p className="text-sm text-gray-500">
                    Data Transazione: {new Date(tx.timestamp).toLocaleDateString()}
                </p>
            )}
            {tx.timestamp_processed?.$date && (
                <p className="text-sm text-gray-500">
                    Data Processata: {new Date(tx.timestamp_processed.$date).toLocaleDateString()}
                </p>
            )}
            {tx.address && (
                <p className="text-sm text-gray-500">
                    Contratto: <a href={`https://sepolia.arbiscan.io/address/${tx.address}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-500">{formatAddress(tx.address)}</a>
                </p>
            )}
        </div>
    );

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Storico Transazioni</h1>

            <div className="mb-6">
                <label htmlFor="query-selector" className="block text-sm font-medium text-gray-700 mb-2">Filtra per tipo di evento:</label>
                <select
                    id="query-selector"
                    value={selectedQuery}
                    onChange={(e) => setSelectedQuery(e.target.value as QueryType)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base  text-gray-700 border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
                >
                    <option value="all">Tutti gli eventi</option>
                    <option value="purchases">Acquisti*</option>
                    <option value="minting">Minting</option>
                    <option value="sales">NFT messi in vendita</option>
                    <option value="auctions">Eventi Asta</option>
                    <option value="transfers">Trasferimenti</option>
                </select>
            </div>

            {!isConnected ? (
                <div className="text-center p-10 bg-gray-100 rounded-lg shadow-md">
                    <p className="text-gray-600">Connetti il tuo wallet per visualizzare lo storico delle tue transazioni.</p>
                </div>
            ) : isLoading ? (
                <div className="flex items-center justify-center p-10">
                    <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-gray-600">Caricamento storico...</p>
                </div>
            ) : transactions.length > 0 ? (
                <div>
                    {transactions.map(tx => renderEventCard(tx))}
                </div>
            ) : (
                <div className="text-center p-10 bg-gray-100 rounded-lg shadow-md">
                    <p className="text-gray-500">Nessuna transazione trovata per il tuo indirizzo per questo tipo di evento.</p>
                </div>
            )}
        </div>
    );
}
