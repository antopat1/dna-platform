// scripts/checkRegistry.ts
import { createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import 'dotenv/config'; // Assicurati di avere 'dotenv' installato per leggere .env

// --- CONFIGURAZIONE ---
// Indirizzo del tuo contratto ScientificContentRegistry
const SCIENTIFIC_CONTENT_REGISTRY_ADDRESS = '0x943d81e96d3eef8c08a56fa3073fd942c3620466' as const;

// L'ID del contenuto che hai coniato (probabilmente 1)
const CONTENT_ID_TO_CHECK = 1n; // Il 'n' finale lo rende un BigInt

// ABI ESATTA della funzione getContent dal tuo ScientificContentRegistry.sol
const SCIENTIFIC_CONTENT_REGISTRY_GET_CONTENT_ABI = {
  inputs: [
    {
      internalType: 'uint256',
      name: 'contentId',
      type: 'uint256',
    },
  ],
  name: 'getContent',
  outputs: [
    {
      components: [
        { internalType: 'string', name: 'title', type: 'string' },
        { internalType: 'string', name: 'description', type: 'string' },
        { internalType: 'address', name: 'author', type: 'address' },
        { internalType: 'bytes32', name: 'contentHash', type: 'bytes32' },
        { internalType: 'bool', name: 'isAvailable', type: 'bool' },
        { internalType: 'uint256', name: 'registrationTime', type: 'uint256' },
        { internalType: 'uint256', name: 'maxCopies', type: 'uint256' },
        { internalType: 'uint256', name: 'mintedCopies', type: 'uint256' }, // Questo è il campo che ci interessa
        { internalType: 'string', name: 'ipfsHash', type: 'string' },
        { internalType: 'uint256', name: 'nftMintPrice', type: 'uint256' },
      ],
      internalType: 'struct ScientificContentRegistry.Content',
      name: '',
      type: 'tuple',
    },
  ],
  stateMutability: 'view',
  type: 'function',
};

// NON ABBIAMO PIÙ BISOGNO DI UN TIPO MANUALE SE L'ABI È PRECISA E VIEM DECODIFICA IN OGGETTO.
// Se l'errore di tipo 'unknown' dovesse riapparire, possiamo forzarlo di nuovo,
// ma l'attuale decodifica in oggetto rende l'accesso molto più leggibile.

async function checkMintedCopies() {
  try {
    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(process.env.ARBITRUM_SEPOLIA_RPC_URL),
    });

    console.log(`Collegato alla rete Arbitrum Sepolia.`);
    console.log(`Leggendo il contratto ScientificContentRegistry a: ${SCIENTIFIC_CONTENT_REGISTRY_ADDRESS}`);
    console.log(`Per il Content ID: ${CONTENT_ID_TO_CHECK.toString()}`);

    const content = await publicClient.readContract({
      address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
      abi: [SCIENTIFIC_CONTENT_REGISTRY_GET_CONTENT_ABI],
      functionName: 'getContent',
      args: [CONTENT_ID_TO_CHECK],
    });

    console.log("Risultato completo di getContent:", content);

    // ACCESSO CORRETTO: Usa il nome della proprietà, non l'indice
    const mintedCopiesOnChain = (content as any).mintedCopies; // Cast a 'any' per evitare l'errore di TypeScript per ora, dato che Viem lo decodifica in un oggetto.


    console.log(`Valore attuale di 'mintedCopies' per Content ID ${CONTENT_ID_TO_CHECK} sulla blockchain: ${mintedCopiesOnChain.toString()}`);

    if (mintedCopiesOnChain === 2n) {
      console.log("Ottimo! Il conteggio sulla blockchain è 2. Il problema è nel frontend.");
    } else {
      console.log(`Attenzione: Il conteggio sulla blockchain è ${mintedCopiesOnChain.toString()}, non 2.`);
      console.log("Questo conferma che la funzione 'incrementMintedCopies' nel ScientificContentRegistry non sta funzionando correttamente.");
      console.log("Oppure, la chiamata a 'incrementMintedCopies' dal tuo contratto ScientificContentNFT non sta avvenendo.");
    }

  } catch (error) {
    console.error("Errore durante la lettura del contratto:", error);
    if (error && typeof error === 'object' && 'cause' in error) {
        console.error("Causa dell'errore:", (error as any).cause);
    }
  }
}

checkMintedCopies();