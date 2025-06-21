// Descrizione: Test del contenuto speciale negli NFT
// Verifica che il contenuto speciale venga correttamente assegnato agli NFT con una probabilità del 10%.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Special Content Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let owner: any;
  let publicClient: any;
  let subscriptionId: bigint;

  before(async function () {
    [owner] = await hre.viem.getWalletClients();
    publicClient = await hre.viem.getPublicClient();

    const deployment = await deployMockVRFAndContracts();
    mockVRF = deployment.vrfMock;
    registry = deployment.registry;
    nft = deployment.nft;
    subscriptionId = deployment.subscriptionId;
  });

  it("Should assign special content with 10% probability", async function () {
    const mintPrice = parseEther("0.05");
    const totalMints = 100;
    let specialContentCount = 0;
    const baseMetadataURI = "ipfs://test/special_content/"; // Base URI per i metadati

    // Creiamo 10 contenuti diversi con 10 copie ciascuno
    for (let i = 0; i < 10; i++) {
      const title = `Test Content ${i}`;
      const description = `Test Description ${i}`;
      const maxCopies = 10;

      const tx = await registry.write.registerContent(
        [title, description, BigInt(maxCopies)],
        { account: owner.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: tx });

      const contentId = BigInt(i + 1);

      // Mintiamo 10 copie per ogni contenuto
      for (let j = 0; j < 10; j++) {
        const nftMetadataURI = `${baseMetadataURI}content${contentId}_copy${j}`; // URI dinamico
        const mintTx = await nft.write.mintNFT([contentId, nftMetadataURI], { // Modificato qui
          value: mintPrice,
          account: owner.account,
        });
        await publicClient.waitForTransactionReceipt({ hash: mintTx });

        const requestIdEvents = await mockVRF.getEvents.RandomWordsRequested();
        const requestId = requestIdEvents[requestIdEvents.length - 1].args.requestId;

        await mockVRF.write.fulfillRandomWords([requestId], {
          account: owner.account,
        });

        const tokenId = BigInt(i * 10 + j + 1);
        const metadata = await nft.read.getNFTMetadata([tokenId]);
        if (metadata.hasSpecialContent) {
          specialContentCount++;
        }
        // Potresti anche aggiungere un'asserzione per verificare che il metadataURI sia corretto qui
        expect(metadata.metadataURI).to.equal(nftMetadataURI);
      }
    }

    const specialContentPercentage = (specialContentCount / totalMints) * 100;
    console.log(`Special content percentage: ${specialContentPercentage}%`);
    expect(specialContentPercentage).to.be.closeTo(10, 5); // 10% con tolleranza del 5%
  });
});
