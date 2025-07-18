// Descrizione: Test del contratto DnAContentMarketplace
// Verifica le funzionalità di vendita a prezzo fisso, aste e gestione delle commissioni.

import { expect } from "chai";
import hre from "hardhat";
import { parseEther, toBytes, parseUnits, getAddress, Hex } from "viem";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock"; // Assicurati che il percorso sia corretto

// Estendi l'interfaccia Mocha per aggiungere tipi a `this` nel contesto dei test
declare module "mocha" {
  export interface Context {
    mintedTokenId: bigint;
    auctionTokenId: bigint;
  }
}

describe("DnAContentMarketplace Tests", function () {
  // Dichiarazioni delle variabili nello scope esterno per essere accessibili
  let mockVRF: any;
  let registry: any;
  let nft: any;
  let marketplace: any;
  let owner: any;
  let seller: any;
  let buyer: any;
  let bidder1: any;
  let bidder2: any;
  let thirdAccount: any;
  let publicClient: any;
  let subscriptionId: bigint;
  let contentId: bigint; // ID del contenuto registrato per i test

  // Variabili per la registrazione del contenuto (necessarie per mintare NFT)
  const contentIpfsHash = "ipfs://QmbTMarketplaceTestHash";
  const contentNftMintPrice = parseEther("0.05");

  // Funzione di setup comune per tutti i test. Utilizzo loadFixture per ottimizzare.
  async function deployMarketplaceFixture() {
    const [ownerWallet, sellerWallet, buyerWallet, bidder1Wallet, bidder2Wallet, thirdAccountWallet] = await hre.viem.getWalletClients();
    const owner = ownerWallet.account;
    const seller = sellerWallet.account;
    const buyer = buyerWallet.account;
    const bidder1 = bidder1Wallet.account;
    const bidder2 = bidder2Wallet.account;
    const thirdAccount = thirdAccountWallet.account;

    const publicClient = await hre.viem.getPublicClient();

    // deployMockVRFAndContracts ritorna un oggetto con vrfMock, registry, nft e subscriptionId
    const deployment = await deployMockVRFAndContracts();
    const mockVRF = deployment.vrfMock; // Assicurati che 'vrfMock' sia il nome corretto
    const registry = deployment.registry;
    const nft = deployment.nft;
    const subscriptionId = deployment.subscriptionId;

    const marketplaceContract = await hre.viem.deployContract("DnAContentMarketplace", [nft.address]);
    const marketplace = marketplaceContract;

    // Registra il contenuto e recupera contentId per l'NFT.
    const registerTx = await registry.write.registerContent(
      ["Marketplace Test Content", "Description for marketplace test", 100n, contentIpfsHash, contentNftMintPrice],
      { account: owner }
    );
    await publicClient.waitForTransactionReceipt({ hash: registerTx });
    
    const contentRegisteredEvents = await registry.getEvents.ContentRegistered();
    expect(contentRegisteredEvents.length).to.be.greaterThan(0, "No ContentRegistered event found during setup");
    const firstContentRegisteredEvent = contentRegisteredEvents[0];
    const initialContentId = firstContentRegisteredEvent.args.contentId;

    return { mockVRF, registry, nft, marketplace, owner, seller, buyer, bidder1, bidder2, thirdAccount, publicClient, subscriptionId, contentId: initialContentId };
  }

  // --- Initial Setup Tests ---
  before(async function () {
    // Questo `before` esegue la fixture una sola volta per tutto il blocco `describe`.
    const fixture = await loadFixture(deployMarketplaceFixture);
    mockVRF = fixture.mockVRF;
    registry = fixture.registry;
    nft = fixture.nft;
    marketplace = fixture.marketplace;
    owner = fixture.owner;
    seller = fixture.seller;
    buyer = fixture.buyer;
    bidder1 = fixture.bidder1;
    bidder2 = fixture.bidder2;
    thirdAccount = fixture.thirdAccount;
    publicClient = fixture.publicClient;
    subscriptionId = fixture.subscriptionId;
    contentId = fixture.contentId;
  });

  describe("Initial Setup", function () {
    it("Should set the NFT contract address correctly", async function () {
      expect(getAddress(await marketplace.read.nftContract())).to.equal(getAddress(nft.address));
    });

    it("Should set the owner correctly", async function () {
      expect(getAddress(await marketplace.read.owner())).to.equal(getAddress(owner.address));
    });

    it("Should set the default protocol fee receiver to owner", async function () {
      expect(getAddress(await marketplace.read.protocolFeeReceiver())).to.equal(getAddress(owner.address));
    });

    it("Should set the default protocol fee to 2.5%", async function () {
      expect(await marketplace.read.protocolFeeBps()).to.equal(250n);
    });
  });

  // Funzione helper per il minting e la gestione VRF, per ridurre la duplicazione
  async function mintAndHandleVRF(
    _nft: any, 
    _mockVRF: any, 
    _publicClient: any, 
    _seller: any, 
    _owner: any, 
    _contentId: bigint, 
    _mintPrice: bigint, 
    _metadataURI: string
  ): Promise<bigint> {
    const mintTxHash = await _nft.write.mintNFT([_contentId, _metadataURI], {
      value: _mintPrice,
      account: _seller,
    });
    const mintReceipt = await _publicClient.waitForTransactionReceipt({ hash: mintTxHash });

    const randomWordsRequestedEvents = await _publicClient.getContractEvents({
      abi: _mockVRF.abi,
      address: _mockVRF.address,
      eventName: 'RandomWordsRequested',
      fromBlock: mintReceipt.blockNumber, 
      toBlock: "latest", 
    });

    expect(randomWordsRequestedEvents.length).to.be.greaterThan(0, "No RandomWordsRequested event found.");
    const requestId = randomWordsRequestedEvents[0].args.requestId;

    const fulfillTxHash = await _mockVRF.write.fulfillRandomWords([requestId], { account: _owner });
    await _publicClient.waitForTransactionReceipt({ hash: fulfillTxHash }); 

    const transferEvents = await _publicClient.getContractEvents({
      abi: _nft.abi,
      address: _nft.address,
      eventName: 'Transfer',
      fromBlock: mintReceipt.blockNumber, 
      toBlock: "latest", 
      args: {
        from: getAddress('0x0000000000000000000000000000000000000000'), 
        to: getAddress(_seller.address)
      }
    });
    
    expect(transferEvents.length).to.be.greaterThan(0, "No Transfer event found for minting after VRF fulfill.");
    const tokenId = transferEvents[0].args.tokenId;
    expect(tokenId).to.not.be.undefined;
    expect(Number(tokenId)).to.be.greaterThan(0, "Minted token ID should be greater than 0");

    return tokenId;
  }



  // ### Fixed Price Sales

  describe("Fixed Price Sales", function () {
    // Dichiara le variabili che verranno assegnate a `this` nel `beforeEach`
    // per renderle accessibili in ogni `it` del blocco.
    const mintPrice = parseEther("0.05");
    const listingPrice = parseEther("1");
    const testMetadataURI = "ipfs://test/marketplace/fixed_price_nft";

    beforeEach(async function () {
      // Re-deploy fixture for each test to ensure a clean state
      const fixture = await loadFixture(deployMarketplaceFixture);
      nft = fixture.nft;
      marketplace = fixture.marketplace;
      owner = fixture.owner;
      seller = fixture.seller;
      buyer = fixture.buyer;
      publicClient = fixture.publicClient;
      contentId = fixture.contentId;
      mockVRF = fixture.mockVRF;
      subscriptionId = fixture.subscriptionId;

      // Assegna a `this.mintedTokenId` per accessibilità nei test `it`
      this.mintedTokenId = await mintAndHandleVRF(
        nft, mockVRF, publicClient, seller, owner, contentId, mintPrice, testMetadataURI
      );
      // DEBUG:
      // console.log(`DEBUG: In beforeEach (Fixed Price Sales), mintedTokenId is: ${this.mintedTokenId}`);
      
      // Approva il marketplace per il token appena mintato
      const approveTx = await nft.write.approve([marketplace.address, this.mintedTokenId], { account: seller });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    });

    it("Should allow a user to list an NFT for sale", async function () {
      // DEBUG:
      // console.log(`DEBUG: In "list an NFT for sale" test, mintedTokenId is: ${this.mintedTokenId}`);
      expect(getAddress(await nft.read.ownerOf([this.mintedTokenId]))).to.equal(getAddress(seller.address));

      const listTx = await marketplace.write.listNFTForSale([this.mintedTokenId, listingPrice], { account: seller });
      const listReceipt = await publicClient.waitForTransactionReceipt({ hash: listTx });

      expect(getAddress(await nft.read.ownerOf([this.mintedTokenId]))).to.equal(getAddress(marketplace.address));
      
      const listing = await marketplace.read.fixedPriceListings([this.mintedTokenId]);
      expect(getAddress(listing.seller)).to.equal(getAddress(seller.address));
      expect(listing.price).to.equal(listingPrice);
      expect(listing.isActive).to.be.true;
      expect(await marketplace.read.isTokenListedForSale([this.mintedTokenId])).to.be.true;

      const events = await marketplace.getEvents.NFTListedForSale();
      expect(events.length).to.be.greaterThan(0);
      const listEvent = events.find((e: any) => e.transactionHash === listReceipt.transactionHash);
      expect(listEvent).to.not.be.undefined;
      expect(listEvent.args.tokenId).to.equal(this.mintedTokenId);
      expect(getAddress(listEvent.args.seller)).to.equal(getAddress(seller.address));
      expect(listEvent.args.price).to.equal(listingPrice);
    });

    it("Should allow a user to purchase an NFT", async function () {
      await marketplace.write.listNFTForSale([this.mintedTokenId, listingPrice], { account: seller });
      const isListed = await marketplace.read.isTokenListedForSale([this.mintedTokenId]);
      expect(isListed).to.be.true;

      const initialSellerEthBalance = await publicClient.getBalance({ address: seller.address });
      const initialBuyerEthBalance = await publicClient.getBalance({ address: buyer.address });

      const purchaseTxHash = await marketplace.write.purchaseNFT([this.mintedTokenId], {
        value: listingPrice,
        account: buyer,
      });
      const purchaseReceipt = await publicClient.waitForTransactionReceipt({ hash: purchaseTxHash });

      const gasUsed = BigInt(purchaseReceipt.gasUsed); 
      const gasPrice = BigInt(purchaseReceipt.effectiveGasPrice); 
      const txCost = gasUsed * gasPrice;

      expect(getAddress(await nft.read.ownerOf([this.mintedTokenId]))).to.equal(getAddress(buyer.address));

      const listing = await marketplace.read.fixedPriceListings([this.mintedTokenId]);
      expect(listing.isActive).to.be.false;
      expect(await marketplace.read.isTokenListedForSale([this.mintedTokenId])).to.be.false;

      const protocolFeeBps = await marketplace.read.protocolFeeBps();
      const calculatedProtocolFee = (listingPrice * protocolFeeBps) / 10000n;
      const sellerAmount = listingPrice - calculatedProtocolFee;

      const finalSellerEthBalance = await publicClient.getBalance({ address: seller.address });
      const finalBuyerEthBalance = await publicClient.getBalance({ address: buyer.address });

      expect(finalSellerEthBalance).to.equal(initialSellerEthBalance + sellerAmount);
      expect(finalBuyerEthBalance).to.equal(initialBuyerEthBalance - listingPrice - txCost);
      expect(await marketplace.read.accumulatedFees()).to.equal(calculatedProtocolFee);

      const events = await marketplace.getEvents.NFTPurchased();
      expect(events.length).to.be.greaterThan(0);
      const purchaseEvent = events.find((e: any) => e.transactionHash === purchaseReceipt.transactionHash);
      expect(purchaseEvent).to.not.be.undefined;
      expect(purchaseEvent.args.tokenId).to.equal(this.mintedTokenId);
      expect(getAddress(purchaseEvent.args.seller)).to.equal(getAddress(seller.address));
      expect(getAddress(purchaseEvent.args.buyer)).to.equal(getAddress(buyer.address));
      expect(purchaseEvent.args.price).to.equal(listingPrice);
      expect(purchaseEvent.args.protocolFee).to.equal(calculatedProtocolFee);
    });

    it("Should refund excess payment during purchase", async function () {
      await marketplace.write.listNFTForSale([this.mintedTokenId, listingPrice], { account: seller });

      const excessPayment = parseEther("0.5");
      const totalPayment = listingPrice + excessPayment;
      const initialBuyerEthBalance = await publicClient.getBalance({ address: buyer.address });

      const purchaseTxHash = await marketplace.write.purchaseNFT([this.mintedTokenId], {
        value: totalPayment,
        account: buyer,
      });
      const purchaseReceipt = await publicClient.waitForTransactionReceipt({ hash: purchaseTxHash });
      const gasUsed = BigInt(purchaseReceipt.gasUsed);
      const gasPrice = BigInt(purchaseReceipt.effectiveGasPrice);
      const txCost = gasUsed * gasPrice;

      const finalBuyerEthBalance = await publicClient.getBalance({ address: buyer.address });
      expect(finalBuyerEthBalance).to.equal(initialBuyerEthBalance - listingPrice - txCost);
    });

    it("Should allow seller to remove an NFT from sale", async function () {
      await marketplace.write.listNFTForSale([this.mintedTokenId, listingPrice], { account: seller });
      expect(getAddress(await nft.read.ownerOf([this.mintedTokenId]))).to.equal(getAddress(marketplace.address));
      const isListed = await marketplace.read.isTokenListedForSale([this.mintedTokenId]);
      expect(isListed).to.be.true;

      const removeTx = await marketplace.write.removeNFTFromSale([this.mintedTokenId], { account: seller });
      const removeReceipt = await publicClient.waitForTransactionReceipt({ hash: removeTx });

      expect(getAddress(await nft.read.ownerOf([this.mintedTokenId]))).to.equal(getAddress(seller.address));
      
      const listing = await marketplace.read.fixedPriceListings([this.mintedTokenId]);
      expect(listing.isActive).to.be.false;
      expect(await marketplace.read.isTokenListedForSale([this.mintedTokenId])).to.be.false;

      const events = await marketplace.getEvents.NFTSaleRemoved();
      expect(events.length).to.be.greaterThan(0);
      const removeEvent = events.find((e: any) => e.transactionHash === removeReceipt.transactionHash);
      expect(removeEvent).to.not.be.undefined;
      expect(removeEvent.args.tokenId).to.equal(this.mintedTokenId);
      expect(getAddress(removeEvent.args.seller)).to.equal(getAddress(seller.address));
    });

    it("Should revert if non-owner tries to list NFT", async function () {
      await expect(
        marketplace.write.listNFTForSale([this.mintedTokenId, listingPrice], { account: buyer })
      ).to.be.rejectedWith("Not token owner"); 
    });

    it("Should revert if NFT is already listed for sale", async function () {
      await marketplace.write.listNFTForSale([this.mintedTokenId, listingPrice], { account: seller });
      // Modificato il messaggio di revert atteso
      await expect(
        marketplace.write.listNFTForSale([this.mintedTokenId, listingPrice], { account: seller })
      ).to.be.rejectedWith("Not token owner"); 
    });

    it("Should revert if seller tries to purchase their own NFT", async function () {
      await marketplace.write.listNFTForSale([this.mintedTokenId, listingPrice], { account: seller });
      await expect(
        marketplace.write.purchaseNFT([this.mintedTokenId], { value: listingPrice, account: seller })
      ).to.be.rejectedWith("Cannot buy your own NFT");
    });

    it("Should revert if purchasing NFT with insufficient payment", async function () {
      await marketplace.write.listNFTForSale([this.mintedTokenId, listingPrice], { account: seller });
      await expect(
        marketplace.write.purchaseNFT([this.mintedTokenId], { value: parseEther("0.5"), account: buyer })
      ).to.be.rejectedWith("Insufficient payment");
    });

    it("Should revert if non-seller tries to remove NFT from sale", async function () {
      await marketplace.write.listNFTForSale([this.mintedTokenId, listingPrice], { account: seller });
      await expect(
        marketplace.write.removeNFTFromSale([this.mintedTokenId], { account: buyer })
      ).to.be.rejectedWith("Not the seller"); 
    });

    it("Should revert if trying to remove an unlisted NFT", async function () {
      const unlistedTokenId = 9999999n; 
      await expect(
        marketplace.write.removeNFTFromSale([unlistedTokenId], { account: seller })
      ).to.be.rejectedWith("Token not listed for sale");
    });
  });


  // ### Auctions

  describe("Auctions", function () {
    // Dichiara le variabili che verranno assegnate a `this` nel `beforeEach`
    const auctionMinPrice = parseEther("0.1");
    const auctionDuration = 7 * 24 * 60 * 60; // 7 days in seconds
    const mintPrice = parseEther("0.05");
    const testMetadataURI = "ipfs://test/marketplace/auction_nft";

    beforeEach(async function () {
      const fixture = await loadFixture(deployMarketplaceFixture);
      nft = fixture.nft;
      marketplace = fixture.marketplace;
      owner = fixture.owner;
      seller = fixture.seller;
      buyer = fixture.buyer;
      bidder1 = fixture.bidder1;
      bidder2 = fixture.bidder2;
      thirdAccount = fixture.thirdAccount;
      publicClient = fixture.publicClient;
      contentId = fixture.contentId;
      mockVRF = fixture.mockVRF;
      subscriptionId = fixture.subscriptionId;

      this.auctionTokenId = await mintAndHandleVRF(
        nft, mockVRF, publicClient, seller, owner, contentId, mintPrice, testMetadataURI
      );
      // DEBUG:
      // console.log(`DEBUG: In beforeEach (Auctions), auctionTokenId is: ${this.auctionTokenId}`);

      const approveTx = await nft.write.approve([marketplace.address, this.auctionTokenId], { account: seller });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    });

    it("Should allow a user to start an auction", async function () {
      // DEBUG:
      // console.log(`DEBUG: In "start an auction" test, auctionTokenId is: ${this.auctionTokenId}`);
      expect(getAddress(await nft.read.ownerOf([this.auctionTokenId]))).to.equal(getAddress(seller.address));

      const startAuctionTx = await marketplace.write.startAuction(
        [this.auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      const startAuctionReceipt = await publicClient.waitForTransactionReceipt({ hash: startAuctionTx });

      expect(getAddress(await nft.read.ownerOf([this.auctionTokenId]))).to.equal(getAddress(marketplace.address));
      
      const auction = await marketplace.read.auctions([this.auctionTokenId]);
      expect(getAddress(auction.seller)).to.equal(getAddress(seller.address));
      expect(auction.minPrice).to.equal(auctionMinPrice);
      expect(auction.highestBid).to.equal(0n); // Inizialmente 0
      expect(getAddress(auction.highestBidder)).to.equal(getAddress("0x0000000000000000000000000000000000000000")); // Inizialmente address(0)
      expect(auction.isActive).to.be.true;
      expect(await marketplace.read.isTokenInAuction([this.auctionTokenId])).to.be.true;
      expect(Number(auction.startTime)).to.be.closeTo(await time.latest(), 5);
      expect(auction.endTime).to.equal(auction.startTime + BigInt(auctionDuration));

      const events = await marketplace.getEvents.AuctionStarted();
      expect(events.length).to.be.greaterThan(0);
      const auctionEvent = events.find((e: any) => e.transactionHash === startAuctionReceipt.transactionHash);
      expect(auctionEvent).to.not.be.undefined;
      expect(auctionEvent.args.tokenId).to.equal(this.auctionTokenId);
      expect(getAddress(auctionEvent.args.seller)).to.equal(getAddress(seller.address));
      expect(auctionEvent.args.minPrice).to.equal(auctionMinPrice);
    });

    it("Should allow users to place bids and update highest bid", async function () {
      await marketplace.write.startAuction(
        [this.auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );

      const bid1Amount = auctionMinPrice;
      await marketplace.write.placeBid([this.auctionTokenId], { value: bid1Amount, account: bidder1 });

      let auction = await marketplace.read.auctions([this.auctionTokenId]);
      expect(auction.highestBid).to.equal(bid1Amount);
      expect(getAddress(auction.highestBidder)).to.equal(getAddress(bidder1.address));
      expect((await marketplace.read.getBidderInfo([this.auctionTokenId, bidder1.address])).amount).to.equal(bid1Amount);

      const bid2Amount = auctionMinPrice + parseEther("0.1");
      await marketplace.write.placeBid([this.auctionTokenId], { value: bid2Amount, account: bidder2 });

      auction = await marketplace.read.auctions([this.auctionTokenId]);
      expect(auction.highestBid).to.equal(bid2Amount);
      expect(getAddress(auction.highestBidder)).to.equal(getAddress(bidder2.address));
      expect((await marketplace.read.getBidderInfo([this.auctionTokenId, bidder2.address])).amount).to.equal(bid2Amount);

      const bid1Increase = parseEther("0.1");
      const bid1Total = bid2Amount + bid1Increase;
      await marketplace.write.placeBid([this.auctionTokenId], { value: bid1Total, account: bidder1 });

      auction = await marketplace.read.auctions([this.auctionTokenId]);
      expect(auction.highestBid).to.equal(bid1Total);
      expect(getAddress(auction.highestBidder)).to.equal(getAddress(bidder1.address));
      expect((await marketplace.read.getBidderInfo([this.auctionTokenId, bidder1.address])).amount).to.equal(bid1Total);
    });

    it("Should allow winner to claim NFT and seller to receive funds after auction ends", async function () {
      await marketplace.write.startAuction(
        [this.auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      const winningBid = auctionMinPrice + parseEther("0.5");
      await marketplace.write.placeBid([this.auctionTokenId], { value: winningBid, account: bidder1 });

      await time.increase(auctionDuration + 1);

      const initialSellerEthBalance = await publicClient.getBalance({ address: seller.address });
      const initialProtocolFeeReceiverBalance = await publicClient.getBalance({ address: owner.address });

      const endAuctionTxHash = await marketplace.write.endAuction([this.auctionTokenId]);
      const endAuctionReceipt = await publicClient.waitForTransactionReceipt({ hash: endAuctionTxHash });

      expect(getAddress(await nft.read.ownerOf([this.auctionTokenId]))).to.equal(getAddress(bidder1.address));
      
      const auction = await marketplace.read.auctions([this.auctionTokenId]);
      expect(auction.isActive).to.be.false;
      expect(auction.claimed).to.be.true;
      expect(await marketplace.read.isTokenInAuction([this.auctionTokenId])).to.be.false;

      const protocolFeeBps = await marketplace.read.protocolFeeBps();
      const calculatedProtocolFee = (winningBid * protocolFeeBps) / 10000n;
      const sellerAmount = winningBid - calculatedProtocolFee;

      const finalSellerEthBalance = await publicClient.getBalance({ address: seller.address });
      const finalProtocolFeeReceiverBalance = await publicClient.getBalance({ address: owner.address });

      expect(finalSellerEthBalance).to.equal(initialSellerEthBalance + sellerAmount);
      expect(await marketplace.read.accumulatedFees()).to.equal(calculatedProtocolFee);
      expect(finalProtocolFeeReceiverBalance).to.equal(initialProtocolFeeReceiverBalance + calculatedProtocolFee);

      const auctionEndedEvents = await marketplace.getEvents.AuctionEnded();
      const auctionEndedEvent = auctionEndedEvents.find((e: any) => e.transactionHash === endAuctionReceipt.transactionHash);
      expect(auctionEndedEvent).to.not.be.undefined;
      expect(auctionEndedEvent.args.tokenId).to.equal(this.auctionTokenId);
      expect(getAddress(auctionEndedEvent.args.winner)).to.equal(getAddress(bidder1.address));
      expect(auctionEndedEvent.args.winningBid).to.equal(winningBid);

      const nftClaimedEvents = await marketplace.getEvents.NFTClaimed();
      const nftClaimedEvent = nftClaimedEvents.find((e: any) => e.transactionHash === endAuctionReceipt.transactionHash);
      expect(nftClaimedEvent).to.not.be.undefined;
      expect(nftClaimedEvent.args.tokenId).to.equal(this.auctionTokenId);
      expect(getAddress(nftClaimedEvent.args.winner)).to.equal(getAddress(bidder1.address));
    });

    it("Should return NFT to seller if no bids are placed when auction ends", async function () {
      await marketplace.write.startAuction(
        [this.auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );

      await time.increase(auctionDuration + 1);

      const endAuctionTxHash = await marketplace.write.endAuction([this.auctionTokenId]);
      const endAuctionReceipt = await publicClient.waitForTransactionReceipt({ hash: endAuctionTxHash });

      expect(getAddress(await nft.read.ownerOf([this.auctionTokenId]))).to.equal(getAddress(seller.address));
      
      const auction = await marketplace.read.auctions([this.auctionTokenId]);
      expect(auction.isActive).to.be.false;
      expect(auction.claimed).to.be.false; // Non dovrebbe essere reclamato se non ci sono offerte
      expect(await marketplace.read.isTokenInAuction([this.auctionTokenId])).to.be.false;

      const auctionEndedEvents = await marketplace.getEvents.AuctionEnded();
      const auctionEndedEvent = auctionEndedEvents.find((e: any) => e.transactionHash === endAuctionReceipt.transactionHash);
      expect(auctionEndedEvent).to.not.be.undefined;
      expect(auctionEndedEvent.args.tokenId).to.equal(this.auctionTokenId);
      expect(getAddress(auctionEndedEvent.args.winner)).to.equal(getAddress("0x0000000000000000000000000000000000000000"));
      expect(auctionEndedEvent.args.winningBid).to.equal(0n);
    });

    it("Should allow non-winning bidders to claim refunds", async function () {
      await marketplace.write.startAuction(
        [this.auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      const winningBid = auctionMinPrice + parseEther("0.2");
      await marketplace.write.placeBid([this.auctionTokenId], { value: winningBid, account: bidder1 });

      const bidForBidder2 = winningBid + parseEther("0.01"); // Bidder2 fa un'offerta più alta
      await marketplace.write.placeBid([this.auctionTokenId], { value: bidForBidder2, account: bidder2 });

      const finalWinningBid = bidForBidder2 + parseEther("0.05"); // Bidder1 supera Bidder2
      await marketplace.write.placeBid([this.auctionTokenId], { value: finalWinningBid, account: bidder1 });


      await time.increase(auctionDuration + 1);

      // Finalizza l'asta
      await marketplace.write.endAuction([this.auctionTokenId]);

      // Bidder2 ora può richiedere il rimborso
      const initialBidder2EthBalance = await publicClient.getBalance({ address: bidder2.address });
      const claimRefundTxHash = await marketplace.write.claimRefund([this.auctionTokenId], { account: bidder2 });
      const claimRefundReceipt = await publicClient.waitForTransactionReceipt({ hash: claimRefundTxHash });
      const gasUsed = BigInt(claimRefundReceipt.gasUsed);
      const gasPrice = BigInt(claimRefundReceipt.effectiveGasPrice);
      const txCost = gasUsed * gasPrice;

      const finalBidder2EthBalance = await publicClient.getBalance({ address: bidder2.address });

      expect(finalBidder2EthBalance).to.equal(initialBidder2EthBalance + bidForBidder2 - txCost);
      const bidderInfo = await marketplace.read.getBidderInfo([this.auctionTokenId, bidder2.address]);
      expect(bidderInfo.refunded).to.be.true;

      const events = await marketplace.getEvents.RefundProcessed();
      expect(events.length).to.be.greaterThan(0);
      const refundEvent = events.find((e: any) => e.transactionHash === claimRefundReceipt.transactionHash);
      expect(refundEvent).to.not.be.undefined;
      expect(refundEvent.args.tokenId).to.equal(this.auctionTokenId);
      expect(getAddress(refundEvent.args.bidder)).to.equal(getAddress(bidder2.address));
      expect(refundEvent.args.amount).to.equal(bidForBidder2);

      // Questo test verifica che la transazione *reverta* con il messaggio 'Already refunded' se si tenta di richiamare due volte
      await expect(
        marketplace.write.claimRefund([this.auctionTokenId], { account: bidder2 })
      ).to.be.rejectedWith(/Already refunded/); // Usa regex per maggiore robustezza

      // Il vincitore non può richiedere il rimborso
      await expect(
        marketplace.write.claimRefund([this.auctionTokenId], { account: bidder1 })
      ).to.be.rejectedWith("Winner cannot claim refund");
    });


    // --- Auction Revert Conditions ---
    it("Should revert if non-owner tries to start auction", async function () {
      await expect(
        marketplace.write.startAuction(
          [this.auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
          { account: buyer }
        )
      ).to.be.rejectedWith("Not token owner");
    });

    it("Should revert if NFT is already in auction", async function () {
      await marketplace.write.startAuction(
        [this.auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      // Modificato il messaggio di revert atteso
      await expect(
        marketplace.write.startAuction(
          [this.auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
          { account: seller }
        )
      ).to.be.rejectedWith("Not token owner"); 
    });

    it("Should revert if auction duration is too short or too long", async function () {
      const shortDuration = 10; 
      const longDuration = 31 * 24 * 60 * 60; 

      await expect(
        marketplace.write.startAuction(
          [this.auctionTokenId, auctionMinPrice, BigInt(shortDuration)],
          { account: seller }
        )
      ).to.be.rejectedWith("Auction must last at least 1 hour");

      const newAuctionTokenId = await mintAndHandleVRF(
        nft, mockVRF, publicClient, seller, owner, contentId, mintPrice, "ipfs://test/long_duration_nft"
      );
      await nft.write.approve([marketplace.address, newAuctionTokenId], { account: seller });

      await expect(
        marketplace.write.startAuction(
          [newAuctionTokenId, auctionMinPrice, BigInt(longDuration)],
          { account: seller }
        )
      ).to.be.rejectedWith("Auction cannot last more than 30 days");
    });

    it("Should revert if seller tries to bid on own auction", async function () {
      await marketplace.write.startAuction(
        [this.auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      await expect(
        marketplace.write.placeBid([this.auctionTokenId], { value: auctionMinPrice, account: seller })
      ).to.be.rejectedWith("Seller cannot bid on own auction");
    });

    it("Should revert if bid is below minimum price", async function () {
      await marketplace.write.startAuction(
        [this.auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      await expect(
        marketplace.write.placeBid([this.auctionTokenId], { value: auctionMinPrice - 1n, account: bidder1 })
      ).to.be.rejectedWith("Bid below minimum price");
    });

    it("Should revert if bid is not higher than current highest bid", async function () {
      await marketplace.write.startAuction(
        [this.auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      await marketplace.write.placeBid([this.auctionTokenId], { value: auctionMinPrice + parseEther("0.1"), account: bidder1 });

      await expect(
        marketplace.write.placeBid([this.auctionTokenId], { value: auctionMinPrice + parseEther("0.1"), account: bidder2 })
      ).to.be.rejectedWith("Bid must be higher than current highest bid");

      await expect(
        marketplace.write.placeBid([this.auctionTokenId], { value: auctionMinPrice + parseEther("0.05"), account: bidder2 })
      ).to.be.rejectedWith("Bid must be higher than current highest bid");
    });

    it("Should revert if placing bid after auction has expired", async function () {
      await marketplace.write.startAuction(
        [this.auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      await time.increase(auctionDuration + 1);
      await expect(
        marketplace.write.placeBid([this.auctionTokenId], { value: auctionMinPrice, account: bidder1 })
      ).to.be.rejectedWith("Auction has expired");
    });

    it("Should revert if ending auction before it expires", async function () {
      await marketplace.write.startAuction(
        [this.auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      await expect(
        marketplace.write.endAuction([this.auctionTokenId])
      ).to.be.rejectedWith("Auction still active");
    });

    it("Should revert if ending an already claimed auction", async function () {
      await marketplace.write.startAuction(
        [this.auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      await marketplace.write.placeBid([this.auctionTokenId], { value: auctionMinPrice + parseEther("0.1"), account: bidder1 });
      await time.increase(auctionDuration + 1);
      await marketplace.write.endAuction([this.auctionTokenId]);

      await expect(
        marketplace.write.endAuction([this.auctionTokenId])
      ).to.be.rejectedWith("Auction does not exist or not active"); // Modificato per corrispondere al messaggio del modificatore
    });
  });



  // ### Fee Management

  describe("Fee Management", function () {
    const mintPrice = parseEther("0.05");
    const listingPrice = parseEther("1");
    let testTokenId: bigint;

    beforeEach(async function () {
      const fixture = await loadFixture(deployMarketplaceFixture);
      nft = fixture.nft;
      marketplace = fixture.marketplace;
      owner = fixture.owner;
      seller = fixture.seller;
      buyer = fixture.buyer;
      publicClient = fixture.publicClient;
      contentId = fixture.contentId;
      mockVRF = fixture.mockVRF;
      subscriptionId = fixture.subscriptionId;

      testTokenId = await mintAndHandleVRF(
        nft, mockVRF, publicClient, seller, owner, contentId, mintPrice, "ipfs://test/fees/nft"
      );

      await nft.write.approve([marketplace.address, testTokenId], { account: seller });
      await marketplace.write.listNFTForSale([testTokenId, listingPrice], { account: seller });

      await marketplace.write.purchaseNFT([testTokenId], { value: listingPrice, account: buyer });
      
      const accumulatedFees = await marketplace.read.accumulatedFees();
      expect(accumulatedFees > 0n).to.be.true; // Asserzione corretta per BigInt
    });

    it("Should allow owner to withdraw accumulated protocol fees", async function () {
      const initialProtocolFeeReceiverBalance = await publicClient.getBalance({ address: owner.address });
      const accumulatedFees = await marketplace.read.accumulatedFees();
      expect(accumulatedFees > 0n).to.be.true; 

      const withdrawTxHash = await marketplace.write.withdrawProtocolFees({ account: owner });
      const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawTxHash });
      const gasUsed = BigInt(withdrawReceipt.gasUsed);
      const gasPrice = BigInt(withdrawReceipt.effectiveGasPrice);
      const txCost = gasUsed * gasPrice;

      expect(await marketplace.read.accumulatedFees()).to.equal(0n);

      const finalProtocolFeeReceiverBalance = await publicClient.getBalance({ address: owner.address });
      expect(finalProtocolFeeReceiverBalance).to.equal(initialProtocolFeeReceiverBalance + accumulatedFees - txCost);

      const events = await marketplace.getEvents.ProtocolFeesWithdrawn();
      expect(events.length).to.be.greaterThan(0);
      const withdrawEvent = events.find((e: any) => e.transactionHash === withdrawReceipt.transactionHash);
      expect(withdrawEvent).to.not.be.undefined;
      expect(getAddress(withdrawEvent.args.to)).to.equal(getAddress(owner.address));
      expect(withdrawEvent.args.amount).to.equal(accumulatedFees);
    });

    it("Should revert if non-owner tries to withdraw protocol fees", async function () {
      await expect(
        marketplace.write.withdrawProtocolFees({ account: buyer })
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });

    it("Should revert if no fees to withdraw", async function () {
      await marketplace.write.withdrawProtocolFees({ account: owner });
      expect(await marketplace.read.accumulatedFees()).to.equal(0n);

      await expect(
        marketplace.write.withdrawProtocolFees({ account: owner })
      ).to.be.rejectedWith("No fees to withdraw");
    });

    it("Should allow owner to update protocol fee", async function () {
      const oldFee = await marketplace.read.protocolFeeBps();
      const newFee = 500n;

      const setFeeTx = await marketplace.write.setProtocolFee([newFee], { account: owner });
      const setFeeReceipt = await publicClient.waitForTransactionReceipt({ hash: setFeeTx });

      expect(await marketplace.read.protocolFeeBps()).to.equal(newFee);

      const events = await marketplace.getEvents.ProtocolFeeUpdated();
      expect(events.length).to.be.greaterThan(0);
      const feeUpdateEvent = events.find((e: any) => e.transactionHash === setFeeReceipt.transactionHash);
      expect(feeUpdateEvent).to.not.be.undefined;
      expect(feeUpdateEvent.args.oldFeeBps).to.equal(oldFee);
      expect(feeUpdateEvent.args.newFeeBps).to.equal(newFee);
    });

    it("Should revert if non-owner tries to update protocol fee", async function () {
      await expect(
        marketplace.write.setProtocolFee([500n], { account: buyer })
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });

    it("Should revert if new protocol fee exceeds max (10%)", async function () {
      await expect(
        marketplace.write.setProtocolFee([1001n], { account: owner })
      ).to.be.rejectedWith("Fee cannot exceed 10%");
    });

    it("Should allow owner to update protocol fee receiver", async function () {
      const oldReceiver = await marketplace.read.protocolFeeReceiver();
      const newReceiver = thirdAccount.address;

      const setReceiverTx = await marketplace.write.setProtocolFeeReceiver([newReceiver], { account: owner });
      const setReceiverReceipt = await publicClient.waitForTransactionReceipt({ hash: setReceiverTx });

      expect(getAddress(await marketplace.read.protocolFeeReceiver())).to.equal(getAddress(newReceiver));

      const events = await marketplace.getEvents.ProtocolFeeReceiverUpdated();
      expect(events.length).to.be.greaterThan(0);
      const receiverUpdateEvent = events.find((e: any) => e.transactionHash === setReceiverReceipt.transactionHash);
      expect(receiverUpdateEvent).to.not.be.undefined;
      expect(getAddress(receiverUpdateEvent.args.oldReceiver)).to.equal(getAddress(oldReceiver));
      expect(getAddress(receiverUpdateEvent.args.newReceiver)).to.equal(getAddress(newReceiver));
    });

    it("Should revert if non-owner tries to update protocol fee receiver", async function () {
      await expect(
        marketplace.write.setProtocolFeeReceiver([thirdAccount.address], { account: buyer })
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });

    it("Should revert if new protocol fee receiver is zero address", async function () {
      await expect(
        marketplace.write.setProtocolFeeReceiver([getAddress("0x0000000000000000000000000000000000000000")], { account: owner })
      ).to.be.rejectedWith("Invalid receiver address");
    });
  });
});