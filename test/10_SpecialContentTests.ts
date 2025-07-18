// Descrizione: Test del contenuto speciale negli NFT
// Verifica che il contenuto speciale venga correttamente assegnato agli NFT con una probabilità del 10%.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Special Content Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let owner: any; // Sarà owner.account
  let publicClient: any;
  let subscriptionId: bigint;

  // Dichiarazione di nftMintPriceForContent come costante per essere usata nei cicli
  const nftMintPriceForContent = parseEther("0.05"); // Prezzo del mint per i contenuti registrati

  before(async function () {
    const [ownerWalletClient] = await hre.viem.getWalletClients();
    owner = ownerWalletClient.account; // Accediamo all'oggetto account
    publicClient = await hre.viem.getPublicClient();

    const deployment = await deployMockVRFAndContracts();
    mockVRF = deployment.vrfMock;
    registry = deployment.registry;
    nft = deployment.nft;
    subscriptionId = deployment.subscriptionId;
  });

  it("Should assign special content with 10% probability (statistical check)", async function () {
    const mintPrice = parseEther("0.05"); // Prezzo del mint per gli NFT singoli
    const totalMints = 100;
    let specialContentCount = 0;
    const baseMetadataURI = "ipfs://test/special_content/"; // Base URI per i metadati

    // Variabili per la registrazione del contenuto (da passare alla funzione registerContent)
    const contentIpfsHash = "ipfs://QmSpecialContentTestHash";

    // Creiamo 10 contenuti diversi con 10 copie ciascuno
    for (let i = 0; i < 10; i++) {
      const title = `Test Content ${i}`;
      const description = `Test Description ${i}`;
      const maxCopies = 10n; // Usiamo BigInt per coerenza

      // Passa tutti i 5 parametri a registerContent
      const tx = await registry.write.registerContent(
        [title, description, maxCopies, contentIpfsHash, nftMintPriceForContent],
        { account: owner }
      );
      await publicClient.waitForTransactionReceipt({ hash: tx });

      const contentId = BigInt(i + 1); // contentId sarà 1n, 2n, ..., 10n

      // Mintiamo 10 copie per ogni contenuto
      for (let j = 0; j < 10; j++) {
        const nftMetadataURI = `${baseMetadataURI}content${contentId}_copy${j}`; // URI dinamico
        const mintTx = await nft.write.mintNFT([contentId, nftMetadataURI], {
          value: mintPrice,
          account: owner,
        });
        const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintTx });

        // Trova l'evento RandomWordsRequested specifico per questa transazione
        const randomWordsRequestedEvents = await mockVRF.getEvents.RandomWordsRequested();
        const specificRandomWordsRequestedEvent = randomWordsRequestedEvents.find(
          (event: any) => event.transactionHash === mintReceipt.transactionHash
        );
        expect(specificRandomWordsRequestedEvent).to.not.be.undefined;
        const requestId = specificRandomWordsRequestedEvent.args.requestId;

        // Simula la fulfillment della VRF
        const fulfillTx = await mockVRF.write.fulfillRandomWords([requestId], {
          account: owner,
        });
        await publicClient.waitForTransactionReceipt({ hash: fulfillTx });

        // Il tokenId sarà incrementale globalmente per tutti gli NFT mintati
        const tokenId = await nft.read.totalSupply(); // Ottieni l'ultimo tokenId mintato
        // CORREZIONE: Asserzione per BigInt.
        expect(tokenId > 0n).to.be.true; // Verifica che un tokenId sia stato assegnato e sia maggiore di 0

        const metadata = await nft.read.getNFTMetadata([tokenId]);
        if (metadata.hasSpecialContent) {
          specialContentCount++;
        }
        // Assicurati che il metadataURI sia corretto
        expect(metadata.metadataURI).to.equal(nftMetadataURI);
      }
    }

    const specialContentPercentage = (specialContentCount / totalMints) * 100;
    console.log(`Special content percentage: ${specialContentPercentage}%`);
    // La tolleranza è necessaria per test statistici.
    // 10% con una tolleranza del 5% significa tra il 5% e il 15%.
    expect(specialContentPercentage).to.be.closeTo(10, 5);
  });
});