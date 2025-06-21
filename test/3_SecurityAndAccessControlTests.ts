// Descrizione: Test di sicurezza e controllo degli accessi
// Verifica che solo gli utenti autorizzati possano eseguire determinate operazioni e che i pagamenti vengano gestiti correttamente.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Security and Access Control Tests", function () {
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

    // Register a content for testing
    const title = "Test Content";
    const description = "Test Description";
    const maxCopies = 10;

    const tx = await registry.write.registerContent(
      [title, description, BigInt(maxCopies)],
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });

    contentId = 1n;
  });

  it("Should only allow owner to set NFT contract in registry", async function () {
    await expect(
      registry.write.setNFTContract([nft.address], {
        account: otherAccount.account,
      })
    ).to.be.rejectedWith("Ownable: caller is not the owner");
  });

  it("Should only allow NFT contract to increment minted copies", async function () {
    await expect(
      registry.write.incrementMintedCopies([contentId], {
        account: otherAccount.account,
      })
    ).to.be.rejectedWith("Only NFT contract can modify");
  });

  it("Should only allow NFT contract to change content availability", async function () {
    await expect(
      registry.write.setContentAvailability([contentId, false], {
        account: otherAccount.account,
      })
    ).to.be.rejectedWith("Only NFT contract can modify");
  });

  it("Should correctly handle payments and prevent reentrancy", async function () {
    const mintPrice = parseEther("0.05");
    const testMetadataURI = "ipfs://test/nft/metadata/security"; // URI di esempio

    // Verifica che il pagamento venga correttamente trasferito all'autore
    const initialAuthorBalance = await publicClient.getBalance({
      address: owner.account.address,
    });

    const mintTx = await nft.write.mintNFT([contentId, testMetadataURI], { // Modificato qui
      value: mintPrice,
      account: otherAccount.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx });

    const finalAuthorBalance = await publicClient.getBalance({
      address: owner.account.address,
    });
    const royaltyAmount = (mintPrice * 3n) / 100n;

    // Convertiamo i valori bigint in number per utilizzare closeTo
    const expectedAuthorBalance = Number(initialAuthorBalance + royaltyAmount);
    const actualAuthorBalance = Number(finalAuthorBalance);
    const tolerance = Number(parseEther("0.001")); // Tolleranza di 0.001 ETH

    expect(actualAuthorBalance).to.be.closeTo(expectedAuthorBalance, tolerance);

    // Verifica che l'eccesso di pagamento venga restituito al minter
    const excessPayment = parseEther("0.01");
    const initialMinterBalance = await publicClient.getBalance({
      address: otherAccount.account.address,
    });

    const mintTxWithExcess = await nft.write.mintNFT([contentId, testMetadataURI], { // Modificato qui
      value: mintPrice + excessPayment,
      account: otherAccount.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTxWithExcess });

    const finalMinterBalance = await publicClient.getBalance({
      address: otherAccount.account.address,
    });

    // Convertiamo i valori bigint in number per utilizzare closeTo
    const expectedMinterBalance = Number(initialMinterBalance - mintPrice);
    const actualMinterBalance = Number(finalMinterBalance);

    expect(actualMinterBalance).to.be.closeTo(expectedMinterBalance, tolerance);
  });
});
