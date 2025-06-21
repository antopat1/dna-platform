import { Address, PublicClient, WalletClient } from "viem";
import { Abi } from "viem";

export interface DeploymentConfig {
  vrfCoordinator: Address;
  keyHash: `0x${string}`;
  subscriptionId: bigint;
}

export interface ScientificContentRegistryContract {
  address: Address;
  abi: Abi;
  write: {
    setNFTContract: (params: [Address], options: { account: Address }) => Promise<any>;
  };
}

export interface ScientificContentNFTContract {
  address: Address;
  abi: Abi;
}

export interface DeploymentResult {
  registry: ScientificContentRegistryContract;
  nft: ScientificContentNFTContract;
  owner: WalletClient;
  publicClient: PublicClient;
}


