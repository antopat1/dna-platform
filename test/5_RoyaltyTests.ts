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

    // Register a content for testing - DEVE PASSARE TUTTI I 5 PARAMETRI
    const title = "Royalty Test Content"; // Ho cambiato il nome per chiarezza tra i test
    const description = "Description for royalty test";
    const maxCopies = 10;
    const ipfsHash = "ipfs://QmRoyaltyTestHash"; // Aggiunto il parametro mancante
    const nftMintPrice = parseEther("0.05"); // Aggiunto il parametro mancante

    const tx = await registry.write.registerContent(
      [title, description, BigInt(maxCopies), ipfsHash, nftMintPrice], // Ora sono 5 parametri
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });

    contentId = 1n; // Si assume che sia il primo contenuto registrato
  });

  it("Should correctly distribute royalties to the author", async function () {
    const mintPrice = parseEther("0.05");
    const testMetadataURI = "ipfs://test/royalty/metadata"; // Nuovo argomento per mintNFT

    // Saldo iniziale dell'autore (owner)
    const initialAuthorBalance = await publicClient.getBalance({
      address: owner.account.address,
    });

    // Effettua il minting da un altro account per simulare un utente
    const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], {
      value: mintPrice,
      account: otherAccount.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx });

    // Ottieni il requestId della richiesta di random words
    const randomWordsRequestedEvents = await mockVRF.getEvents.RandomWordsRequested();
    // Prendi l'ultimo requestId per assicurarti che sia quello del mint appena eseguito
    const requestId = randomWordsRequestedEvents[randomWordsRequestedEvents.length - 1].args.requestId;

    // Simula la fulfillment della richiesta VRF. Questo è il punto in cui le royalty vengono trasferite.
    await mockVRF.write.fulfillRandomWords([requestId], { account: owner.account });

    // Saldo finale dell'autore dopo la distribuzione delle royalty
    const finalAuthorBalance = await publicClient.getBalance({
      address: owner.account.address,
    });

    // Calcola l'importo delle royalty (3% come definito nel contratto)
    const royaltyAmount = (mintPrice * 3n) / 100n;

    // Definisci una tolleranza per i confronti, a causa delle gas fee
    const tolerance = Number(parseEther("0.001")); // Tolleranza di 0.001 ETH convertita a number

    // Verifica che il saldo finale dell'autore sia approssimativamente uguale al saldo iniziale più le royalty.
    // Convertiamo i BigInt in Number per usare `closeTo`.
    expect(Number(finalAuthorBalance)).to.be.closeTo(Number(initialAuthorBalance + royaltyAmount), tolerance);
  });
});