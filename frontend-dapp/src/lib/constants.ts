// frontend-dapp/src/lib/constants.ts


import { abi as ScientificContentRegistryABI } from './abi/ScientificContentRegistry.json';
import { abi as ScientificContentNFTABI } from './abi/ScientificContentNFT.json';
import { abi as GovernanceTokenABI } from './abi/GovernanceToken.json';
import { abi as DaoABI } from './abi/DAO.json';
import { abi as DnAContentMarketplaceABI } from './abi/DnAContentMarketplace.json';


export const SCIENTIFIC_CONTENT_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_REGISTRY_ADDRESS! as `0x${string}`;
export const SCIENTIFIC_CONTENT_NFT_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_NFT_ADDRESS! as `0x${string}`;
export const GOVERNANCE_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS! as `0x${string}`;
export const DAO_ADDRESS = process.env.NEXT_PUBLIC_DAO_ADDRESS! as `0x${string}`;

export const SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS! as `0x${string}`;


export const VRF_COORDINATOR_ADDRESS = process.env.NEXT_PUBLIC_VRF_COORDINATOR_ADDRESS! as `0x${string}`;
export const CHAINLINK_KEYHASH = process.env.NEXT_PUBLIC_CHAINLINK_KEYHASH! as `0x${string}`;

export const CHAINLINK_SUBSCRIPTION_ID = BigInt(process.env.NEXT_PUBLIC_CHAINLINK_SUBSCRIPTION_ID || '0');


export const SCIENTIFIC_CONTENT_REGISTRY_ABI = ScientificContentRegistryABI;
export const SCIENTIFIC_CONTENT_NFT_ABI = ScientificContentNFTABI;
export const GOVERNANCE_TOKEN_ABI = GovernanceTokenABI;
export const DAO_ABI = DaoABI;
export const SCIENTIFIC_CONTENT_MARKETPLACE_ABI = DnAContentMarketplaceABI;


export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614; 
export const ARBITRUM_SEPOLIA_RPC_URL = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL; 

if (!ARBITRUM_SEPOLIA_RPC_URL) {
  throw new Error("Missing NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL environment variable.");
}
export const ARBITRUM_SEPOLIA_EXPLORER_URL = "https://sepolia.arbiscan.io/"; 


export const MAX_TOKEN_ID_TO_CHECK = 100;


export const GOVERNANCE_TOKEN_AIRDROP_AMOUNT = 100000000000000000000n;


export const CONTRACT_INFO = {
  GOVERNANCE_TOKEN: {
    address: GOVERNANCE_TOKEN_ADDRESS,
    abi: GOVERNANCE_TOKEN_ABI,
    functions: {
      balanceOf: "balanceOf", 
      mint: "mint", 
      buyTokens: "buyTokens", 
      transfer: "transfer", 
      approve: "approve", 
      allowance: "allowance", 
    }
  },
  DAO: {
    address: DAO_ADDRESS,
    abi: DAO_ABI,
    functions: {
      createProposal: "createProposal",
      vote: "vote",
      executeProposal: "executeProposal",
      getProposal: "getProposal",
    }
  },
  NETWORK: "arbitrumSepolia"
};


