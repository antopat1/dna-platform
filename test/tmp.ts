// import { expect } from "chai";
// import hre from "hardhat";
// import { parseEther, getAddress } from "viem";
// import { time } from "@nomicfoundation/hardhat-network-helpers";
// import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
// import { deployMockVRFAndContracts } from "../scripts/deployWithMock";

// declare module "mocha" {
//   export interface Context {
//     mintedTokenId: bigint;
//     auctionTokenId: bigint;
//   }
// }

// describe("DnAContentMarketplace Tests", function () {
//   const contentIpfsHash = "ipfs://QmbTMarketplaceTestHash";
//   const contentNftMintPrice = parseEther("0.05");

//   async function deployMarketplaceFixture() {
//     const [ownerWallet, sellerWallet, buyerWallet, bidder1Wallet, bidder2Wallet, thirdAccountWallet] = await hre.viem.getWalletClients();
//     const owner = ownerWallet.account;
//     const seller = sellerWallet.account;
//     const buyer = buyerWallet.account;
//     const bidder1 = bidder1Wallet.account;
//     const bidder2 = bidder2Wallet.account;
//     const thirdAccount = thirdAccountWallet.account;

//     const publicClient = await hre.viem.getPublicClient();

//     const deployment = await deployMockVRFAndContracts();
//     const mockVRF = deployment.vrfMock;
//     const registry = deployment.registry;
//     const nft = deployment.nft;
//     const subscriptionId = deployment.subscriptionId;

//     const marketplaceContract = await hre.viem.deployContract("DnAContentMarketplace", [nft.address]);
//     const marketplace = marketplaceContract;

//     const registerTx = await registry.write.registerContent(
//       ["Marketplace Test Content", "Description for marketplace test", 100n, contentIpfsHash, contentNftMintPrice],
//       { account: owner }
//     );
//     await publicClient.waitForTransactionReceipt({ hash: registerTx });

//     const contentRegisteredEvents = await registry.getEvents.ContentRegistered();
//     expect(contentRegisteredEvents.length).to.be.greaterThan(0, "No ContentRegistered event found during setup");
//     const firstContentRegisteredEvent = contentRegisteredEvents[0];
//     const initialContentId = firstContentRegisteredEvent.args.contentId;

//     return {
//       mockVRF,
//       registry,
//       nft,
//       marketplace,
//       owner,
//       seller,
//       buyer,
//       bidder1,
//       bidder2,
//       thirdAccount,
//       publicClient,
//       subscriptionId,
//       contentId: initialContentId
//     };
//   }

//   async function mintAndHandleVRF(
//     _nft: any,
//     _mockVRF: any,
//     _publicClient: any,
//     _seller: any,
//     _owner: any,
//     _contentId: bigint,
//     _mintPrice: bigint,
//     _metadataURI: string
//   ): Promise<bigint> {
//     const mintTxHash = await _nft.write.mintNFT([_contentId, _metadataURI], {
//       value: _mintPrice,
//       account: _seller,
//     });
//     const mintReceipt = await _publicClient.waitForTransactionReceipt({ hash: mintTxHash });

//     const randomWordsRequestedEvents = await _publicClient.getContractEvents({
//       abi: _mockVRF.abi,
//       address: _mockVRF.address,
//       eventName: 'RandomWordsRequested',
//       fromBlock: mintReceipt.blockNumber,
//       toBlock: "latest",
//     });

//     expect(randomWordsRequestedEvents.length).to.be.greaterThan(0, "No RandomWordsRequested event found.");
//     const requestId = randomWordsRequestedEvents[0].args.requestId;

//     await hre.network.provider.request({
//       method: "hardhat_impersonateAccount",
//       params: [_mockVRF.address],
//     });

//     const coordinatorAccount = getAddress(_mockVRF.address);
//     const randomWords = [123456789n];

//     const rawFulfillTxHash = await _nft.write.rawFulfillRandomWords([requestId, randomWords], { account: coordinatorAccount });
//     await _publicClient.waitForTransactionReceipt({ hash: rawFulfillTxHash });

//     await hre.network.provider.request({
//       method: "hardhat_stopImpersonatingAccount",
//       params: [_mockVRF.address],
//     });

//     const transferEvents = await _publicClient.getContractEvents({
//       abi: _nft.abi,
//       address: _nft.address,
//       eventName: 'Transfer',
//       fromBlock: mintReceipt.blockNumber,
//       toBlock: "latest",
//       args: {
//         from: getAddress('0x0000000000000000000000000000000000000000'),
//         to: getAddress(_seller.address)
//       }
//     });

//     expect(transferEvents.length).to.be.greaterThan(0, "No Transfer event found for minting after VRF fulfill.");
//     const tokenId = transferEvents[transferEvents.length - 1].args.tokenId;
//     expect(tokenId).to.not.be.undefined;
//     expect(Number(tokenId)).to.be.greaterThan(0, "Minted token ID should be greater than 0");

//     return tokenId;
//   }

//   describe("Fixed Price Sales", function () {
//     const mintPrice = parseEther("0.05");
//     const listingPrice = parseEther("1");
//     const testMetadataURI = "ipfs://test/marketplace/fixed_price_nft";

//     it("Should allow a user to list an NFT for sale", async function () {
//       const fixture = await loadFixture(deployMarketplaceFixture);
//       const { nft, marketplace, seller, publicClient, contentId, mockVRF, owner } = fixture;

//       const mintedTokenId = await mintAndHandleVRF(
//         nft, mockVRF, publicClient, seller, owner, contentId, mintPrice, testMetadataURI
//       );

//       const approveTx = await nft.write.approve([marketplace.address, mintedTokenId], { account: seller });
//       await publicClient.waitForTransactionReceipt({ hash: approveTx });

//       expect(getAddress(await nft.read.ownerOf([mintedTokenId]))).to.equal(getAddress(seller.address));

//       const listTx = await marketplace.write.listNFTForSale([mintedTokenId, listingPrice], { account: seller });
//       const listReceipt = await publicClient.waitForTransactionReceipt({ hash: listTx });

//       expect(getAddress(await nft.read.ownerOf([mintedTokenId]))).to.equal(getAddress(marketplace.address));

//       const listing = await marketplace.read.fixedPriceListings([mintedTokenId]);
//       expect(getAddress(listing.seller)).to.equal(getAddress(seller.address));
//       expect(listing.price).to.equal(listingPrice);
//       expect(listing.isActive).to.be.true;
//       expect(await marketplace.read.isTokenListedForSale([mintedTokenId])).to.be.true;

//       const events = await publicClient.getContractEvents({
//         abi: marketplace.abi,
//         address: marketplace.address,
//         eventName: 'NFTListedForSale',
//         fromBlock: listReceipt.blockNumber,
//         toBlock: listReceipt.blockNumber,
//       });

//       expect(events.length).to.be.greaterThan(0);
//       const listEvent = events[0];
//       expect(listEvent.args.tokenId).to.equal(mintedTokenId);
//       expect(getAddress(listEvent.args.seller)).to.equal(getAddress(seller.address));
//       expect(listEvent.args.price).to.equal(listingPrice);
//     });

//     it("Should allow a user to purchase an NFT", async function () {
//       const fixture = await loadFixture(deployMarketplaceFixture);
//       const { nft, marketplace, seller, buyer, publicClient, contentId, mockVRF, owner } = fixture;

//       const mintedTokenId = await mintAndHandleVRF(
//         nft, mockVRF, publicClient, seller, owner, contentId, mintPrice, testMetadataURI
//       );

//       const approveTx = await nft.write.approve([marketplace.address, mintedTokenId], { account: seller });
//       await publicClient.waitForTransactionReceipt({ hash: approveTx });

//       await marketplace.write.listNFTForSale([mintedTokenId, listingPrice], { account: seller });
//       const isListed = await marketplace.read.isTokenListedForSale([mintedTokenId]);
//       expect(isListed).to.be.true;

//       const initialSellerEthBalance = await publicClient.getBalance({ address: seller.address });
//       const initialBuyerEthBalance = await publicClient.getBalance({ address: buyer.address });

//       const purchaseTxHash = await marketplace.write.purchaseNFT([mintedTokenId], {
//         value: listingPrice,
//         account: buyer,
//       });
//       const purchaseReceipt = await publicClient.waitForTransactionReceipt({ hash: purchaseTxHash });

//       const gasUsed = BigInt(purchaseReceipt.gasUsed);
//       const gasPrice = BigInt(purchaseReceipt.effectiveGasPrice);
//       const txCost = gasUsed * gasPrice;

//       expect(getAddress(await nft.read.ownerOf([mintedTokenId]))).to.equal(getAddress(buyer.address));

//       const listing = await marketplace.read.fixedPriceListings([mintedTokenId]);
//       expect(listing.isActive).to.be.false;
//       expect(await marketplace.read.isTokenListedForSale([mintedTokenId])).to.be.false;

//       const protocolFeeBps = await marketplace.read.protocolFeeBps();
//       const calculatedProtocolFee = (listingPrice * protocolFeeBps) / 10000n;
//       const sellerAmount = listingPrice - calculatedProtocolFee;

//       const finalSellerEthBalance = await publicClient.getBalance({ address: seller.address });
//       const finalBuyerEthBalance = await publicClient.getBalance({ address: buyer.address });

//       expect(finalSellerEthBalance).to.equal(initialSellerEthBalance + sellerAmount);
//       expect(finalBuyerEthBalance).to.equal(initialBuyerEthBalance - listingPrice - txCost);
//       expect(await marketplace.read.accumulatedFees()).to.equal(calculatedProtocolFee);

//       const events = await publicClient.getContractEvents({
//         abi: marketplace.abi,
//         address: marketplace.address,
//         eventName: 'NFTPurchased',
//         fromBlock: purchaseReceipt.blockNumber,
//         toBlock: purchaseReceipt.blockNumber,
//       });

//       expect(events.length).to.be.greaterThan(0);
//       const purchaseEvent = events[0];
//       expect(purchaseEvent.args.tokenId).to.equal(mintedTokenId);
//       expect(getAddress(purchaseEvent.args.seller)).to.equal(getAddress(seller.address));
//       expect(getAddress(purchaseEvent.args.buyer)).to.equal(getAddress(buyer.address));
//       expect(purchaseEvent.args.price).to.equal(listingPrice);
//       expect(purchaseEvent.args.protocolFee).to.equal(calculatedProtocolFee);
//     });

//     it("Should allow seller to remove an NFT from sale", async function () {
//       const fixture = await loadFixture(deployMarketplaceFixture);
//       const { nft, marketplace, seller, publicClient, contentId, mockVRF, owner } = fixture;

//       const mintedTokenId = await mintAndHandleVRF(
//         nft, mockVRF, publicClient, seller, owner, contentId, mintPrice, testMetadataURI
//       );

//       const approveTx = await nft.write.approve([marketplace.address, mintedTokenId], { account: seller });
//       await publicClient.waitForTransactionReceipt({ hash: approveTx });

//       await marketplace.write.listNFTForSale([mintedTokenId, listingPrice], { account: seller });
//       expect(getAddress(await nft.read.ownerOf([mintedTokenId]))).to.equal(getAddress(marketplace.address));
//       const isListed = await marketplace.read.isTokenListedForSale([mintedTokenId]);
//       expect(isListed).to.be.true;

//       const removeTx = await marketplace.write.removeNFTFromSale([mintedTokenId], { account: seller });
//       const removeReceipt = await publicClient.waitForTransactionReceipt({ hash: removeTx });

//       expect(getAddress(await nft.read.ownerOf([mintedTokenId]))).to.equal(getAddress(seller.address));

//       const listing = await marketplace.read.fixedPriceListings([mintedTokenId]);
//       expect(listing.isActive).to.be.false;
//       expect(await marketplace.read.isTokenListedForSale([mintedTokenId])).to.be.false;

//       const events = await publicClient.getContractEvents({
//         abi: marketplace.abi,
//         address: marketplace.address,
//         eventName: 'NFTSaleRemoved',
//         fromBlock: removeReceipt.blockNumber,
//         toBlock: removeReceipt.blockNumber,
//       });

//       expect(events.length).to.be.greaterThan(0);
//       const removeEvent = events[0];
//       expect(removeEvent.args.tokenId).to.equal(mintedTokenId);
//       expect(getAddress(removeEvent.args.seller)).to.equal(getAddress(seller.address));
//     });
//   });

//   describe("Auctions", function () {
//     const auctionMinPrice = parseEther("0.1");
//     const auctionDuration = 7 * 24 * 60 * 60; // 7 days in seconds
//     const mintPrice = parseEther("0.05");
//     const testMetadataURI = "ipfs://test/marketplace/auction_nft";

//     it("Should allow a user to start an auction", async function () {
//       const fixture = await loadFixture(deployMarketplaceFixture);
//       const { nft, marketplace, seller, publicClient, contentId, mockVRF, owner } = fixture;

//       const auctionTokenId = await mintAndHandleVRF(
//         nft, mockVRF, publicClient, seller, owner, contentId, mintPrice, testMetadataURI
//       );

//       const approveTx = await nft.write.approve([marketplace.address, auctionTokenId], { account: seller });
//       await publicClient.waitForTransactionReceipt({ hash: approveTx });

//       expect(getAddress(await nft.read.ownerOf([auctionTokenId]))).to.equal(getAddress(seller.address));

//       const startAuctionTx = await marketplace.write.startAuction(
//         [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
//         { account: seller }
//       );
//       const startAuctionReceipt = await publicClient.waitForTransactionReceipt({ hash: startAuctionTx });

//       expect(getAddress(await nft.read.ownerOf([auctionTokenId]))).to.equal(getAddress(marketplace.address));

//       const auction = await marketplace.read.auctions([auctionTokenId]);
//       expect(getAddress(auction.seller)).to.equal(getAddress(seller.address));
//       expect(auction.minPrice).to.equal(auctionMinPrice);
//       expect(auction.highestBid).to.equal(0n);
//       expect(getAddress(auction.highestBidder)).to.equal(getAddress("0x0000000000000000000000000000000000000000"));
//       expect(auction.isActive).to.be.true;
//       expect(await marketplace.read.isTokenInAuction([auctionTokenId])).to.be.true;
//       expect(Number(auction.startTime)).to.be.closeTo(await time.latest(), 5);
//       expect(auction.endTime).to.equal(auction.startTime + BigInt(auctionDuration));

//       const events = await publicClient.getContractEvents({
//         abi: marketplace.abi,
//         address: marketplace.address,
//         eventName: 'AuctionStarted',
//         fromBlock: startAuctionReceipt.blockNumber,
//         toBlock: startAuctionReceipt.blockNumber,
//       });

//       expect(events.length).to.be.greaterThan(0);
//       const auctionEvent = events[0];
//       expect(auctionEvent.args.tokenId).to.equal(auctionTokenId);
//       expect(getAddress(auctionEvent.args.seller)).to.equal(getAddress(seller.address));
//       expect(auctionEvent.args.minPrice).to.equal(auctionMinPrice);
//     });

//     it("Should allow users to place bids and update highest bid", async function () {
//       const fixture = await loadFixture(deployMarketplaceFixture);
//       const { nft, marketplace, seller, bidder1, bidder2, publicClient, contentId, mockVRF, owner } = fixture;

//       const auctionTokenId = await mintAndHandleVRF(
//         nft, mockVRF, publicClient, seller, owner, contentId, mintPrice, testMetadataURI
//       );

//       const approveTx = await nft.write.approve([marketplace.address, auctionTokenId], { account: seller });
//       await publicClient.waitForTransactionReceipt({ hash: approveTx });

//       await marketplace.write.startAuction(
//         [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
//         { account: seller }
//       );

//       const bid1Amount = auctionMinPrice;
//       await marketplace.write.placeBid([auctionTokenId], { value: bid1Amount, account: bidder1 });

//       let auction = await marketplace.read.auctions([auctionTokenId]);
//       expect(auction.highestBid).to.equal(bid1Amount);
//       expect(getAddress(auction.highestBidder)).to.equal(getAddress(bidder1.address));
//       expect((await marketplace.read.getBidderInfo([auctionTokenId, bidder1.address])).amount).to.equal(bid1Amount);

//       const bid2Amount = auctionMinPrice + parseEther("0.1");
//       await marketplace.write.placeBid([auctionTokenId], { value: bid2Amount, account: bidder2 });

//       auction = await marketplace.read.auctions([auctionTokenId]);
//       expect(auction.highestBid).to.equal(bid2Amount);
//       expect(getAddress(auction.highestBidder)).to.equal(getAddress(bidder2.address));
//       expect((await marketplace.read.getBidderInfo([auctionTokenId, bidder2.address])).amount).to.equal(bid2Amount);

//       const bid1Increase = parseEther("0.1");
//       const bid1Total = bid2Amount + bid1Increase;
//       await marketplace.write.placeBid([auctionTokenId], { value: bid1Total, account: bidder1 });

//       auction = await marketplace.read.auctions([auctionTokenId]);
//       expect(auction.highestBid).to.equal(bid1Total);
//       expect(getAddress(auction.highestBidder)).to.equal(getAddress(bidder1.address));
//       expect((await marketplace.read.getBidderInfo([auctionTokenId, bidder1.address])).amount).to.equal(bid1Total);
//     });

//     it("Should allow winner to claim NFT and seller to receive funds after auction ends", async function () {
//       const fixture = await loadFixture(deployMarketplaceFixture);
//       const { nft, marketplace, seller, bidder1, owner, publicClient, contentId, mockVRF } = fixture;

//       const auctionTokenId = await mintAndHandleVRF(
//         nft, mockVRF, publicClient, seller, owner, contentId, mintPrice, testMetadataURI
//       );

//       const approveTx = await nft.write.approve([marketplace.address, auctionTokenId], { account: seller });
//       await publicClient.waitForTransactionReceipt({ hash: approveTx });

//       await marketplace.write.startAuction(
//         [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
//         { account: seller }
//       );
//       const winningBid = auctionMinPrice + parseEther("0.5");
//       await marketplace.write.placeBid([auctionTokenId], { value: winningBid, account: bidder1 });

//       await time.increase(auctionDuration + 1);

//       const initialSellerEthBalance = await publicClient.getBalance({ address: seller.address });

//       const endAuctionTxHash = await marketplace.write.endAuction([auctionTokenId]);
//       const endAuctionReceipt = await publicClient.waitForTransactionReceipt({ hash: endAuctionTxHash });

//       expect(getAddress(await nft.read.ownerOf([auctionTokenId]))).to.equal(getAddress(bidder1.address));

//       const auction = await marketplace.read.auctions([auctionTokenId]);
//       expect(auction.isActive).to.be.false;
//       expect(auction.claimed).to.be.true;
//       expect(await marketplace.read.isTokenInAuction([auctionTokenId])).to.be.false;

//       const protocolFeeBps = await marketplace.read.protocolFeeBps();
//       const calculatedProtocolFee = (winningBid * protocolFeeBps) / 10000n;
//       const sellerAmount = winningBid - calculatedProtocolFee;

//       const finalSellerEthBalance = await publicClient.getBalance({ address: seller.address });

//       expect(finalSellerEthBalance).to.equal(initialSellerEthBalance + sellerAmount);
//       expect(await marketplace.read.accumulatedFees()).to.equal(calculatedProtocolFee);

//       const auctionEndedEvents = await publicClient.getContractEvents({
//         abi: marketplace.abi,
//         address: marketplace.address,
//         eventName: 'AuctionEnded',
//         fromBlock: endAuctionReceipt.blockNumber,
//         toBlock: endAuctionReceipt.blockNumber,
//       });

//       expect(auctionEndedEvents.length).to.be.greaterThan(0);
//       const auctionEndedEvent = auctionEndedEvents[0];
//       expect(auctionEndedEvent.args.tokenId).to.equal(auctionTokenId);
//       expect(getAddress(auctionEndedEvent.args.winner)).to.equal(getAddress(bidder1.address));
//       expect(auctionEndedEvent.args.winningBid).to.equal(winningBid);

//       const nftClaimedEvents = await publicClient.getContractEvents({
//         abi: marketplace.abi,
//         address: marketplace.address,
//         eventName: 'NFTClaimed',
//         fromBlock: endAuctionReceipt.blockNumber,
//         toBlock: endAuctionReceipt.blockNumber,
//       });

//       expect(nftClaimedEvents.length).to.be.greaterThan(0);
//       const nftClaimedEvent = nftClaimedEvents[0];
//       expect(nftClaimedEvent.args.tokenId).to.equal(auctionTokenId);
//       expect(getAddress(nftClaimedEvent.args.winner)).to.equal(getAddress(bidder1.address));
//     });

//     it("Should return NFT to seller if no bids are placed when auction ends", async function () {
//       const fixture = await loadFixture(deployMarketplaceFixture);
//       const { nft, marketplace, seller, publicClient, contentId, mockVRF, owner } = fixture;

//       const auctionTokenId = await mintAndHandleVRF(
//         nft, mockVRF, publicClient, seller, owner, contentId, mintPrice, testMetadataURI
//       );

//       const approveTx = await nft.write.approve([marketplace.address, auctionTokenId], { account: seller });
//       await publicClient.waitForTransactionReceipt({ hash: approveTx });

//       await marketplace.write.startAuction(
//         [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
//         { account: seller }
//       );

//       await time.increase(auctionDuration + 1);

//       const endAuctionTxHash = await marketplace.write.endAuction([auctionTokenId]);
//       const endAuctionReceipt = await publicClient.waitForTransactionReceipt({ hash: endAuctionTxHash });

//       expect(getAddress(await nft.read.ownerOf([auctionTokenId]))).to.equal(getAddress(seller.address));

//       const auction = await marketplace.read.auctions([auctionTokenId]);
//       expect(auction.isActive).to.be.false;
//       expect(auction.claimed).to.be.false;
//       expect(await marketplace.read.isTokenInAuction([auctionTokenId])).to.be.false;

//       const auctionEndedEvents = await publicClient.getContractEvents({
//         abi: marketplace.abi,
//         address: marketplace.address,
//         eventName: 'AuctionEnded',
//         fromBlock: endAuctionReceipt.blockNumber,
//         toBlock: endAuctionReceipt.blockNumber,
//       });

//       expect(auctionEndedEvents.length).to.be.greaterThan(0);
//       const auctionEndedEvent = auctionEndedEvents[0];
//       expect(auctionEndedEvent.args.tokenId).to.equal(auctionTokenId);
//       expect(getAddress(auctionEndedEvent.args.winner)).to.equal(getAddress("0x0000000000000000000000000000000000000000"));
//       expect(auctionEndedEvent.args.winningBid).to.equal(0n);
//     });

//     it("Should allow non-winners to claim refunds", async function () {
//       const fixture = await loadFixture(deployMarketplaceFixture);
//       const { nft, marketplace, seller, bidder1, bidder2, publicClient, contentId, mockVRF, owner } = fixture;

//       const auctionTokenId = await mintAndHandleVRF(
//         nft, mockVRF, publicClient, seller, owner, contentId, mintPrice, testMetadataURI
//       );

//       const approveTx = await nft.write.approve([marketplace.address, auctionTokenId], { account: seller });
//       await publicClient.waitForTransactionReceipt({ hash: approveTx });

//       await marketplace.write.startAuction(
//         [auctionTokenId, auctionMinPrice, BigInt(auctionDuration)],
//         { account: seller }
//       );

//       const bid1Amount = auctionMinPrice;
//       await marketplace.write.placeBid([auctionTokenId], { value: bid1Amount, account: bidder1 });

//       const bid2Amount = auctionMinPrice + parseEther("0.2");
//       await marketplace.write.placeBid([auctionTokenId], { value: bid2Amount, account: bidder2 });

//       await time.increase(auctionDuration + 1);
//       await marketplace.write.endAuction([auctionTokenId]);

//       const initialBidder1Balance = await publicClient.getBalance({ address: bidder1.address });

//       const claimRefundTx = await marketplace.write.claimRefund([auctionTokenId], { account: bidder1 });
//       const claimRefundReceipt = await publicClient.waitForTransactionReceipt({ hash: claimRefundTx });

//       const gasUsed = BigInt(claimRefundReceipt.gasUsed);
//       const gasPrice = BigInt(claimRefundReceipt.effectiveGasPrice);
//       const txCost = gasUsed * gasPrice;

//       const finalBidder1Balance = await publicClient.getBalance({ address: bidder1.address });
//       expect(finalBidder1Balance).to.equal(initialBidder1Balance + bid1Amount - txCost);

//       const bidderInfo = await marketplace.read.getBidderInfo([auctionTokenId, bidder1.address]);
//       expect(bidderInfo.refunded).to.be.true;
//       expect(bidderInfo.amount).to.equal(0n);

//       const refundEvents = await publicClient.getContractEvents({
//         abi: marketplace.abi,
//         address: marketplace.address,
//         eventName: 'RefundProcessed',
//         fromBlock: claimRefundReceipt.blockNumber,
//         toBlock: claimRefundReceipt.blockNumber,
//       });

//       expect(refundEvents.length).to.be.greaterThan(0);
//       const refundEvent = refundEvents[0];
//       expect(refundEvent.args.tokenId).to.equal(auctionTokenId);
//       expect(getAddress(refundEvent.args.bidder)).to.equal(getAddress(bidder1.address));
//       expect(refundEvent.args.amount).to.equal(bid1Amount);
//     });
//   });
// });