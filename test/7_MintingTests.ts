// Descrizione: Test del processo di minting degli NFT
// Verifica che il processo di minting degli NFT funzioni correttamente, inclusa la generazione di numeri casuali tramite VRF.
// Include test per casi limite come pagamenti insufficienti o superamento delle copie massime.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Minting Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let owner: any; // Sarà owner.account.address
  let otherAccount: any; // Per testare il minting da un altro account
  let publicClient: any;
  let subscriptionId: bigint;
  let contentId: bigint;
  const mintPrice = parseEther("0.05"); // Prezzo standard per il minting in questi test

  before(async function () {
    [owner, otherAccount] = await hre.viem.getWalletClients(); // Inizializza owner e otherAccount
    owner = owner.account; // Assegna l'account del walletClient a owner
    otherAccount = otherAccount.account;
    publicClient = await hre.viem.getPublicClient();

    const deployment = await deployMockVRFAndContracts();
    mockVRF = deployment.vrfMock;
    registry = deployment.registry;
    nft = deployment.nft;
    subscriptionId = deployment.subscriptionId;

    // Registra un contenuto per i test
    const title = "Test Content for Minting";
    const description = "Description for minting test";
    const maxCopies = 10n;
    const ipfsHash = "ipfs://QmMintingTestHash";
    const nftMintPrice = mintPrice; // Usiamo il mintPrice standard per la registrazione

    const tx = await registry.write.registerContent(
      [title, description, maxCopies, ipfsHash, nftMintPrice],
      { account: owner }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });
    contentId = 1n; // Si assume che sia il primo contenuto registrato
  });

  it("Should mint NFT with correct metadata and metadata URI", async function () {
    const testMetadataURI = "ipfs://test/minting/nft_metadata";

    // 1. Invia la richiesta di minting
    const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], {
      value: mintPrice,
      account: otherAccount, // Usiamo otherAccount per simulare un utente
    });
    const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintTx });

    // 2. Trova l'evento RandomWordsRequested per ottenere il requestId
    const randomWordsRequestedEvents = await mockVRF.getEvents.RandomWordsRequested();
    const specificRandomWordsRequestedEvent = randomWordsRequestedEvents.find(
      (event: any) => event.transactionHash === mintReceipt.transactionHash
    );

    expect(specificRandomWordsRequestedEvent).to.not.be.undefined;
    const requestId = specificRandomWordsRequestedEvent.args.requestId;

    // 3. Simula il callback di VRF
    const fulfillTx = await mockVRF.write.fulfillRandomWords([requestId], {
      account: owner, // L'owner è il deployer e può chiamare fulfillRandomWords nel mock
    });
    await publicClient.waitForTransactionReceipt({ hash: fulfillTx });

    // 4. Verifica che l'NFT sia stato creato correttamente
    const totalSupply = await nft.read.totalSupply();
    expect(totalSupply).to.equal(1n);

    const tokenId = 1n; // Il primo NFT mintato avrà ID 1
    const metadata = await nft.read.getNFTMetadata([tokenId]);
    expect(metadata.contentId).to.equal(contentId);
    expect(metadata.randomSeed).to.not.equal(0n);
    expect(metadata.copyNumber).to.equal(1n);
    expect(metadata.metadataURI).to.equal(testMetadataURI);

    const tokenOwner = await nft.read.ownerOf([tokenId]);
    expect(tokenOwner.toLowerCase()).to.equal(otherAccount.address.toLowerCase());

    // Verifica tokenURI
    const returnedTokenURI = await nft.read.tokenURI([tokenId]);
    expect(returnedTokenURI).to.equal(testMetadataURI);
  });

  it("Should prevent minting with insufficient payment", async function () {
    const insufficientMintPrice = parseEther("0.04"); // Pagamento inferiore al richiesto
    const testMetadataURI = "ipfs://test/minting/insufficient_payment";

    await expect(
      nft.write.mintNFT([contentId, testMetadataURI], {
        value: insufficientMintPrice,
        account: otherAccount,
      })
    ).to.be.rejectedWith("Insufficient payment for this content");
  });

  it("Should prevent minting when metadata URI is empty", async function () {
    const emptyMetadataURI = ""; // URI vuoto
    await expect(
      nft.write.mintNFT([contentId, emptyMetadataURI], {
        value: mintPrice,
        account: otherAccount,
      })
    ).to.be.rejectedWith("Metadata URI cannot be empty");
  });

});
