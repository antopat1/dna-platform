// Descrizione: Test dei pagamenti e della gestione dei fondi
// Verifica che i pagamenti vengano correttamente gestiti e che gli eccessi vengano restituiti al minter.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Payment Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let owner: any; // Sarà l'oggetto Account del primo walletClient
  let otherAccount: any; // Sarà l'oggetto Account del secondo walletClient
  let publicClient: any;
  let subscriptionId: bigint;
  let contentId: bigint;

  // Spostato mintPrice qui per renderlo accessibile a tutti i test
  const mintPrice = parseEther("0.05");

  before(async function () {
    // Otteniamo i wallet clients
    const [ownerWalletClient, otherWalletClient] = await hre.viem.getWalletClients();
    // Assegniamo gli oggetti account alle variabili let
    owner = ownerWalletClient.account;
    otherAccount = otherWalletClient.account;
    publicClient = await hre.viem.getPublicClient();

    const deployment = await deployMockVRFAndContracts();
    mockVRF = deployment.vrfMock;
    registry = deployment.registry;
    nft = deployment.nft;
    subscriptionId = deployment.subscriptionId;

    // Register a content for testing - DEVE PASSARE TUTTI I 5 PARAMETRI
    const title = "Test Content for Payments";
    const description = "Description for payment test";
    const maxCopies = 10n;
    const ipfsHash = "ipfs://QmPaymentTestHash";
    const nftMintPriceForContent = mintPrice; // Usiamo il mintPrice definito sopra

    const tx = await registry.write.registerContent(
      [title, description, maxCopies, ipfsHash, nftMintPriceForContent],
      { account: owner }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });

    contentId = 1n; // Si assume che sia il primo contenuto registrato
  });

  it("Should return excess payment to minter", async function () {
    const excessPayment = parseEther("0.01");
    const testMetadataURI = "ipfs://test/payment/excess_metadata";

    const initialMinterBalance = await publicClient.getBalance({
      address: otherAccount.address,
    });

    const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], {
      value: mintPrice + excessPayment,
      account: otherAccount,
    });
    const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintTx });

    // Calcola il costo esatto della transazione del minter
    const gasUsed = mintReceipt.gasUsed;
    const gasPrice = mintReceipt.effectiveGasPrice;
    // CORREZIONE 1: Converti esplicitamente in BigInt se necessario,
    // anche se gasUsed e gasPrice di Viem dovrebbero essere già BigInt
    const transactionCost: bigint = BigInt(gasUsed) * BigInt(gasPrice);

    // Per completare il processo e pulire _pendingMints, simula la fulfillment
    const randomWordsRequestedEvents = await mockVRF.getEvents.RandomWordsRequested();
    const specificRandomWordsRequestedEvent = randomWordsRequestedEvents.find(
      (event: any) => event.transactionHash === mintReceipt.transactionHash
    );

    expect(specificRandomWordsRequestedEvent).to.not.be.undefined;
    const requestId = specificRandomWordsRequestedEvent.args.requestId;
    
    const fulfillTx = await mockVRF.write.fulfillRandomWords([requestId], { account: owner });
    await publicClient.waitForTransactionReceipt({ hash: fulfillTx });


    const finalMinterBalance = await publicClient.getBalance({
      address: otherAccount.address,
    });

    // Il saldo finale del minter dovrebbe essere:
    // Saldo iniziale - (prezzo dell'NFT) - (costo della transazione)
    // L'eccesso di pagamento viene rimborsato immediatamente al minter.
    const expectedMinterBalance = initialMinterBalance - mintPrice - transactionCost;

    const tolerance = Number(parseEther("0.001")); // Tolleranza di 0.001 ETH

    expect(Number(finalMinterBalance)).to.be.closeTo(
      Number(expectedMinterBalance),
      tolerance
    );
  });

  it("Should allow owner to withdraw protocol fees", async function () {
    // Assicuriamoci che ci siano fondi nel contratto NFT (es. da un mint precedente)
    let currentContractBalance = await nft.read.getContractBalance();
    if (currentContractBalance === 0n) {
        const testMetadataURI = "ipfs://test/payment/setup_fees";
        const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], {
            value: mintPrice,
            account: otherAccount,
        });
        const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintTx });

        const randomWordsRequestedEvents = await mockVRF.getEvents.RandomWordsRequested();
        const specificRandomWordsRequestedEvent = randomWordsRequestedEvents.find(
            (event: any) => event.transactionHash === mintReceipt.transactionHash
        );
        expect(specificRandomWordsRequestedEvent).to.not.be.undefined;
        const requestId = specificRandomWordsRequestedEvent.args.requestId;
        
        const fulfillTx = await mockVRF.write.fulfillRandomWords([requestId], { account: owner });
        await publicClient.waitForTransactionReceipt({ hash: fulfillTx });
        
        currentContractBalance = await nft.read.getContractBalance(); // Aggiorna il saldo
    }
    // Asserzione per BigInt:
    expect(currentContractBalance > 0n).to.be.true;


    const initialOwnerBalance = await publicClient.getBalance({
      address: owner.address,
    });

    const withdrawTx = await nft.write.withdrawProtocolFees({ account: owner });
    const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawTx });

    const finalContractBalance = await nft.read.getContractBalance();
    expect(finalContractBalance).to.equal(0n); // Il contratto dovrebbe essere vuoto

    const finalOwnerBalance = await publicClient.getBalance({
      address: owner.address,
    });

    // Calcola il costo della transazione di prelievo per l'owner
    const gasUsed = withdrawReceipt.gasUsed;
    const gasPrice = withdrawReceipt.effectiveGasPrice;
    const transactionCost: bigint = BigInt(gasUsed) * BigInt(gasPrice); // Assicurati sia BigInt

    const expectedOwnerBalance = initialOwnerBalance + currentContractBalance - transactionCost;
    const tolerance = Number(parseEther("0.001"));

    expect(Number(finalOwnerBalance)).to.be.closeTo(
      Number(expectedOwnerBalance),
      tolerance
    );

    // Verifica l'evento ProtocolFeesWithdrawn
    const protocolFeesWithdrawnEvents = await nft.getEvents.ProtocolFeesWithdrawn();
    const specificWithdrawEvent = protocolFeesWithdrawnEvents.find(
      (event: any) =>
        event.args.to.toLowerCase() === owner.address.toLowerCase() &&
        event.args.amount === currentContractBalance // Usa il saldo prelevato
    );
    expect(specificWithdrawEvent).to.not.be.undefined;
    expect(specificWithdrawEvent.args.to.toLowerCase()).to.equal(owner.address.toLowerCase());
    expect(specificWithdrawEvent.args.amount).to.equal(currentContractBalance);
  });

  it("Should update protocol fee receiver", async function () {
    const oldReceiver = await nft.read.protocolFeeReceiver();
    const newReceiver = otherAccount.address;

    const setReceiverTx = await nft.write.setProtocolFeeReceiver([newReceiver], { account: owner });
    await publicClient.waitForTransactionReceipt({ hash: setReceiverTx });

    const currentReceiver = await nft.read.protocolFeeReceiver();
    expect(currentReceiver.toLowerCase()).to.equal(newReceiver.toLowerCase());

    // Verifica l'evento ProtocolFeeReceiverUpdated
    const protocolFeeReceiverUpdatedEvents = await nft.getEvents.ProtocolFeeReceiverUpdated();
    const specificUpdateEvent = protocolFeeReceiverUpdatedEvents.find(
      (event: any) =>
        event.args.oldReceiver.toLowerCase() === oldReceiver.toLowerCase() &&
        event.args.newReceiver.toLowerCase() === newReceiver.toLowerCase()
    );
    expect(specificUpdateEvent).to.not.be.undefined;
    expect(specificUpdateEvent.args.oldReceiver.toLowerCase()).to.equal(oldReceiver.toLowerCase());
    expect(specificUpdateEvent.args.newReceiver.toLowerCase()).to.equal(newReceiver.toLowerCase());
  });

});