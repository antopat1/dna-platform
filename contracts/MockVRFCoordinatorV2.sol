// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract MockVRFCoordinatorV2Plus {
    using VRFV2PlusClient for VRFV2PlusClient.RandomWordsRequest;

    struct Subscription {
        address owner;
        uint96 balance;
        bool active;
        mapping(address => bool) consumers;
    }

    struct RandomWordRequest {
        address sender;
        uint32 numWords;
        bytes32 keyHash;
        uint256 subId;
        bool fulfilled;
    }

    mapping(uint256 => Subscription) private subscriptions;
    mapping(uint256 => RandomWordRequest) private requests;
    uint256 private nonce;
    uint96 public immutable BASE_FEE;
    uint96 public immutable GAS_PRICE_LINK;

    event SubscriptionCreated(uint64 indexed subId, address owner);
    event SubscriptionFunded(uint64 indexed subId, uint256 oldBalance, uint256 newBalance);
    event ConsumerAdded(uint64 indexed subId, address consumer);
    event RandomWordsRequested(
        bytes32 indexed keyHash,
        uint256 requestId,
        uint256 preSeed,
        uint64 indexed subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords,
        address indexed sender
    );
    event RandomWordsFulfilled(
        uint256 indexed requestId,
        uint256 indexed subId,
        uint256[] randomWords,
        uint96 payment
    );

    constructor(uint96 _baseFee, uint96 _gasPriceLink) {
        BASE_FEE = _baseFee;
        GAS_PRICE_LINK = _gasPriceLink;
    }

    function createSubscription() external returns (uint64 subId) {
        subId = uint64(++nonce);
        subscriptions[subId].owner = msg.sender;
        subscriptions[subId].active = true;
        emit SubscriptionCreated(subId, msg.sender);
    }

    function addConsumer(uint64 subId, address consumer) external {
        require(subscriptions[subId].owner == msg.sender, "Not subscription owner");
        require(!subscriptions[subId].consumers[consumer], "Already a consumer");
        subscriptions[subId].consumers[consumer] = true;
        emit ConsumerAdded(subId, consumer);
    }

    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata req
    ) external returns (uint256) {
        require(subscriptions[req.subId].active, "Subscription not active");
        require(subscriptions[req.subId].consumers[msg.sender], "Not registered consumer");
        require(req.numWords > 0, "Must request at least 1 word");
        require(req.callbackGasLimit >= 100000, "Gas limit too low");

        uint256 requestId = uint256(keccak256(abi.encode(req.keyHash, nonce++)));
        
        requests[requestId] = RandomWordRequest({
            sender: msg.sender,
            numWords: req.numWords,
            keyHash: req.keyHash,
            subId: req.subId,
            fulfilled: false
        });

        emit RandomWordsRequested(
            req.keyHash,
            requestId,
            0,
            uint64(req.subId),
            req.requestConfirmations,
            req.callbackGasLimit,
            req.numWords,
            msg.sender
        );

        // Simula un ritardo asincrono
        return requestId;
    }

    function fulfillRandomWords(uint256 requestId) external {
        RandomWordRequest storage request = requests[requestId];
        require(!request.fulfilled, "Request already fulfilled");
        require(request.sender != address(0), "Request not found");

        request.fulfilled = true;
        uint256[] memory randomWords = new uint256[](request.numWords);
        for (uint32 i = 0; i < request.numWords; i++) {
            randomWords[i] = uint256(keccak256(abi.encode(requestId, i, block.timestamp)));
        }

        emit RandomWordsFulfilled(
            requestId,
            request.subId,
            randomWords,
            0
        );

        VRFConsumerBaseV2Plus consumer = VRFConsumerBaseV2Plus(request.sender);
        consumer.rawFulfillRandomWords(requestId, randomWords);
    }

    function fundSubscription(uint64 subId) external payable {
        require(subscriptions[subId].active, "Subscription not active");
        uint96 oldBalance = subscriptions[subId].balance;
        subscriptions[subId].balance += uint96(msg.value);
        emit SubscriptionFunded(subId, oldBalance, subscriptions[subId].balance);
    }

    function getSubscription(uint64 subId) 
        external 
        view 
        returns (
            address owner,
            uint96 balance,
            bool active
        )
    {
        Subscription storage sub = subscriptions[subId];
        return (sub.owner, sub.balance, sub.active);
    }

    function isConsumer(uint64 subId, address consumer) external view returns (bool) {
        return subscriptions[subId].consumers[consumer];
    }
}