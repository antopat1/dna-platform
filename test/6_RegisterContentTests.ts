// Descrizione: Test della registrazione dei contenuti
// Verifica che i contenuti vengano correttamente registrati nel registro e che siano accessibili.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Register Content Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let owner: any;
  let publicClient: any;
  let subscriptionId: bigint;

  before(async function () {
    [owner] = await hre.viem.getWalletClients();
    publicClient = await hre.viem.getPublicClient();

    const deployment = await deployMockVRFAndContracts();
    mockVRF = deployment.vrfMock;
    registry = deployment.registry;
    nft = deployment.nft;
    subscriptionId = deployment.subscriptionId;
  });

  it("Should allow content registration", async function () {
    const title = "Test Content";
    const description = "Test Description";
    const maxCopies = 10;

    const tx = await registry.write.registerContent(
      [title, description, BigInt(maxCopies)],
      { account: owner.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const contentId = 1n;
    const content = await registry.read.getContent([contentId]);
    expect(content.title).to.equal(title);
    expect(content.description).to.equal(description);
    expect(content.maxCopies).to.equal(BigInt(maxCopies));
  });

});