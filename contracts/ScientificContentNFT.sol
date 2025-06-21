// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "./ScientificContentRegistry.sol";

contract ScientificContentNFT is ERC721Enumerable, VRFConsumerBaseV2Plus {
    using Strings for uint256;

    IVRFCoordinatorV2Plus private immutable COORDINATOR;
    bytes32 private immutable keyHash;
    uint256 private immutable subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant CALLBACK_GAS_LIMIT = 700000;
    uint32 private constant NUM_WORDS = 1;

    ScientificContentRegistry public immutable contentRegistry;
    
    uint256 public constant MINT_PRICE = 0.005 ether;
    uint256 private constant AUTHOR_ROYALTY_PERCENTAGE = 3;
    
    address public protocolFeeReceiver;
    
    string private _baseTokenURI;
    
    struct NFTMetadata {
        uint256 contentId;
        address author;
        uint256 randomSeed;
        bool hasSpecialContent;
        uint256 copyNumber;
        string metadataURI;
    }

    mapping(uint256 => NFTMetadata) private _nftMetadata;
    mapping(uint256 => PendingMint) private _pendingMints;

    struct PendingMint {
        address minter;
        uint256 contentId;
        string metadataURI;
    }

    event NFTMinted(
        uint256 indexed tokenId,
        uint256 indexed contentId,
        address indexed owner,
        bool isSpecial,
        uint256 copyNumber,
        string metadataURI
    );
    event MintingFailed(address indexed minter, uint256 indexed contentId);
    event ProtocolFeesWithdrawn(address indexed to, uint256 amount);
    event ProtocolFeeReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);
    event BaseURIUpdated(string newBaseURI);

    constructor(
        address _contentRegistry,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint256 _subscriptionId
    ) 
        ERC721("DnA Scientific Content", "DNASCI")
        VRFConsumerBaseV2Plus(_vrfCoordinator)
    {
        require(_contentRegistry != address(0), "Invalid registry address");
        require(_vrfCoordinator != address(0), "Invalid VRF coordinator");
        require(_keyHash != bytes32(0), "Invalid key hash");
        require(_subscriptionId != 0, "Invalid subscription ID");
        
        protocolFeeReceiver = msg.sender;
        
        contentRegistry = ScientificContentRegistry(_contentRegistry);
        COORDINATOR = IVRFCoordinatorV2Plus(_vrfCoordinator);
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
    }

    function mintNFT(uint256 contentId, string memory nftMetadataURI) external payable {
        require(msg.value >= MINT_PRICE, "Insufficient payment, required 0.005 ETH");
        require(bytes(nftMetadataURI).length > 0, "Metadata URI cannot be empty");
        
        ScientificContentRegistry.Content memory content = contentRegistry.getContent(contentId);
        
        require(content.isAvailable, "Content not available");
        require(content.mintedCopies < content.maxCopies, "No copies available");

        VRFV2PlusClient.RandomWordsRequest memory request = VRFV2PlusClient.RandomWordsRequest({
            keyHash: keyHash,
            subId: subscriptionId,
            requestConfirmations: REQUEST_CONFIRMATIONS,
            callbackGasLimit: CALLBACK_GAS_LIMIT,
            numWords: NUM_WORDS,
            extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
        });

        uint256 requestId = COORDINATOR.requestRandomWords(request);
        _pendingMints[requestId] = PendingMint({
            minter: msg.sender,
            contentId: contentId,
            metadataURI: nftMetadataURI
        });

        if (msg.value > MINT_PRICE) {
            payable(msg.sender).transfer(msg.value - MINT_PRICE);
        }
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        PendingMint memory mintData = _pendingMints[requestId];
        require(mintData.minter != address(0), "Pending mint request not found");
        
        try this._processMint(
            mintData.minter,
            mintData.contentId,
            randomWords[0],
            mintData.metadataURI
        ) {
            ScientificContentRegistry.Content memory content = contentRegistry.getContent(mintData.contentId);
            uint256 authorRoyalty = (MINT_PRICE * AUTHOR_ROYALTY_PERCENTAGE) / 100;
            
            if (authorRoyalty > 0) {
                 (bool success, ) = payable(content.author).call{value: authorRoyalty}("");
                 require(success, "Failed to send royalty to author");
            }

        } catch {
            emit MintingFailed(mintData.minter, mintData.contentId);
            
            (bool success, ) = payable(mintData.minter).call{value: MINT_PRICE}("");
            require(success, "Failed to refund user on mint failure");
            
            contentRegistry.setContentAvailability(mintData.contentId, true);
        }
        
        delete _pendingMints[requestId];
    }

    function _processMint(
        address minter,
        uint256 contentId,
        uint256 randomWord,
        string memory nftMetadataURI
    ) external {
        require(msg.sender == address(this), "Internal call only");
        
        uint256 newTokenId = totalSupply() + 1;
        _safeMint(minter, newTokenId);

        ScientificContentRegistry.Content memory content = contentRegistry.getContent(contentId);
        bool hasSpecialContent = randomWord % 10 == 0;

        _nftMetadata[newTokenId] = NFTMetadata({
            contentId: contentId,
            author: content.author,
            randomSeed: randomWord,
            hasSpecialContent: hasSpecialContent,
            copyNumber: content.mintedCopies + 1,
            metadataURI: nftMetadataURI
        });

        contentRegistry.incrementMintedCopies(contentId);

        emit NFTMinted(
            newTokenId, 
            contentId, 
            minter, 
            hasSpecialContent, 
            content.mintedCopies + 1,
            nftMetadataURI
        );
    }

    function withdrawProtocolFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");

        (bool success, ) = payable(protocolFeeReceiver).call{value: balance}("");
        require(success, "Failed to withdraw fees");

        emit ProtocolFeesWithdrawn(protocolFeeReceiver, balance);
    }
    
    function setProtocolFeeReceiver(address newReceiver) external onlyOwner {
        require(newReceiver != address(0), "New receiver cannot be zero address");
        address oldReceiver = protocolFeeReceiver;
        protocolFeeReceiver = newReceiver;
        emit ProtocolFeeReceiverUpdated(oldReceiver, newReceiver);
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        NFTMetadata memory metadata = _nftMetadata[tokenId];
        if (bytes(metadata.metadataURI).length > 0) {
            return metadata.metadataURI;
        }
        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString())) : "";
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function getNFTMetadata(uint256 tokenId) external view returns (NFTMetadata memory) {
        require(_exists(tokenId), "Token does not exist");
        return _nftMetadata[tokenId];
    }

    /**
     * @dev Funzioni getter per variabili immutable per debugging e frontend
     */
    function getVRFCoordinator() external view returns (address) {
        return address(COORDINATOR);
    }

    function getKeyHash() external view returns (bytes32) {
        return keyHash;
    }

    function getSubscriptionId() external view returns (uint256) {
        return subscriptionId;
    }

    /**
     * @dev Funzione helper per ottenere tutte le configurazioni VRF in una sola chiamata
     */
    function getVRFConfig() external view returns (
        address coordinator,
        bytes32 vrfKeyHash,
        uint256 vrfSubscriptionId
    ) {
        return (address(COORDINATOR), keyHash, subscriptionId);
    }
}