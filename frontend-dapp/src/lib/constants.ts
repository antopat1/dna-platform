// frontend-dapp/src/lib/constants.ts

// --- MODIFICA CHIAVE: Importiamo direttamente la proprietà 'abi' e la rinominiamo ---
import { abi as ScientificContentRegistryABI } from './abi/ScientificContentRegistry.json';
import { abi as ScientificContentNFTABI } from './abi/ScientificContentNFT.json';
import { abi as GovernanceTokenABI } from './abi/GovernanceToken.json';
import { abi as DaoABI } from './abi/Dao.json';
import { abi as DnAContentMarketplaceABI } from './abi/DnAContentMarketplace.json';

// Esporta gli indirizzi dei contratti, presi dalle variabili d'ambiente
// Il '!' alla fine indica a TypeScript che la variabile sarà sicuramente definita al runtime.
// 'as `0x${string}`' è una tipizzazione per Viem per indirizzi esadecimali.
export const SCIENTIFIC_CONTENT_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_REGISTRY_ADDRESS! as `0x${string}`;
export const SCIENTIFIC_CONTENT_NFT_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_NFT_ADDRESS! as `0x${string}`;
export const GOVERNANCE_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS! as `0x${string}`;
export const DAO_ADDRESS = process.env.NEXT_PUBLIC_DAO_ADDRESS! as `0x${string}`;

export const SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS! as `0x${string}`;

// Esporta i parametri di Chainlink VRF
export const VRF_COORDINATOR_ADDRESS = process.env.NEXT_PUBLIC_VRF_COORDINATOR_ADDRESS! as `0x${string}`;
export const CHAINLINK_KEYHASH = process.env.NEXT_PUBLIC_CHAINLINK_KEYHASH! as `0x${string}`;
// La Subscription ID deve essere convertita in BigInt per Viem
export const CHAINLINK_SUBSCRIPTION_ID = BigInt(process.env.NEXT_PUBLIC_CHAINLINK_SUBSCRIPTION_ID || '0');

// --- Ora le nostre costanti ABI sono direttamente gli array, senza passare da un oggetto intermedio ---
export const SCIENTIFIC_CONTENT_REGISTRY_ABI = ScientificContentRegistryABI;
export const SCIENTIFIC_CONTENT_NFT_ABI = ScientificContentNFTABI;
export const GOVERNANCE_TOKEN_ABI = GovernanceTokenABI;
export const DAO_ABI = DaoABI;
export const SCIENTIFIC_CONTENT_MARKETPLACE_ABI = DnAContentMarketplaceABI;

// Configurazione per la rete Arbitrum Sepolia
export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614; // Chain ID ufficiale di Arbitrum Sepolia
export const ARBITRUM_SEPOLIA_RPC_URL = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL; // URL RPC pubblico "https://sepolia-rollup.arbitrum.io/rpc";
// Aggiungi un controllo di tipo, altrimenti TypeScript potrebbe lamentarsi che è string | undefined
if (!ARBITRUM_SEPOLIA_RPC_URL) {
  throw new Error("Missing NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL environment variable.");
}
export const ARBITRUM_SEPOLIA_EXPLORER_URL = "https://sepolia.arbiscan.io/"; // URL di Arbiscan per Sepolia

// Limite massimo di token ID da controllare per trovare gli NFT dell'utente.
// Questo è un approccio temporaneo per evitare di scansionare l'intera collezione se è molto grande.
// La soluzione ideale a lungo termine è un subgraph o un backend indexer.
export const MAX_TOKEN_ID_TO_CHECK = 100;

// --- COSTANTI AGGIUNTIVE PER IL CLAIM ---

// Quantità di governance token da airdroppare agli early adopter
export const GOVERNANCE_TOKEN_AIRDROP_AMOUNT = 100;

// Informazioni sui contratti per il frontend developer
export const CONTRACT_INFO = {
  GOVERNANCE_TOKEN: {
    address: GOVERNANCE_TOKEN_ADDRESS,
    abi: GOVERNANCE_TOKEN_ABI,
    functions: {
      // Funzioni principali del GovernanceToken
      balanceOf: "balanceOf", // per vedere i token dell'utente
      mint: "mint", // per l'airdrop (solo owner)
      buyTokens: "buyTokens", // per comprare token
      transfer: "transfer", // per trasferire token
      approve: "approve", // per approvare spese
      allowance: "allowance", // per vedere allowance
    }
  },
  DAO: {
    address: DAO_ADDRESS,
    abi: DAO_ABI,
    functions: {
      // Funzioni principali del DAO
      createProposal: "createProposal",
      vote: "vote",
      executeProposal: "executeProposal",
      getProposal: "getProposal",
    }
  },
  NETWORK: "arbitrumSepolia"
};

