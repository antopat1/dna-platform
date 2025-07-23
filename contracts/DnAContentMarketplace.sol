// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title DnAContentMarketplace
 * @dev Marketplace per la vendita di NFT scientifici con supporto per vendite a prezzo fisso e aste
 */
contract DnAContentMarketplace is Ownable, ReentrancyGuard, IERC721Receiver {

    // ============ STRUTTURE DATI ============

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

    // ============ VARIABILI DI STATO ============

    IERC721 public immutable nftContract;

    // Commissione di protocollo (basis points - 250 = 2.5%)
    uint256 public protocolFeeBps = 250;
    address public protocolFeeReceiver;

    // Mappings per le vendite a prezzo fisso
    mapping(uint256 => FixedPriceListing) public fixedPriceListings;
    mapping(uint256 => bool) public isTokenListedForSale;

    // Mappings per le aste
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => bool) public isTokenInAuction;

    // Mapping per tenere traccia delle offerte per ogni asta
    mapping(uint256 => mapping(address => BidderInfo)) public bidderInfo;
    mapping(uint256 => address[]) public auctionBidders;

    // Commissioni accumulate
    uint256 public accumulatedFees;

    // ============ EVENTI ============

    // Eventi per vendite a prezzo fisso
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

    // Eventi per aste
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
        address indexed winner,
        uint256 timestamp
    );

    event RefundProcessed(
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 amount,
        uint256 timestamp
    );

    // Eventi per gestione commissioni
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

    // ============ MODIFICATORI ============

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
        require(auctions[tokenId].isActive, "Auction does not exist or not active");
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

    // ============ COSTRUTTORE ============

    constructor(address _nftContract) { 
        require(_nftContract != address(0), "Invalid NFT contract address");
        nftContract = IERC721(_nftContract);
        // Poiché Ownable imposta msg.sender come owner di default,
        // questa riga rimane per impostare il ricevitore delle commissioni all'owner iniziale.
        protocolFeeReceiver = msg.sender;
    }

    // ============ FUNZIONI PER VENDITE A PREZZO FISSO ============

    /**
     * @dev Lista un NFT per la vendita a prezzo fisso
     * @param tokenId ID del token da vendere
     * @param price Prezzo di vendita in wei
     */
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
        // Trasferisce l'NFT al marketplace
        nftContract.safeTransferFrom(msg.sender, address(this), tokenId);

        // Crea il listing
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

    /**
     * @dev Rimuove un NFT dalla vendita
     * @param tokenId ID del token da rimuovere
     */
    function removeNFTFromSale(uint256 tokenId)
        external
        nonReentrant
    {
        FixedPriceListing storage listing = fixedPriceListings[tokenId];
        require(listing.isActive, "Token not listed for sale");
        require(listing.seller == msg.sender, "Not the seller");

        // Restituisce l'NFT al venditore
        nftContract.safeTransferFrom(address(this), msg.sender, tokenId);

        // Rimuove il listing
        listing.isActive = false;
        isTokenListedForSale[tokenId] = false;

        emit NFTSaleRemoved(tokenId, msg.sender, block.timestamp);
    }

    /**
     * @dev Acquista un NFT a prezzo fisso
     * @param tokenId ID del token da acquistare
     */
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

        // Calcola commissioni
        uint256 protocolFee = (salePrice * protocolFeeBps) / 10000;
        uint256 sellerAmount = salePrice - protocolFee;

        // Rimuove il listing
        listing.isActive = false;
        isTokenListedForSale[tokenId] = false;

        // Trasferisce l'NFT all'acquirente
        nftContract.safeTransferFrom(address(this), msg.sender, tokenId);

        // Accumula commissioni
        accumulatedFees += protocolFee;

        // Paga il venditore
        (bool success, ) = payable(seller).call{value: sellerAmount}("");
        require(success, "Failed to pay seller");

        // Rimborsa l'eccesso se presente
        if (msg.value > salePrice) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - salePrice}("");
            require(refundSuccess, "Failed to refund excess payment");
        }

        emit NFTPurchased(tokenId, seller, msg.sender, salePrice, protocolFee, block.timestamp);
    }

    // ============ FUNZIONI PER ASTE ============

    /**
     * @dev Avvia un'asta per un NFT
     * @param tokenId ID del token da mettere all'asta
     * @param minPrice Prezzo minimo dell'asta
     * @param duration Durata dell'asta in secondi
     */
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
        require(duration >= 1 hours, "Auction must last at least 1 hour");
        require(duration <= 30 days, "Auction cannot last more than 30 days");

        // Trasferisce l'NFT al marketplace
        nftContract.safeTransferFrom(msg.sender, address(this), tokenId);

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + duration;

        // Crea l'asta
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

    /**
     * @dev Fa un'offerta per un NFT all'asta
     * @param tokenId ID del token per cui fare l'offerta
     */
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

        // Se c'è già un'offerta più alta, deve superarla
        if (auction.highestBid > 0) {
            require(msg.value > auction.highestBid, "Bid must be higher than current highest bid");
        }

        BidderInfo storage bidderData = bidderInfo[tokenId][msg.sender];

        // Se l'offerente ha già fatto un'offerta, gli si restituisce il saldo precedente
        // (indipendentemente dal fatto che sia il highestBidder o meno)
        if (bidderData.amount > 0) {
            (bool success, ) = payable(msg.sender).call{value: bidderData.amount}("");
            require(success, "Failed to refund previous bid");
            bidderData.amount = 0; // Azzera l'importo precedente dopo il rimborso
            bidderData.refunded = false; // Reset del flag di rimborso
        } else {
             // Se è un nuovo offerente, aggiungilo alla lista (per rimborsi futuri)
            auctionBidders[tokenId].push(msg.sender);
        }

        // Aggiorna i dati dell'offerta per l'attuale offerente
        bidderData.amount = msg.value;
        bidderData.refunded = false; // Non rimborsato (ha appena fatto una nuova offerta)

        // Aggiorna l'asta se l'offerta attuale è la più alta
        if (msg.value > auction.highestBid) {
            auction.highestBid = msg.value;
            auction.highestBidder = msg.sender;
        }

        emit NewBid(tokenId, msg.sender, msg.value, block.timestamp);
    }

    /**
     * @dev Finalizza un'asta
     * @param tokenId ID del token dell'asta da finalizzare
     */
    function endAuction(uint256 tokenId)
        external
        auctionExists(tokenId)
        auctionExpired(tokenId)
        nonReentrant
    {
        Auction storage auction = auctions[tokenId];
        require(!auction.claimed, "Auction already claimed");

        auction.isActive = false;

        if (auction.highestBidder != address(0)) {
            // C'è un vincitore
            uint256 winningBid = auction.highestBid;
            address winner = auction.highestBidder;

            // Calcola commissioni
            uint256 protocolFee = (winningBid * protocolFeeBps) / 10000;
            uint256 sellerAmount = winningBid - protocolFee;

            // Accumula commissioni
            accumulatedFees += protocolFee;

            // Paga il venditore
            (bool success, ) = payable(auction.seller).call{value: sellerAmount}("");
            require(success, "Failed to pay seller");

            // Trasferisce l'NFT al vincitore
            nftContract.safeTransferFrom(address(this), winner, tokenId);

            // Il vincitore non viene marcato come "rimborsato" qui,
            // poiché sta ricevendo l'NFT, non un rimborso.
            auction.claimed = true; // Questo flag indica che l'asta è stata finalizzata/reclamat

            emit AuctionEnded(tokenId, winner, winningBid, block.timestamp);
            emit NFTClaimed(tokenId, winner, block.timestamp);
        } else {
            // Nessuna offerta, restituisce l'NFT al venditore
            nftContract.safeTransferFrom(address(this), auction.seller, tokenId);
            emit AuctionEnded(tokenId, address(0), 0, block.timestamp);
        }

        isTokenInAuction[tokenId] = false;
    }

    /**
     * @dev Richiede il rimborso per un'offerta non vincente
     * @param tokenId ID del token dell'asta
     */
    function claimRefund(uint256 tokenId)
        external
        nonReentrant
    {
        Auction storage auction = auctions[tokenId];
        // L'asta deve essere scaduta per permettere i rimborsi.
        require(block.timestamp > auction.endTime, "Auction still active");
        
        // Il vincitore non può reclamare un rimborso
        require(msg.sender != auction.highestBidder, "Winner cannot claim refund"); 

        BidderInfo storage bidderData = bidderInfo[tokenId][msg.sender];
        require(bidderData.amount > 0, "No bid found for this address"); 
        require(!bidderData.refunded, "Already refunded"); 
        
        uint256 refundAmount = bidderData.amount;
        bidderData.amount = 0; // Azzera l'importo del bid dopo il rimborso
        bidderData.refunded = true; // Marca come rimborsato

        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        require(success, "Failed to process refund");

        emit RefundProcessed(tokenId, msg.sender, refundAmount, block.timestamp);
    }

    // ============ FUNZIONI DI GESTIONE COMMISSIONI ============

    /**
     * @dev Preleva le commissioni accumulate
     */
    function withdrawProtocolFees()
        external
        onlyOwner
        nonReentrant
    {
        require(accumulatedFees > 0, "No fees to withdraw");

        uint256 amount = accumulatedFees;
        accumulatedFees = 0;

        (bool success, ) = payable(protocolFeeReceiver).call{value: amount}("");
        require(success, "Failed to withdraw fees");

        emit ProtocolFeesWithdrawn(protocolFeeReceiver, amount, block.timestamp);
    }

    /**
     * @dev Aggiorna la commissione di protocollo
     * @param newFeeBps Nuova commissione in basis points (max 1000 = 10%)
     */
    function setProtocolFee(uint256 newFeeBps)
        external
        onlyOwner
    {
        require(newFeeBps <= 1000, "Fee cannot exceed 10%");

        uint256 oldFeeBps = protocolFeeBps;
        protocolFeeBps = newFeeBps;

        emit ProtocolFeeUpdated(oldFeeBps, newFeeBps, block.timestamp);
    }

    /**
     * @dev Aggiorna il ricevitore delle commissioni
     * @param newReceiver Nuovo indirizzo ricevitore
     */
    function setProtocolFeeReceiver(address newReceiver)
        external
        onlyOwner
    {
        require(newReceiver != address(0), "Invalid receiver address");

        address oldReceiver = protocolFeeReceiver;
        protocolFeeReceiver = newReceiver;

        emit ProtocolFeeReceiverUpdated(oldReceiver, newReceiver, block.timestamp);
    }

    // ============ FUNZIONI DI VISTA ============

    /**
     * @dev Ottiene informazioni su un listing a prezzo fisso
     * @param tokenId ID del token
     * @return Il listing corrispondente
     */
    function getFixedPriceListing(uint256 tokenId)
        external
        view
        returns (FixedPriceListing memory)
    {
        return fixedPriceListings[tokenId];
    }

    /**
     * @dev Ottiene informazioni su un'asta
     * @param tokenId ID del token
     * @return L'asta corrispondente
     */
    function getAuction(uint256 tokenId)
        external
        view
        returns (Auction memory)
    {
        return auctions[tokenId];
    }

    /**
     * @dev Ottiene informazioni su un offerente per un'asta specifica
     * @param tokenId ID del token
     * @param bidder Indirizzo dell'offerente
     * @return Le informazioni dell'offerente
     */
    function getBidderInfo(uint256 tokenId, address bidder)
        external
        view
        returns (BidderInfo memory)
    {
        return bidderInfo[tokenId][bidder];
    }

    /**
     * @dev Ottiene la lista degli offerenti per un'asta
     * @param tokenId ID del token
     * @return Array degli indirizzi degli offerenti
     */
    function getAuctionBidders(uint256 tokenId)
        external
        view
        returns (address[] memory)
    {
        return auctionBidders[tokenId];
    }

    /**
     * @dev Calcola la commissione di protocollo per un dato prezzo
     * @param price Prezzo di vendita
     * @return La commissione calcolata
     */
    function calculateProtocolFee(uint256 price)
        external
        view
        returns (uint256)
    {
        return (price * protocolFeeBps) / 10000;
    }

    // ============ FUNZIONI DI UTILITÀ ============

    /**
     * @dev Verifica se un token è attualmente in vendita o all'asta
     * @param tokenId ID del token
     * @return true se il token è attualmente listato
     */
    function isTokenListed(uint256 tokenId)
        external
        view
        returns (bool)
    {
        return isTokenListedForSale[tokenId] || isTokenInAuction[tokenId];
    }

    /**
     * @dev Gestisce la ricezione di NFT ERC721
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @dev Funzione di emergenza per recuperare ETH bloccati
     * Può essere usata solo dal proprietario in caso di emergenza
     */
    function emergencyWithdraw()
        external
        onlyOwner
        nonReentrant
    {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Emergency withdrawal failed");
    }

    /**
     * @dev Funzione per recuperare NFT bloccati accidentalmente
     * Può essere usata solo dal proprietario in caso di emergenza
     */
    function emergencyRecoverNFT(uint256 tokenId)
        external
        onlyOwner
        nonReentrant
    {
        require(!isTokenListedForSale[tokenId], "Token is listed for sale");
        require(!isTokenInAuction[tokenId], "Token is in auction");

        nftContract.safeTransferFrom(address(this), owner(), tokenId);
    }
}