// frontend-dapp/src/lib/secure-wallet.ts

import { createWalletClient, http, createPublicClient, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { pbkdf2Sync, createDecipheriv } from 'crypto';

const SCIENTIFIC_CONTENT_REGISTRY_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "_authorAddress", "type": "address"}],
        "name": "addAuthorToWhitelist",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
] as const;

const SCIENTIFIC_CONTENT_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_SCIENTIFIC_CONTENT_REGISTRY_ADDRESS as `0x${string}`;


const decryptPrivateKey = (encryptedKeyBase64: string, passphrase: string): string => {
    try {
        const encryptedData = Buffer.from(encryptedKeyBase64, 'base64');
        const salt = encryptedData.slice(0, 16);
        const iv = encryptedData.slice(16, 28);
        const authTag = encryptedData.slice(28, 44);
        const ciphertext = encryptedData.slice(44);


        const derivedKey = pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');

        const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
        decipher.setAuthTag(authTag);


        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        
        const privateKey = decrypted.toString('utf8');

        if (!privateKey.match(/^(0x)?[a-fA-F0-9]{64}$/)) {
            throw new Error('Formato chiave privata non valido dopo la decifratura.');
        }

        return privateKey;

    } catch (error: any) {
        console.error('❌ Errore critico durante la decifratura della chiave:', error.message);
        throw new Error('Decifratura fallita. Controllare passphrase o chiave cifrata.');
    }
};

/**
 * Funzione principale per aggiungere un autore alla whitelist on-chain.
 * Utilizza una chiave privata cifrata per firmare la transazione.
 * @param authorAddress L'indirizzo Ethereum da aggiungere alla whitelist.
 * @returns L'hash della transazione.
 */
export async function whitelistAuthorOnChain(authorAddress: string): Promise<string> {
    console.log(`🚀 Inizio processo di whitelisting on-chain per ${authorAddress}`);

  
    if (!SCIENTIFIC_CONTENT_REGISTRY_ADDRESS || !isAddress(SCIENTIFIC_CONTENT_REGISTRY_ADDRESS)) {
        throw new Error('Indirizzo del contratto non valido o non configurato.');
    }
    if (!isAddress(authorAddress)) {
        throw new Error('Indirizzo autore fornito non è valido.');
    }

    const encryptedKey = process.env.NEXT_PUBLIC_ENCRYPTED_PRIVATE_KEY;
    const passphrase = process.env.NEXT_PUBLIC_FOR_CLAIM;

    if (!encryptedKey || !passphrase) {
        throw new Error('Credenziali di automazione (chiave cifrata o passphrase) non trovate in .env');
    }

    let privateKey: string | null = null;
    try {
        privateKey = decryptPrivateKey(encryptedKey, passphrase);
        const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}`);
        console.log(`🔐 Chiave decifrata. Usando l'account sender: ${account.address}`);


        const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http() });
        const walletClient = createWalletClient({
            account,
            chain: arbitrumSepolia,
            transport: http(),
        });
        
        console.log(`🔗 Client Viem configurati. Invio transazione a ${SCIENTIFIC_CONTENT_REGISTRY_ADDRESS}...`);


        const txHash = await walletClient.writeContract({
            address: SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
            abi: SCIENTIFIC_CONTENT_REGISTRY_ABI,
            functionName: 'addAuthorToWhitelist',
            args: [authorAddress as `0x${string}`],
        });

        console.log(`✅ Transazione inviata con successo! Hash: ${txHash}`);
        

        console.log('⏳ In attesa di conferma della transazione...');
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        if (receipt.status !== 'success') {
            throw new Error(`La transazione on-chain è fallita. Status: ${receipt.status}`);
        }

        console.log(`🎉 Transazione confermata nel blocco: ${receipt.blockNumber}`);
        return txHash;

    } catch (error: any) {
        console.error('❌ Fallimento nel processo di whitelisting on-chain:', error);
        throw error;
    } finally {
        privateKey = null; 
    }
}