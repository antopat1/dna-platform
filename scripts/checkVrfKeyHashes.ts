// scripts/checkVrfKeyHashes.ts
import { createPublicClient, http, Address, Hex, Abi, getAddress } from 'viem'; // Aggiunto getAddress
import { PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts';
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

dotenv.config();

// ABI semplificato per la sola funzione s_provingKeyHashes
const VRF_COORDINATOR_V2_PLUS_ABI_PARTIAL = [
  {
    inputs: [{ internalType: 'uint256', name: 'index', type: 'uint256' }],
    name: 's_provingKeyHashes',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

async function main() {
  // --- CONFIGURAZIONE ---
  // Indirizzo del VRF Coordinator V2.5 per ARBITRUM SEPOLIA (quello che hai confermato)
  const ARBITRUM_SEPOLIA_VRF_COORDINATOR_ADDRESS: Address = "0x5CE8D5A2BC84beb22a398CCA51996F7930313D61";

  // URL RPC per Arbitrum Sepolia
  const ARBITRUM_SEPOLIA_RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL;

  // Indirizzo del tuo contratto ScientificContentNFT (quello DEPLOYATO ATTUALMENTE sulla rete)
  // DEVE essere l'indirizzo del contratto che ha fallito la callback.
  // NON PREOCCUPARTI DEL FORMATO CHECKSUM QUI, LO SISTEMEREMO AUTOMATICAMENTE.
  const SCIENTIFIC_CONTENT_NFT_ADDRESS_RAW: string = "0x63364f9b8054B20bB7aE7C17208221b66C7B64cf"; // <--- INSERISCI QUI IL TUO INDIRIZZO ATTUALE DEL CONTRATTO NFT (PUÒ ESSERE IN MINUSCOLO)

  // Percorso all'ABI del tuo contratto ScientificContentNFT
  const SCIENTIFIC_CONTENT_NFT_ABI_PATH = path.join(__dirname, '../artifacts/contracts/ScientificContentNFT.sol/ScientificContentNFT.json');

  if (!ARBITRUM_SEPOLIA_RPC_URL) {
    console.error("Errore: Variabile d'ambiente ARBITRUM_SEPOLIA_RPC_URL non impostata nel file .env");
    process.exit(1);
  }

  // Converti l'indirizzo NFT in formato checksum per Viem
  let SCIENTIFIC_CONTENT_NFT_ADDRESS: Address;
  try {
    SCIENTIFIC_CONTENT_NFT_ADDRESS = getAddress(SCIENTIFIC_CONTENT_NFT_ADDRESS_RAW);
    console.log(`Indirizzo NFT fornito: ${SCIENTIFIC_CONTENT_NFT_ADDRESS_RAW}`);
    console.log(`Indirizzo NFT (checksummed): ${SCIENTIFIC_CONTENT_NFT_ADDRESS}`);
  } catch (error: any) {
    console.error(`Errore: L'indirizzo del contratto NFT fornito '${SCIENTIFIC_CONTENT_NFT_ADDRESS_RAW}' non è valido.`);
    console.error(`Dettagli errore:`, error.message);
    process.exit(1);
  }


  let SCIENTIFIC_CONTENT_NFT_ABI: Abi;
  try {
    const nftAbiJson = JSON.parse(fs.readFileSync(SCIENTIFIC_CONTENT_NFT_ABI_PATH, 'utf8'));
    SCIENTIFIC_CONTENT_NFT_ABI = nftAbiJson.abi as Abi;
  } catch (error) {
    console.error(`Errore nel caricamento o parsing dell'ABI da: ${SCIENTIFIC_CONTENT_NFT_ABI_PATH}`);
    console.error("Assicurati di aver compilato il tuo contratto e che il percorso sia corretto.");
    console.error(error);
    process.exit(1);
  }

  // Inizializza il publicClient di Viem
  const publicClient = createPublicClient({
    transport: http(ARBITRUM_SEPOLIA_RPC_URL),
  });

  // --- PARTE 1: VERIFICA KEY HASH REGISTRATI ---
  console.log('\n🔍 === VERIFICA KEY HASH REGISTRATI SUL VRF COORDINATOR ===');
  console.log(`Indirizzo VRF Coordinator (Arbitrum Sepolia): ${ARBITRUM_SEPOLIA_VRF_COORDINATOR_ADDRESS}`);
  console.log(`Connesso a RPC: ${ARBITRUM_SEPOLIA_RPC_URL}`);

  const registeredKeyHashes: Hex[] = [];
  let index = 0;
  const MAX_INDEX_CHECK = 10;

  while (index < MAX_INDEX_CHECK) {
    try {
      const keyHash = await publicClient.readContract({
        address: ARBITRUM_SEPOLIA_VRF_COORDINATOR_ADDRESS,
        abi: VRF_COORDINATOR_V2_PLUS_ABI_PARTIAL as Abi,
        functionName: 's_provingKeyHashes',
        args: [BigInt(index)],
      }) as Hex;

      if (keyHash && keyHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        console.log(`  - Key Hash registrato all'indice ${index}: ${keyHash}`);
        registeredKeyHashes.push(keyHash);
        index++;
      } else {
        console.log(`  - Nessun Key Hash valido trovato all'indice ${index} o successivi.`);
        break;
      }
    } catch (error: any) {
      console.log(`  - Errore nel recupero del Key Hash all'indice ${index}. Potrebbe essere fuori range o problemi di connessione/indirizzo errato.`);
      break;
    }
  }

  console.log(`\n--- Riassunto Key Hashes trovati ---`);
  if (registeredKeyHashes.length === 0) {
    console.log('  Nessun Key Hash registrato trovato sul VRF Coordinator (o indirizzo Coordinator errato/problemi di rete).');
  } else {
    registeredKeyHashes.forEach((kh, idx) => console.log(`  ${idx + 1}. ${kh}`));
  }
  console.log('=== FINE VERIFICA KEY HASH ===\n');

  // --- PARTE 2: STIMA GAS PER rawFulfillRandomWords ---
  console.log('\n⛽ === STIMA GAS PER rawFulfillRandomWords DEL TUO CONTRATTO NFT ===');
  console.log(`Contratto NFT da stimare: ${SCIENTIFIC_CONTENT_NFT_ADDRESS}`);

  // Genera dati fittizi per la chiamata simulateContract
  // NOTA: Questi valori devono essere validi per il tuo contratto.
  // Se la logica interna di rawFulfillRandomWords dipende da valori specifici
  // (es. registryContentId mappato ad un utente, o il tokenId non deve esistere già),
  // la simulazione potrebbe fallire se i dati sono irrealistici.
  // In caso di fallimento della simulazione, prova a variare questi parametri.
  const requestId = 123456789n; // Un ID di richiesta di esempio (BigInt)
  const randomWords = [
    100000000000000000000000000000000000000000000000000000000000000000n // Una parola casuale di esempio (BigInt)
  ];

  // Crea un account fittizio/dummy per simulare la transazione
  // Non userà veri fondi, serve solo per il `from` nella simulazione
  const dummyPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5ef2b4621c174d085601"; // Hardhat default acc 0 (NON USARE IN PROD)
  const dummyAccount: PrivateKeyAccount = privateKeyToAccount(dummyPrivateKey);


  try {
    const { request, result } = await publicClient.simulateContract({
      account: dummyAccount.address, // Indirizzo che "effettua" la chiamata simulata
      address: SCIENTIFIC_CONTENT_NFT_ADDRESS, // Usiamo l'indirizzo checksummed
      abi: SCIENTIFIC_CONTENT_NFT_ABI,
      functionName: 'rawFulfillRandomWords',
      args: [requestId, randomWords],
    });

    const estimatedGas = await publicClient.estimateGas(request);

    // Calcola il buffer del 20%
    const bufferedGas = estimatedGas * 120n / 100n; // 20% in più

    console.log(`  - Gas stimato per rawFulfillRandomWords: ${estimatedGas.toString()}`);
    console.log(`  - Gas raccomandato (con buffer del 20%): ${bufferedGas.toString()}`);
    console.log('\n👉 Azione consigliata: Imposta `CALLBACK_GAS_LIMIT` nel tuo contratto NFT a un valore pari o superiore a QUESTO.');
    console.log(`  Ad esempio: uint32 private constant CALLBACK_GAS_LIMIT = ${bufferedGas.toString()};`);

  } catch (error: any) {
    console.error(`  ❌ Errore durante la stima del gas per rawFulfillRandomWords:`);
    console.error(`  Assicurati che:`);
    console.error(`  1. Il tuo contratto ScientificContentNFT sia compilato e che l'ABI in '${SCIENTIFIC_CONTENT_NFT_ABI_PATH}' sia aggiornato.`);
    console.error(`  2. L'indirizzo del contratto NFT ('${SCIENTIFIC_CONTENT_NFT_ADDRESS_RAW}' -> '${SCIENTIFIC_CONTENT_NFT_ADDRESS}') sia corretto e che il contratto sia deployato su Arbitrum Sepolia.`);
    console.error(`  3. La funzione 'rawFulfillRandomWords' esista e sia 'public' o 'external' (come dovrebbe essere per Chainlink VRF).`);
    console.error(`  4. I parametri di input per la simulazione (requestId, randomWords) siano validi per la logica interna di 'rawFulfillRandomWords'. A volte, se la logica interna dipende da stati specifici del contratto (es. mapping), la simulazione con dati fittizi può fallire.`);
    console.error(`  Dettagli errore:`, error.message);
  }

  console.log('\n=== FINE STIMA GAS ===\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



// // scripts/checkVrfKeyHashes.ts
// import { createPublicClient, http, Address, Hex, Abi } from 'viem';
// import dotenv from "dotenv";

// dotenv.config(); // Carica le variabili d'ambiente dal file .env

// // ABI semplificato per la sola funzione s_provingKeyHashes
// // Questo ti permette di non importare l'intero ABI del Coordinator se non vuoi
// const VRF_COORDINATOR_V2_PLUS_ABI_PARTIAL = [
//   {
//     inputs: [{ internalType: 'uint256', name: 'index', type: 'uint256' }],
//     name: 's_provingKeyHashes',
//     outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
//     stateMutability: 'view',
//     type: 'function',
//   },
// ] as const;

// async function main() {
//   // --- CONFIGURAZIONE ---
//   // Sostituisci con l'indirizzo del VRF Coordinator V2.5 per ARBITRUM SEPOLIA
//   // TROVA QUESTO VALORE QUI: https://docs.chain.link/vrf/v2_5/supported-networks/ (sezione Arbitrum Sepolia)
//   const ARBITRUM_SEPOLIA_VRF_COORDINATOR_ADDRESS: Address = "0x5CE8D5A2BC84beb22a398CCA51996F7930313D61"; // <-- **IMPORNATE: SOSTITUISCI QUESTO!**

//   const ARBITRUM_SEPOLIA_RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL;

//   if (!ARBITRUM_SEPOLIA_RPC_URL) {
//     console.error("Errore: Variabile d'ambiente ARBITRUM_SEPOLIA_RPC_URL non impostata nel file .env");
//     process.exit(1);
//   }

//   // Inizializza il publicClient di Viem
//   const publicClient = createPublicClient({
//     transport: http(ARBITRUM_SEPOLIA_RPC_URL),
//   });

//   console.log('\n🔍 === VERIFICA KEY HASH REGISTRATI SUL VRF COORDINATOR ===');
//   console.log(`Indirizzo VRF Coordinator (Arbitrum Sepolia): ${ARBITRUM_SEPOLIA_VRF_COORDINATOR_ADDRESS}`);
//   console.log(`Connesso a RPC: ${ARBITRUM_SEPOLIA_RPC_URL}`);

//   const registeredKeyHashes: Hex[] = [];
//   let index = 0;
//   const MAX_INDEX_CHECK = 10; // Limita i controlli per evitare chiamate eccessive

//   while (index < MAX_INDEX_CHECK) {
//     try {
//       const keyHash = await publicClient.readContract({
//         address: ARBITRUM_SEPOLIA_VRF_COORDINATOR_ADDRESS,
//         abi: VRF_COORDINATOR_V2_PLUS_ABI_PARTIAL as Abi,
//         functionName: 's_provingKeyHashes',
//         args: [BigInt(index)],
//       }) as Hex;

//       if (keyHash && keyHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
//         console.log(`  - Key Hash registrato all'indice ${index}: ${keyHash}`);
//         registeredKeyHashes.push(keyHash);
//         index++;
//       } else {
//         console.log(`  - Nessun Key Hash valido trovato all'indice ${index} o successivi.`);
//         break;
//       }
//     } catch (error: any) {
//       console.log(`  - Errore nel recupero del Key Hash all'indice ${index}. Potrebbe essere fuori range o ci sono problemi di connessione/indirizzo errato.`);
//       // console.error(`Dettagli errore:`, error); // Decommenta per un debug più approfondito
//       break;
//     }
//   }

//   console.log(`\n--- Riassunto Key Hashes trovati ---`);
//   if (registeredKeyHashes.length === 0) {
//     console.log('  Nessun Key Hash registrato trovato sul VRF Coordinator (o indirizzo Coordinator errato/problemi di rete).');
//   } else {
//     registeredKeyHashes.forEach((kh, idx) => console.log(`  ${idx + 1}. ${kh}`));
//   }
//   console.log('=== FINE VERIFICA KEY HASH ===\n');
// }

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });