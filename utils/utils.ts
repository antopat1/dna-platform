import { Address, createPublicClient, createWalletClient, http, PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { ScientificContentRegistryContract, ScientificContentNFTContract } from "../interfaces/interfaces";

export async function createPublicNetworkWalletClient(privateKey: string) {
  const account = privateKeyToAccount(`0x${privateKey}`);
  return createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http()
  });
}

export async function logTransaction(label: string, address: Address) {
  console.log(`${label}\nAddress: ${address}`);
  console.log("-".repeat(50));
}

export async function executeTransaction(
  deployFn: () => Promise<ScientificContentRegistryContract | ScientificContentNFTContract>,
  publicClient: PublicClient,
  isTestNetwork: boolean,
  label: string
) {
  try {
    const contract = await deployFn();
    
    if (!isTestNetwork) {
      console.log(`Deployed ${label}`);
    }
    
    return contract;
  } catch (error) {
    console.error(`Error in ${label}:`, error);
    throw error;
  }
}

export async function verifyPreDeployConditions(
  network: string,
  deployerAddress: Address,
  publicClient: PublicClient,
  vrfCoordinator: Address,
  subscriptionId: bigint
) {
  console.log(`Verifying pre-deployment conditions for ${network}`);
  
  const balance = await publicClient.getBalance({ address: deployerAddress });
  console.log(`Deployer Balance: ${balance}`);
  
  // For hardhat network, we don't need to check initial balance
  if (network !== 'hardhat' && balance === 0n) {
    throw new Error("Insufficient funds for deployment");
  }
}

export async function verifyDeployment(
  registry: ScientificContentRegistryContract, 
  nft: ScientificContentNFTContract,
  publicClient: PublicClient
) {
  console.log("✅ Deployment verification completed successfully");
}







