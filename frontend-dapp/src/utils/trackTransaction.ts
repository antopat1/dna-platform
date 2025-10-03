// frontend-dapp/src\utils\trackTransaction.ts

import { TransactionReceipt } from 'viem'; 
import { formatUnits, parseUnits } from 'viem'; 
import { ContractFunctionRevertedError } from 'viem'; 
import { WriteContractErrorType } from 'wagmi/actions'; 


export interface TransactionDetails { 
  transactionHash: `0x${string}`; 
  from: `0x${string}`;
  to: `0x${string}`;
  value: string; 
  gasPrice?: string; 
  gasUsed?: string;
  blockNumber?: number;
  timestamp?: string; 
  methodName?: string; 
  contractName?: string; 
  chainId: number;
  status: 'pending' | 'success' | 'failed' | 'user_rejected' | 'reverted'; 
  errorMessage?: string;
  metadata?: Record<string, any>; 
}

/**
 * @param details 
 */
export async function trackTransaction(details: TransactionDetails) {
  
  try {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(details),
    });

    const responseText = await response.text();
    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: responseText };
      }
      console.error('Failed to track transaction via API:', errorData.error);
    } else {
    }
  } catch (error) {
    console.error('Error sending transaction to tracking API:', error);
  }
}

/**
 * @param txHash 
 * @param fromAddress
 * @param toAddress 
 * @param value 
 * @param methodName 
 * @param contractName 
 * @param chainId 
 * @param metadata 
 * @returns 
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
    value: formatUnits(value, 18), 
    methodName,
    contractName,
    chainId,
    status: 'pending',
    metadata,
  };
}

/**
 * @param initialDetails 
 * @param txReceipt 
 * @returns 
 */
export function buildConfirmedTxDetails(
  initialDetails: TransactionDetails,
  txReceipt: TransactionReceipt,
): TransactionDetails {
  const status = txReceipt.status === 'success' ? 'success' : 'reverted';
  const errorMessage = status === 'reverted' ? 'Transaction reverted on-chain' : undefined;

  return {
    ...initialDetails,
    blockNumber: Number(txReceipt.blockNumber), 
    gasUsed: txReceipt.gasUsed ? formatUnits(txReceipt.gasUsed, 0) : undefined, 
    status,
    errorMessage,
    timestamp: new Date().toISOString(), 
  };
}

/**
 * @param initialDetails 
 * @param error 
 * @returns 
 */
export function buildFailedTxDetails(
  initialDetails: Omit<TransactionDetails, 'status'>, 
  error: WriteContractErrorType | Error, 
): TransactionDetails {
  let status: TransactionDetails['status'] = 'failed';
  let errorMessage: string = error.message || 'Unknown error during transaction';

 
  if (error instanceof ContractFunctionRevertedError) {
      status = 'reverted';
      errorMessage = `Contract reverted: ${error.reason || error.shortMessage || error.message}`;
  } else if ((error as any).code === 4001) { 
      status = 'user_rejected';
      errorMessage = 'User rejected the transaction';
  } else if ((error as any).shortMessage && (error as any).shortMessage.includes("User rejected the request")) {
      status = 'user_rejected';
      errorMessage = 'User rejected the transaction';
  }
 

  return {
    ...initialDetails,
    transactionHash: initialDetails.transactionHash || '0x', 
    status,
    errorMessage,
    timestamp: new Date().toISOString(),
  };
}
