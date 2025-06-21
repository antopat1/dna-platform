// Descrizione: Test di edge case e situazioni limite
// Verifica il comportamento del sistema in situazioni limite, come pagamenti insufficienti o superamento del numero massimo di copie.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Edge Case Tests", function () {
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

    // Registra un contenuto per i test
    const title = "Edge Case Test Content";
    const description = "Edge Case Test Description";
    const maxCopies = 2; // Numero limitato di copie per testare il limite

    const tx = await registry.write.registerContent(
      [title, description, BigInt(maxCopies)],
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });

    contentId = 1n;
  });

  it("Should prevent minting with insufficient payment", async function () {
    const insufficientMintPrice = parseEther("0.04"); // Pagamento inferiore al richiesto
    const testMetadataURI = "ipfs://test/nft/metadata/edgecase_insufficient";

    await expect(
      nft.write.mintNFT([contentId, testMetadataURI], { // Modificato qui
        value: insufficientMintPrice,
        account: owner.account,
      })
    ).to.be.rejectedWith("Insufficient payment");
  });

  it("Should prevent minting when metadata URI is empty", async function () {
    const mintPrice = parseEther("0.05");
    const emptyMetadataURI = ""; // URI vuoto

    await expect(
      nft.write.mintNFT([contentId, emptyMetadataURI], { // Modificato qui
        value: mintPrice,
        account: owner.account,
      })
    ).to.be.rejectedWith("Metadata URI cannot be empty");
  });

  it("Should prevent minting beyond max copies", async function () {
    const mintPrice = parseEther("0.05");
    const testMetadataURI1 = "ipfs://test/nft/metadata/limit_1";
    const testMetadataURI2 = "ipfs://test/nft/metadata/limit_2";
    const testMetadataURI3 = "ipfs://test/nft/metadata/limit_3"; // Questo dovrebbe fallire

    // Mint la prima copia
    const mintTx1 = await nft.write.mintNFT([contentId, testMetadataURI1], {
      value: mintPrice,
      account: owner.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx1 });
    const randomWordsRequestedEvents1 = await mockVRF.getEvents.RandomWordsRequested();
    const requestId1 = randomWordsRequestedEvents1[randomWordsRequestedEvents1.length -1].args.requestId;
    await mockVRF.write.fulfillRandomWords([requestId1], { account: owner.account });

    // Mint la seconda copia
    const mintTx2 = await nft.write.mintNFT([contentId, testMetadataURI2], {
      value: mintPrice,
      account: owner.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx2 });
    const randomWordsRequestedEvents2 = await mockVRF.getEvents.RandomWordsRequested();
    const requestId2 = randomWordsRequestedEvents2[randomWordsRequestedEvents2.length -1].args.requestId;
    await mockVRF.write.fulfillRandomWords([requestId2], { account: owner.account });

    // Tentativo di mintare una terza copia (dovrebbe fallire)
    await expect(
      nft.write.mintNFT([contentId, testMetadataURI3], {
        value: mintPrice,
        account: owner.account,
      })
    ).to.be.rejectedWith("Content not available"); // <-- MODIFICA QUI
  });
});
