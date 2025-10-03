// frontend-dapp/src/lib/types.ts

export type ScientificContentRegistryContent = {
  
  title?: string;
  description?: string;
  author?: `0x${string}`; 
  contentHash?: `0x${string}`;

  
  isAvailable?: boolean; 
  creator?: `0x${string}`; 
  ipfsHash?: string;       
  blockTimestamp?: bigint;
  nftMintPrice?: bigint;
  maxCopies?: bigint;
  mintedCopies?: bigint;
};