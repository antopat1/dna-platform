// Descrizione: Test della generazione di numeri casuali tramite VRF
// Verifica che i numeri casuali vengano correttamente generati e utilizzati nel processo di minting degli NFT.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Randomness Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let owner: any; // Sarà owner.account
  let publicClient: any;
  let subscriptionId: bigint;
  let contentId: bigint;

  before(async function () {
    [owner] = await hre.viem.getWalletClients(); // Assumiamo owner è un WalletClient
    owner = owner.account; // Accediamo all'oggetto account
    publicClient = await hre.viem.getPublicClient();

    const deployment = await deployMockVRFAndContracts();
    mockVRF = deployment.vrfMock;
    registry = deployment.registry;
    nft = deployment.nft;
    subscriptionId = deployment.subscriptionId;

    // Register a content for testing - DEVE PASSARE TUTTI I 5 PARAMETRI
    const title = "Test Content for Randomness"; // Modificato il titolo per chiarezza
    const description = "Description for randomness test";
    const maxCopies = 10n; // Usiamo BigInt per coerenza
    const ipfsHash = "ipfs://QmRandomnessTestHash"; // Aggiunto il parametro mancante
    const nftMintPrice = parseEther("0.05"); // Aggiunto il parametro mancante

    const tx = await registry.write.registerContent(
      [title, description, maxCopies, ipfsHash, nftMintPrice], // Ora sono 5 parametri
      { account: owner }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });

    contentId = 1n; // Si assume che sia il primo contenuto registrato
  });

  it("Should generate random numbers via VRF and assign to NFT", async function () {
    const mintPrice = parseEther("0.05");
    const testMetadataURI = "ipfs://test/randomness/metadata";

    // 1. Invia la richiesta di minting
    const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], {
      value: mintPrice,
      account: owner,
    });
    const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintTx });

    // 2. Trova l'evento RandomWordsRequested per ottenere il requestId
    const randomWordsRequestedEvents = await mockVRF.getEvents.RandomWordsRequested();
    // Trova l'evento specifico per questa transazione di minting
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

    // 4. Verifica che il seed casuale sia stato assegnato all'NFT
    const tokenId = 1n; // Il primo NFT mintato avrà ID 1
    const metadata = await nft.read.getNFTMetadata([tokenId]);
    
    // VERIFICA CORRETTA PER BIGINT:
    expect(metadata.randomSeed).to.not.equal(0n); // Il seed non dovrebbe essere zero
    // Rimosso .to.be.above(0n) che causava l'errore con BigInt per default
    // Se vuoi testare che sia > 0, puoi farlo direttamente con BigInt
    // es: expect(metadata.randomSeed > 0n).to.be.true;

    // Opzionale: puoi anche aggiungere un test per verificare che `copyNumber` sia stato assegnato
    expect(metadata.copyNumber).to.equal(1n);

    // Opzionale: verifica che l'owner dell'NFT sia corretto
    const tokenOwner = await nft.read.ownerOf([tokenId]);
    expect(tokenOwner.toLowerCase()).to.equal(owner.address.toLowerCase());
  });

});