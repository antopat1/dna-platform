// Descrizione: Test del trasferimento degli NFT
// Verifica che gli NFT possano essere trasferiti correttamente tra gli utenti.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Token Transfer Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let owner: any;
  let otherAccount: any;
  let publicClient: any;
  let subscriptionId: bigint;
  let contentId: bigint;
  let tokenId: bigint;

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

  it("Should transfer NFT to another account", async function () {
    const mintPrice = parseEther("0.05");
    const testMetadataURI = "ipfs://test/transfer/nft_metadata"; // Nuovo argomento per mintNFT

    // Mint an NFT
    const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], { // Modificato qui
      value: mintPrice,
      account: owner.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx });

    // Get the request ID from the last RandomWordsRequested event
    const requestIdEvents = await mockVRF.getEvents.RandomWordsRequested();
    const requestId = requestIdEvents[requestIdEvents.length - 1].args.requestId;

    // Fulfill the random words request
    await mockVRF.write.fulfillRandomWords([requestId], {
      account: owner.account,
    });

    // Verify that token ID 1 exists by checking the NFT minted event
    const mintedEvents = await nft.getEvents.NFTMinted();
    expect(mintedEvents.length).to.be.greaterThan(0);
    tokenId = mintedEvents[0].args.tokenId;

    // Verify the owner before transfer
    const originalOwner = await nft.read.ownerOf([tokenId]);
    expect(originalOwner.toLowerCase()).to.equal(
      owner.account.address.toLowerCase()
    );

    // Transfer the NFT
    const transferTx = await nft.write.transferFrom(
      [owner.account.address, otherAccount.account.address, tokenId],
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: transferTx });

    // Verify the new owner
    const newOwner = await nft.read.ownerOf([tokenId]);
    expect(newOwner.toLowerCase()).to.equal(
      otherAccount.account.address.toLowerCase()
    );
  });
});
