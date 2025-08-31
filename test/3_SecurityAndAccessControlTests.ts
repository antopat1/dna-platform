// Descrizione: Test di sicurezza e controllo degli accessi
// Verifica che solo gli utenti autorizzati possano eseguire determinate operazioni e che i pagamenti vengano gestiti correttamente.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther, keccak256, toHex, getAddress } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Security and Access Control Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let owner: any;
  let otherAccount: any;
  let thirdAccount: any;
  let publicClient: any;
  let subscriptionId: bigint;
  let contentId: bigint;

  // Role constants basati sul contratto ScientificContentRegistry
  const ADMIN_ROLE = keccak256(toHex("ADMIN_ROLE"));

  before(async function () {
    [owner, otherAccount, thirdAccount] = await hre.viem.getWalletClients();
    publicClient = await hre.viem.getPublicClient();

    const deployment = await deployMockVRFAndContracts();
    mockVRF = deployment.vrfMock;
    registry = deployment.registry;
    nft = deployment.nft;
    subscriptionId = deployment.subscriptionId;

    // Register a content for testing - DEVE PASSARE TUTTI I 5 PARAMETRI
    const title = "Test Content";
    const description = "Test Description";
    const maxCopies = 10;
    const ipfsHash = "ipfs://QmTestSecurityHash";
    const nftMintPrice = parseEther("0.05");

    const tx = await registry.write.registerContent(
      [title, description, BigInt(maxCopies), ipfsHash, nftMintPrice],
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });

    contentId = 1n;
  });

  it("Should only allow admin role to set NFT contract in registry", async function () {
    // Test che l'account senza ruolo ADMIN_ROLE non possa chiamare setNFTContract
    try {
      await registry.write.setNFTContract([nft.address], {
        account: otherAccount.account,
      });
      expect.fail("La transazione dovrebbe essere fallita");
    } catch (error: any) {
      // Verifica che l'errore contenga riferimenti ad AccessControl e al ruolo mancante
      expect(error.message).to.include("AccessControl");
      expect(error.message).to.include("missing role");
      expect(error.message.toLowerCase()).to.include(otherAccount.account.address.toLowerCase());
    }
  });

  it("Should only allow NFT contract to increment minted copies", async function () {
    // Test che solo il contratto NFT possa incrementare le copie
    try {
      await registry.write.incrementMintedCopies([contentId], {
        account: otherAccount.account,
      });
      expect.fail("La transazione dovrebbe essere fallita");
    } catch (error: any) {
      // Verifica che l'errore contenga il messaggio "Only NFT contract can modify"
      expect(error.message).to.include("Only NFT contract can modify");
    }
  });

  it("Should only allow NFT contract to change content availability", async function () {
    // Test che solo il contratto NFT possa cambiare disponibilità
    try {
      await registry.write.setContentAvailability([contentId, false], {
        account: otherAccount.account,
      });
      expect.fail("La transazione dovrebbe essere fallita");
    } catch (error: any) {
      // Verifica che l'errore contenga il messaggio "Only NFT contract can modify"
      expect(error.message).to.include("Only NFT contract can modify");
    }
  });

  it("Should allow owner with ADMIN_ROLE to grant and revoke ADMIN_ROLE", async function () {
    // Verifica che l'owner abbia il ruolo ADMIN_ROLE (assegnato nel costruttore)
    const ownerHasAdminRole = await registry.read.hasRole([ADMIN_ROLE, owner.account.address]);
    expect(ownerHasAdminRole).to.be.true;

    // L'owner (che ha ADMIN_ROLE) concede ADMIN_ROLE a otherAccount
    const addAdminTx = await registry.write.addAdmin([otherAccount.account.address], {
      account: owner.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: addAdminTx });

    // Verifica che il ruolo sia stato concesso
    const hasRole = await registry.read.hasRole([ADMIN_ROLE, otherAccount.account.address]);
    expect(hasRole).to.be.true;

    // L'owner (che ha ADMIN_ROLE) revoca ADMIN_ROLE da otherAccount
    const removeAdminTx = await registry.write.removeAdmin([otherAccount.account.address], {
      account: owner.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: removeAdminTx });

    // Verifica che il ruolo sia stato revocato
    const hasRoleAfterRevoke = await registry.read.hasRole([ADMIN_ROLE, otherAccount.account.address]);
    expect(hasRoleAfterRevoke).to.be.false;
  });


  it("Should not allow non-admin to grant roles", async function () {
    // Test che un account senza ruolo ADMIN_ROLE (otherAccount) non possa aggiungere admin
    try {
      await registry.write.addAdmin([thirdAccount.account.address], {
        account: otherAccount.account,
      });
      expect.fail("La transazione dovrebbe essere fallita");
    } catch (error: any) {
      expect(error.message).to.include("AccessControl: account");
      expect(error.message).to.include("is missing role");
    }
  });

  it("Should only allow admin to manage author whitelist", async function () {
    // Test che non-admin non possa aggiungere alla whitelist
    try {
      await registry.write.addAuthorToWhitelist([thirdAccount.account.address], {
        account: otherAccount.account,
      });
      expect.fail("La transazione dovrebbe essere fallita");
    } catch (error: any) {
      expect(error.message).to.include("AccessControl: account");
      expect(error.message).to.include("is missing role");
    }

    // Test che admin possa aggiungere alla whitelist (usando thirdAccount che non è già whitelisted)
    const addTx = await registry.write.addAuthorToWhitelist([thirdAccount.account.address], {
      account: owner.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: addTx });

    // Verifica che sia stato aggiunto
    const isWhitelisted = await registry.read.isAuthorWhitelisted([thirdAccount.account.address]);
    expect(isWhitelisted).to.be.true;

    // Test che non-admin non possa rimuovere dalla whitelist
    try {
      await registry.write.removeAuthorFromWhitelist([thirdAccount.account.address], {
        account: otherAccount.account,
      });
      expect.fail("La transazione dovrebbe essere fallita");
    } catch (error: any) {
      expect(error.message).to.include("AccessControl: account");
      expect(error.message).to.include("is missing role");
    }

    // Test che admin possa rimuovere dalla whitelist
    const removeTx = await registry.write.removeAuthorFromWhitelist([thirdAccount.account.address], {
      account: owner.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: removeTx });

    // Verifica che sia stato rimosso
    const isWhitelistedAfterRemove = await registry.read.isAuthorWhitelisted([thirdAccount.account.address]);
    expect(isWhitelistedAfterRemove).to.be.false;
  });

  it("Should only allow whitelisted authors to register content", async function () {
    // Test che solo autori nella whitelist possano registrare contenuti
    const title = "Test Content Unauthorized";
    const description = "Test Description Unauthorized";
    const maxCopies = 5;
    const ipfsHash = "ipfs://QmTestUnauthorizedHash";
    const nftMintPrice = parseEther("0.1");

    // Test che otherAccount (non nella whitelist) non possa registrare
    try {
      await registry.write.registerContent(
        [title, description, BigInt(maxCopies), ipfsHash, nftMintPrice],
        { account: otherAccount.account }
      );
      expect.fail("La transazione dovrebbe essere fallita");
    } catch (error: any) {
      expect(error.message).to.include("Author not whitelisted");
    }

    // Test che owner (nella whitelist) possa registrare
    const ownerRegisterTx = await registry.write.registerContent(
      ["Owner Content", "Owner Description", BigInt(maxCopies), "ipfs://QmOwnerHash", nftMintPrice],
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: ownerRegisterTx });

    // Verifica che il contenuto sia stato registrato
    const newContentId = (await registry.read.nextContentId()) - 1n;
    const content = await registry.read.getContent([newContentId]);
    expect(content.title).to.equal("Owner Content");

    // Confronto degli indirizzi normalizzati per evitare problemi di case sensitivity
    expect(getAddress(content.author)).to.equal(getAddress(owner.account.address));
  });

  it("Should correctly handle payments and prevent reentrancy", async function () {
    const mintPrice: bigint = parseEther("0.05");
    const testMetadataURI = "ipfs://test/nft/metadata/security";

    // --- 1. Test Royalty Pagata all'Autore ---
    const initialAuthorBalance: bigint = await publicClient.getBalance({
      address: owner.account.address,
    });

    const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], {
      value: mintPrice,
      account: otherAccount.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx });

    // Simula la fulfillment della VRF, che triggera il pagamento della royalty
    const randomWordsRequestedEvents = await mockVRF.getEvents.RandomWordsRequested();
    const requestId = randomWordsRequestedEvents[0].args.requestId;

    // --- FIX: Passa solo il requestId, come richiesto dal mock semplificato ---
    const fulfillTx = await mockVRF.write.fulfillRandomWords([requestId], {
      account: owner.account,
    });
    const fulfillReceipt = await publicClient.waitForTransactionReceipt({ hash: fulfillTx });

    // Calcola il costo del gas pagato dall'autore (owner) per la chiamata `fulfill`
    const gasCostForFulfill: bigint = BigInt(fulfillReceipt.gasUsed) * BigInt(fulfillReceipt.effectiveGasPrice);
    const royaltyAmount: bigint = (mintPrice * 3n) / 100n; // 3% royalty

    const finalAuthorBalance: bigint = await publicClient.getBalance({
      address: owner.account.address,
    });

    // Il saldo finale atteso è: saldo iniziale + royalty ricevuta - gas pagato
    const expectedAuthorBalance: bigint = initialAuthorBalance + royaltyAmount - gasCostForFulfill;
    expect(finalAuthorBalance).to.equal(expectedAuthorBalance);

    // --- 2. Test Rimborso Pagamento in Eccesso al Minter ---
    const excessPayment: bigint = parseEther("0.01");
    const initialMinterBalance: bigint = await publicClient.getBalance({
      address: otherAccount.account.address,
    });

    const mintTxWithExcess = await nft.write.mintNFT([contentId, testMetadataURI], {
      value: mintPrice + excessPayment,
      account: otherAccount.account,
    });
    const excessReceipt = await publicClient.waitForTransactionReceipt({ hash: mintTxWithExcess });
    
    // Calcola il costo del gas pagato dal minter per la sua transazione `mintNFT`
    const gasCostForMinter: bigint = BigInt(excessReceipt.gasUsed) * BigInt(excessReceipt.effectiveGasPrice);

    // Simula la fulfillment per il secondo mint
    const randomWordsRequestedEvents2 = await mockVRF.getEvents.RandomWordsRequested();
    const requestId2 = randomWordsRequestedEvents2[randomWordsRequestedEvents2.length - 1].args.requestId;
    
    // --- FIX: Passa solo il requestId anche qui ---
    const fulfillTx2 = await mockVRF.write.fulfillRandomWords([requestId2], {
      account: owner.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: fulfillTx2 });

    const finalMinterBalance: bigint = await publicClient.getBalance({
      address: otherAccount.account.address,
    });

    // Il saldo finale atteso del minter è: saldo iniziale - costo del mint - gas pagato
    // L'eccesso è stato rimborsato, quindi non appare nel calcolo.
    const expectedFinalMinterBalance: bigint = initialMinterBalance - mintPrice - gasCostForMinter;
    expect(finalMinterBalance).to.equal(expectedFinalMinterBalance);
  });
});
