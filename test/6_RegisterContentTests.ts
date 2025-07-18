// Descrizione: Test della registrazione dei contenuti
// Verifica che i contenuti vengano correttamente registrati nel registro e che siano accessibili.
// Include test per edge case come input non validi e tentativi di riutilizzo di hash.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Register Content Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let owner: any;
  let otherAccount: any; // Aggiunto per testare autori non whitelisted
  let publicClient: any;
  let subscriptionId: bigint;

  // Variabili comuni per la registrazione
  const baseTitle = "Test Content";
  const baseDescription = "Test Description";
  const baseMaxCopies = 10;
  const baseIpfsHash = "ipfs://QmRegisterContentHash";
  const baseNftMintPrice = parseEther("0.05");

  before(async function () {
    [owner, otherAccount] = await hre.viem.getWalletClients(); // Inizializza otherAccount
    publicClient = await hre.viem.getPublicClient();

    const deployment = await deployMockVRFAndContracts();
    mockVRF = deployment.vrfMock;
    registry = deployment.registry;
    nft = deployment.nft;
    subscriptionId = deployment.subscriptionId;
  });

  it("Should allow content registration with valid parameters", async function () {
    // Il contentId sarà 1n perché è il primo contenuto registrato in questo blocco di test
    const tx = await registry.write.registerContent(
      [baseTitle, baseDescription, BigInt(baseMaxCopies), baseIpfsHash, baseNftMintPrice],
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const contentId = 1n;
    const content = await registry.read.getContent([contentId]);

    expect(content.title).to.equal(baseTitle);
    expect(content.description).to.equal(baseDescription);
    expect(content.maxCopies).to.equal(BigInt(baseMaxCopies));
    expect(content.ipfsHash).to.equal(baseIpfsHash);
    expect(content.nftMintPrice).to.equal(baseNftMintPrice);
    // Converti entrambi gli indirizzi in lowercase per il confronto
    expect(content.author.toLowerCase()).to.equal(owner.account.address.toLowerCase());
    expect(content.isAvailable).to.be.true;
    expect(content.mintedCopies).to.equal(0n);

    // Verifica che l'evento ContentRegistered sia stato emesso
    // Otteniamo tutti gli eventi e filtriamo per trovare quello corretto.
    const allContentRegisteredEvents = await registry.getEvents.ContentRegistered();
    const specificContentRegisteredEvent = allContentRegisteredEvents.find(
      (event: any) =>
        event.args.contentId === contentId &&
        event.args.author.toLowerCase() === owner.account.address.toLowerCase() &&
        event.args.title === baseTitle
    );
    expect(specificContentRegisteredEvent).to.not.be.undefined;
    expect(specificContentRegisteredEvent.args.contentId).to.equal(contentId);
    expect(specificContentRegisteredEvent.args.author.toLowerCase()).to.equal(owner.account.address.toLowerCase());
    expect(specificContentRegisteredEvent.args.title).to.equal(baseTitle);
  });

  it("Should prevent content registration with empty title", async function () {
    const emptyTitle = "";
    await expect(
      registry.write.registerContent(
        [emptyTitle, baseDescription, BigInt(baseMaxCopies), baseIpfsHash, baseNftMintPrice],
        { account: owner.account }
      )
    ).to.be.rejectedWith("Title cannot be empty");
  });

  it("Should prevent content registration with empty description", async function () {
    const emptyDescription = "";
    await expect(
      registry.write.registerContent(
        [baseTitle, emptyDescription, BigInt(baseMaxCopies), baseIpfsHash, baseNftMintPrice],
        { account: owner.account }
      )
    ).to.be.rejectedWith("Description cannot be empty");
  });

  it("Should prevent content registration with maxCopies equal to 0", async function () {
    const zeroMaxCopies = 0;
    await expect(
      registry.write.registerContent(
        [baseTitle, baseDescription, BigInt(zeroMaxCopies), baseIpfsHash, baseNftMintPrice],
        { account: owner.account }
      )
    ).to.be.rejectedWith("Must allow at least one copy");
  });

  it("Should prevent content registration with empty IPFS hash", async function () {
    const emptyIpfsHash = "";
    await expect(
      registry.write.registerContent(
        [baseTitle, baseDescription, BigInt(baseMaxCopies), emptyIpfsHash, baseNftMintPrice],
        { account: owner.account }
      )
    ).to.be.rejectedWith("IPFS hash cannot be empty");
  });

  it("Should prevent content registration with nftMintPrice equal to 0", async function () {
    const zeroNftMintPrice = 0n; // Usiamo 0n per indicare un BigInt zero
    await expect(
      registry.write.registerContent(
        [baseTitle, baseDescription, BigInt(baseMaxCopies), baseIpfsHash, zeroNftMintPrice],
        { account: owner.account }
      )
    ).to.be.rejectedWith("NFT mint price must be greater than zero");
  });

  it("Should prevent content registration with an already used hash", async function () {
    // Il primo test "Should allow content registration with valid parameters" ha già registrato
    // un contenuto con baseTitle, baseDescription e owner.
    // L'hash è generato da keccak256(abi.encodePacked(title, description, msg.sender))
    // Quindi, tentare di registrare un nuovo contenuto con gli stessi title, description e author (owner) dovrebbe fallire.
    // Usiamo un IPFS hash diverso qui solo per dimostrare che non è questo il problema.
    const duplicateTitle = baseTitle;
    const duplicateDescription = baseDescription;
    const newIpfsHash = "ipfs://Qmdiffhash_duplicate_test"; // Nuovo hash per evidenziare che non è questo il problema

    await expect(
      registry.write.registerContent(
        [duplicateTitle, duplicateDescription, BigInt(baseMaxCopies), newIpfsHash, baseNftMintPrice],
        { account: owner.account }
      )
    ).to.be.rejectedWith("Content already registered");
  });

  it("Should prevent content registration by a non-whitelisted author", async function () {
    const nonWhitelistedTitle = "Unauthorized Content";
    const nonWhitelistedDescription = "Description by unauthorized author";
    const nonWhitelistedMaxCopies = 5;
    const nonWhitelistedIpfsHash = "ipfs://QmUnauthorizedHash";
    const nonWhitelistedNftMintPrice = parseEther("0.1");

    // otherAccount non è stato whitelisted inizialmente
    expect(await registry.read.isAuthorWhitelisted([otherAccount.account.address])).to.be.false;

    await expect(
      registry.write.registerContent(
        [nonWhitelistedTitle, nonWhitelistedDescription, BigInt(nonWhitelistedMaxCopies), nonWhitelistedIpfsHash, nonWhitelistedNftMintPrice],
        { account: otherAccount.account }
      )
    ).to.be.rejectedWith("Author not whitelisted");
  });

  it("Should allow owner to whitelist an author", async function () {
    // Verifica che otherAccount non sia whitelisted prima
    expect(await registry.read.isAuthorWhitelisted([otherAccount.account.address])).to.be.false;

    // L'owner aggiunge otherAccount alla whitelist
    const addTx = await registry.write.addAuthorToWhitelist([otherAccount.account.address], { account: owner.account });
    await publicClient.waitForTransactionReceipt({ hash: addTx }); // Attendiamo la ricevuta per l'esecuzione della transazione

    // Verifica che otherAccount sia ora whitelisted
    expect(await registry.read.isAuthorWhitelisted([otherAccount.account.address])).to.be.true;

    // Emettere evento AuthorWhitelisted
    // Otteniamo tutti gli eventi AuthorWhitelisted e filtriamo per quello che ci interessa.
    const allAuthorWhitelistedEvents = await registry.getEvents.AuthorWhitelisted();
    const specificAuthorWhitelistedEvent = allAuthorWhitelistedEvents.find(
      (event: any) => event.args.author.toLowerCase() === otherAccount.account.address.toLowerCase()
    );
    expect(specificAuthorWhitelistedEvent).to.not.be.undefined;
    expect(specificAuthorWhitelistedEvent.args.author.toLowerCase()).to.equal(otherAccount.account.address.toLowerCase());
  });

  it("Should allow whitelisted author to register content", async function () {
    // Questo test si basa sul fatto che otherAccount sia stato whitelisted nel test precedente
    const whitelistedAuthorTitle = "Whitelisted Author Content";
    const whitelistedAuthorDescription = "Content from a whitelisted author";
    const whitelistedAuthorMaxCopies = 3;
    const whitelistedAuthorIpfsHash = "ipfs://QmWhitelistedHash";
    const whitelistedAuthorNftMintPrice = parseEther("0.08");

    // Verifica che otherAccount sia effettivamente whitelisted
    expect(await registry.read.isAuthorWhitelisted([otherAccount.account.address])).to.be.true;

    // otherAccount registra il contenuto
    const tx = await registry.write.registerContent(
      [whitelistedAuthorTitle, whitelistedAuthorDescription, BigInt(whitelistedAuthorMaxCopies), whitelistedAuthorIpfsHash, whitelistedAuthorNftMintPrice],
      { account: otherAccount.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });

    // Verifica che il contenuto sia stato registrato con un nuovo contentId.
    // Poiché il primo test ha usato contentId 1n, questo dovrebbe essere il 2n.
    const contentId = 2n; // Il prossimo ID disponibile dopo il primo test "Should allow content registration with valid parameters"
    const content = await registry.read.getContent([contentId]);
    expect(content.title).to.equal(whitelistedAuthorTitle);
    expect(content.author.toLowerCase()).to.equal(otherAccount.account.address.toLowerCase());

    // Verifica l'evento ContentRegistered
    const allContentRegisteredEvents = await registry.getEvents.ContentRegistered();
    const specificContentRegisteredEvent = allContentRegisteredEvents.find(
      (event: any) =>
        event.args.contentId === contentId &&
        event.args.author.toLowerCase() === otherAccount.account.address.toLowerCase() &&
        event.args.title === whitelistedAuthorTitle
    );
    expect(specificContentRegisteredEvent).to.not.be.undefined;
    expect(specificContentRegisteredEvent.args.contentId).to.equal(contentId);
    expect(specificContentRegisteredEvent.args.author.toLowerCase()).to.equal(otherAccount.account.address.toLowerCase());
    expect(specificContentRegisteredEvent.args.title).to.equal(whitelistedAuthorTitle);
  });

  it("Should allow owner to remove an author from whitelist", async function () {
    // Assumiamo che otherAccount sia ancora whitelisted dal test precedente
    expect(await registry.read.isAuthorWhitelisted([otherAccount.account.address])).to.be.true;

    // L'owner rimuove otherAccount dalla whitelist
    const removeTx = await registry.write.removeAuthorFromWhitelist([otherAccount.account.address], { account: owner.account });
    await publicClient.waitForTransactionReceipt({ hash: removeTx });

    // Verifica che otherAccount non sia più whitelisted
    expect(await registry.read.isAuthorWhitelisted([otherAccount.account.address])).to.be.false;

    // Emettere evento AuthorRemovedFromWhitelist
    const allAuthorRemovedEvents = await registry.getEvents.AuthorRemovedFromWhitelist();
    const specificAuthorRemovedEvent = allAuthorRemovedEvents.find(
      (event: any) => event.args.author.toLowerCase() === otherAccount.account.address.toLowerCase()
    );
    expect(specificAuthorRemovedEvent).to.not.be.undefined;
    expect(specificAuthorRemovedEvent.args.author.toLowerCase()).to.equal(otherAccount.account.address.toLowerCase());
  });

  it("Should prevent removed author from registering content", async function () {
    // otherAccount dovrebbe essere stato rimosso dalla whitelist
    expect(await registry.read.isAuthorWhitelisted([otherAccount.account.address])).to.be.false;

    const removedAuthorTitle = "Removed Author Content";
    const removedAuthorDescription = "Description by removed author";
    const removedAuthorMaxCopies = 1;
    const removedAuthorIpfsHash = "ipfs://QmRemovedAuthorHash";
    const removedAuthorNftMintPrice = parseEther("0.01");

    await expect(
      registry.write.registerContent(
        [removedAuthorTitle, removedAuthorDescription, BigInt(removedAuthorMaxCopies), removedAuthorIpfsHash, removedAuthorNftMintPrice],
        { account: otherAccount.account }
      )
    ).to.be.rejectedWith("Author not whitelisted");
  });
});