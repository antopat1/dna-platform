// frontend-dapp/src\utils\trackTransaction.ts

import { TransactionReceipt } from 'viem'; // Importa da viem
import { formatUnits, parseUnits } from 'viem'; // Importa da viem
import { ContractFunctionRevertedError } from 'viem'; // Per gli errori di revert
import { WriteContractErrorType } from 'wagmi/actions'; // Tipo di errore da Wagmi

// Definizione dell'interfaccia per i dettagli della transazione
export interface TransactionDetails { // Esportato per poter essere usato in altri file
  transactionHash: `0x${string}`; // viem usa stringhe esadecimali tipizzate
  from: `0x${string}`;
  to: `0x${string}`;
  value: string; // Valore ETH in stringa (es. "0.005")
  gasPrice?: string; // in Gwei o Wei, a seconda di come lo ricevi e vuoi salvarlo
  gasUsed?: string;
  blockNumber?: number;
  timestamp?: string; // ISO string
  methodName?: string; // Es. "mintNFT", "transferFrom"
  contractName?: string; // Es. "ScientificContentNFT", "Marketplace"
  chainId: number;
  status: 'pending' | 'success' | 'failed' | 'user_rejected' | 'reverted'; // Nuovi stati
  errorMessage?: string;
  metadata?: Record<string, any>; // Dati aggiuntivi da salvare
}

/**
 * Invia i dettagli di una transazione all'API di backend per il salvataggio.
 * @param details I dettagli della transazione.
 */
export async function trackTransaction(details: TransactionDetails) {
  // Rimossi console.log di debug sull'avvio e sui dettagli
  
  try {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(details),
    });
    
    // Rimossi console.log di debug sulla risposta

    const responseText = await response.text();
    // Rimosso console.log di debug sulla raw response

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: responseText };
      }
      // Mantenuto console.error per il fallimento dell'API
      console.error('Failed to track transaction via API:', errorData.error);
    } else {
      // Rimossi console.log sul successo del tracking
    }
  } catch (error) {
    // Mantenuto console.error per errori di rete o fetch
    console.error('Error sending transaction to tracking API:', error);
  }
  // Rimosso console.log di debug sul completamento
}

/**
 * Helper per costruire TransactionDetails da un oggetto TransactionResponse di Wagmi/viem (prima della conferma).
 * @param txHash L'hash della transazione.
 * @param fromAddress L'indirizzo del mittente (dal wallet connesso).
 * @param toAddress L'indirizzo del contratto chiamato.
 * @param value Il valore in Wei (BigInt).
 * @param methodName Il nome della funzione del contratto chiamata (es. "mintNFT").
 * @param contractName Il nome del contratto (es. "ScientificContentNFT").
 * @param chainId L'ID della chain.
 * @param metadata Dati aggiuntivi da allegare.
 * @returns Oggetto TransactionDetails.
 */
export function buildPendingTxDetails(
  txHash: `0x${string}`,
  fromAddress: `0x${string}`,
  toAddress: `0x${string}`,
  value: bigint,
  methodName: string,
  contractName: string,
  chainId: number,
  metadata?: Record<string, any>
): TransactionDetails {
  return {
    transactionHash: txHash,
    from: fromAddress,
    to: toAddress,
    value: formatUnits(value, 18), // Converti Wei in ETH (18 decimali)
    methodName,
    contractName,
    chainId,
    status: 'pending',
    metadata,
  };
}

/**
 * Helper per aggiornare TransactionDetails con i dati di una TransactionReceipt.
 * @param initialDetails I dettagli iniziali della transazione pending.
 * @param txReceipt La ricevuta della transazione confermata da viem.
 * @returns Oggetto TransactionDetails aggiornato.
 */
export function buildConfirmedTxDetails(
  initialDetails: TransactionDetails,
  txReceipt: TransactionReceipt,
): TransactionDetails {
  // Controlla lo stato della transazione dalla ricevuta
  const status = txReceipt.status === 'success' ? 'success' : 'reverted';
  const errorMessage = status === 'reverted' ? 'Transaction reverted on-chain' : undefined;

  return {
    ...initialDetails,
    blockNumber: Number(txReceipt.blockNumber), // Converti da bigint a number
    gasUsed: txReceipt.gasUsed ? formatUnits(txReceipt.gasUsed, 0) : undefined, // Gas used in stringa
    status,
    errorMessage,
    timestamp: new Date().toISOString(), // Data/ora della conferma del blocco
  };
}

/**
 * Helper per costruire TransactionDetails da un errore di transazione.
 * @param initialDetails I dettagli iniziali della transazione (anche se solo hash e from/to).
 * @param error L'oggetto errore (e.g., Wagmi WriteContractErrorType).
 * @returns Oggetto TransactionDetails aggiornato.
 */
export function buildFailedTxDetails(
  initialDetails: Omit<TransactionDetails, 'status'>, // Non aspettarti lo stato iniziale
  error: WriteContractErrorType | Error, // Usa il tipo di errore che ricevi
): TransactionDetails {
  let status: TransactionDetails['status'] = 'failed';
  let errorMessage: string = error.message || 'Unknown error during transaction';

  // Rileva errori specifici di Wagmi/Viem
  if (error instanceof ContractFunctionRevertedError) {
      status = 'reverted';
      errorMessage = `Contract reverted: ${error.reason || error.shortMessage || error.message}`;
  } else if ((error as any).code === 4001) { // Standard per user rejected transaction
      status = 'user_rejected';
      errorMessage = 'User rejected the transaction';
  } else if ((error as any).shortMessage && (error as any).shortMessage.includes("User rejected the request")) {
      status = 'user_rejected';
      errorMessage = 'User rejected the transaction';
  }
  // Puoi aggiungere altri controlli specifici per altri tipi di errori se necessario

  return {
    ...initialDetails,
    transactionHash: initialDetails.transactionHash || '0x', // Assicurati che l'hash sia presente anche se la transazione non è stata inviata
    status,
    errorMessage,
    timestamp: new Date().toISOString(),
  };
}
