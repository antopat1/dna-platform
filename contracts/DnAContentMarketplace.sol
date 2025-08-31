// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract DnAContentMarketplace is AccessControl, ReentrancyGuard, IERC721Receiver {

    struct FixedPriceListing {
        address seller;
        uint256 tokenId;
        uint256 price;
        bool isActive;
        uint256 listedAt;
    }

    struct Auction {
        address seller;
        uint256 tokenId;
        uint256 minPrice;
        uint256 highestBid;
        address highestBidder;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool claimed;
    }

    struct BidderInfo {
        uint256 amount;
        bool refunded;
    }

    IERC721 public immutable nftContract;

    uint256 public protocolFeeBps = 250;
    address public protocolFeeReceiver;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    mapping(uint256 => FixedPriceListing) public fixedPriceListings;
    mapping(uint256 => bool) public isTokenListedForSale;

    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => bool) public isTokenInAuction;

    mapping(uint256 => mapping(address => BidderInfo)) public bidderInfo;
    mapping(uint256 => address[]) public auctionBidders;

    uint256 public accumulatedFees;

    event NFTListedForSale(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        uint256 timestamp
    );

    event NFTSaleRemoved(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 timestamp
    );

    event NFTPurchased(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 protocolFee,
        uint256 timestamp
    );

    event AuctionStarted(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 minPrice,
        uint256 startTime,
        uint256 endTime
    );

    event NewBid(
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 amount,
        uint256 timestamp
    );

    event AuctionEnded(
        uint256 indexed tokenId,
        address indexed winner,
        uint256 winningBid,
        uint256 timestamp
    );

    event NFTClaimed(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 timestamp
    );

    event RefundProcessed(
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 amount,
        uint256 timestamp
    );

    event ProtocolFeesWithdrawn(
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    event ProtocolFeeUpdated(
        uint256 oldFeeBps,
        uint256 newFeeBps,
        uint256 timestamp
    );

    event ProtocolFeeReceiverUpdated(
        address indexed oldReceiver,
        address indexed newReceiver,
        uint256 timestamp
    );

    modifier onlyTokenOwner(uint256 tokenId) {
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not token owner");
        _;
    }

    modifier tokenNotListed(uint256 tokenId) {
        require(!isTokenListedForSale[tokenId], "Token already listed for sale");
        require(!isTokenInAuction[tokenId], "Token already in auction");
        _;
    }

    modifier validPrice(uint256 price) {
        require(price > 0, "Price must be greater than zero");
        _;
    }

    modifier auctionExists(uint256 tokenId) {
        require(auctions[tokenId].isActive, "Auction does not exist or not active (already finalized/claimed)");
        _;
    }

    modifier auctionNotExpired(uint256 tokenId) {
        require(block.timestamp <= auctions[tokenId].endTime, "Auction has expired");
        _;
    }

    modifier auctionExpired(uint256 tokenId) {
        require(block.timestamp > auctions[tokenId].endTime, "Auction still active");
        _;
    }

    constructor(address _nftContract) { 
        require(_nftContract != address(0), "Invalid NFT contract address");
        nftContract = IERC721(_nftContract);
        protocolFeeReceiver = msg.sender;
        _grantRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
    }

    function listNFTForSale(
        uint256 tokenId,
        uint256 price
    )
        external
        onlyTokenOwner(tokenId)
        tokenNotListed(tokenId)
        validPrice(price)
        nonReentrant
    {
        nftContract.safeTransferFrom(msg.sender, address(this), tokenId);

        fixedPriceListings[tokenId] = FixedPriceListing({
            seller: msg.sender,
            tokenId: tokenId,
            price: price,
            isActive: true,
            listedAt: block.timestamp
        });

        isTokenListedForSale[tokenId] = true;

        emit NFTListedForSale(tokenId, msg.sender, price, block.timestamp);
    }

    function removeNFTFromSale(uint256 tokenId)
        external
        nonReentrant
    {
        FixedPriceListing storage listing = fixedPriceListings[tokenId];
        require(listing.isActive, "Token not listed for sale");
        require(listing.seller == msg.sender, "Not the seller");

        nftContract.safeTransferFrom(address(this), msg.sender, tokenId);

        listing.isActive = false;
        isTokenListedForSale[tokenId] = false;

        emit NFTSaleRemoved(tokenId, msg.sender, block.timestamp);
    }

    function purchaseNFT(uint256 tokenId)
        external
        payable
        nonReentrant
    {
        FixedPriceListing storage listing = fixedPriceListings[tokenId];
        require(listing.isActive, "Token not listed for sale");
        require(msg.value >= listing.price, "Insufficient payment");
        require(msg.sender != listing.seller, "Cannot buy your own NFT");

        address seller = listing.seller;
        uint256 salePrice = listing.price;

        uint256 protocolFee = (salePrice * protocolFeeBps) / 10000;
        uint256 sellerAmount = salePrice - protocolFee;

        listing.isActive = false;
        isTokenListedForSale[tokenId] = false;

        nftContract.safeTransferFrom(address(this), msg.sender, tokenId);

        accumulatedFees += protocolFee;

        (bool success, ) = payable(seller).call{value: sellerAmount}("");
        require(success, "Failed to pay seller");

        if (msg.value > salePrice) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - salePrice}("");
            require(refundSuccess, "Failed to refund excess payment");
        }

        emit NFTPurchased(tokenId, seller, msg.sender, salePrice, protocolFee, block.timestamp);
    }

    function startAuction(
        uint256 tokenId,
        uint256 minPrice,
        uint256 duration
    )
        external
        onlyTokenOwner(tokenId)
        tokenNotListed(tokenId)
        validPrice(minPrice)
        nonReentrant
    {
        require(duration >= 15 minutes, "Auction must last at least 15 minutes"); 
        require(duration <= 30 days, "Auction cannot last more than 30 days");

        nftContract.safeTransferFrom(msg.sender, address(this), tokenId);

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + duration;

        auctions[tokenId] = Auction({
            seller: msg.sender,
            tokenId: tokenId,
            minPrice: minPrice,
            highestBid: 0,
            highestBidder: address(0),
            startTime: startTime,
            endTime: endTime,
            isActive: true,
            claimed: false
        });

        isTokenInAuction[tokenId] = true;

        emit AuctionStarted(tokenId, msg.sender, minPrice, startTime, endTime);
    }

    function placeBid(uint256 tokenId)
        external
        payable
        auctionExists(tokenId)
        auctionNotExpired(tokenId)
        nonReentrant
    {
        Auction storage auction = auctions[tokenId];
        require(msg.sender != auction.seller, "Seller cannot bid on own auction");
        require(msg.value >= auction.minPrice, "Bid below minimum price");

        if (auction.highestBid > 0) {
            require(msg.value > auction.highestBid, "Bid must be higher than current highest bid");
        }

        BidderInfo storage bidderData = bidderInfo[tokenId][msg.sender];

        if (bidderData.amount > 0) {
            (bool success, ) = payable(msg.sender).call{value: bidderData.amount}("");
            require(success, "Failed to refund previous bid");
            bidderData.amount = 0;
            bidderData.refunded = false;
        } else {
            auctionBidders[tokenId].push(msg.sender);
        }

        bidderData.amount = msg.value;
        bidderData.refunded = false;

        if (msg.value > auction.highestBid) {
            auction.highestBid = msg.value;
            auction.highestBidder = msg.sender;
        }

        emit NewBid(tokenId, msg.sender, msg.value, block.timestamp);
    }

    function _finalizeAuction(uint256 tokenId) private {
        Auction storage auction = auctions[tokenId];
        
        require(!auction.claimed, "Auction already claimed");

        auction.isActive = false;
        auction.claimed = true;
        isTokenInAuction[tokenId] = false;

        address recipient = address(0);
        uint256 finalBid = 0;

        if (auction.highestBidder != address(0)) {
            uint256 winningBid = auction.highestBid;
            address winner = auction.highestBidder;
            
            uint256 protocolFee = (winningBid * protocolFeeBps) / 10000;
            uint256 sellerAmount = winningBid - protocolFee;

            accumulatedFees += protocolFee;

            (bool success, ) = payable(auction.seller).call{value: sellerAmount}("");
            require(success, "Failed to pay seller");

            nftContract.safeTransferFrom(address(this), winner, tokenId);
            
            recipient = winner;
            finalBid = winningBid;
        } else {
            nftContract.safeTransferFrom(address(this), auction.seller, tokenId);
            recipient = auction.seller;
        }

        emit AuctionEnded(tokenId, recipient, finalBid, block.timestamp);
        emit NFTClaimed(tokenId, recipient, block.timestamp);
    }

    function endAuction(uint256 tokenId)
        external
        auctionExists(tokenId)
        auctionExpired(tokenId)
        nonReentrant
    {
        _finalizeAuction(tokenId);
    }

    function claimAuction(uint256 tokenId)
        external
        auctionExists(tokenId)
        auctionExpired(tokenId)
        nonReentrant
    {
        Auction storage auction = auctions[tokenId];
        
        if (auction.highestBidder != address(0)) {
            require(msg.sender == auction.highestBidder, "Claim: Only winner can claim");
        } else {
            require(msg.sender == auction.seller, "Claim: Only seller can claim if no bids");
        }
        
        _finalizeAuction(tokenId);
    }

    function claimRefund(uint256 tokenId)
        external
        nonReentrant
    {
        Auction storage auction = auctions[tokenId];
        require(block.timestamp > auction.endTime, "Auction still active");
        require(msg.sender != auction.highestBidder, "Winner cannot claim refund"); 

        BidderInfo storage bidderData = bidderInfo[tokenId][msg.sender];
        require(bidderData.amount > 0, "No bid found for this address"); 
        require(!bidderData.refunded, "Already refunded"); 
        
        uint256 refundAmount = bidderData.amount;
        bidderData.amount = 0; 
        bidderData.refunded = true;

        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        require(success, "Failed to process refund");

        emit RefundProcessed(tokenId, msg.sender, refundAmount, block.timestamp);
    }

    function addAdmin(address account) external onlyRole(ADMIN_ROLE) {
        grantRole(ADMIN_ROLE, account);
    }

    function removeAdmin(address account) external onlyRole(ADMIN_ROLE) {
        revokeRole(ADMIN_ROLE, account);
    }

    function withdrawProtocolFees()
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        require(accumulatedFees > 0, "No fees to withdraw");

        uint256 amount = accumulatedFees;
        accumulatedFees = 0;

        (bool success, ) = payable(protocolFeeReceiver).call{value: amount}("");
        require(success, "Failed to withdraw fees");

        emit ProtocolFeesWithdrawn(protocolFeeReceiver, amount, block.timestamp);
    }

    function setProtocolFee(uint256 newFeeBps)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(newFeeBps <= 1000, "Fee cannot exceed 10%");

        uint256 oldFeeBps = protocolFeeBps;
        protocolFeeBps = newFeeBps;

        emit ProtocolFeeUpdated(oldFeeBps, newFeeBps, block.timestamp);
    }

    function setProtocolFeeReceiver(address newReceiver)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(newReceiver != address(0), "Invalid receiver address");

        address oldReceiver = protocolFeeReceiver;
        protocolFeeReceiver = newReceiver;

        emit ProtocolFeeReceiverUpdated(oldReceiver, newReceiver, block.timestamp);
    }

    function getFixedPriceListing(uint256 tokenId)
        external
        view
        returns (FixedPriceListing memory)
    {
        return fixedPriceListings[tokenId];
    }

    function getAuction(uint256 tokenId)
        external
        view
        returns (Auction memory)
    {
        return auctions[tokenId];
    }

    function getBidderInfo(uint256 tokenId, address bidder)
        external
        view
        returns (BidderInfo memory)
    {
        return bidderInfo[tokenId][bidder];
    }

    function getAuctionBidders(uint256 tokenId)
        external
        view
        returns (address[] memory)
    {
        return auctionBidders[tokenId];
    }

    function calculateProtocolFee(uint256 price)
        external
        view
        returns (uint256)
    {
        return (price * protocolFeeBps) / 10000;
    }

    function isTokenListed(uint256 tokenId)
        external
        view
        returns (bool)
    {
        return isTokenListedForSale[tokenId] || isTokenInAuction[tokenId];
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function emergencyWithdraw()
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");

        (bool success, ) = payable(protocolFeeReceiver).call{value: balance}("");
        require(success, "Emergency withdrawal failed");
    }

    function emergencyRecoverNFT(uint256 tokenId)
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        require(!isTokenListedForSale[tokenId], "Token is listed for sale");
        require(!isTokenInAuction[tokenId], "Token is in auction");

        nftContract.safeTransferFrom(address(this), protocolFeeReceiver, tokenId);
    }
}