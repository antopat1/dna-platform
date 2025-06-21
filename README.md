# Decentralized News & Articles (DnA)

The **Decentralized News & Articles (DnA)** project is a system that integrates NFTs, verifiable randomness (via Chainlink VRF), and a decentralized ledger to manage scientific content transparently and securely. Authors can register their content by specifying the title, description, and maximum number of available copies. Each content is associated with a unique hash to ensure authenticity. Users can then mint NFTs representing this content, with unique metadata and a 10% chance of obtaining special content.

---

## 🛠 Technologies and Frameworks

- **Smart Contract**: Developed in Solidity, the contracts handle the logic of registration, minting, and royalty distribution.
- **Hardhat**: Development and testing environment for Smart Contracts, which allowed for comprehensive testing and simulation of complex scenarios.
- **Viem**: Library for interacting with the blockchain and testing contract calls, chosen for its efficiency and ease of use in developing scripts and tests.
- **Chainlink VRF**: Used to generate verifiable random numbers, essential for the special content mechanism.
- **Mock VRF Coordinator**: Local simulation of Chainlink VRF to avoid dependencies on the network.
- **Chai + Mocha**: Testing framework for Solidity.

---

## 🛠 Key Features

- **Content Registry**: Authors register content in the `ScientificContentRegistry`, which stores the details and ensures authenticity through a unique hash.
- **NFT Minting**: Users pay to mint an NFT. The system requests a random number via Chainlink VRF to generate unique metadata, including the possibility of special content.
- **Automatic Royalties**: 3% of the payment is automatically transferred to the author as royalties, incentivizing the creation of quality content.
- **Limited Editions**: Each content has a maximum number of copies, making the NFTs more valuable and collectible.
- **Verifiable Randomness**: Chainlink VRF ensures that randomness is unbiased and verifiable, adding an element of surprise and value.

---

## 🚀 Getting Started

### Prerequisites

1. **Node.js**: Ensure you have Node.js installed. You can download it from [here](https://nodejs.org/).
2. **Git**: Clone the repository to get started.

```bash
git clone https://github.com/antopat1/ProgettoEthereumAdvancedDiAntoninoPaterno.git
cd ProgettoEthereumAdvancedDiAntoninoPaterno
```
### Install Dependencies:
```bash
npm install
```

   Note: This command will automatically install all dependencies listed in the package.json file, including Hardhat, Viem, Chainlink, and OpenZeppelin


### Configure the .env file:
```bash
PRIVATE_KEY="<Your private key>"
CHAINLINK_VRF_COORDINATOR="<VRF coordinator address>"
CHAINLINK_SUBSCRIPTION_ID="<Chainlink subscription ID>"
CHAINLINK_KEY_HASH="<Key hash for Chainlink VRF>"
ARBITRUM_SEPOLIA_RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"
LOCAL_PRIVATE_KEY="<Private key for local tests>"
LOCAL_VRF_MOCK="<VRF mock address for local tests>"
```

   Note: For local tests, you can leave the Chainlink fields empty and use the VRF mock.


### Compile Contracts:
```bash
npx hardhat compile
```

### Useful Commands:

- **Deploy locally**
```bash
npx hardhat run scripts/deployWithMock.ts
```

- **Deploy on Arbitrum Sepolia**
```bash
npx hardhat run scripts/deployContracts.ts --network arbitrumSepolia
```

- **Run developed tests**
```bash
npx hardhat test
```
## 🛠 Developed Tests

- **DeploymentTests**: Verify that the contracts are deployed correctly and that the initial configurations are set as expected.

- **VRFFunctionalityTests**: Verify that the NFT minting process works correctly, including the generation of random numbers via VRF.

- **SecurityAndAccessControlTests**: Verify that only authorized users can perform certain operations and that payments are handled correctly.

- **EdgeCaseTests**: Verify the system's behavior in edge cases, such as insufficient payments or exceeding the maximum number of copies.

- **RoyaltyTests & RegisterContentTests:**: Verify that royalties are correctly calculated and transferred to the author and that content is registered and accessible.

- **MintingTests & RandomnessTests**: Verify NFT minting with correct metadata, and prevent minting if the maximum number of copies is reached.

- **SpecialContentTests & TokenTransferTest**: Verify that special content is assigned with a 10% probability and that NFT transfer is possible.

---
