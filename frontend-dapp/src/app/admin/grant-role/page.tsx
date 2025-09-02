'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { keccak256, toHex, isAddress } from 'viem';
import {
  SCIENTIFIC_CONTENT_REGISTRY_ABI,
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
  SCIENTIFIC_CONTENT_NFT_ABI,
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
  SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS
} from '@/lib/constants';

const ADMIN_ROLE_HASH = keccak256(toHex('ADMIN_ROLE'));

interface ContractConfig {
  address: `0x${string}`;
  abi: any;
  grantFunctionName: string;
  revokeFunctionName: string;
  name: string;
}

const contractsConfig: ContractConfig[] = [
  {
    address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
    abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
    grantFunctionName: 'addAdmin',
    revokeFunctionName: 'removeAdmin',
    name: 'Scientific Content Registry',
  },
  {
    address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
    abi: SCIENTIFIC_CONTENT_NFT_ABI,
    grantFunctionName: 'grantRole',
    revokeFunctionName: 'revokeRole',
    name: 'Scientific Content NFT',
  },
  {
    address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
    abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
    grantFunctionName: 'addAdmin',
    revokeFunctionName: 'removeAdmin',
    name: 'DnA Content Marketplace',
  },
];

interface TransactionState {
  contractIndex: number;
  hash?: string;
  isConfirmed: boolean;
  error?: string;
  isPending: boolean;
}

type OperationType = 'grant' | 'revoke';

export default function AdminManagementPage() {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { address } = useAccount();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [operationType, setOperationType] = useState<OperationType>('grant');
  const [currentContractIndex, setCurrentContractIndex] = useState(-1);
  const [transactions, setTransactions] = useState<TransactionState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  const {
    writeContract,
    data: hash,
    isPending: isTxPending,
    error: writeError,
    reset: resetWrite
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError
  } = useWaitForTransactionReceipt({
    hash,
  });

  const executeTransaction = useCallback((contractIndex: number, recipientAddr: string, operation: OperationType) => {
    const contract = contractsConfig[contractIndex];

    setTransactions(prev =>
      prev.map((tx, idx) =>
        idx === contractIndex
          ? { ...tx, isPending: true }
          : tx
      )
    );

    const functionName = operation === 'grant' ? contract.grantFunctionName : contract.revokeFunctionName;
    const args = functionName === 'grantRole' || functionName === 'revokeRole'
      ? [ADMIN_ROLE_HASH, recipientAddr as `0x${string}`]
      : [recipientAddr as `0x${string}`];

    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: functionName,
      args: args,
    });
  }, [writeContract]);

  useEffect(() => {
    if (currentContractIndex === -1) return;

    if (writeError && transactions[currentContractIndex]) {
      setTransactions(prev =>
        prev.map((tx, idx) =>
          idx === currentContractIndex
            ? { ...tx, error: writeError.message || 'Errore durante l\'invio della transazione', isPending: false }
            : tx
        )
      );

      setTimeout(() => {
        const nextIndex = currentContractIndex + 1;
        if (nextIndex < contractsConfig.length) {
          setCurrentContractIndex(nextIndex);
          resetWrite();
        } else {
          setIsProcessing(false);
          setCurrentContractIndex(-1);
        }
      }, 2000);

      return;
    }

    if (isConfirmed && hash && transactions[currentContractIndex] && !transactions[currentContractIndex].isConfirmed) {
      setTransactions(prev =>
        prev.map((tx, idx) =>
          idx === currentContractIndex
            ? { ...tx, isConfirmed: true, hash: hash, isPending: false }
            : tx
        )
      );

      setTimeout(() => {
        const nextIndex = currentContractIndex + 1;
        if (nextIndex < contractsConfig.length) {
          setCurrentContractIndex(nextIndex);
          resetWrite();
        } else {
          setIsProcessing(false);
          setCurrentContractIndex(-1);
        }
      }, 1000);
    }

    if (receiptError && transactions[currentContractIndex]) {
      setTransactions(prev =>
        prev.map((tx, idx) =>
          idx === currentContractIndex
            ? { ...tx, error: receiptError.message || 'Errore durante la conferma', isPending: false }
            : tx
        )
      );

      setTimeout(() => {
        const nextIndex = currentContractIndex + 1;
        if (nextIndex < contractsConfig.length) {
          setCurrentContractIndex(nextIndex);
          resetWrite();
        } else {
          setIsProcessing(false);
          setCurrentContractIndex(-1);
        }
      }, 2000);
    }

  }, [isConfirmed, writeError, receiptError, hash, currentContractIndex, transactions, resetWrite]);

  useEffect(() => {
    if (currentContractIndex >= 0 && currentContractIndex < contractsConfig.length && recipientAddress) {
      const timer = setTimeout(() => {
        executeTransaction(currentContractIndex, recipientAddress, operationType);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [currentContractIndex, recipientAddress, operationType, executeTransaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientAddress || !isAddress(recipientAddress)) {
      alert("Inserisci un indirizzo Ethereum valido.");
      return;
    }

    if (!address) {
      alert("Connetti il tuo wallet per continuare.");
      return;
    }

    if (operationType === 'revoke' && address.toLowerCase() === recipientAddress.toLowerCase()) {
      const confirm = window.confirm(
        "Attenzione: stai per rimuovere i privilegi di amministratore dal tuo stesso account. " +
        "Dopo questa operazione non potrai più gestire gli amministratori. Vuoi continuare?"
      );
      if (!confirm) return;
    }

    resetWrite();

    setTransactions(
      contractsConfig.map((contract, index) => ({
        contractIndex: index,
        isConfirmed: false,
        isPending: false,
      }))
    );

    setIsProcessing(true);
    setCurrentContractIndex(0);
  };

  const resetForm = () => {
    setRecipientAddress('');
    setTransactions([]);
    setCurrentContractIndex(-1);
    setIsProcessing(false);
    resetWrite();
  };

  if (roleLoading) {
    return (
      <div className="flex justify-center items-center h-screen text-xl text-white">
        Verifica dei permessi...
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] text-gray-900 p-8 flex flex-col justify-center items-center">
        <div className="text-center p-6 bg-white rounded-lg shadow-lg">
          <h1 className="text-4xl font-bold mb-4 text-red-600">Accesso Negato</h1>
          <p className="text-lg">Solo gli amministratori possono accedere a questa pagina.</p>
        </div>
      </div>
    );
  }

  const allTransactionsCompleted = transactions.length > 0 &&
    transactions.every(tx => tx.isConfirmed || tx.error);

  const getCurrentStatus = (index: number) => {
    const tx = transactions[index];
    if (!tx) return 'In attesa';

    if (tx.error) return 'Errore';
    if (tx.isConfirmed) return 'Confermata';
    if (currentContractIndex === index) {
      if (isTxPending) return 'Invio...';
      if (isConfirming) return 'Conferma...';
      if (tx.isPending) return 'In corso...';
    }
    if (currentContractIndex > index) return 'Completata';
    return 'In attesa';
  };

  const getStatusColor = (index: number) => {
    const tx = transactions[index];
    if (!tx) return 'border-gray-300';

    if (tx.error) return 'border-red-500';
    if (tx.isConfirmed) return 'border-green-500';
    if (currentContractIndex === index) return 'border-blue-500';
    return 'border-gray-300';
  };

  const getStatusBgColor = (index: number) => {
    const tx = transactions[index];
    if (!tx) return 'bg-gray-100';

    if (tx.error) return 'bg-red-100';
    if (tx.isConfirmed) return 'bg-green-100';
    if (currentContractIndex === index) return 'bg-blue-100';
    return 'bg-gray-100';
  };

  const getStatusBadgeColor = (index: number) => {
    const tx = transactions[index];
    if (!tx) return 'bg-gray-400 text-white';

    if (tx.error) return 'bg-red-500 text-white';
    if (tx.isConfirmed) return 'bg-green-500 text-white';
    if (currentContractIndex === index) return 'bg-blue-500 text-white';
    return 'bg-gray-400 text-white';
  };

  const getOperationTitle = () => {
    return operationType === 'grant' ? 'Conferisci Ruolo Amministratore' : 'Rimuovi Ruolo Amministratore';
  };

  const getOperationButtonText = () => {
    if (isTxPending) return 'In attesa di firma...';
    if (isConfirming) return 'Conferma in corso...';
    return operationType === 'grant' ? 'Conferisci Ruolo Admin' : 'Rimuovi Ruolo Admin';
  };

  const getOperationColor = () => {
    return operationType === 'grant' ? 'purple' : 'red';
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-gray-900 p-8">
      <div className="container mx-auto max-w-2xl bg-white p-6 rounded-lg shadow-lg">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-purple-600 mb-8">
          Gestione Amministratori
        </h1>

        {/* Toggle per mostrare/nascondere info di debug */}
        <div className="mb-4 text-center">
          <button
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            {showDebugInfo ? 'Nascondi' : 'Mostra'} informazioni di debug
          </button>
        </div>

        {/* Info di debug minimizzate */}
        {showDebugInfo && (
          <div className="mb-6 p-4 rounded-md border border-gray-300 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Informazioni di Debug</h3>
            <div className="text-xs space-y-1 text-gray-600">
              <p><strong>Wallet:</strong> {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Non connesso'}</p>
              <p><strong>Status Admin:</strong> 
                <span className={`ml-1 px-2 py-1 rounded text-xs ${
                  isAdmin ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {isAdmin ? 'Admin' : 'Utente'}
                </span>
              </p>
            </div>
          </div>
        )}

        <p className="mb-6 text-sm text-gray-600 text-center">
          Gestisci i ruoli di amministratore su tutti i contratti della piattaforma DnA Scientific Content.
        </p>

        {!isProcessing && transactions.length === 0 ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Selezione tipo operazione */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo di Operazione
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="operationType"
                    value="grant"
                    checked={operationType === 'grant'}
                    onChange={(e) => setOperationType(e.target.value as OperationType)}
                    className="focus:ring-purple-500 h-4 w-4 text-purple-600 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-900">Conferisci Ruolo Admin</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="operationType"
                    value="revoke"
                    checked={operationType === 'revoke'}
                    onChange={(e) => setOperationType(e.target.value as OperationType)}
                    className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-900">Rimuovi Ruolo Admin</span>
                </label>
              </div>
            </div>

            {/* Input indirizzo */}
            <div>
              <label htmlFor="addressInput" className="block text-sm font-medium text-gray-700">
                Indirizzo Ethereum
              </label>
              <input
                type="text"
                id="addressInput"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="0x..."
                className="mt-1 block w-full rounded-md border-gray-300 bg-white text-gray-900 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm p-3"
                required
              />
              {operationType === 'revoke' && recipientAddress.toLowerCase() === address?.toLowerCase() && (
                <p className="mt-2 text-sm text-red-600">
                  ⚠️ Attenzione: stai per rimuovere i tuoi stessi privilegi di amministratore
                </p>
              )}
            </div>

            {/* Descrizione operazione */}
            <div className={`p-4 rounded-md border-l-4 ${
              operationType === 'grant' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
            }`}>
              <h3 className={`font-medium ${
                operationType === 'grant' ? 'text-green-800' : 'text-red-800'
              }`}>
                {getOperationTitle()}
              </h3>
              <p className={`text-sm mt-1 ${
                operationType === 'grant' ? 'text-green-700' : 'text-red-700'
              }`}>
                {operationType === 'grant' 
                  ? 'L\'indirizzo specificato otterrà i privilegi di amministratore su tutti e 3 i contratti della piattaforma.'
                  : 'L\'indirizzo specificato perderà i privilegi di amministratore su tutti e 3 i contratti della piattaforma.'
                }
              </p>
            </div>

            <button
              type="submit"
              disabled={isTxPending || isConfirming}
              className={`w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors ${
                isTxPending || isConfirming 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : operationType === 'grant'
                    ? 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                    : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
              } focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              {getOperationButtonText()}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {allTransactionsCompleted && (
              <div className={`mt-6 p-4 rounded-md border ${
                operationType === 'grant' 
                  ? 'bg-purple-100 border-purple-300' 
                  : 'bg-red-100 border-red-300'
              }`}>
                <h3 className={`font-semibold mb-2 ${
                  operationType === 'grant' ? 'text-purple-700' : 'text-red-700'
                }`}>
                  {transactions.every(tx => tx.isConfirmed)
                    ? `${operationType === 'grant' ? 'Conferimento' : 'Rimozione'} Completata con Successo!`
                    : `${operationType === 'grant' ? 'Conferimento' : 'Rimozione'} Completata con Alcuni Errori`
                  }
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Operazione: <strong>{operationType === 'grant' ? 'Conferimento' : 'Rimozione'} ruolo admin</strong><br/>
                  Indirizzo: <code className={`px-1 rounded ${
                    operationType === 'grant' ? 'bg-purple-200' : 'bg-red-200'
                  }`}>{recipientAddress}</code>
                </p>
                <button
                  onClick={resetForm}
                  className={`w-full py-2 px-4 rounded-md text-white text-sm font-medium transition-colors ${
                    operationType === 'grant'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Esegui Nuova Operazione
                </button>
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2 text-gray-700">Progresso Transazioni:</h3>
              <div className="w-full bg-gray-300 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    operationType === 'grant' ? 'bg-purple-600' : 'bg-red-600'
                  }`}
                  style={{
                    width: `${(transactions.filter(tx => tx.isConfirmed || tx.error).length / contractsConfig.length) * 100}%`
                  }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {transactions.filter(tx => tx.isConfirmed || tx.error).length} di {contractsConfig.length} completate
              </p>
            </div>

            {transactions.map((tx, index) => (
              <div
                key={index}
                className={`p-4 rounded-md border-l-4 transition-colors ${getStatusBgColor(index)} ${getStatusColor(index)}`}
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-gray-800">{contractsConfig[index].name}</h4>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusBadgeColor(index)}`}>
                    {getCurrentStatus(index)}
                  </span>
                </div>

                {tx.hash && (
                  <p className="text-xs mt-2 text-gray-600">
                    <a
                      href={`https://sepolia.arbiscan.io/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      Visualizza su Explorer
                    </a>
                  </p>
                )}

                {tx.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs text-red-700">
                      <strong>Errore:</strong> {tx.error}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 'use client';

// import { useState, useEffect, useCallback } from 'react';
// import { useUserRole } from '@/hooks/useUserRole';
// import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
// import { keccak256, toHex, isAddress } from 'viem';
// import {
//   SCIENTIFIC_CONTENT_REGISTRY_ABI,
//   SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
//   SCIENTIFIC_CONTENT_NFT_ABI,
//   SCIENTIFIC_CONTENT_NFT_ADDRESS,
//   SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
//   SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS
// } from '@/lib/constants';

// const ADMIN_ROLE_HASH = keccak256(toHex('ADMIN_ROLE'));

// interface ContractConfig {
//   address: `0x${string}`;
//   abi: any;
//   functionName: string;
//   name: string;
// }

// const contractsConfig: ContractConfig[] = [
//   {
//     address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
//     abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
//     functionName: 'addAdmin',
//     name: 'Scientific Content Registry',
//   },
//   {
//     address: SCIENTIFIC_CONTENT_NFT_ADDRESS,
//     abi: SCIENTIFIC_CONTENT_NFT_ABI,
//     functionName: 'grantRole',
//     name: 'Scientific Content NFT',
//   },
//   {
//     address: SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS,
//     abi: SCIENTIFIC_CONTENT_MARKETPLACE_ABI,
//     functionName: 'addAdmin',
//     name: 'DnA Content Marketplace',
//   },
// ];

// interface TransactionState {
//   contractIndex: number;
//   hash?: string;
//   isConfirmed: boolean;
//   error?: string;
//   isPending: boolean;
// }

// export default function GrantAdminRolePage() {
//   const { isAdmin, isLoading: roleLoading } = useUserRole();
//   const { address } = useAccount();
//   const [recipientAddress, setRecipientAddress] = useState('');
//   const [currentContractIndex, setCurrentContractIndex] = useState(-1);
//   const [transactions, setTransactions] = useState<TransactionState[]>([]);
//   const [isProcessing, setIsProcessing] = useState(false);

//   const {
//     writeContract,
//     data: hash,
//     isPending: isTxPending,
//     error: writeError,
//     reset: resetWrite
//   } = useWriteContract();

//   const {
//     isLoading: isConfirming,
//     isSuccess: isConfirmed,
//     error: receiptError
//   } = useWaitForTransactionReceipt({
//     hash,
//   });

//   const executeTransaction = useCallback((contractIndex: number, recipientAddr: string) => {
//     const contract = contractsConfig[contractIndex];

//     setTransactions(prev =>
//       prev.map((tx, idx) =>
//         idx === contractIndex
//           ? { ...tx, isPending: true }
//           : tx
//       )
//     );

//     const args = contract.functionName === 'grantRole'
//       ? [ADMIN_ROLE_HASH, recipientAddr as `0x${string}`]
//       : [recipientAddr as `0x${string}`];

//     writeContract({
//       address: contract.address,
//       abi: contract.abi,
//       functionName: contract.functionName,
//       args: args,
//     });
//   }, [writeContract]);

//   useEffect(() => {
//     if (currentContractIndex === -1) return;

//     if (writeError && transactions[currentContractIndex]) {
//       setTransactions(prev =>
//         prev.map((tx, idx) =>
//           idx === currentContractIndex
//             ? { ...tx, error: writeError.message || 'Errore durante l\'invio della transazione', isPending: false }
//             : tx
//         )
//       );

//       setTimeout(() => {
//         const nextIndex = currentContractIndex + 1;
//         if (nextIndex < contractsConfig.length) {
//           setCurrentContractIndex(nextIndex);
//           resetWrite();
//         } else {
//           setIsProcessing(false);
//           setCurrentContractIndex(-1);
//         }
//       }, 2000);

//       return;
//     }

//     if (isConfirmed && hash && transactions[currentContractIndex] && !transactions[currentContractIndex].isConfirmed) {
//       setTransactions(prev =>
//         prev.map((tx, idx) =>
//           idx === currentContractIndex
//             ? { ...tx, isConfirmed: true, hash: hash, isPending: false }
//             : tx
//         )
//       );

//       setTimeout(() => {
//         const nextIndex = currentContractIndex + 1;
//         if (nextIndex < contractsConfig.length) {
//           setCurrentContractIndex(nextIndex);
//           resetWrite();
//         } else {
//           setIsProcessing(false);
//           setCurrentContractIndex(-1);
//         }
//       }, 1000);
//     }

//     if (receiptError && transactions[currentContractIndex]) {
//       setTransactions(prev =>
//         prev.map((tx, idx) =>
//           idx === currentContractIndex
//             ? { ...tx, error: receiptError.message || 'Errore durante la conferma', isPending: false }
//             : tx
//         )
//       );

//       setTimeout(() => {
//         const nextIndex = currentContractIndex + 1;
//         if (nextIndex < contractsConfig.length) {
//           setCurrentContractIndex(nextIndex);
//           resetWrite();
//         } else {
//           setIsProcessing(false);
//           setCurrentContractIndex(-1);
//         }
//       }, 2000);
//     }

//   }, [isConfirmed, writeError, receiptError, hash, currentContractIndex, transactions, resetWrite]);

//   useEffect(() => {
//     if (currentContractIndex >= 0 && currentContractIndex < contractsConfig.length && recipientAddress) {
//       const timer = setTimeout(() => {
//         executeTransaction(currentContractIndex, recipientAddress);
//       }, 500);

//       return () => clearTimeout(timer);
//     }
//   }, [currentContractIndex, recipientAddress, executeTransaction]);

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();

//     if (!recipientAddress || !isAddress(recipientAddress)) {
//       alert("Inserisci un indirizzo Ethereum valido.");
//       return;
//     }

//     if (!address) {
//       alert("Connetti il tuo wallet per continuare.");
//       return;
//     }

//     resetWrite();

//     setTransactions(
//       contractsConfig.map((contract, index) => ({
//         contractIndex: index,
//         isConfirmed: false,
//         isPending: false,
//       }))
//     );

//     setIsProcessing(true);

//     setCurrentContractIndex(0);
//   };

//   const resetForm = () => {
//     setRecipientAddress('');
//     setTransactions([]);
//     setCurrentContractIndex(-1);
//     setIsProcessing(false);
//     resetWrite();
//   };

//   if (roleLoading) {
//     return (
//       <div className="flex justify-center items-center h-screen text-xl text-white">
//         Verifica dei permessi...
//       </div>
//     );
//   }
  
//   // Condizionale per mostrare "Accesso Negato" se non sei admin
//   if (!isAdmin) {
//     return (
//       <div className="min-h-screen bg-[#f3f4f6] text-gray-900 p-8 flex flex-col justify-center items-center">
//         <div className="text-center p-6 bg-white rounded-lg shadow-lg">
//           <h1 className="text-4xl font-bold mb-4 text-red-600">Accesso Negato</h1>
//           <p className="text-lg">Solo gli amministratori possono accedere a questa pagina.</p>
//         </div>
//       </div>
//     );
//   }


//   const allTransactionsCompleted = transactions.length > 0 &&
//     transactions.every(tx => tx.isConfirmed || tx.error);

//   const getCurrentStatus = (index: number) => {
//     const tx = transactions[index];
//     if (!tx) return 'In attesa';

//     if (tx.error) return 'Errore';
//     if (tx.isConfirmed) return 'Confermata';
//     if (currentContractIndex === index) {
//       if (isTxPending) return 'Invio...';
//       if (isConfirming) return 'Conferma...';
//       if (tx.isPending) return 'In corso...';
//     }
//     if (currentContractIndex > index) return 'Completata';
//     return 'In attesa';
//   };

//   const getStatusColor = (index: number) => {
//     const tx = transactions[index];
//     if (!tx) return 'border-gray-300';

//     if (tx.error) return 'border-red-500';
//     if (tx.isConfirmed) return 'border-green-500';
//     if (currentContractIndex === index) return 'border-blue-500';
//     return 'border-gray-300';
//   };

//   const getStatusBgColor = (index: number) => {
//     const tx = transactions[index];
//     if (!tx) return 'bg-gray-100';

//     if (tx.error) return 'bg-red-100';
//     if (tx.isConfirmed) return 'bg-green-100';
//     if (currentContractIndex === index) return 'bg-blue-100';
//     return 'bg-gray-100';
//   };

//   const getStatusBadgeColor = (index: number) => {
//     const tx = transactions[index];
//     if (!tx) return 'bg-gray-400 text-white';

//     if (tx.error) return 'bg-red-500 text-white';
//     if (tx.isConfirmed) return 'bg-green-500 text-white';
//     if (currentContractIndex === index) return 'bg-blue-500 text-white';
//     return 'bg-gray-400 text-white';
//   };

//   return (
//     <div className="min-h-screen bg-[#f3f4f6] text-gray-900 p-8">
//       <div className="container mx-auto max-w-2xl bg-white p-6 rounded-lg shadow-lg">
//         <h1 className="text-3xl md:text-4xl font-bold text-center text-purple-600 mb-8">
//           Conferisci Ruolo Amministratore
//         </h1>

//         <div className="mb-8 p-4 rounded-md border-l-4 border-yellow-500 bg-yellow-100">
//           <h3 className="text-lg font-semibold text-yellow-800 mb-2">Stato Amministratore (Debug)</h3>
//           <ul className="text-sm space-y-1 text-gray-700">
//             <li>
//               **Indirizzo Collegato:** <code className="break-all">{address || 'Non Connesso'}</code>
//             </li>
//             <li>
//               **Sei un Admin?**
//               <span className={`px-2 py-1 rounded-md text-xs font-semibold ml-2 ${
//                 isAdmin ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
//               }`}>
//                 {roleLoading ? 'Verifica in corso...' : (isAdmin ? 'Sì' : 'No')}
//               </span>
//             </li>
//             <li className="mt-4">
//               <span className="font-medium">Indirizzi dei contratti (`constants.ts`):</span>
//               <ul className="list-disc list-inside ml-4 text-xs">
//                 <li>Registry: <code className="break-all">{SCIENTIFIC_CONTENT_REGISTRY_ADDRESS}</code></li>
//                 <li>NFT: <code className="break-all">{SCIENTIFIC_CONTENT_NFT_ADDRESS}</code></li>
//                 <li>Marketplace: <code className="break-all">{SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS}</code></li>
//               </ul>
//             </li>
//           </ul>
//         </div>

//         <p className="mb-6 text-sm text-gray-500 text-center">
//           Usa questo strumento per eleggere un nuovo amministratore su tutti i contratti della piattaforma.
//         </p>

//         {!isProcessing && transactions.length === 0 ? (
//           <form onSubmit={handleSubmit} className="space-y-4">
//             <div>
//               <label htmlFor="addressInput" className="block text-sm font-medium text-gray-700">
//                 Indirizzo Amministratore (EoA)
//               </label>
//               <input
//                 type="text"
//                 id="addressInput"
//                 value={recipientAddress}
//                 onChange={(e) => setRecipientAddress(e.target.value)}
//                 placeholder="0x..."
//                 className="mt-1 block w-full rounded-md border-gray-300 bg-white text-gray-900 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm p-2"
//                 required
//               />
//             </div>

//             <button
//               type="submit"
//               disabled={isTxPending || isConfirming}
//               className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
//                 isTxPending || isConfirming ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
//               }`}
//             >
//               {isTxPending ? 'In attesa di firma...' : isConfirming ? 'Conferma in corso...' : 'Conferma Ruolo Admin'}
//             </button>
//           </form>
//         ) : (
//           <div className="space-y-4">
//             {allTransactionsCompleted && (
//               <div className="mt-6 p-4 bg-purple-100 rounded-md border border-purple-300">
//                 <h3 className="font-semibold text-purple-700 mb-2">
//                   {transactions.every(tx => tx.isConfirmed)
//                     ? 'Processo Completato con Successo!'
//                     : 'Processo Completato con Alcuni Errori'
//                   }
//                 </h3>
//                 <p className="text-sm text-gray-600 mb-4">
//                   Indirizzo destinatario: <code className="bg-purple-200 px-1 rounded">{recipientAddress}</code>
//                 </p>
//                 <button
//                   onClick={resetForm}
//                   className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 rounded-md text-white text-sm font-medium transition-colors"
//                 >
//                   Esegui Nuova Operazione
//                 </button>
//               </div>
//             )}

//             <div className="mb-4">
//               <h3 className="text-lg font-semibold mb-2 text-gray-700">Progresso Transazioni:</h3>
//               <div className="w-full bg-gray-300 rounded-full h-2">
//                 <div
//                   className="bg-purple-600 h-2 rounded-full transition-all duration-300"
//                   style={{
//                     width: `${(transactions.filter(tx => tx.isConfirmed || tx.error).length / contractsConfig.length) * 100}%`
//                   }}
//                 ></div>
//               </div>
//               <p className="text-sm text-gray-500 mt-1">
//                 {transactions.filter(tx => tx.isConfirmed || tx.error).length} di {contractsConfig.length} completate
//               </p>
//             </div>

//             {transactions.map((tx, index) => (
//               <div
//                 key={index}
//                 className={`p-4 rounded-md border-l-4 transition-colors ${getStatusBgColor(index)} ${getStatusColor(index)}`}
//               >
//                 <div className="flex justify-between items-center">
//                   <h4 className="font-semibold text-gray-800">{contractsConfig[index].name}</h4>
//                   <span className={`px-2 py-1 rounded text-xs ${getStatusBadgeColor(index)}`}>
//                     {getCurrentStatus(index)}
//                   </span>
//                 </div>

//                 {tx.hash && (
//                   <p className="text-xs mt-2 text-gray-600">
//                     Hash: <a
//                       href={`https://sepolia.arbiscan.io/tx/${tx.hash}`}
//                       target="_blank"
//                       rel="noopener noreferrer"
//                       className="text-blue-500 hover:underline break-all"
//                     >
//                       {tx.hash}
//                     </a>
//                   </p>
//                 )}

//                 {tx.error && (
//                   <p className="text-xs mt-2 text-red-600">
//                     Errore: {tx.error}
//                   </p>
//                 )}
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }


