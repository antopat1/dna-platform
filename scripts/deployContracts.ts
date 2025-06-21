import hre from "hardhat";
import dotenv from "dotenv";
import {
  formatEther,
  Address,
  createWalletClient,
  http,
  WalletClient,
  PublicClient,
  parseGwei,
  createPublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { Account } from "viem";

dotenv.config();

interface NetworkConfig {
  vrfCoordinator: Address;
  keyHash: `0x${string}`;
  subscriptionId: bigint;
}

type NetworkConfigs = {
  [key: string]: NetworkConfig;
};

const networkConfig: NetworkConfigs = {
  arbitrumSepolia: {
    vrfCoordinator: process.env.NEXT_PUBLIC_VRF_COORDINATOR_ADDRESS as Address,
    keyHash: process.env.NEXT_PUBLIC_CHAINLINK_KEYHASH as `0x${string}`,
    subscriptionId: BigInt(process.env.CHAINLINK_SUBSCRIPTION_ID || "0"),
  },
  hardhat: {
    vrfCoordinator: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625" as Address,
    keyHash:
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" as `0x${string}`,
    subscriptionId: 1n,
  },
};

interface DeploymentResult {
  registry: any;
  nft: any;
  owner: WalletClient;
  publicClient: PublicClient;
}

async function getWalletClient(
  network: string
): Promise<{ walletClient: WalletClient; account: Account; publicClient: PublicClient }> {
  if (network === "arbitrumSepolia") {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("Private key not found in environment variables");
    }
    
    const account = privateKeyToAccount(`0x${privateKey}`);
    
    const walletClient = createWalletClient({
      account,
      chain: arbitrumSepolia,
      transport: http(),
    });

    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(),
    });

    return { walletClient, account, publicClient };
  } else {
    const [wallet] = await hre.viem.getWalletClients();
    if (!wallet.account) {
      throw new Error("No account found in wallet client");
    }
    const publicClient = await hre.viem.getPublicClient();
    return { walletClient: wallet, account: wallet.account as Account, publicClient };
  }
}

async function getGasPrice(publicClient: PublicClient): Promise<bigint> {
  try {
    const gasPrice = await publicClient.getGasPrice();
    return (gasPrice * 120n) / 100n;
  } catch (error) {
    console.warn("Failed to get gas price, using default");
    return parseGwei("0.1");
  }
}

async function deployContract(
  contractName: string,
  args: any[] = [],
  network: string,
  isNFTContract: boolean = false
) {
  if (network === "arbitrumSepolia") {
    const { walletClient, account, publicClient } = await getWalletClient(network);

    const { bytecode } = await hre.artifacts.readArtifact(contractName);
    const { abi } = await hre.artifacts.readArtifact(contractName);

    try {
      console.log(`\n📝 Deploying ${contractName} with args:`, args);
      console.log(`📄 Bytecode length: ${bytecode.length}`);

      const gasPrice = await getGasPrice(publicClient);

      console.log(`⛽ Gas Price: ${formatEther(gasPrice)} ETH`);

      const hash = await walletClient.deployContract({
        abi,
        bytecode: bytecode as `0x${string}`,
        args,
        chain: arbitrumSepolia,
        account,
        gasPrice: gasPrice,
      });

      console.log(`⏳ Waiting for deployment transaction: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 120_000,
        confirmations: 2,
      });

      if (!receipt.contractAddress) {
        throw new Error(
          "Contract deployment failed - no contract address received"
        );
      }

      console.log(`✅ ${contractName} deployed at: ${receipt.contractAddress}`);

      if (isNFTContract) {
        console.log(
          "\n⚠️ Important: Add this NFT Contract Address to your Chainlink VRF Subscription:"
        );
        console.log(`🔗 NFT_CONTRACT_ADDRESS: ${receipt.contractAddress}\n`);
      }

      return hre.viem.getContractAt(contractName, receipt.contractAddress);
    } catch (error: any) {
      console.error(`❌ Error deploying ${contractName}:`, error.message);
      console.error(`🔍 Error details:`, error);
      throw error;
    }
  } else {
    console.log(`\n📝 Deploying ${contractName} on local network...`);
    return hre.viem.deployContract(contractName, args);
  }
}

// Funzione per aggiungere consumer manualmente (se necessario)
async function addConsumerManually(
  vrfCoordinatorAddress: Address,
  subscriptionId: bigint,
  consumerAddress: Address,
  network: string
) {
  if (network !== "arbitrumSepolia") {
    console.log("🔗 Skipping consumer addition for local network");
    return;
  }

  console.log("🔗 Adding NFT Contract as a consumer to Chainlink VRF Subscription manually...");
  
  const { walletClient, account, publicClient } = await getWalletClient(network);

  // ABI minima per la funzione addConsumer
  const vrfCoordinatorABI = [
    {
      "inputs": [
        { "internalType": "uint256", "name": "subId", "type": "uint256" },
        { "internalType": "address", "name": "consumer", "type": "address" }
      ],
      "name": "addConsumer",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ] as const;

  try {
    const gasPrice = await getGasPrice(publicClient);
    
    const { request } = await publicClient.simulateContract({
      address: vrfCoordinatorAddress,
      abi: vrfCoordinatorABI,
      functionName: 'addConsumer',
      args: [subscriptionId, consumerAddress],
      account: account.address,
    });

    const hash = await walletClient.writeContract({
      ...request,
      gasPrice: gasPrice,
    });

    await publicClient.waitForTransactionReceipt({ hash });
    console.log("✅ NFT Contract added as a consumer to Chainlink VRF Subscription");
  } catch (error: any) {
    console.warn("⚠️ Failed to add consumer automatically:", error.message);
    console.log("📝 You may need to add the consumer manually through the Chainlink VRF interface");
    console.log(`🔗 NFT Contract Address: ${consumerAddress}`);
    console.log(`📋 Subscription ID: ${subscriptionId}`);
  }
}

export async function deployContractsFixture(
  isDirectDeploy: boolean = false,
  isMockDeploy: boolean = false,
  mockVRFAddress?: Address
): Promise<DeploymentResult> {
  const network = hre.network.name;
  const config = networkConfig[network];

  if (!config) {
    throw new Error(`Network configuration not found for ${network}`);
  }

  try {
    const { walletClient, account, publicClient } = await getWalletClient(network);

    console.log("\n🚀 Starting deployment process...\n");
    console.log(`🌐 Network: ${network}`);
    console.log(`👤 Deployer Address: ${account.address}`);

    const balance = await publicClient.getBalance({
      address: account.address,
    });
    console.log(`💰 Deployer Balance: ${formatEther(balance)} ETH\n`);

    // Deploy Registry
    console.log("📝 Deploying ScientificContentRegistry...");
    const registry = await deployContract(
      "ScientificContentRegistry",
      [],
      network
    );
    console.log(
      `✅ ScientificContentRegistry deployed at: ${registry.address}\n`
    );

    // Deploy NFT Contract with appropriate configuration
    const nftArgs = [
      registry.address,
      mockVRFAddress || config.vrfCoordinator,
      config.keyHash,
      config.subscriptionId,
    ];

    console.log("📝 Deploying ScientificContentNFT...");
    const nft = await deployContract(
      "ScientificContentNFT",
      nftArgs,
      network,
      true
    );

    // Tentativo di aggiungere il consumer automaticamente
    if (network === "arbitrumSepolia") {
      await addConsumerManually(
        config.vrfCoordinator,
        config.subscriptionId,
        nft.address,
        network
      );
    }

    // Set NFT contract in registry
    console.log("🔗 Setting NFT Contract in Registry...");
    const setNFTTx = await registry.write.setNFTContract([nft.address]);
    await publicClient.waitForTransactionReceipt({ hash: setNFTTx });
    console.log("✅ NFT Contract set in Registry");

    console.log("\n✅ Deployment Summary");
    console.log("=".repeat(50));
    console.log(`📚 Registry Address: ${registry.address}`);
    console.log(`🎨 NFT Contract Address: ${nft.address}`);
    console.log(`👤 Owner Address: ${account.address}`);
    console.log(`🔗 VRF Coordinator: ${config.vrfCoordinator}`);
    console.log(`🔑 Key Hash: ${config.keyHash}`);
    console.log(`📋 Subscription ID: ${config.subscriptionId}`);
    console.log("=".repeat(50) + "\n");

    return {
      registry,
      nft,
      owner: walletClient,
      publicClient,
    };
  } catch (error: any) {
    console.error("\n❌ Deployment failed:", error.message);
    console.error("🔍 Error details:", error);
    throw error;
  }
}

async function main() {
  try {
    await deployContractsFixture(true);
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

// import hre from "hardhat";
// import dotenv from "dotenv";
// import readline from "readline";
// import {
//   formatEther,
//   Address,
//   createWalletClient,
//   http,
//   WalletClient,
//   PublicClient,
//   parseGwei,
// } from "viem";
// import { privateKeyToAccount } from "viem/accounts";
// import { arbitrumSepolia } from "viem/chains";
// import { Account } from "viem";
// import { IVRFCoordinatorV2Plus } from "../typechain-types";
// dotenv.config();

// interface NetworkConfig {
//   vrfCoordinator: Address;
//   keyHash: `0x${string}`;
//   subscriptionId: bigint;
// }

// type NetworkConfigs = {
//   [key: string]: NetworkConfig;
// };

// const networkConfig: NetworkConfigs = {
//   arbitrumSepolia: {
//     vrfCoordinator: process.env.CHAINLINK_VRF_COORDINATOR as Address,
//     keyHash: process.env.CHAINLINK_KEY_HASH as `0x${string}`,
//     subscriptionId: BigInt(process.env.CHAINLINK_SUBSCRIPTION_ID || "0"),
//   },
//   hardhat: {
//     vrfCoordinator: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625" as Address,
//     keyHash:
//       "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" as `0x${string}`,
//     subscriptionId: 1n,
//   },
// };

// interface DeploymentResult {
//   registry: any;
//   nft: any;
//   owner: WalletClient;
//   publicClient: PublicClient;
// }

// async function getWalletClient(
//   network: string
// ): Promise<{ walletClient: WalletClient; account: Account }> {
//   if (network === "arbitrumSepolia") {
//     const privateKey = process.env.PRIVATE_KEY;
//     if (!privateKey) {
//       throw new Error("Private key not found in environment variables");
//     }
//     const account = privateKeyToAccount(`0x${privateKey}`);
//     const walletClient = createWalletClient({
//       account,
//       chain: arbitrumSepolia,
//       transport: http(),
//     });
//     return { walletClient, account };
//   } else {
//     const [wallet] = await hre.viem.getWalletClients();
//     if (!wallet.account) {
//       throw new Error("No account found in wallet client");
//     }
//     return { walletClient: wallet, account: wallet.account as Account };
//   }
// }

// async function getGasPrice(publicClient: PublicClient): Promise<bigint> {
//   try {
//     const gasPrice = await publicClient.getGasPrice();
//     return (gasPrice * 120n) / 100n;
//   } catch (error) {
//     console.warn("Failed to get gas price, using default");
//     return parseGwei("0.1");
//   }
// }

// async function estimateGas(
//   contractName: string,
//   args: any[],
//   bytecode: string,
//   publicClient: PublicClient,
//   account: Account
// ): Promise<bigint> {
//   try {
//     const gasEstimate = await publicClient.estimateGas({
//       account: account.address,
//       data: bytecode as `0x${string}`,
//       value: 0n,
//     });
//     return (gasEstimate * 130n) / 100n;
//   } catch (error) {
//     console.warn("Failed to estimate gas, using default");
//     return 3000000n;
//   }
// }

// async function deployContract(
//   contractName: string,
//   args: any[] = [],
//   network: string,
//   isNFTContract: boolean = false
// ) {
//   if (network === "arbitrumSepolia") {
//     const publicClient = await hre.viem.getPublicClient();
//     const { walletClient, account } = await getWalletClient(network);

//     const { bytecode } = await hre.artifacts.readArtifact(contractName);
//     const { abi } = await hre.artifacts.readArtifact(contractName);

//     try {
//       console.log(`\n📝 Deploying ${contractName} with args:`, args);
//       console.log(`📄 Bytecode length: ${bytecode.length}`);

//       const gasPrice = await getGasPrice(publicClient);
//       const gasLimit = await estimateGas(contractName, args, bytecode, publicClient, account);

//       console.log(`⛽ Gas Price: ${formatEther(gasPrice)} ETH`);
//       console.log(`⛽ Gas Limit: ${gasLimit.toString()}`);

//       const hash = await walletClient.deployContract({
//         abi,
//         bytecode: bytecode as `0x${string}`,
//         args,
//         chain: arbitrumSepolia,
//         account,
//         gas: gasLimit,
//         gasPrice: gasPrice,
//       });

//       console.log(`⏳ Waiting for deployment transaction: ${hash}`);
//       const receipt = await publicClient.waitForTransactionReceipt({
//         hash,
//         timeout: 120_000,
//         confirmations: 2,
//       });

//       if (!receipt.contractAddress) {
//         throw new Error(
//           "Contract deployment failed - no contract address received"
//         );
//       }

//       console.log(`✅ ${contractName} deployed at: ${receipt.contractAddress}`);

//       if (isNFTContract) {
//         console.log(
//           "\n⚠️ Important: Add this NFT Contract Address to your Chainlink VRF Subscription:"
//         );
//         console.log(`🔗 NFT_CONTRACT_ADDRESS: ${receipt.contractAddress}\n`);
//       }

//       return hre.viem.getContractAt(contractName, receipt.contractAddress);
//     } catch (error: any) {
//       console.error(`❌ Error deploying ${contractName}:`, error.message);
//       console.error(`🔍 Error details:`, error);
//       throw error;
//     }
//   } else {
//     console.log(`\n📝 Deploying ${contractName} on local network...`);
//     return hre.viem.deployContract(contractName, args);
//   }
// }

// export async function deployContractsFixture(
//   isDirectDeploy: boolean = false,
//   isMockDeploy: boolean = false,
//   mockVRFAddress?: Address
// ): Promise<DeploymentResult> {
//   const network = hre.network.name;
//   const config = networkConfig[network];

//   if (!config) {
//     throw new Error(`Network configuration not found for ${network}`);
//   }

//   try {
//     const { walletClient, account } = await getWalletClient(network);
//     const publicClient = await hre.viem.getPublicClient();

//     console.log("\n🚀 Starting deployment process...\n");
//     console.log(`🌐 Network: ${network}`);
//     console.log(`👤 Deployer Address: ${account.address}`);

//     const balance = await publicClient.getBalance({
//       address: account.address,
//     });
//     console.log(`💰 Deployer Balance: ${formatEther(balance)} ETH\n`);

//     // Deploy Registry
//     console.log("📝 Deploying ScientificContentRegistry...");
//     const registry = await deployContract(
//       "ScientificContentRegistry",
//       [],
//       network
//     );
//     console.log(
//       `✅ ScientificContentRegistry deployed at: ${registry.address}\n`
//     );

//     // Deploy NFT Contract with appropriate configuration
//     // *** MODIFICA QUI: Rimosso 'account.address' come primo argomento ***
//     const nftArgs = [
//       registry.address,
//       mockVRFAddress || config.vrfCoordinator,
//       config.keyHash,
//       config.subscriptionId,
//     ];

//     console.log("📝 Deploying ScientificContentNFT...");
//     const nft = await deployContract(
//       "ScientificContentNFT",
//       nftArgs,
//       network,
//       true
//     );

//     // Automatically add the NFT contract as a consumer to the VRF subscription
//     if (network === "arbitrumSepolia") {
//       console.log("🔗 Adding NFT Contract as a consumer to Chainlink VRF Subscription...");
//       const vrfCoordinator = await hre.viem.getContractAt<IVRFCoordinatorV2Plus>(
//         "IVRFCoordinatorV2Plus",
//         config.vrfCoordinator
//       );

//       const addConsumerTx = await vrfCoordinator.write.addConsumer([
//         config.subscriptionId,
//         nft.address,
//       ]);

//       await publicClient.waitForTransactionReceipt({ hash: addConsumerTx });
//       console.log("✅ NFT Contract added as a consumer to Chainlink VRF Subscription");
//     }
    

//     // Set NFT contract in registry
//     console.log("🔗 Setting NFT Contract in Registry...");
//     const setNFTTx = await registry.write.setNFTContract([nft.address]);
//     await publicClient.waitForTransactionReceipt({ hash: setNFTTx });
//     console.log("✅ NFT Contract set in Registry");

//     console.log("\n✅ Deployment Summary");
//     console.log("=".repeat(50));
//     console.log(`📚 Registry Address: ${registry.address}`);
//     console.log(`🎨 NFT Contract Address: ${nft.address}`);
//     console.log(`👤 Owner Address: ${account.address}`);
//     console.log(`🔗 VRF Coordinator: ${config.vrfCoordinator}`);
//     console.log(`🔑 Key Hash: ${config.keyHash}`);
//     console.log(`📋 Subscription ID: ${config.subscriptionId}`);
//     console.log("=".repeat(50) + "\n");

//     return {
//       registry,
//       nft,
//       owner: walletClient,
//       publicClient,
//     };
//   } catch (error: any) {
//     console.error("\n❌ Deployment failed:", error.message);
//     console.error("🔍 Error details:", error);
//     throw error;
//   }
// }

// async function main() {
//   try {
//     await deployContractsFixture(true);
//   } catch (error) {
//     console.error("\n❌ Deployment failed:", error);
//     process.exitCode = 1;
//   }
// }

// if (require.main === module) {
//   main();
// }
