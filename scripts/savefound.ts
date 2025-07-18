// scripts/savefound.ts
import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import dotenv from 'dotenv';

// Carica le variabili d'ambiente
dotenv.config();

// IMPORTA L'ABI DEL TUO CONTRATTO ScientificContentNFT
// Questo percorso è standard per Hardhat dopo la compilazione.
// Assicurati di aver compilato i tuoi contratti (`npx hardhat compile`)
import ScientificContentNFT_ABI_JSON from '../artifacts/contracts/ScientificContentNFT.sol/ScientificContentNFT.json';

async function main() {
  const nftAddress = "0x314210af75f4338f1db06fa047a25e314cd8777e" as `0x${string}`; // Indirizzo del contratto NFT

  // La chiave privata viene già formattata con '0x' in hardhat.config.ts
  // Ma qui dobbiamo assicurarci che sia `0x${string}` per viem.
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("Errore: PRIVATE_KEY non trovato nel file .env.");
    console.error("Assicurati che sia configurato correttamente.");
    process.exit(1);
  }

  // Aggiungiamo il prefisso '0x' se non è già presente.
  // La tua configurazione hardhat.config.ts lo fa già quando imposta `accounts`.
  const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

  // Crea un account Viem dalla chiave privata
  const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);

  // URL RPC da .env, come usato in hardhat.config.ts
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL;
  if (!rpcUrl) {
    console.error("Errore: ARBITRUM_SEPOLIA_RPC_URL non trovato nel file .env.");
    process.exit(1);
  }

  // Crea un client pubblico per le operazioni di sola lettura
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
  });

  // Crea un client wallet per le operazioni di scrittura (che richiedono firma)
  const walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
  });

  console.log("--------------------------------------------------");
  console.log("Tentativo di prelevare i fondi dal contratto ScientificContentNFT (Viem)...");
  console.log(`Connesso con l'indirizzo del deployer: ${walletClient.account.address}`);
  console.log(`Indirizzo del contratto NFT: ${nftAddress}`);
  console.log(`Rete: ${walletClient.chain.name} (Chain ID: ${walletClient.chain.id})`);
  console.log("--------------------------------------------------");

  // Controlla il saldo attuale del contratto prima del prelievo
  const contractBalance = await publicClient.getBalance({ address: nftAddress });
  console.log(`Saldo attuale del contratto: ${formatEther(contractBalance)} ETH`);

  if (contractBalance === BigInt(0)) {
    console.log("Nessun fondo da prelevare. Il saldo del contratto è 0 ETH.");
    return;
  }

  try {
    console.log("Invio transazione per il prelievo dei fondi...");

    // Simula la transazione per un controllo preliminare degli errori
    // Questo è un passaggio opzionale ma raccomandato in viem per catturare errori prima di inviare
    const { request } = await publicClient.simulateContract({
      address: nftAddress,
      abi: ScientificContentNFT_ABI_JSON.abi, // Usa la proprietà `abi` dal file JSON
      functionName: 'withdrawProtocolFees',
      account: walletClient.account, // L'account che esegue la transazione
    });
    
    // Invia la transazione vera e propria alla rete
    const hash = await walletClient.writeContract(request);

    console.log(`Transazione di prelievo inviata. Hash: ${hash}`);

    // Attendi che la transazione sia inclusa in un blocco e confermata
    console.log("In attesa della conferma della transazione...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    console.log("Fondi prelevati con successo!");
    console.log(`Stato della transazione: ${receipt.status === 'success' ? 'SUCCESS' : 'REVERTED'}`);

    // Controlla il nuovo saldo del contratto per confermare il prelievo
    const newContractBalance = await publicClient.getBalance({ address: nftAddress });
    console.log(`Nuovo saldo del contratto: ${formatEther(newContractBalance)} ETH`);

  } catch (error: any) {
    console.error("Errore durante il prelievo dei fondi:");
    if (error.shortMessage) {
        console.error(`  ${error.shortMessage}`);
    } else if (error.message) {
        console.error(`  ${error.message}`);
    } else {
        console.error(`  ${String(error)}`);
    }

    // Tenta di decodificare il motivo del revert, utile per debugging
    if (error.cause && typeof error.cause === 'object' && 'data' in error.cause) {
        const revertData = error.cause.data;
        // La firma '0x08c379a0' è per un errore `Error(string)` in Solidity
        if (typeof revertData === 'string' && revertData.startsWith('0x08c379a0')) {
            try {
                // Decodifica la stringa di errore (es. "No fees to withdraw")
                const decodedError = publicClient.abi.decodeErrorResult({
                    abi: ScientificContentNFT_ABI_JSON.abi,
                    data: revertData as `0x${string}`,
                });
                console.error(`  Motivo del revert (decodificato): ${decodedError}`);
            } catch (decodeErr) {
                console.error(`  Impossibile decodificare il motivo del revert dalla stringa: ${decodeErr}`);
            }
        } else {
            console.error(`  Revert Data (raw): ${revertData}`);
        }
    }
  }
}

// Esegui lo script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });