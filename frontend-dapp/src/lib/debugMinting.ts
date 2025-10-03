import {
  Address,
  Hex,
  PublicClient,
  WalletClient,
  parseEther,
  formatEther,
  Abi 
} from 'viem';


import {
  SCIENTIFIC_CONTENT_NFT_ADDRESS,
  SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
  SCIENTIFIC_CONTENT_NFT_ABI,
  SCIENTIFIC_CONTENT_REGISTRY_ABI,
  VRF_COORDINATOR_ADDRESS,
  CHAINLINK_KEYHASH,
  CHAINLINK_SUBSCRIPTION_ID,
} from './constants';


import VrfCoordinatorV2PlusABI from '../lib/abi/VrfCoordinatorV2PlusABI.json'; 


interface ContentRegistryData {
  title: string;
  description: string;
  author: Address;
  contentHash: Hex;
  isAvailable: boolean;
  registrationTime: bigint;
  maxCopies: bigint;
  mintedCopies: bigint;
  ipfsHash: string;
  nftMintPrice: bigint;
}


interface DebugMintingParams {
  publicClient: PublicClient;
  walletClient?: WalletClient; 
  userAddress: Address;
  registryContentId: bigint;
  nftMetadataURI: string;
  registryContractAbi: Abi;
  registryContractAddress: Address;
  nftContractAbi: Abi;
  nftContractAddress: Address;
}

export async function debugMinting({
  publicClient,
  walletClient,
  userAddress,
  registryContentId,
  nftMetadataURI,
  registryContractAbi,
  registryContractAddress,
  nftContractAbi,
  nftContractAddress,
}: DebugMintingParams): Promise<void> {
  console.log('\n🔍 === INIZIO DEBUG TRANSAZIONE MINTING NFT ===');
  console.log('📊 Parametri di Input:');
  console.log(`  - Registry Content ID: ${registryContentId}`);
  console.log(`  - NFT Metadata URI: ${nftMetadataURI}`);

  const MINT_PRICE_ETH = 0.005;
  const MINT_PRICE_WEI = parseEther(MINT_PRICE_ETH.toString());
  console.log(`  - Mint Price (ETH): ${MINT_PRICE_ETH}`);
  console.log(`  - Mint Price (Wei): ${MINT_PRICE_WEI}`);
  console.log(`  - User Address: ${userAddress}`);
  console.log(`  - NFT Contract Address: ${nftContractAddress}`);
  console.log(`  - Registry Contract Address: ${registryContractAddress}`);

  try {
    console.log('\n💰 === CONTROLLO SALDO ETH UTENTE ===');
    const userEthBalance = await publicClient.getBalance({ address: userAddress });
    const userEthBalanceFormatted = parseFloat(formatEther(userEthBalance));

    console.log(`  - Saldo attuale: ${userEthBalanceFormatted} ETH`);
    console.log(`  - Prezzo richiesto: ${MINT_PRICE_ETH} ETH`);

    if (userEthBalance < MINT_PRICE_WEI) {
      console.error(
        `❌ ERRORE: Saldo ETH insufficiente. Richiesto ${MINT_PRICE_ETH} ETH, disponibile ${userEthBalanceFormatted} ETH.`
      );
      throw new Error('Insufficient ETH balance');
    }
    console.log('✅ Saldo ETH sufficiente');

    console.log('\n📋 === CONTROLLO STATO CONTENUTO NEL REGISTRY ===');
    const registryData = await publicClient.readContract({
      address: registryContractAddress,
      abi: registryContractAbi,
      functionName: 'getContent',
      args: [registryContentId],
    }) as ContentRegistryData;

    console.log(`DEBUG: Dati raw restituiti da getContent:`, registryData);


    const {
      title,
      description,
      author,
      contentHash,
      isAvailable,
      registrationTime,
      maxCopies,
      mintedCopies,
      ipfsHash,
      nftMintPrice,
    } = registryData;

 
    if (
      title === undefined ||
      author === undefined ||
      contentHash === undefined ||
      isAvailable === undefined ||
      registrationTime === undefined ||
      maxCopies === undefined ||
      mintedCopies === undefined ||
      ipfsHash === undefined ||
      nftMintPrice === undefined
    ) {
      console.error("❌ ERRORE: Uno o più campi critici della struct 'Content' sono undefined.");
      console.error("Dati ricevuti dal Registry:", registryData);
      throw new Error("Invalid content data received from registry.");
    }

    console.log(`  - Contenuto ID ${registryContentId}:`);
    console.log(`    - Titolo: ${title}`);
    console.log(`    - Descrizione: ${description}`);
    console.log(`    - Author: ${author}`);
    console.log(`    - Content Hash: ${contentHash}`);
    console.log(`    - IPFS Hash: ${ipfsHash}`);
    console.log(
      `    - Timestamp Registrazione: ${new Date(
        Number(registrationTime) * 1000
      ).toLocaleString()}`
    );
    console.log(`    - Prezzo Mint Registry: ${formatEther(nftMintPrice)} ETH`);
    console.log(`    - È disponibile per minting: ${isAvailable}`);
    console.log(`    - Copie massime: ${Number(maxCopies)}`);
    console.log(`    - Copie mintate finora: ${Number(mintedCopies)}`);


    if (!isAvailable) {
      console.error(`❌ ERRORE: Contenuto con ID ${registryContentId} non disponibile per il minting.`);
      throw new Error('Content not available');
    }
    if (Number(mintedCopies) >= Number(maxCopies)) {
      console.error(`❌ ERRORE: Nessuna copia disponibile per il contenuto ID ${registryContentId}.`);
      throw new Error('No copies available');
    }
    if (MINT_PRICE_WEI !== nftMintPrice) {
      console.error(`❌ ERRORE: Discrepanza prezzo minting. Contratto richiede ${formatEther(nftMintPrice)} ETH, DApp invia ${MINT_PRICE_ETH} ETH.`);
      throw new Error('Mint price mismatch');
    }

    console.log('✅ Stato contenuto nel Registry OK');

    console.log('\n🔗 === CONTROLLO COLLEGAMENTO REGISTRY ===');
    try {
      const linkedRegistryAddress = await publicClient.readContract({
        address: nftContractAddress,
        abi: nftContractAbi,
        functionName: 'contentRegistry',
      }) as Address;

      if (linkedRegistryAddress.toLowerCase() !== registryContractAddress.toLowerCase()) {
        console.error(
          `❌ ERRORE: Il contratto NFT è collegato a un Registry diverso. NFT: ${linkedRegistryAddress}, Atteso: ${registryContractAddress}`
        );
        throw new Error('NFT linked to wrong Registry');
      }
      console.log(`  - NFT Contract è collegato al Registry: ${linkedRegistryAddress}`);
      console.log('✅ Collegamento Registry OK');
    } catch (e: any) {
      console.warn(`⚠️ ATTENZIONE: Impossibile leggere la variabile 'contentRegistry' dal contratto NFT. Errore: ${e.message}`);
      console.log('  - Assumiamo che il collegamento al Registry sia corretto.');
    }

    console.log('\n🎲 === CONTROLLO CONFIGURAZIONE CHAINLINK VRF ===');
    console.log(`  - Chainlink VRF Coordinator Address (da constants.ts): ${VRF_COORDINATOR_ADDRESS}`);
    console.log(`  - Chainlink VRF Key Hash (da constants.ts): ${CHAINLINK_KEYHASH}`);
    console.log(`  - Chainlink VRF Subscription ID (da constants.ts): ${CHAINLINK_SUBSCRIPTION_ID}`);

    try {
      const coordinatorFromContract = await publicClient.readContract({
        address: nftContractAddress,
        abi: nftContractAbi,
        functionName: 'getVRFCoordinator',
      }) as Address;
      console.log(`  - VRF Coordinator dal contratto: ${coordinatorFromContract}`);
      
      if (coordinatorFromContract.toLowerCase() !== VRF_COORDINATOR_ADDRESS.toLowerCase()) {
        console.warn(`⚠️ DISCREPANZA: VRF Coordinator nel contratto (${coordinatorFromContract}) diverso da constants.ts (${VRF_COORDINATOR_ADDRESS})`);
      }
    } catch (e) {
      console.warn(`⚠️ ATTENZIONE: Impossibile leggere 'getVRFCoordinator' dal contratto NFT. Assicurati di aver aggiunto le funzioni getter e rigenerato l'ABI.`);
    }

    try {
      const keyHashFromContract = await publicClient.readContract({
        address: nftContractAddress,
        abi: nftContractAbi,
        functionName: 'getKeyHash',
      }) as Hex;
      console.log(`  - Key Hash dal contratto: ${keyHashFromContract}`);
      
      if (keyHashFromContract !== CHAINLINK_KEYHASH) {
        console.warn(`⚠️ DISCREPANZA: Key Hash nel contratto (${keyHashFromContract}) diverso da constants.ts (${CHAINLINK_KEYHASH})`);
      }
    } catch (e) {
      console.warn(`⚠️ ATTENZIONE: Impossibile leggere 'getKeyHash' dal contratto NFT.`);
    }

    try {
      const subscriptionIdFromContract = await publicClient.readContract({
        address: nftContractAddress,
        abi: nftContractAbi,
        functionName: 'getSubscriptionId',
      }) as bigint;
      console.log(`  - Subscription ID dal contratto: ${subscriptionIdFromContract}`);
      
      if (subscriptionIdFromContract !== CHAINLINK_SUBSCRIPTION_ID) {
        console.warn(`⚠️ DISCREPANZA: Subscription ID nel contratto (${subscriptionIdFromContract}) diverso da constants.ts (${CHAINLINK_SUBSCRIPTION_ID})`);
      }
    } catch (e) {
      console.warn(`⚠️ ATTENZIONE: Impossibile leggere 'getSubscriptionId' dal contratto NFT.`);
    }

    console.log('\n🔗 === CONTROLLO SALDO LINK SULLA VRF SUBSCRIPTION ===');
    try {
      const subscriptionDetails = await publicClient.readContract({
        address: VRF_COORDINATOR_ADDRESS,
        abi: VrfCoordinatorV2PlusABI as Abi, 
        functionName: 'getSubscription',
        args: [CHAINLINK_SUBSCRIPTION_ID],
      }) as [bigint, bigint, bigint, Address, Address[]]; 


      const [linkBalance, nativeBalance, reqCount, owner, consumers] = subscriptionDetails;
      const subscriptionLinkBalanceFormatted = parseFloat(formatEther(linkBalance));
      const subscriptionNativeBalanceFormatted = parseFloat(formatEther(nativeBalance)); 

      console.log(`  - Saldo LINK della VRF Subscription ID ${CHAINLINK_SUBSCRIPTION_ID}: ${subscriptionLinkBalanceFormatted} LINK`);
      console.log(`  - Saldo NATIVE della VRF Subscription: ${subscriptionNativeBalanceFormatted} ETH`); 
      console.log(`  - Request Count: ${reqCount}`);
      console.log(`  - Owner: ${owner}`);
      console.log(`  - Consumers: ${consumers.join(', ')}`);
      
      const isConsumer = consumers.some(consumer => 
        consumer.toLowerCase() === nftContractAddress.toLowerCase()
      );
      
      if (!isConsumer) {
        console.warn(`⚠️ ATTENZIONE: Il contratto NFT (${nftContractAddress}) NON è listato come CONSUMER della Subscription!`);
        console.warn(`  Questo è un ERRORE CRITICO che impedirà le richieste VRF.`);
      } else {
        console.log(`✅ Il contratto NFT è un consumer autorizzato della Subscription.`);
      }

      if (subscriptionLinkBalanceFormatted < 0.5) {
        console.warn(`⚠️ ATTENZIONE: Saldo LINK basso (${subscriptionLinkBalanceFormatted} LINK). Si consiglia almeno 0.5-1 LINK.`);
      } else {
        console.log('✅ Saldo LINK della VRF Subscription sufficiente.');
      }
    } catch (e: any) {
      console.error(`❌ ERRORE nel controllo VRF Subscription:`, e.message);
      console.error(`Verifica che VRF Coordinator (${VRF_COORDINATOR_ADDRESS}) e Subscription ID (${CHAINLINK_SUBSCRIPTION_ID}) siano corretti.`);
      console.error(e); 
    }

    console.log('\n⛽ === STIMA GAS E SIMULAZIONE TRANSAZIONE ===');
    console.log('Tentativo di simulare la transazione mintNFT...');
    try {
      const { request } = await publicClient.simulateContract({
        account: userAddress,
        address: nftContractAddress,
        abi: nftContractAbi,
        functionName: 'mintNFT',
        args: [registryContentId, nftMetadataURI],
        value: MINT_PRICE_WEI,
      });

      console.log('✅ Simulazione della transazione riuscita!');
      
      if (request.gas) {
        console.log('  - Gas stimato:', request.gas.toString());
      }

      console.log('\n✨ Tutto sembra OK per la transazione. Puoi procedere con il minting reale.');

    } catch (e: any) {
      console.error(`❌ ERRORE CRITICO nella simulazione mintNFT: ${e.name}: ${e.message}`);
      console.error('--- Dettagli Errore ---');
      console.error(e);
      console.error('----------------------');

      if (e.cause?.message) {
        console.error(`  - CAUSA: ${e.cause.message}`);
      }
      if (e.details) {
        console.error(`  - DETTAGLI: ${e.details}`);
      }
      if (e.shortMessage) {
        console.error(`  - MESSAGGIO: ${e.shortMessage}`);
      }
      if (e.metaMessages) {
        console.error(`  - MESSAGGI AGGIUNTIVI:`);
        e.metaMessages.forEach((msg: string) => console.error(`    - ${msg}`));
      }

      console.error(
        `\n🔍 ANALISI: Un "execution reverted" indica spesso:` +
        `\n  1. Discrepanza tra ABI e contratto deployato` +
        `\n  2. Parametri non validi o fuori range` +
        `\n  3. Condizioni del contratto non soddisfatte` +
        `\n  4. Problemi con la configurazione VRF`
      );
      console.error(`\n❌ Non procedere con la transazione reale finché questo errore non è risolto.`);
      throw e;
    }

    console.log('\n=== FINE DEBUG TRANSAZIONE MINTING NFT ===\n');
  } catch (e: any) {
    console.error(`❌ ERRORE GENERALE nel processo di debug: ${e.message}`);
    throw e;
  }
}


