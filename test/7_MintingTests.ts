// Descrizione: Test del processo di minting degli NFT
// Verifica che il processo di minting degli NFT funzioni correttamente, inclusa la generazione di numeri casuali tramite VRF.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Minting Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let walletClient: any;
  let owner: any;
  let publicClient: any;
  let subscriptionId: bigint;
  let contentId: bigint;

  before(async function () {
    [walletClient] = await hre.viem.getWalletClients();
    owner = walletClient.account;
    publicClient = await hre.viem.getPublicClient();

    const deployment = await deployMockVRFAndContracts();
    mockVRF = deployment.vrfMock;
    registry = deployment.registry;
    nft = deployment.nft;
    subscriptionId = deployment.subscriptionId;

    // Register a content for testing
    const title = "Test Content";
    const description = "Test Description";
    const maxCopies = 10n;

    const tx = await registry.write.registerContent(
      [title, description, maxCopies],
      { account: owner }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });
    contentId = 1n;
  });

  it("Should mint NFT with correct metadata and metadata URI", async function () {
    const mintPrice = parseEther("0.05");
    const testMetadataURI = "ipfs://test/minting/nft_metadata"; // Nuovo argomento

    // 1. Invia la richiesta di minting
    const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], { // Modificato qui
      value: mintPrice,
      account: owner,
    });
    const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintTx });

    // 2. Trova l'evento RandomWordsRequested per ottenere il requestId
    const logs = await publicClient.getLogs({
      address: mockVRF.address,
      fromBlock: mintReceipt.blockNumber,
      toBlock: mintReceipt.blockNumber,
      event: {
        type: 'event',
        name: 'RandomWordsRequested',
        inputs: [
          { type: 'bytes32', name: 'keyHash', indexed: true },
          { type: 'uint256', name: 'requestId' },
          { type: 'uint256', name: 'preSeed' },
          { type: 'uint64', name: 'subId', indexed: true },
          { type: 'uint16', name: 'minimumRequestConfirmations' },
          { type: 'uint32', name: 'callbackGasLimit' },
          { type: 'uint32', name: 'numWords' },
          { type: 'address', name: 'sender', indexed: true }
        ]
      }
    });

    expect(logs.length).to.be.greaterThan(0, "No RandomWordsRequested event found");
    const requestId = logs[0].args.requestId;

    // 3. Simula il callback di VRF
    const fulfillTx = await mockVRF.write.fulfillRandomWords([requestId], {
      account: owner
    });
    await publicClient.waitForTransactionReceipt({ hash: fulfillTx });

    // 4. Verifica che l'NFT sia stato creato correttamente
    const totalSupply = await nft.read.totalSupply();
    expect(totalSupply).to.equal(1n);

    const tokenId = 1n;
    const metadata = await nft.read.getNFTMetadata([tokenId]);
    expect(metadata.contentId).to.equal(contentId);
    expect(metadata.randomSeed).to.not.equal(0n);
    expect(metadata.copyNumber).to.equal(1n);
    expect(metadata.metadataURI).to.equal(testMetadataURI); // Aggiunta verifica metadataURI

    const tokenOwner = await nft.read.ownerOf([tokenId]);
    expect(tokenOwner.toLowerCase()).to.equal(
      owner.address.toLowerCase()
    );

    // Verifica tokenURI
    const returnedTokenURI = await nft.read.tokenURI([tokenId]);
    expect(returnedTokenURI).to.equal(testMetadataURI);
  });

});
