// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ScientificContentRegistry is Ownable {
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
    uint256 private _contentCounter;
    address public nftContract;

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

    modifier onlyNFTContract() {
        require(msg.sender == nftContract, "Only NFT contract can modify");
        _;
    }
    
    function nextContentId() public view returns (uint256) {
        return _contentCounter + 1;
    }

    function setNFTContract(address _nftContract) external onlyOwner {
        require(_nftContract != address(0), "Invalid address");
        require(nftContract == address(0), "NFT contract already set");
        nftContract = _nftContract;
        emit NFTContractSet(_nftContract);
    }

    function registerContent(
        string memory title,
        string memory description,
        uint256 maxCopies,
        string memory _ipfsHash,
        uint256 _nftMintPrice
    ) external returns (uint256) {
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