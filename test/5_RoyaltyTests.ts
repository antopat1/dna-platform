// Descrizione: Test delle royalty e della distribuzione dei pagamenti
// Verifica che le royalty vengano correttamente calcolate e trasferite all'autore del contenuto.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Royalty Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let owner: any;
  let otherAccount: any;
  let publicClient: any;
  let subscriptionId: bigint;
  let contentId: bigint;

  before(async function () {
    [owner, otherAccount] = await hre.viem.getWalletClients();
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

  it("Should correctly distribute royalties to the author", async function () {
    const mintPrice = parseEther("0.05");
    const testMetadataURI = "ipfs://test/royalty/metadata"; // Nuovo argomento per mintNFT

    const initialAuthorBalance = await publicClient.getBalance({
      address: owner.account.address,
    });

    const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], { // Modificato qui
      value: mintPrice,
      account: otherAccount.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx });

    // Per completare il processo e pulire _pendingMints
    const randomWordsRequestedEvents = await mockVRF.getEvents.RandomWordsRequested();
    const requestId = randomWordsRequestedEvents[0].args.requestId;
    await mockVRF.write.fulfillRandomWords([requestId], { account: owner.account });

    const finalAuthorBalance = await publicClient.getBalance({
      address: owner.account.address,
    });
    const royaltyAmount = (mintPrice * 3n) / 100n;

    // Convertiamo i valori bigint in number per utilizzare closeTo
    const expectedAuthorBalance = Number(initialAuthorBalance + royaltyAmount);
    const actualAuthorBalance = Number(finalAuthorBalance);
    const tolerance = Number(parseEther("0.001")); // Tolleranza di 0.001 ETH

    expect(actualAuthorBalance).to.be.closeTo(expectedAuthorBalance, tolerance);
  });
});
