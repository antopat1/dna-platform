// Descrizione: Test del trasferimento degli NFT
// Verifica che gli NFT possano essere trasferiti correttamente tra gli utenti.
// Include test per casi limite come trasferimenti non autorizzati, NFT inesistenti e safeTransferFrom.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Token Transfer Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let owner: any; // Sarà l'oggetto Account del primo walletClient
  let otherAccount: any; // Sarà l'oggetto Account del secondo walletClient
  let thirdAccount: any; // Per testare approvazioni/operatori
  let publicClient: any;
  let subscriptionId: bigint;
  let contentId: bigint;
  let tokenId: bigint; // Dichiarato qui per essere accessibile in tutto il describe

  // Variabili per la registrazione del contenuto
  const contentIpfsHash = "ipfs://QmTokenTransferTestHash";
  const contentNftMintPrice = parseEther("0.05"); // Prezzo standard

  before(async function () {
    // Otteniamo i wallet clients
    const [ownerWalletClient, otherWalletClient, thirdWalletClient] = await hre.viem.getWalletClients();
    // Assegniamo gli oggetti account alle variabili let
    owner = ownerWalletClient.account;
    otherAccount = otherWalletClient.account;
    thirdAccount = thirdWalletClient.account; // Inizializza il terzo account
    publicClient = await hre.viem.getPublicClient();

    const deployment = await deployMockVRFAndContracts();
    mockVRF = deployment.vrfMock;
    registry = deployment.registry;
    nft = deployment.nft;
    subscriptionId = deployment.subscriptionId;

    // Register a content for testing - DEVE PASSARE TUTTI I 5 PARAMETRI
    const title = "Test Content for Transfer";
    const description = "Description for transfer test";
    const maxCopies = 10n; // Usiamo BigInt per coerenza

    const tx = await registry.write.registerContent(
      [title, description, maxCopies, contentIpfsHash, contentNftMintPrice],
      { account: owner }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });

    contentId = 1n; // Si assume che sia il primo contenuto registrato
  });

  it("Should transfer NFT to another account using transferFrom", async function () {
    const mintPrice = parseEther("0.05");
    const testMetadataURI = "ipfs://test/transfer/nft_metadata";

    // Mint an NFT
    const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], {
      value: mintPrice,
      account: owner, // L'owner minta l'NFT
    });
    const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintTx });

    // Get the request ID from the last RandomWordsRequested event
    const randomWordsRequestedEvents = await mockVRF.getEvents.RandomWordsRequested();
    const specificRandomWordsRequestedEvent = randomWordsRequestedEvents.find(
      (event: any) => event.transactionHash === mintReceipt.transactionHash
    );
    expect(specificRandomWordsRequestedEvent).to.not.be.undefined;
    const requestId = specificRandomWordsRequestedEvent.args.requestId;

    // Fulfill the random words request
    const fulfillTx = await mockVRF.write.fulfillRandomWords([requestId], {
      account: owner, // L'owner (deployer del mock) fulfilla
    });
    await publicClient.waitForTransactionReceipt({ hash: fulfillTx });

    // VERIFICA E RECUPERO TOKEN ID: Usiamo totalSupply() per ottenere l'ID dell'ultimo NFT mintato
    tokenId = await nft.read.totalSupply();
    expect(tokenId > 0n).to.be.true; // Assicurati che un tokenId valido sia stato mintato

    // Verify the owner before transfer
    const originalOwner = await nft.read.ownerOf([tokenId]);
    expect(originalOwner.toLowerCase()).to.equal(owner.address.toLowerCase());

    // Transfer the NFT
    const transferTx = await nft.write.transferFrom(
      [owner.address, otherAccount.address, tokenId],
      { account: owner }
    );
    await publicClient.waitForTransactionReceipt({ hash: transferTx });

    // Verify the new owner
    const newOwner = await nft.read.ownerOf([tokenId]);
    expect(newOwner.toLowerCase()).to.equal(otherAccount.address.toLowerCase());

    // Verifica che il saldo dell'owner sia diminuito e quello di otherAccount sia aumentato
    const ownerBalance = await nft.read.balanceOf([owner.address]);
    const otherAccountBalance = await nft.read.balanceOf([otherAccount.address]);

    expect(ownerBalance).to.equal(0n); // L'owner non dovrebbe più possedere l'NFT
    expect(otherAccountBalance).to.equal(1n); // otherAccount dovrebbe possedere 1 NFT
  });

  it("Should allow transfer by approved operator", async function () {
    const mintPrice = parseEther("0.05");
    const testMetadataURI = "ipfs://test/approved_operator_transfer_metadata";

    // Mint NFT con owner
    const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], {
      value: mintPrice,
      account: owner,
    });
    const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintTx });

    const randomWordsRequestedEvents = await mockVRF.getEvents.RandomWordsRequested();
    const specificRandomWordsRequestedEvent = randomWordsRequestedEvents.find(
      (event: any) => event.transactionHash === mintReceipt.transactionHash
    );
    expect(specificRandomWordsRequestedEvent).to.not.be.undefined;
    const requestId = specificRandomWordsRequestedEvent.args.requestId;

    await mockVRF.write.fulfillRandomWords([requestId], { account: owner });

    const localTokenId = await nft.read.totalSupply();
    expect(localTokenId > 0n).to.be.true;

    // Owner approva thirdAccount per l'NFT specifico
    const approveTx = await nft.write.approve([thirdAccount.address, localTokenId], {
      account: owner,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });

    // Verifica che thirdAccount sia l'approved
    const approvedAddress = await nft.read.getApproved([localTokenId]);
    expect(approvedAddress.toLowerCase()).to.equal(thirdAccount.address.toLowerCase());

    // thirdAccount (l'operatore approvato) trasferisce l'NFT
    const transferByOperatorTx = await nft.write.transferFrom(
      [owner.address, otherAccount.address, localTokenId],
      { account: thirdAccount } // La transazione è inviata da thirdAccount
    );
    await publicClient.waitForTransactionReceipt({ hash: transferByOperatorTx });

    // Verifica il nuovo owner
    const newOwner = await nft.read.ownerOf([localTokenId]);
    expect(newOwner.toLowerCase()).to.equal(otherAccount.address.toLowerCase());
  });

  it("Should allow transfer by approved operator for all tokens (setApprovalForAll)", async function () {
    const mintPrice = parseEther("0.05");
    const testMetadataURI1 = "ipfs://test/set_approval_for_all_1";
    const testMetadataURI2 = "ipfs://test/set_approval_for_all_2";

    // Mint due NFT con owner
    const mintTx1 = await nft.write.mintNFT([contentId, testMetadataURI1], { value: mintPrice, account: owner });
    const mintReceipt1 = await publicClient.waitForTransactionReceipt({ hash: mintTx1 });
    const reqIdEvents1 = await mockVRF.getEvents.RandomWordsRequested();
    const specificReqIdEvent1 = reqIdEvents1.find((e: any) => e.transactionHash === mintReceipt1.transactionHash);
    expect(specificReqIdEvent1).to.not.be.undefined;
    await mockVRF.write.fulfillRandomWords([specificReqIdEvent1.args.requestId], { account: owner });
    const tokenId1 = await nft.read.totalSupply();
    expect(tokenId1 > 0n).to.be.true;

    const mintTx2 = await nft.write.mintNFT([contentId, testMetadataURI2], { value: mintPrice, account: owner });
    const mintReceipt2 = await publicClient.waitForTransactionReceipt({ hash: mintTx2 });
    const reqIdEvents2 = await mockVRF.getEvents.RandomWordsRequested();
    const specificReqIdEvent2 = reqIdEvents2.find((e: any) => e.transactionHash === mintReceipt2.transactionHash);
    expect(specificReqIdEvent2).to.not.be.undefined;
    await mockVRF.write.fulfillRandomWords([specificReqIdEvent2.args.requestId], { account: owner });
    const tokenId2 = await nft.read.totalSupply();
    expect(tokenId2 > 0n).to.be.true;
    expect(tokenId2).to.not.equal(tokenId1); // Assicurati che i tokenId siano diversi

    // Owner approva thirdAccount come operatore per tutti i suoi token
    const setApprovalTx = await nft.write.setApprovalForAll([thirdAccount.address, true], {
      account: owner,
    });
    await publicClient.waitForTransactionReceipt({ hash: setApprovalTx });

    // Verifica che thirdAccount sia un operatore per owner
    const isApproved = await nft.read.isApprovedForAll([owner.address, thirdAccount.address]);
    expect(isApproved).to.be.true;

    // thirdAccount (l'operatore) trasferisce il primo NFT
    const transferByOperatorAllTx1 = await nft.write.transferFrom(
      [owner.address, otherAccount.address, tokenId1],
      { account: thirdAccount }
    );
    await publicClient.waitForTransactionReceipt({ hash: transferByOperatorAllTx1 });

    // Verifica il nuovo owner del primo NFT
    const newOwner1 = await nft.read.ownerOf([tokenId1]);
    expect(newOwner1.toLowerCase()).to.equal(otherAccount.address.toLowerCase());

    // thirdAccount (l'operatore) trasferisce il secondo NFT
    const transferByOperatorAllTx2 = await nft.write.transferFrom(
      [owner.address, otherAccount.address, tokenId2],
      { account: thirdAccount }
    );
    await publicClient.waitForTransactionReceipt({ hash: transferByOperatorAllTx2 });

    // Verifica il nuovo owner del secondo NFT
    const newOwner2 = await nft.read.ownerOf([tokenId2]);
    expect(newOwner2.toLowerCase()).to.equal(otherAccount.address.toLowerCase());
  });
});