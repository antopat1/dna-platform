// Descrizione: Test della generazione di numeri casuali tramite VRF
// Verifica che i numeri casuali vengano correttamente generati e utilizzati nel processo di minting degli NFT.

import { expect }  from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Randomness Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let owner: any;
  let publicClient: any;
  let subscriptionId: bigint;
  let contentId: bigint;

  before(async function () {
    [owner] = await hre.viem.getWalletClients();
    publicClient = await hre.viem.getPublicClient();

    const deployment = await deployMockVRFAndContracts();
    mockVRF = deployment.vrfMock;
    registry = deployment.registry;
    nft = deployment.nft;
    subscriptionId = deployment.subscriptionId;

    // Register a content for testing
    const title = "Test Content";
    const description = "Test Description";
    const maxCopies = 10;

    const tx = await registry.write.registerContent(
      [title, description, BigInt(maxCopies)],
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });

    contentId = 1n;
  });

  it("Should generate random numbers via VRF", async function () {
    const mintPrice = parseEther("0.05");
    const testMetadataURI = "ipfs://test/randomness/metadata"; // Nuovo argomento per mintNFT

    const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], { // Modificato qui
      value: mintPrice,
      account: owner.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx });

    const randomWordsRequestedEvents =
      await mockVRF.getEvents.RandomWordsRequested();
    expect(randomWordsRequestedEvents).to.have.length.above(0);
    const requestId = randomWordsRequestedEvents[0].args.requestId;

    const fulfillTx = await mockVRF.write.fulfillRandomWords([requestId], {
      account: owner.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: fulfillTx });

    const tokenId = 1n;
    const metadata = await nft.read.getNFTMetadata([tokenId]);
    expect(metadata.randomSeed).to.not.equal(0n);
  });
});