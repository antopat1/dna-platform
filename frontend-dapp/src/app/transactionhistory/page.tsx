'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { toast } from 'react-hot-toast';
import { formatEther } from 'viem'; // Importazione corretta

interface TransactionEvent {
    _id: string;
    event?: string; // Es. 'ApprovalForAll', 'AuctionStarted' (se log raw)
    transactionHash: string;
    address?: string; // Indirizzo del contratto che ha emesso l'evento
    blockNumber?: number;
    chainId?: number;
    contractName?: string;
    createdAt?: string; // Data di creazione del record nel DB
    errorMessage?: string;
    from?: string; // Indirizzo 'from' della transazione (root level)
    to?: string; // Indirizzo 'to' della transazione (root level)
    gasPrice?: string;
    gasUsed?: string;
    logIndex?: number;
    transactionIndex?: number;
    methodName?: string; // Il nome del metodo chiamato sulla blockchain (es. 'purchaseNFT')
    source?: string;
    status?: 'pending' | 'success' | 'failed';
    timestamp?: string; // Timestamp della transazione (root level, stringa ISO)
    timestamp_processed?: { $date: string }; // Timestamp di processazione (formato MongoDB Date)
    value?: string; // Valore ETH della transazione (root level, stringa "0.005")
    args?: { // Argomenti dell'evento, se presenti (potrebbero non esserci per i tx_status)
        [key: string]: any;
        tokenId?: number;
        seller?: string;
        buyer?: string;
        price?: { $numberLong: string }; // Per i prezzi in wei come oggetto di MongoDB
        bidder?: string;
        winner?: string;
        from?: string;
        to?: string;
        author?: string; // Per NFTMinted
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
        amount?: string; // per RefundProcessed
    };
    metadata_frontend_tx?: { // Metadati aggiunti dal frontend
        tokenId?: string;
        priceEth?: string; // Prezzo in ETH come stringa (es. "0.005")
        contentId?: string;
        type?: string;
        recipient?: string;
        saleType?: string;
    };
}

type QueryType = 'all' | 'purchases' | 'sales' | 'auctions' | 'transfers';

export default function MyTransactionHistoryPage() {
    const { address: connectedAddress, isConnected } = useAccount();
    const [transactions, setTransactions] = useState<TransactionEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedQuery, setSelectedQuery] = useState<QueryType>('purchases'); // Default: acquisti
    const [fetchError, setFetchError] = useState<string | null>(null);

    const renderDebugInfo = () => (
        <div style={{ backgroundColor: '#ffeebb', padding: '15px', border: '1px solid #ffcc00', borderRadius: '8px', marginBottom: '20px', color: '#333', overflowWrap: 'break-word' }}>
            <h3 style={{ color: '#cc9900', marginTop: '0' }}>ℹ️ Informazioni di Debug (visibili in sviluppo)</h3>
            <p><strong>Utente Connesso:</strong> {connectedAddress || 'Nessuno'}</p>
            <p><strong>Stato Connessione:</strong> {isConnected ? 'Connesso ✅' : 'Non Connesso ❌'}</p>
            <p><strong>Query Selezionata:</strong> {selectedQuery}</p>
            {isLoading && <p><strong>Stato Caricamento:</strong> Caricamento dati dal backend...</p>}
            {fetchError && <p style={{ color: 'red' }}><strong>Errore Fetch API:</strong> {fetchError}</p>}
            {transactions.length === 0 && !isLoading && <p><strong>Risultati:</strong> Nessuna transazione trovata per i criteri selezionati.</p>}
        </div>
    );

    const fetchTransactions = async (queryType: QueryType) => {
        setFetchError(null);
        if (!connectedAddress) {
            setFetchError("Nessun indirizzo connesso. Connetti il tuo wallet.");
            return;
        }

        setIsLoading(true);
        try {
            const url = `/api/transaction-history?address=${connectedAddress}&queryType=${queryType}`;
            console.log(`[Frontend] Chiamata API per storico: ${url}`);
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error || `Errore HTTP ${response.status} nel recupero dello storico.`;
                console.error(`[Frontend] API Response Error:`, response.status, errorMessage);
                setFetchError(errorMessage);
                throw new Error(errorMessage);
            }
            
            const data: TransactionEvent[] = await response.json();
            setTransactions(data);
            console.log(`[Frontend] Dati caricati: ${data.length} transazioni.`);

        } catch (error: any) {
            console.error('[Frontend] Errore durante fetchTransactions:', error);
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
        // Gestisci indirizzi zero o troppo corti
        if (address === '0x0000000000000000000000000000000000000000') return 'Indirizzo Zero';
        if (address.length < 10) return address; // Indirizzi troppo corti per troncamento
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    const getTransactionDescription = (tx: TransactionEvent): string => {
        const args = tx.args || {};
        const metadata = tx.metadata_frontend_tx || {};

        const tokenId = metadata.tokenId || args.tokenId || 'N/D';
        
        let priceDisplay = 'N/D ETH';
        // Prioritizza il prezzo da metadata_frontend_tx, poi da args, poi dal value root
        if (metadata.priceEth) {
            priceDisplay = `${metadata.priceEth} ETH`;
        } else if (args.price?.$numberLong) {
            try {
                priceDisplay = `${formatEther(BigInt(args.price.$numberLong))} ETH`;
            } catch (e) {
                console.error("Errore nel formattare args.price.$numberLong:", args.price.$numberLong, e);
                priceDisplay = `Errore Prezzo`;
            }
        } else if (tx.value && tx.value !== '0') { // tx.value è una stringa in ETH, non in wei, quindi la usiamo direttamente
            priceDisplay = `${tx.value} ETH`;
        }


        // Indirizzi rilevanti dalla transazione (root) o dagli args
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


        // Prioritizza methodName per la descrizione, altrimenti event
        const mainIdentifier = tx.methodName || tx.event;

        switch (mainIdentifier) {
            case 'purchaseNFT':
                return `Acquisto ${tokenId} per ${priceDisplay} (da: ${fromAddr})`;
            case 'listNFTForSale':
                return `Messa in vendita ${tokenId} per ${priceDisplay} (da: ${fromAddr})`;
            case 'mintNFT':
                return `Minting ${tokenId} (da: ${fromAddr})`;
            case 'safeTransferFrom':
                return `Trasferimento ${tokenId} da ${fromAddr} a ${toAddr}`;
            case 'AuctionStarted':
                return `Asta iniziata per ${tokenId} (min. ${priceDisplay}) da ${sellerAddr}`;
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
            {renderDebugInfo()}

            <div className="mb-6">
                <label htmlFor="query-selector" className="block text-sm font-medium text-gray-700 mb-2">Filtra per tipo di evento:</label>
                <select
                    id="query-selector"
                    value={selectedQuery}
                    onChange={(e) => setSelectedQuery(e.target.value as QueryType)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
                >
                    <option value="purchases">Acquisti (Default)</option>
                    <option value="all">Tutti gli eventi</option>
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