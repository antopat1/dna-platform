// Descrizione: Test della funzionalità VRF e del processo di minting degli NFT
// Verifica che il processo di minting degli NFT funzioni correttamente, inclusa la generazione di numeri casuali tramite VRF.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("VRF Functionality Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let owner: any;
  let publicClient: any;
  let subscriptionId: bigint;
  let contentId: bigint;
  let contentIdForCustomURI: bigint;

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
    const ipfsHash = "ipfs://QmYF6tQ3v2e1S2x4n5y6z7w8u9v0a1b2c3d4e5f6g7h8i9j0k1l";
    const nftMintPrice = parseEther("0.05");

    const tx = await registry.write.registerContent(
      [title, description, BigInt(maxCopies), ipfsHash, nftMintPrice],
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });

    contentId = 1n;

    // Registra un nuovo contenuto per il test del custom URI
    const titleForCustomURI = "Custom URI Content";
    const descriptionForCustomURI = "Description for custom URI";
    const maxCopiesForCustomURI = 1;
    const ipfsHashForCustomURI =
      "ipfs://QmXF6tQ3v2e1S2x4n5y6z7w8u9v0a1b2c3d4e5f6g7h8i9j0k1m";
    const nftMintPriceForCustomURI = parseEther("0.05");

    const tx2 = await registry.write.registerContent(
      [
        titleForCustomURI,
        descriptionForCustomURI,
        BigInt(maxCopiesForCustomURI),
        ipfsHashForCustomURI,
        nftMintPriceForCustomURI,
      ],
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx2 });

    contentIdForCustomURI = 2n;
  });

  it("Should verify content registration", async function () {
    const content = await registry.read.getContent([contentId]);
    expect(content.title).to.equal("Test Content");
    expect(content.description).to.equal("Test Description");
    expect(content.maxCopies).to.equal(10n);
  });

  it("Should verify NFT contract can access registered content", async function () {
    const content = await registry.read.getContent([contentId]);
    expect(content.title).to.equal("Test Content");

    const nftContent = await nft.read.contentRegistry();
    expect(nftContent.toLowerCase()).to.equal(registry.address.toLowerCase());

    const contentFromNFT = await registry.read.getContent([contentId], {
      from: nft.address,
    });
    expect(contentFromNFT.title).to.equal("Test Content");
  });

  it("Should verify content is available for minting", async function () {
    const content = await registry.read.getContent([contentId]);
    expect(content.isAvailable).to.be.true;
  });

  it("Should verify NFT contract is set in registry", async function () {
    const nftContractAddress = await registry.read.nftContract();
    expect(nftContractAddress.toLowerCase()).to.equal(
      nft.address.toLowerCase()
    );
  });

  it("Should fail minting when content does not exist", async function () {
    const invalidContentId = 999n;
    const mintPrice = parseEther("0.05");
    const dummyMetadataURI =
      "ipfs://QmbF6tQ3v2e1S2x4n5y6z7w8u9v0a1b2c3d4e5f6g7h8i9j0k1l";

    await expect(
      nft.write.mintNFT([invalidContentId, dummyMetadataURI], {
        value: mintPrice,
        account: owner.account,
      })
    ).to.be.rejectedWith("Content does not exist");
  });

  it("Should complete the NFT minting process with VRF and correct metadata URI", async function () {
    const mintPrice = parseEther("0.05");
    const testMetadataURI = "ipfs://test/nft/metadata/1";

    const content = await registry.read.getContent([contentId]);
    expect(content.title).to.equal("Test Content");
    expect(content.isAvailable).to.be.true;
    expect(content.mintedCopies).to.equal(0n);

    const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], {
      value: mintPrice,
      account: owner.account,
    });
    const mintReceipt = await publicClient.waitForTransactionReceipt({
      hash: mintTx,
    });
    expect(mintReceipt.status).to.equal("success");

    const randomWordsRequestedEvents =
      await mockVRF.getEvents.RandomWordsRequested();
    expect(randomWordsRequestedEvents).to.have.length.above(0);
    const requestId = randomWordsRequestedEvents[0].args.requestId;

    const fulfillTx = await mockVRF.write.fulfillRandomWords([requestId], {
      account: owner.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: fulfillTx });

    const totalSupply = await nft.read.totalSupply();
    expect(totalSupply).to.equal(1n);

    const tokenId = 1n;
    const metadata = await nft.read.getNFTMetadata([tokenId]);
    expect(metadata.contentId).to.equal(contentId);
    expect(metadata.randomSeed).to.not.equal(0n);
    expect(metadata.copyNumber).to.equal(1n);
    expect(metadata.metadataURI).to.equal(testMetadataURI);

    const updatedContent = await registry.read.getContent([contentId]);
    expect(updatedContent.mintedCopies).to.equal(1n);

    const tokenOwner = await nft.read.ownerOf([tokenId]);
    expect(tokenOwner.toLowerCase()).to.equal(
      owner.account.address.toLowerCase()
    );

    const returnedTokenURI = await nft.read.tokenURI([tokenId]);
    expect(returnedTokenURI).to.equal(testMetadataURI);
  });

  it("Should fail minting with insufficient payment", async function () {
    const invalidMintPrice = parseEther("0.01");
    const testMetadataURI = "ipfs://test/nft/metadata/invalid_payment";

    await expect(
      nft.write.mintNFT([contentId, testMetadataURI], {
        value: invalidMintPrice,
        account: owner.account,
      })
    ).to.be.rejected;
  });

  it("Should always return the specific metadataURI provided at minting", async function () {
    const customMetadataURI = "ipfs://specific/nft/data";
    const mintPrice = parseEther("0.05");

    // Impostiamo un base URI, ma ci aspettiamo che non venga usato se forniamo un custom URI
    const baseURI = "https://mycollection.com/tokens/";
    await nft.write.setBaseURI([baseURI], { account: owner.account });

    const mintTx = await nft.write.mintNFT(
      [contentIdForCustomURI, customMetadataURI],
      {
        value: mintPrice,
        account: owner.account,
      }
    );
    await publicClient.waitForTransactionReceipt({ hash: mintTx });

    const randomWordsRequestedEvents =
      await mockVRF.getEvents.RandomWordsRequested();
    const requestId =
      randomWordsRequestedEvents[randomWordsRequestedEvents.length - 1].args
        .requestId;

    await mockVRF.write.fulfillRandomWords([requestId], {
      account: owner.account,
    });

    const totalSupply = await nft.read.totalSupply();
    const returnedTokenURI = await nft.read.tokenURI([totalSupply]);

    expect(returnedTokenURI).to.equal(customMetadataURI);
    const metadata = await nft.read.getNFTMetadata([totalSupply]);
    expect(metadata.metadataURI).to.equal(customMetadataURI);
  });
});