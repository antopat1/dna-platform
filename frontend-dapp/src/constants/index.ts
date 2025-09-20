// frontend-dapp/src/constants/index.ts

import { Address } from 'viem'; // O da viem se preferisci

// Indirizzi dei tuoi contratti dalla variabile d'ambiente
// Assicurati che questi siano corretti e che il tuo .env sia configurato
export const SCIENTIFIC_CONTENT_NFT_ADDRESS: Address = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS as Address;
export const SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS: Address = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS as Address;

// ABI dei tuoi contratti
// Questi dovrebbero puntare ai file ABI JSON generati dal tuo processo di compilazione.
// Esempio: se li hai in `src/abis/`
import ScientificContentNFTAbi from '@/lib/abi/ScientificContentNFT.json';
import DnAContentMarketplaceAbi from '@/lib/abi/DnAContentMarketplace.json';

export const SCIENTIFIC_CONTENT_NFT_ABI = ScientificContentNFTAbi.abi;
export const SCIENTIFIC_CONTENT_MARKETPLACE_ABI = DnAContentMarketplaceAbi.abi;

// Costanti varie
export const MINT_PRICE_ETH = "0.0001"; // Esempio
export const CHAINLINK_SUBSCRIPTION_ID = BigInt(process.env.NEXT_PUBLIC_CHAINLINK_SUBSCRIPTION_ID || "0"); // Assicurati che sia BigInt

// NOTA BENE: L'URL del gateway IPFS è gestito centralmente da 'src/utils/ipfs.ts'
// usando la variabile d'ambiente NEXT_PUBLIC_PINATA_GATEWAY_SUBDOMAIN.
// Se vuoi usare un sottodominio Pinata personalizzato, aggiungi la variabile
// NEXT_PUBLIC_PINATA_GATEWAY_SUBDOMAIN="il_tuo_sottodominio" al tuo file .env.local.
// Altrimenti, verrà usato il gateway pubblico di fallback di Pinata.


