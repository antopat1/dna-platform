// scripts/savefound.ts
import { createPublicClient, createWalletClient, http, formatEther, getAddress, type Abi, type Address, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import dotenv from 'dotenv';
import 'isomorphic-fetch';

// Carica le variabili d'ambiente dal file .env
dotenv.config();

// --- IMPORTA GLI ABI DEI TUOI CONTRATTI ---
import DnAContentNFT_ABI_JSON from '../artifacts/contracts/ScientificContentNFT.sol/ScientificContentNFT.json';
import DnAContentMarketplace_ABI_JSON from '../artifacts/contracts/DnAContentMarketplace.sol/DnAContentMarketplace.json';

// --- CONFIGURAZIONE E SETUP INIZIALE ---

interface ContractInfo {
  name: string;
  address: Address;
  abi: Abi;
  withdrawFunctionName: string;
}

async function setup() {
  const { PRIVATE_KEY, ARBITRUM_SEPOLIA_RPC_URL, SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS, SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS } = process.env;

  if (!PRIVATE_KEY || !ARBITRUM_SEPOLIA_RPC_URL || !SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS || !SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS) {
    console.error("Errore: una o più variabili d'ambiente necessarie non sono state trovate nel file .env.");
    console.error("Assicurati che PRIVATE_KEY, ARBITRUM_SEPOLIA_RPC_URL, SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS, e SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS siano impostate.");
    process.exit(1);
  }

  const formattedPrivateKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY as `0x${string}` : `0x${PRIVATE_KEY}` as `0x${string}`;
  const account = privateKeyToAccount(formattedPrivateKey);

  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(ARBITRUM_SEPOLIA_RPC_URL) });
  const walletClient = createWalletClient({ account, chain: arbitrumSepolia, transport: http(ARBITRUM_SEPOLIA_RPC_URL) });

  console.log("--------------------------------------------------");
  console.log(`Connesso con l'indirizzo: ${walletClient.account.address}`);
  console.log(`Rete: ${walletClient.chain.name} (Chain ID: ${walletClient.chain.id})`);
  console.log("--------------------------------------------------");
  
  const availableContracts: Record<string, ContractInfo> = {
    'nft': {
      name: 'DnAContentNFT',
      address: getAddress(SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS),
      abi: DnAContentNFT_ABI_JSON.abi as Abi,
      // =========================================================================
      // CORREZIONE: Sostituito 'emergencyWithdraw' con 'withdrawProtocolFees'
      // basandosi sull'ABI fornita.
      withdrawFunctionName: 'withdrawProtocolFees'
      // =========================================================================
    },
    'marketplace': {
      name: 'DnAContentMarketplace',
      address: getAddress(SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS),
      abi: DnAContentMarketplace_ABI_JSON.abi as Abi,
      withdrawFunctionName: 'withdrawProtocolFees'
    }
  };
  
  return { publicClient, walletClient, availableContracts };
}

// --- LOGICA PRINCIPALE PER IL PRELIEVO ---

async function withdrawFunds(
  publicClient: PublicClient,
  walletClient: WalletClient,
  contractInfo: ContractInfo
) {
  if (!walletClient.account) {
    console.error("Errore: Il wallet client non ha un account associato.");
    return;
  }
  const activeAccount = walletClient.account;

  const { name, address, abi, withdrawFunctionName } = contractInfo;
  console.log(`\n>>> Tentativo di prelievo dal contratto: ${name} (${address})`);

  const contractBalance = await publicClient.getBalance({ address });
  console.log(`Saldo attuale del contratto: ${formatEther(contractBalance)} ETH`);

  if (contractBalance === 0n) {
    console.log("Nessun fondo da prelevare. Il saldo del contratto è 0 ETH.");
    return;
  }
  
  const owner = await publicClient.readContract({
    address,
    abi,
    functionName: 'owner',
  }) as Address;

  if (getAddress(owner) !== getAddress(activeAccount.address)) {
    console.error(`Errore: L'account che esegue lo script (${activeAccount.address}) non è l'owner del contratto (${owner}).`);
    console.error("Il prelievo fallirà. Solo l'owner può prelevare i fondi.");
    return;
  }
  console.log("Controllo owner superato. L'account corrente è l'owner del contratto.");

  try {
    console.log(`Invio transazione per chiamare la funzione '${withdrawFunctionName}'...`);

    const { request } = await publicClient.simulateContract({
      address,
      abi,
      functionName: withdrawFunctionName,
      account: activeAccount,
    });
    
    const hash = await walletClient.writeContract(request);
    console.log(`Transazione di prelievo inviata. Hash: ${hash}`);

    console.log("In attesa della conferma della transazione...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    console.log("\n✅ Fondi prelevati con successo!");
    console.log(`Stato della transazione: ${receipt.status}`);
    console.log(`Blocco N.: ${receipt.blockNumber}`);

    const newContractBalance = await publicClient.getBalance({ address });
    console.log(`Nuovo saldo del contratto: ${formatEther(newContractBalance)} ETH`);

  } catch (error: any) {
    console.error("\n❌ Errore durante il prelievo dei fondi:");
    if (error.shortMessage) {
        console.error(`  Messaggio: ${error.shortMessage}`);
    } else {
        console.error(`  Messaggio: ${error.message}`);
    }
  }
}

// --- ESECUZIONE DELLO SCRIPT ---

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("Errore: specificare il contratto da cui prelevare.");
    console.error("Uso: npx ts-node scripts/savefound.ts <target>");
    console.error("Target validi: 'nft', 'marketplace', 'all'");
    process.exit(1);
  }

  const { publicClient, walletClient, availableContracts } = await setup();

  if (target === 'all') {
    console.log("Modalità 'all' selezionata: tentativo di prelievo da tutti i contratti.");
    for (const key in availableContracts) {
        await withdrawFunds(publicClient, walletClient, availableContracts[key]);
    }
  } else if (availableContracts[target]) {
    await withdrawFunds(publicClient, walletClient, availableContracts[target]);
  } else {
    console.error(`Errore: target '${target}' non valido.`);
    console.error("Target validi: 'nft', 'marketplace', 'all'");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



