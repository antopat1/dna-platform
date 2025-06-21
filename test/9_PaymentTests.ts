// Descrizione: Test dei pagamenti e della gestione dei fondi
// Verifica che i pagamenti vengano correttamente gestiti e che gli eccessi vengano restituiti al minter.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Payment Tests", function () {
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

  it("Should return excess payment to minter", async function () {
    const mintPrice = parseEther("0.05");
    const excessPayment = parseEther("0.01");
    const testMetadataURI = "ipfs://test/payment/excess_metadata"; // Nuovo argomento per mintNFT

    const initialMinterBalance = await publicClient.getBalance({
      address: otherAccount.account.address,
    });

    const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], { // Modificato qui
      value: mintPrice + excessPayment,
      account: otherAccount.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx });

    // Per completare il processo e pulire _pendingMints
    const randomWordsRequestedEvents = await mockVRF.getEvents.RandomWordsRequested();
    const requestId = randomWordsRequestedEvents[0].args.requestId;
    await mockVRF.write.fulfillRandomWords([requestId], { account: owner.account });


    const finalMinterBalance = await publicClient.getBalance({
      address: otherAccount.account.address,
    });

    // Convertiamo i valori bigint in number per utilizzare closeTo
    const expectedMinterBalance = Number(initialMinterBalance - mintPrice);
    const actualMinterBalance = Number(finalMinterBalance);
    const tolerance = Number(parseEther("0.001")); // Tolleranza di 0.001 ETH

    expect(actualMinterBalance).to.be.closeTo(expectedMinterBalance, tolerance);
  });
});
