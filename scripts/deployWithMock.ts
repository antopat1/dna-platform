import hre from "hardhat";
import { deployContractsFixture } from './deployContracts';
import { Address, parseEther } from "viem";

export async function deployMockVRFAndContracts() {
    console.log("\n🚀 Starting local deployment with Mock VRF V2 Plus...\n");

    // Converti i valori in wei usando viem
    const baseFee = parseEther("0.1"); // 0.1 LINK
    const gasPriceLink = parseEther("0.000001"); // 0.000001 LINK per gas

    // Deploy del Mock VRF V2 Plus
    const mockVRF = await hre.viem.deployContract("MockVRFCoordinatorV2Plus", [baseFee, gasPriceLink]);
    console.log(`📍 Mock VRF Coordinator V2 Plus deployed to: ${mockVRF.address}`);

    // Crea una subscription per il VRF
    const createSubscriptionTx = await mockVRF.write.createSubscription();
    // Aspetta la conferma della transazione
    await createSubscriptionTx;
    
    // Ottieni l'ID della subscription dai logs (assumendo che sia la prima subscription creata)
    const subscriptionId = 1n; // Il nonce parte da 1 nel contratto

    console.log(`📝 VRF Subscription created with ID: ${subscriptionId}`);

    // Deploy dei contratti principali usando il mock VRF
    // *** MODIFICA QUI: L'ultimo argomento del costruttore di ScientificContentNFT è ora l'ID della subscription, non il mockVRFAddress ***
    const deployment = await deployContractsFixture(
        true, 
        true, 
        mockVRF.address as Address // Passa l'indirizzo del mock VRF per la configurazione del VRF
    );

    // Aggiungi il contratto consumer come consumer autorizzato
    const addConsumerTx = await mockVRF.write.addConsumer([subscriptionId, deployment.nft.address]);
    await addConsumerTx;
    console.log(`✅ Added NFT contract as VRF consumer`);

    // Finanzia la subscription con alcuni ETH
    const fundAmount = parseEther("1"); // 1 ETH per i test
    const fundTx = await mockVRF.write.fundSubscription([subscriptionId], { value: fundAmount });
    await fundTx;
    console.log(`💰 Funded VRF subscription with ${fundAmount} wei`);

    console.log("\n✅ Local deployment completed with Mock VRF V2 Plus");
    console.log("=".repeat(50));
    console.log(`📚 Registry Address: ${deployment.registry.address}`);
    console.log(`🎨 NFT Contract Address: ${deployment.nft.address}`);
    console.log(`🎲 Mock VRF Address: ${mockVRF.address}`);
    console.log(`🔢 VRF Subscription ID: ${subscriptionId}`);
    console.log("=".repeat(50) + "\n");

    return {
        ...deployment,
        vrfMock: mockVRF,
        subscriptionId
    };
}

async function main() {
    try {
        await deployMockVRFAndContracts();
    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main();
}
