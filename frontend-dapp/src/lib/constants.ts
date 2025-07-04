// frontend-dapp/src/lib/constants.ts

// Importa le ABI dai tuoi file JSON
import ScientificContentRegistryABI from './abi/ScientificContentRegistry.json';
import ScientificContentNFTABI from './abi/ScientificContentNFT.json';
import GovernanceTokenABI from './abi/GovernanceToken.json';
import DaoABI from './abi/Dao.json';

// Esporta gli indirizzi dei contratti, presi dalle variabili d'ambiente
// Il '!' alla fine indica a TypeScript che la variabile sarà sicuramente definita al runtime.
// 'as `0x${string}`' è una tipizzazione per Viem per indirizzi esadecimali.
export const SCIENTIFIC_CONTENT_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_REGISTRY_ADDRESS! as `0x${string}`;
export const SCIENTIFIC_CONTENT_NFT_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_NFT_ADDRESS! as `0x${string}`;
export const GOVERNANCE_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS! as `0x${string}`;
export const DAO_ADDRESS = process.env.NEXT_PUBLIC_DAO_ADDRESS! as `0x${string}`;

// Esporta i parametri di Chainlink VRF
export const VRF_COORDINATOR_ADDRESS = process.env.NEXT_PUBLIC_VRF_COORDINATOR_ADDRESS! as `0x${string}`;
export const CHAINLINK_KEYHASH = process.env.NEXT_PUBLIC_CHAINLINK_KEYHASH! as `0x${string}`;
// La Subscription ID deve essere convertita in BigInt per Viem
export const CHAINLINK_SUBSCRIPTION_ID = BigInt(process.env.NEXT_PUBLIC_CHAINLINK_SUBSCRIPTION_ID || '0');

// Esporta solo la parte 'abi' del JSON importato
export const SCIENTIFIC_CONTENT_REGISTRY_ABI = ScientificContentRegistryABI.abi;
export const SCIENTIFIC_CONTENT_NFT_ABI = ScientificContentNFTABI.abi;
export const GOVERNANCE_TOKEN_ABI = GovernanceTokenABI.abi;
export const DAO_ABI = DaoABI.abi;

// Configurazione per la rete Arbitrum Sepolia
export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614; // Chain ID ufficiale di Arbitrum Sepolia
export const ARBITRUM_SEPOLIA_RPC_URL = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL; // URL RPC pubblico "https://sepolia-rollup.arbitrum.io/rpc";
// Aggiungi un controllo di tipo, altrimenti TypeScript potrebbe lamentarsi che è string | undefined
if (!ARBITRUM_SEPOLIA_RPC_URL) {
  throw new Error("Missing NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL environment variable.");
}
export const ARBITRUM_SEPOLIA_EXPLORER_URL = "https://sepolia.arbiscan.io/"; // URL di Arbiscan per Sepolia