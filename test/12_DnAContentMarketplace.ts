import { expect } from "chai";
import hre from "hardhat";
import {
  parseEther,
  getAddress,
  type Address,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

// Estendi l'interfaccia Mocha per aggiungere tipi a `this` nel contesto dei test
declare module "mocha" {
  export interface Context {
    mintedTokenId: bigint;
    auctionTokenId: bigint;
  }
}

describe("DnAContentMarketplace Tests", function () {
  // Variabili globali per il test
  const contentIpfsHash = "ipfs://QmbTMarketplaceTestHash";
  const contentNftMintPrice = parseEther("0.05");

  // Funzione di setup comune per tutti i test.
  async function deployMarketplaceFixture() {
    const [
      ownerWallet,
      sellerWallet,
      buyerWallet,
      bidder1Wallet,
      bidder2Wallet,
      thirdAccountWallet,
    ] = await hre.viem.getWalletClients();
    const owner = ownerWallet.account;
    const seller = sellerWallet.account;
    const buyer = buyerWallet.account;
    const bidder1 = bidder1Wallet.account;
    const bidder2 = bidder2Wallet.account;
    const thirdAccount = thirdAccountWallet.account;

    const publicClient = await hre.viem.getPublicClient();

    const deployment = await deployMockVRFAndContracts();
    const { vrfMock, registry, nft, subscriptionId } = deployment;

    const marketplace = await hre.viem.deployContract("DnAContentMarketplace", [
      nft.address as Address,
    ]);

    // Registra il contenuto per ottenere un ID valido
    const registerTx = await registry.write.registerContent(
      [
        "Marketplace Test Content",
        "Description for marketplace test",
        1n,
        contentIpfsHash,
        contentNftMintPrice,
      ],
      { account: owner }
    );
    const registerReceipt = await publicClient.waitForTransactionReceipt({
      hash: registerTx,
    });

    // Correzione: Cerca l'evento nel blocco corretto per evitare race condition
    const contentRegisteredEvents = await registry.getEvents.ContentRegistered(
      {},
      {
        fromBlock: registerReceipt.blockNumber,
        toBlock: registerReceipt.blockNumber,
      }
    );
    expect(contentRegisteredEvents.length).to.be.greaterThan(
      0,
      "ContentRegistered event not found in setup"
    );
    const initialContentId = contentRegisteredEvents[0].args.contentId!;

    return {
      mockVRF: vrfMock,
      registry,
      nft,
      marketplace,
      owner,
      seller,
      buyer,
      bidder1,
      bidder2,
      thirdAccount,
      publicClient,
      subscriptionId,
      contentId: initialContentId,
    };
  }

  // Funzione helper per il minting e la gestione VRF
  async function mintAndHandleVRF(
    _nft: any,
    _mockVRF: any,
    _publicClient: PublicClient,
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
    const mintReceipt = await _publicClient.waitForTransactionReceipt({
      hash: mintTxHash,
    });
    expect(mintReceipt.status).to.equal("success");

    const randomWordsRequestedEvents =
      await _mockVRF.getEvents.RandomWordsRequested(
        {},
        { fromBlock: mintReceipt.blockNumber }
      );
    expect(randomWordsRequestedEvents.length).to.be.greaterThan(
      0,
      "No RandomWordsRequested event found."
    );
    const requestId = randomWordsRequestedEvents[0].args.requestId;
    expect(requestId).to.not.be.undefined;

    const fulfillTxHash = await _mockVRF.write.fulfillRandomWords(
      [requestId!],
      { account: _owner }
    );
    const fulfillReceipt = await _publicClient.waitForTransactionReceipt({
      hash: fulfillTxHash,
    });
    expect(fulfillReceipt.status).to.equal("success");

    const transferEvents = await _nft.getEvents.Transfer(
      {
        from: getAddress("0x0000000000000000000000000000000000000000"),
        to: _seller.address,
      },
      {
        fromBlock: fulfillReceipt.blockNumber,
        toBlock: fulfillReceipt.blockNumber,
      }
    );
    expect(transferEvents.length).to.be.greaterThan(
      0,
      "No Transfer event found for minting after VRF fulfill."
    );

    const tokenId = transferEvents[0].args.tokenId;
    expect(tokenId).to.not.be.undefined;
    expect(tokenId! > 0n).to.be.true;

    return tokenId!;
  }

  describe("Initial Setup", function () {
    // La tua struttura originale: loadFixture in ogni test `it`
    it("Should set the NFT contract address correctly", async function () {
      const { nft, marketplace } = await loadFixture(deployMarketplaceFixture);
      expect(getAddress(await marketplace.read.nftContract())).to.equal(
        getAddress(nft.address)
      );
    });

    it("Should set the admin correctly", async function () {
      const { owner, marketplace } = await loadFixture(
        deployMarketplaceFixture
      );
      const adminRole = await marketplace.read.ADMIN_ROLE();
      expect(await marketplace.read.hasRole([adminRole, owner.address])).to.be.true;
    });

    it("Should set the default protocol fee receiver to owner", async function () {
      const { owner, marketplace } = await loadFixture(
        deployMarketplaceFixture
      );
      expect(getAddress(await marketplace.read.protocolFeeReceiver())).to.equal(
        getAddress(owner.address)
      );
    });

    it("Should set the default protocol fee to 2.5%", async function () {
      const { marketplace } = await loadFixture(deployMarketplaceFixture);
      expect(await marketplace.read.protocolFeeBps()).to.equal(250n);
    });
  });

  describe("Fixed Price Sales", function () {
    const mintPrice = parseEther("0.05");
    const listingPrice = parseEther("1");
    const testMetadataURI = "ipfs://test/marketplace/fixed_price_nft";
    // Manteniamo la tua struttura originale con variabili dichiarate qui
    let nft: any,
      marketplace: any,
      owner: any,
      seller: any,
      buyer: any,
      publicClient: any;
    let contentId: bigint, mockVRF: any;
    let mintedTokenId: bigint;

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

      mintedTokenId = await mintAndHandleVRF(
        nft,
        mockVRF,
        publicClient,
        seller,
        owner,
        contentId,
        mintPrice,
        testMetadataURI
      );

      const approveTx = await nft.write.approve(
        [marketplace.address, mintedTokenId],
        { account: seller }
      );
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    });

    it("Should allow a user to list an NFT for sale", async function () {
      await marketplace.write.listNFTForSale([mintedTokenId, listingPrice], {
        account: seller,
      });

      const listing = await marketplace.read.getFixedPriceListing([
        mintedTokenId,
      ]);
      // CORREZIONE CHIAVE: Accesso nominativo
      expect(getAddress(listing.seller)).to.equal(getAddress(seller.address));
      expect(listing.price).to.equal(listingPrice);
      expect(listing.isActive).to.be.true;
    });

    it("Should allow a user to purchase an NFT", async function () {
      await marketplace.write.listNFTForSale([mintedTokenId, listingPrice], {
        account: seller,
      });

      const initialSellerBalance = await publicClient.getBalance({
        address: seller.address,
      });

      await marketplace.write.purchaseNFT([mintedTokenId], {
        value: listingPrice,
        account: buyer,
      });

      const listing = await marketplace.read.getFixedPriceListing([
        mintedTokenId,
      ]);
      expect(listing.isActive).to.be.false;

      const fee =
        (listingPrice * (await marketplace.read.protocolFeeBps())) / 10000n;
      const finalSellerBalance = await publicClient.getBalance({
        address: seller.address,
      });
      expect(finalSellerBalance).to.equal(
        initialSellerBalance + (listingPrice - fee)
      );
    });

    it("Should refund excess payment during purchase", async function () {
      await marketplace.write.listNFTForSale([mintedTokenId, listingPrice], {
        account: seller,
      });

      const excess = parseEther("0.5");
      const initialBuyerBalance = await publicClient.getBalance({
        address: buyer.address,
      });

      const receipt = await marketplace.write
        .purchaseNFT([mintedTokenId], {
          value: listingPrice + excess,
          account: buyer,
        })
        .then((hash) => publicClient.waitForTransactionReceipt({ hash }));

      const txCost = receipt.gasUsed * receipt.effectiveGasPrice;
      const finalBuyerBalance = await publicClient.getBalance({
        address: buyer.address,
      });

      expect(initialBuyerBalance - finalBuyerBalance).to.equal(
        listingPrice + txCost
      );
    });

    it("Should allow seller to remove an NFT from sale", async function () {
      await marketplace.write.listNFTForSale([mintedTokenId, listingPrice], {
        account: seller,
      });
      await marketplace.write.removeNFTFromSale([mintedTokenId], {
        account: seller,
      });

      const listing = await marketplace.read.getFixedPriceListing([
        mintedTokenId,
      ]);
      expect(listing.isActive).to.be.false;
      expect(getAddress(await nft.read.ownerOf([mintedTokenId]))).to.equal(
        getAddress(seller.address)
      );
    });

    it("Should revert if non-owner tries to list NFT", async function () {
      await expect(
        marketplace.write.listNFTForSale([mintedTokenId, listingPrice], {
          account: buyer,
        })
      ).to.be.rejectedWith("Not token owner");
    });

    it("Should revert if NFT is already listed for sale", async function () {
      await marketplace.write.listNFTForSale([mintedTokenId, listingPrice], {
        account: seller,
      });
      await expect(
        marketplace.write.listNFTForSale([mintedTokenId, listingPrice], {
          account: seller,
        })
      ).to.be.rejectedWith("Not token owner"); // Corretto: il marketplace ora è l'owner
    });

    it("Should revert if seller tries to purchase their own NFT", async function () {
      await marketplace.write.listNFTForSale([mintedTokenId, listingPrice], {
        account: seller,
      });
      await expect(
        marketplace.write.purchaseNFT([mintedTokenId], {
          value: listingPrice,
          account: seller,
        })
      ).to.be.rejectedWith("Cannot buy your own NFT");
    });

    it("Should revert if purchasing NFT with insufficient payment", async function () {
      await marketplace.write.listNFTForSale([mintedTokenId, listingPrice], {
        account: seller,
      });
      await expect(
        marketplace.write.purchaseNFT([mintedTokenId], {
          value: listingPrice - 1n,
          account: buyer,
        })
      ).to.be.rejectedWith("Insufficient payment");
    });

    it("Should revert if non-seller tries to remove NFT from sale", async function () {
      await marketplace.write.listNFTForSale([mintedTokenId, listingPrice], {
        account: seller,
      });
      await expect(
        marketplace.write.removeNFTFromSale([mintedTokenId], { account: buyer })
      ).to.be.rejectedWith("Not the seller");
    });

    it("Should revert if trying to remove an unlisted NFT", async function () {
      // Questo token non è stato listato.
      await expect(
        marketplace.write.removeNFTFromSale([99999n], { account: seller })
      ).to.be.rejectedWith("Token not listed for sale");
    });
  });

  describe("Auctions", function () {
    const auctionMinPrice = parseEther("0.1");
    const auctionDuration = 7 * 24 * 60 * 60; // 7 days
    const mintPrice = parseEther("0.05");
    const testMetadataURI = "ipfs://test/marketplace/auction_nft";
    let nft: any,
      marketplace: any,
      owner: any,
      seller: any,
      buyer: any,
      bidder1: any,
      bidder2: any;
    let thirdAccount: any, publicClient: any, contentId: bigint, mockVRF: any;
    let auctionTokenId: bigint;

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

      auctionTokenId = await mintAndHandleVRF(
        nft,
        mockVRF,
        publicClient,
        seller,
        owner,
        contentId,
        mintPrice,
        testMetadataURI
      );

      await nft.write.approve([marketplace.address, auctionTokenId], {
        account: seller,
      });
    });

    it("Should allow a user to start an auction", async function () {
      await marketplace.write.startAuction(
        [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      const auction = await marketplace.read.getAuction([auctionTokenId]);

      // CORREZIONE CHIAVE: Accesso nominativo
      expect(getAddress(auction.seller)).to.equal(getAddress(seller.address));
      expect(auction.minPrice).to.equal(auctionMinPrice);
      expect(auction.isActive).to.be.true;
    });

    it("Should allow users to place bids and update highest bid", async function () {
      await marketplace.write.startAuction(
        [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );

      await marketplace.write.placeBid([auctionTokenId], {
        value: auctionMinPrice,
        account: bidder1,
      });
      let auction = await marketplace.read.getAuction([auctionTokenId]);
      expect(auction.highestBid).to.equal(auctionMinPrice);
      expect(getAddress(auction.highestBidder)).to.equal(
        getAddress(bidder1.address)
      );

      const higherBid = auctionMinPrice + parseEther("0.1");
      await marketplace.write.placeBid([auctionTokenId], {
        value: higherBid,
        account: bidder2,
      });
      auction = await marketplace.read.getAuction([auctionTokenId]);
      expect(auction.highestBid).to.equal(higherBid);
      expect(getAddress(auction.highestBidder)).to.equal(
        getAddress(bidder2.address)
      );
    });

    it("Should allow winner to claim NFT and seller to receive funds after auction ends", async function () {
      await marketplace.write.startAuction(
        [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      const winningBid = auctionMinPrice + parseEther("0.5");
      await marketplace.write.placeBid([auctionTokenId], {
        value: winningBid,
        account: bidder1,
      });

      await time.increase(auctionDuration + 1);

      const initialSellerBalance = await publicClient.getBalance({
        address: seller.address,
      });
      await marketplace.write.endAuction([auctionTokenId]);

      const auction = await marketplace.read.getAuction([auctionTokenId]);
      expect(auction.isActive).to.be.false;
      expect(auction.claimed).to.be.true;

      const fee =
        (winningBid * (await marketplace.read.protocolFeeBps())) / 10000n;
      const finalSellerBalance = await publicClient.getBalance({
        address: seller.address,
      });
      expect(finalSellerBalance).to.equal(
        initialSellerBalance + winningBid - fee
      );
    });

    it("Should return NFT to seller if no bids are placed when auction ends", async function () {
      await marketplace.write.startAuction(
        [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      await time.increase(auctionDuration + 1);

      // Chiunque può chiamare endAuction
      await marketplace.write.endAuction([auctionTokenId], {
        account: thirdAccount,
      });

      const auction = await marketplace.read.getAuction([auctionTokenId]);
      expect(auction.isActive).to.be.false;

      // La funzione _finalizeAuction imposta 'claimed' a true per indicare che
      // l'asta è stata processata. 
      expect(auction.claimed).to.be.true;

      // La verifica principale è che l'NFT sia tornato al venditore
      expect(getAddress(await nft.read.ownerOf([auctionTokenId]))).to.equal(
        getAddress(seller.address)
      );
    });

    it("Should allow non-winning bidders to claim refunds", async function () {
      await marketplace.write.startAuction(
        [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      const bid2Amount = auctionMinPrice + parseEther("0.1");
      await marketplace.write.placeBid([auctionTokenId], {
        value: bid2Amount,
        account: bidder2,
      });
      await marketplace.write.placeBid([auctionTokenId], {
        value: bid2Amount + 1n,
        account: bidder1,
      });

      await time.increase(auctionDuration + 1);
      await marketplace.write.endAuction([auctionTokenId]);

      const initialBidder2Balance = await publicClient.getBalance({
        address: bidder2.address,
      });
      const receipt = await marketplace.write
        .claimRefund([auctionTokenId], { account: bidder2 })
        .then((hash) => publicClient.waitForTransactionReceipt({ hash }));

      const txCost = receipt.gasUsed * receipt.effectiveGasPrice;
      const finalBidder2Balance = await publicClient.getBalance({
        address: bidder2.address,
      });

      expect(finalBidder2Balance).to.equal(
        initialBidder2Balance + bid2Amount - txCost
      );
      const bidderInfo = await marketplace.read.getBidderInfo([
        auctionTokenId,
        bidder2.address,
      ]);
      expect(bidderInfo.refunded).to.be.true;
    });

    it("Should revert if non-owner tries to start auction", async function () {
      await expect(
        marketplace.write.startAuction(
          [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
          { account: buyer }
        )
      ).to.be.rejectedWith("Not token owner");
    });

    it("Should revert if auction duration is too short or too long", async function () {
      const fifteenMinutesInSeconds = 15 * 60;

      // Testa una durata troppo breve (14 minuti e 59 secondi)
      await expect(
        marketplace.write.startAuction(
          [
            auctionTokenId,
            auctionMinPrice,
            BigInt(fifteenMinutesInSeconds - 1),
          ],
          { account: seller }
        )
      ).to.be.rejectedWith("Auction must last at least 15 minutes");

      // Testa una durata troppo lunga (30 giorni + 1 secondo)
      await expect(
        marketplace.write.startAuction(
          [auctionTokenId, auctionMinPrice, BigInt(30 * 24 * 60 * 60 + 1)],
          { account: seller }
        )
      ).to.be.rejectedWith("Auction cannot last more than 30 days");
    });

    it("Should revert if seller tries to bid on own auction", async function () {
      await marketplace.write.startAuction(
        [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      await expect(
        marketplace.write.placeBid([auctionTokenId], {
          value: auctionMinPrice,
          account: seller,
        })
      ).to.be.rejectedWith("Seller cannot bid on own auction");
    });

    it("Should revert if bid is below minimum price", async function () {
      await marketplace.write.startAuction(
        [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      await expect(
        marketplace.write.placeBid([auctionTokenId], {
          value: auctionMinPrice - 1n,
          account: bidder1,
        })
      ).to.be.rejectedWith("Bid below minimum price");
    });

    it("Should revert if bid is not higher than current highest bid", async function () {
      await marketplace.write.startAuction(
        [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      await marketplace.write.placeBid([auctionTokenId], {
        value: auctionMinPrice,
        account: bidder1,
      });
      await expect(
        marketplace.write.placeBid([auctionTokenId], {
          value: auctionMinPrice,
          account: bidder2,
        })
      ).to.be.rejectedWith("Bid must be higher than current highest bid");
    });

    it("Should revert if placing bid after auction has expired", async function () {
      await marketplace.write.startAuction(
        [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      await time.increase(auctionDuration + 1);
      await expect(
        marketplace.write.placeBid([auctionTokenId], {
          value: auctionMinPrice,
          account: bidder1,
        })
      ).to.be.rejectedWith("Auction has expired");
    });

    it("Should revert if ending auction before it expires", async function () {
      await marketplace.write.startAuction(
        [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      await expect(
        marketplace.write.endAuction([auctionTokenId])
      ).to.be.rejectedWith("Auction still active");
    });

    it("Should revert if ending an already claimed auction", async function () {
      await marketplace.write.startAuction(
        [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
        { account: seller }
      );
      await marketplace.write.placeBid([auctionTokenId], {
        value: auctionMinPrice,
        account: bidder1,
      });
      await time.increase(auctionDuration + 1);
      await marketplace.write.endAuction([auctionTokenId]);

      await expect(
        marketplace.write.endAuction([auctionTokenId])
      ).to.be.rejectedWith("Auction does not exist or not active");
    });
  });

  describe("Fee Management", function () {
    const mintPrice = parseEther("0.05");
    const listingPrice = parseEther("1");
    let testTokenId: bigint;
    let nft: any,
      marketplace: any,
      owner: any,
      seller: any,
      buyer: any,
      thirdAccount: any,
      publicClient: any;

    beforeEach(async function () {
      const fixture = await loadFixture(deployMarketplaceFixture);
      nft = fixture.nft;
      marketplace = fixture.marketplace;
      owner = fixture.owner;
      seller = fixture.seller;
      buyer = fixture.buyer;
      thirdAccount = fixture.thirdAccount;
      publicClient = fixture.publicClient;
      const contentId = fixture.contentId;
      const mockVRF = fixture.mockVRF;

      testTokenId = await mintAndHandleVRF(
        nft,
        mockVRF,
        publicClient,
        seller,
        owner,
        contentId,
        mintPrice,
        "ipfs://fees"
      );

      await nft.write.approve([marketplace.address, testTokenId], {
        account: seller,
      });
      await marketplace.write.listNFTForSale([testTokenId, listingPrice], {
        account: seller,
      });
      await marketplace.write.purchaseNFT([testTokenId], {
        value: listingPrice,
        account: buyer,
      });
    });

    it("Should allow owner to withdraw accumulated protocol fees", async function () {
      const fees = await marketplace.read.accumulatedFees();

      expect(fees > 0n).to.be.true;

      const initialBalance = await publicClient.getBalance({
        address: owner.address,
      });

      const receipt = await marketplace.write
        .withdrawProtocolFees({ account: owner })
        .then((hash: `0x${string}`) =>
          publicClient.waitForTransactionReceipt({ hash })
        );

      const txCost = receipt.gasUsed * receipt.effectiveGasPrice;
      const finalBalance = await publicClient.getBalance({
        address: owner.address,
      });

      expect(finalBalance).to.equal(initialBalance + fees - txCost);

      expect(await marketplace.read.accumulatedFees()).to.equal(0n);
    });

    it("Should revert if non-owner tries to withdraw protocol fees", async function () {
      await expect(
        marketplace.write.withdrawProtocolFees({ account: buyer })
      ).to.be.rejectedWith(/AccessControl: account .* is missing role .*/);
    });

    it("Should revert if no fees to withdraw", async function () {
      await marketplace.write.withdrawProtocolFees({ account: owner }); // First withdrawal
      await expect(
        marketplace.write.withdrawProtocolFees({ account: owner })
      ).to.be.rejectedWith("No fees to withdraw");
    });

    it("Should allow owner to update protocol fee", async function () {
      const newFee = 500n; // 5%
      await marketplace.write.setProtocolFee([newFee], { account: owner });
      expect(await marketplace.read.protocolFeeBps()).to.equal(newFee);
    });

    it("Should revert if non-owner tries to update protocol fee", async function () {
      await expect(
        marketplace.write.setProtocolFee([500n], { account: buyer })
      ).to.be.rejectedWith(/AccessControl: account .* is missing role .*/);
    });

    it("Should revert if new protocol fee exceeds max (10%)", async function () {
      await expect(
        marketplace.write.setProtocolFee([1001n], { account: owner })
      ).to.be.rejectedWith("Fee cannot exceed 10%");
    });

    it("Should allow owner to update protocol fee receiver", async function () {
      const newReceiver = thirdAccount.address;
      await marketplace.write.setProtocolFeeReceiver([newReceiver], {
        account: owner,
      });
      expect(getAddress(await marketplace.read.protocolFeeReceiver())).to.equal(
        getAddress(newReceiver)
      );
    });

    it("Should revert if non-owner tries to update protocol fee receiver", async function () {
      await expect(
        marketplace.write.setProtocolFeeReceiver([thirdAccount.address], {
          account: buyer,
        })
      ).to.be.rejectedWith(/AccessControl: account .* is missing role .*/);
    });

    it("Should revert if new protocol fee receiver is zero address", async function () {
      await expect(
        marketplace.write.setProtocolFeeReceiver(
          [getAddress("0x0000000000000000000000000000000000000000")],
          { account: owner }
        )
      ).to.be.rejectedWith("Invalid receiver address");
    });
  });
});

