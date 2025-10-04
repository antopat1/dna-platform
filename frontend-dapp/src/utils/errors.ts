// frontend-dapp/src/utils/errors.ts


export const translateBlockchainError = (error: any): string => {

  const errorMessage = error?.shortMessage || error?.message || '';

  console.error("Original Blockchain Error:", errorMessage); // Utile per il debug


  if (errorMessage.includes('insufficient funds') || errorMessage.includes('exceeds the balance')) {
    return "Fondi insufficienti nel tuo account per completare la transazione. Assicurati di avere abbastanza ETH per coprire il costo dell'NFT e le spese di gas.";
  }

  if (errorMessage.includes('User rejected') || errorMessage.includes('denied transaction signature')) {
    return "Hai annullato la transazione dal tuo wallet.";
  }


  if (errorMessage.includes('reverted')) {
    return "La transazione è stata annullata sulla blockchain. Le condizioni potrebbero essere cambiate (es. l'oggetto è già stato venduto).";
  }


  if (errorMessage.includes('nonce too low')) {
    return "Si è verificato un problema di sincronizzazione con il tuo wallet. Prova a reimpostare l'account nelle impostazioni di MetaMask.";
  }
  

  return "Si è verificato un errore imprevisto. Controlla la console per i dettagli e riprova.";
};