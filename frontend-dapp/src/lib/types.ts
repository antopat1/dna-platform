// frontend-dapp/src/lib/types.ts

export type ScientificContentRegistryContent = {
  // Questi campi sono quelli che hai visto nei "Dati raw restituiti" più di recente,
  // o che ti aspetti in base alla logica del tuo contratto.
  // Li rendiamo tutti opzionali per evitare errori di tipo se il contratto non li restituisce sempre.

  // Campi che il log raw mostrava
  title?: string;
  description?: string;
  author?: `0x${string}`; // Questo era nel tuo log raw, ma VSC dice che manca
  contentHash?: `0x${string}`;

  // Campo booleano per la disponibilità
  isAvailable?: boolean; // Era 'isAvailableForMint', ora 'isAvailable'

  // Campi essenziali per il minting, che il tuo contratto dovrebbe restituire per la logica
  creator?: `0x${string}`; // Aggiunto come opzionale, VSC dice che non esiste
  ipfsHash?: string;       // Aggiunto come opzionale, VSC dice che non esiste
  blockTimestamp?: bigint;
  nftMintPrice?: bigint;
  maxCopies?: bigint;
  mintedCopies?: bigint;
};