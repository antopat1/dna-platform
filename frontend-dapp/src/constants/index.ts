// frontend-dapp/src/constants/index.ts

import { Address } from 'viem'; 


export const SCIENTIFIC_CONTENT_NFT_ADDRESS: Address = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS as Address;
export const SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS: Address = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS as Address;


import ScientificContentNFTAbi from '@/lib/abi/ScientificContentNFT.json';
import DnAContentMarketplaceAbi from '@/lib/abi/DnAContentMarketplace.json';

export const SCIENTIFIC_CONTENT_NFT_ABI = ScientificContentNFTAbi.abi;
export const SCIENTIFIC_CONTENT_MARKETPLACE_ABI = DnAContentMarketplaceAbi.abi;


export const MINT_PRICE_ETH = "0.0001"; // Example
export const CHAINLINK_SUBSCRIPTION_ID = BigInt(process.env.NEXT_PUBLIC_CHAINLINK_SUBSCRIPTION_ID || "0"); // Assicurati che sia BigInt




