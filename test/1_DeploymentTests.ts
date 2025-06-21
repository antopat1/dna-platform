// Descrizione: Test di deployment dei contratti e configurazione iniziale
// Verifica che i contratti vengano deployati correttamente e che le configurazioni iniziali siano impostate come previsto.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

describe("Deployment Tests", function () {
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let owner: any;
  let publicClient: any;
  let subscriptionId: bigint;

  before(async function () {
    [owner] = await hre.viem.getWalletClients();
    publicClient = await hre.viem.getPublicClient();
  });

  it("Should deploy all contracts with Mock VRF", async function () {
    console.log("\n🔍 Testing full deployment with Mock VRF...");

    const deployment = await deployMockVRFAndContracts();

    mockVRF = deployment.vrfMock;
    registry = deployment.registry;
    nft = deployment.nft;
    subscriptionId = deployment.subscriptionId;

    console.log(`📍 MockVRF deployed to: ${mockVRF.address}`);
    console.log(`📍 Registry deployed to: ${registry.address}`);
    console.log(`📍 NFT Contract deployed to: ${nft.address}`);

    expect(mockVRF.address).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );
    expect(registry.address).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );
    expect(nft.address).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );
  });

  it("Should have correct VRF configuration", async function () {
    const baseFee = parseEther("0.1");
    const gasPriceLink = parseEther("0.000001");

    expect(await mockVRF.read.BASE_FEE()).to.equal(baseFee);
    expect(await mockVRF.read.GAS_PRICE_LINK()).to.equal(gasPriceLink);
  });

  it("Should have NFT contract registered as VRF consumer", async function () {
    const isConsumer = await mockVRF.read.isConsumer([
      subscriptionId,
      nft.address,
    ]);
    expect(isConsumer).to.be.true;
  });

  it("Should have correct Registry and NFT connection", async function () {
    const registeredNFTAddress = await registry.read.nftContract();
    expect(registeredNFTAddress.toLowerCase()).to.equal(
      nft.address.toLowerCase()
    );

    const contentRegistry = await nft.read.contentRegistry();
    expect(contentRegistry.toLowerCase()).to.equal(
      registry.address.toLowerCase()
    );
  });

  it("Should have funded VRF subscription", async function () {
    const subscription = await mockVRF.read.getSubscription([subscriptionId]);

    const [owner, balance, active] = subscription;

    expect(owner).to.not.be.undefined;
    expect(balance).to.not.be.undefined;
    expect(active).to.not.be.undefined;

    expect(Number(balance)).to.be.above(0);
    expect(active).to.be.true;
  });
});