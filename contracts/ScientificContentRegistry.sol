// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ScientificContentRegistry is AccessControl {
    using Strings for string;

    struct Content {
        string title;
        string description;
        address author;
        bytes32 contentHash;
        bool isAvailable;
        uint256 registrationTime;
        uint256 maxCopies;
        uint256 mintedCopies;
        string ipfsHash;
        uint256 nftMintPrice;
    }

    mapping(uint256 => Content) private _contents;
    mapping(bytes32 => bool) private _usedHashes;
    mapping(address => bool) public isAuthorWhitelisted;
    uint256 private _contentCounter;
    address public nftContract;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    event ContentRegistered(
        uint256 indexed contentId,
        address indexed author,
        string title,
        bytes32 contentHash,
        uint256 maxCopies,
        string ipfsHash,
        uint256 nftMintPrice
    );
    event ContentStatusChanged(uint256 indexed contentId, bool isAvailable);
    event CopyMinted(uint256 indexed contentId, uint256 currentCopies);
    event NFTContractSet(address indexed nftContract);
    event DebugLog(string message, uint256 id, string data);
    event AuthorWhitelisted(address indexed author);
    event AuthorRemovedFromWhitelist(address indexed author);

    constructor() {
        // Imposta il deployer come primo ADMIN
        _grantRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        
        // Imposta l'admin come autore whitelisted di default
        isAuthorWhitelisted[msg.sender] = true;
        emit AuthorWhitelisted(msg.sender);
    }

    modifier onlyNFTContract() {
        require(msg.sender == nftContract, "Only NFT contract can modify");
        _;
    }

    modifier onlyWhitelistedAuthor() {
        require(isAuthorWhitelisted[msg.sender], "Author not whitelisted");
        _;
    }
    
    function nextContentId() public view returns (uint256) {
        return _contentCounter + 1;
    }

    // === Funzioni Gestione Admin ===
    
    /**
     * @dev Aggiunge un nuovo amministratore. Solo un admin esistente può chiamare questa funzione.
     */
    function addAdmin(address account) external onlyRole(ADMIN_ROLE) {
        grantRole(ADMIN_ROLE, account);
    }

    /**
     * @dev Rimuove un amministratore. Solo un admin esistente può chiamare questa funzione.
     */
    function removeAdmin(address account) external onlyRole(ADMIN_ROLE) {
        revokeRole(ADMIN_ROLE, account);
    }

    // === Funzioni Amministrative ===

    function setNFTContract(address _nftContract) external onlyRole(ADMIN_ROLE) {
        require(_nftContract != address(0), "Invalid address");
        require(nftContract == address(0), "NFT contract already set");
        nftContract = _nftContract;
        emit NFTContractSet(_nftContract);
    }

    function addAuthorToWhitelist(address _authorAddress) external onlyRole(ADMIN_ROLE) {
        require(_authorAddress != address(0), "Invalid address");
        require(!isAuthorWhitelisted[_authorAddress], "Author already whitelisted");
        
        isAuthorWhitelisted[_authorAddress] = true;
        emit AuthorWhitelisted(_authorAddress);
    }

    function removeAuthorFromWhitelist(address _authorAddress) external onlyRole(ADMIN_ROLE) {
        require(_authorAddress != address(0), "Invalid address");
        require(isAuthorWhitelisted[_authorAddress], "Author not whitelisted");
        
        isAuthorWhitelisted[_authorAddress] = false;
        emit AuthorRemovedFromWhitelist(_authorAddress);
    }

    // === Funzioni Pubbliche / Autori ===

    function registerContent(
        string memory title,
        string memory description,
        uint256 maxCopies,
        string memory _ipfsHash,
        uint256 _nftMintPrice
    ) external onlyWhitelistedAuthor returns (uint256) {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(description).length > 0, "Description cannot be empty");
        require(maxCopies > 0, "Must allow at least one copy");
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(_nftMintPrice > 0, "NFT mint price must be greater than zero");

        bytes32 contentHash = keccak256(
            abi.encodePacked(title, description, msg.sender)
        );
        require(!_usedHashes[contentHash], "Content already registered");

        _contentCounter++;
        _contents[_contentCounter] = Content({
            title: title,
            description: description,
            author: msg.sender,
            contentHash: contentHash,
            isAvailable: true,
            registrationTime: block.timestamp,
            maxCopies: maxCopies,
            mintedCopies: 0,
            ipfsHash: _ipfsHash,
            nftMintPrice: _nftMintPrice
        });

        _usedHashes[contentHash] = true;

        emit ContentRegistered(_contentCounter, msg.sender, title, contentHash, maxCopies, _ipfsHash, _nftMintPrice);
        emit DebugLog("Content registered", _contentCounter, title);
        return _contentCounter;
    }

    function getContent(uint256 contentId) 
        external 
        view
        returns (Content memory) 
    {
        require(contentExists(contentId), "Content does not exist");
        return _contents[contentId];
    }

    function incrementMintedCopies(uint256 contentId) 
        external 
        onlyNFTContract 
        returns (bool) 
    {
        require(contentExists(contentId), "Content does not exist");
        
        Content storage content = _contents[contentId];
        require(content.mintedCopies < content.maxCopies, "Max copies reached");
        
        content.mintedCopies++;
        emit CopyMinted(contentId, content.mintedCopies);
        emit DebugLog("Copy minted", contentId, content.title);
        
        if (content.mintedCopies >= content.maxCopies) {
            content.isAvailable = false;
            emit ContentStatusChanged(contentId, false);
        }
        
        return true;
    }

    function setContentAvailability(uint256 contentId, bool isAvailable) 
        external 
        onlyNFTContract
    {
        require(contentExists(contentId), "Content does not exist");
        Content storage content = _contents[contentId];
        require(content.mintedCopies < content.maxCopies, "Max copies reached");
        
        content.isAvailable = isAvailable;
        emit ContentStatusChanged(contentId, isAvailable);
        emit DebugLog("Content availability changed", contentId, isAvailable ? "Available" : "Unavailable");
    }

    function contentExists(uint256 contentId) public view returns (bool) {
        return contentId > 0 && contentId <= _contentCounter;
    }

    function getAvailableCopies(uint256 contentId) external view returns (uint256) {
        require(contentExists(contentId), "Content does not exist");
        Content memory content = _contents[contentId];
        return content.maxCopies - content.mintedCopies;
    }
}