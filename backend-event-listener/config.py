import os
from dotenv import load_dotenv
import json # Importa il modulo json

# Carica le variabili d'ambiente dal file .env nella radice del progetto
# Il percorso '../.env' è corretto se config.py si trova in backend-event-listener/ e .env è nella root di dnaPlatform
load_dotenv(dotenv_path='../.env')

# --- Variabili d'Ambiente ---
MONGO_DB_URI = os.getenv("MONGODB_URI")
ARBITRUM_SEPOLIA_RPC_URL = os.getenv("ARBITRUM_SEPOLIA_RPC_URL")

# Indirizzi dei contratti
SCIENTIFIC_CONTENT_NFT_ADDRESS = os.getenv("SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS")
SCIENTIFIC_CONTENT_REGISTRY_ADDRESS = os.getenv("SCIENTIFIC_CONTENT_REGISTRY_CONTRACT_ADDRESS")
SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS = os.getenv("SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS")

# Assicurati che tutte le variabili d'ambiente necessarie siano caricate
if not all([MONGO_DB_URI, ARBITRUM_SEPOLIA_RPC_URL,
             SCIENTIFIC_CONTENT_NFT_ADDRESS, SCIENTIFIC_CONTENT_REGISTRY_ADDRESS,
             SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS]):
    raise ValueError("One or more environment variables (MONGODB_URI, ARBITRUM_SEPOLIA_RPC_URL, contract addresses) are not set.")

# --- Caricamento degli ABI dai file JSON di Hardhat ---

# La funzione load_abi_from_hardhat carica l'ABI specifico da un file JSON di Hardhat
def load_abi_from_hardhat(contract_name: str) -> list:
    # Il percorso è relativo a config.py.
    # '../artifacts/' per risalire alla root di dnaPlatform e poi entrare in artifacts.
    # Nota che il tuo marketplace ABI è DnAContentMarketplace.json, quindi il nome del file deve corrispondere.
    abi_path = os.path.join('..', 'artifacts', 'contracts', f'{contract_name}.sol', f'{contract_name}.json')

    if contract_name == "DnAContentMarketplace":
        abi_path = os.path.join('..', 'artifacts', 'contracts', 'DnAContentMarketplace.sol', 'DnAContentMarketplace.json')
    elif contract_name == "ScientificContentNFT":
        abi_path = os.path.join('..', 'artifacts', 'contracts', 'ScientificContentNFT.sol', 'ScientificContentNFT.json')
    elif contract_name == "ScientificContentRegistry":
        abi_path = os.path.join('..', 'artifacts', 'contracts', 'ScientificContentRegistry.sol', 'ScientificContentRegistry.json')
    else:
        raise ValueError(f"Unknown contract name: {contract_name}. Cannot find ABI path.")

    try:
        with open(abi_path, 'r') as f:
            full_abi_data = json.load(f)
            # L'ABI effettivo è contenuto sotto la chiave 'abi' nel JSON di Hardhat
            return full_abi_data.get('abi')
    except FileNotFoundError:
        raise FileNotFoundError(f"ABI file not found for {contract_name} at {abi_path}. Have you compiled your contracts?")
    except json.JSONDecodeError:
        raise ValueError(f"Error decoding JSON for {contract_name} at {abi_path}. Check if the file is a valid JSON.")

# Carica gli ABI per ciascun contratto
SCIENTIFIC_CONTENT_NFT_ABI = load_abi_from_hardhat("ScientificContentNFT")
SCIENTIFIC_CONTENT_REGISTRY_ABI = load_abi_from_hardhat("ScientificContentRegistry")
# Attenzione: il nome del tuo file ABI per il marketplace è "DnAContentMarketplace.json"
SCIENTIFIC_CONTENT_MARKETPLACE_ABI = load_abi_from_hardhat("DnAContentMarketplace")

# Verifica che gli ABI siano stati caricati (opzionale ma consigliato per debug)
if not all([SCIENTIFIC_CONTENT_NFT_ABI, SCIENTIFIC_CONTENT_REGISTRY_ABI, SCIENTIFIC_CONTENT_MARKETPLACE_ABI]):
    raise ValueError("One or more contract ABIs could not be loaded. Check contract names and file paths.")