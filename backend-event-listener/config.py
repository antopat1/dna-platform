import os
from dotenv import load_dotenv

load_dotenv() # Carica le variabili d'ambiente dal file .env

# Configurazione Blockchain
RPC_URL = os.getenv("ARBITRUM_SEPOLIA_RPC_URL", "https://sepolia-rollup.arbitrum.io/rpc")

# Indirizzi dei Contratti
NFT_CONTRACT_ADDRESS = os.getenv("SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS")
MARKETPLACE_CONTRACT_ADDRESS = os.getenv("SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS")

# Calcola i percorsi ABI relativamente alla posizione di questo file (config.py)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

# Modifica: Percorsi relativi corretti basati su /app/artifacts nel container
NFT_ABI_PATH = os.path.join(CURRENT_DIR, "artifacts", "contracts", "ScientificContentNFT.sol", "ScientificContentNFT.json")
MARKETPLACE_ABI_PATH = os.path.join(CURRENT_DIR, "artifacts", "contracts", "DnAContentMarketplace.sol", "DnAContentMarketplace.json")

# Nomi degli eventi da monitorare
NFT_EVENT_NAMES_TO_MONITOR = [
    "Approval",
    "ApprovalForAll",
    "BaseURIUpdated",
    "CoordinatorSet",
    "MintingFailed",
    "NFTMinted",
    "OwnershipTransferRequested",
    "OwnershipTransferred",
    "ProtocolFeeReceiverUpdated",
    "ProtocolFeesWithdrawn",
    "Transfer"
]

MARKETPLACE_EVENT_NAMES_TO_MONITOR = [
    "AuctionEnded",
    "AuctionStarted",
    "NFTClaimed",
    "NFTListedForSale",
    "NFTPurchased",
    "NFTSaleRemoved",
    "NewBid",
    "OwnershipTransferred",
    "ProtocolFeeReceiverUpdated",
    "ProtocolFeeUpdated",
    "ProtocolFeesWithdrawn",
    "RefundProcessed"
]

# Configurazione MongoDB
MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME", "DnaContentMarketplaceDB")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "events")

# Altre configurazioni
POLLING_INTERVAL_SECONDS = 1500
MAX_BLOCKS_TO_SCAN_PER_CYCLE = 100 # non lo imposto a 1000 per non saturare il free tier di Alchemy

# BLOCCHI INIZIALI DI DEPLOY DEI CONTRATTI
INITIAL_START_BLOCKS = {
    NFT_CONTRACT_ADDRESS: 176973932,
    MARKETPLACE_CONTRACT_ADDRESS: 176973973
}

# ********************************************************************************
# NUOVA VARIABILE D'AMBIENTE PER OVERRIDE DEL BLOCCO DI PARTENZA
# ********************************************************************************
# Se impostata (es. OVERRIDE_START_BLOCK=170800000 nel .env o nella shell),
# il listener inizierà la scansione da questo blocco, ignorando lo stato nel DB
# e i blocchi di deploy. Utile per testare solo eventi futuri.
# Assicurati che sia un intero.
OVERRIDE_START_BLOCK = os.getenv("OVERRIDE_START_BLOCK")

# ********************************************************************************
# NUOVA CONFIGURAZIONE REDIS PER IL LISTENER IN TEMPO REALE
# ********************************************************************************
REDIS_URL = os.getenv("REDIS_URL")
REDIS_CHANNEL = os.getenv("REDIS_CHANNEL", "blockchain_events") # Canale Pub/Sub su Redis



# # backend-event-listener/config.py

# import os
# from dotenv import load_dotenv

# load_dotenv() # Carica le variabili d'ambiente dal file .env

# # Configurazione Blockchain
# RPC_URL = os.getenv("ARBITRUM_SEPOLIA_RPC_URL", "https://sepolia-rollup.arbitrum.io/rpc")

# # Indirizzi dei Contratti
# NFT_CONTRACT_ADDRESS = os.getenv("SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS")
# MARKETPLACE_CONTRACT_ADDRESS = os.getenv("SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS")

# # Calcola i percorsi ABI relativamente alla posizione di questo file (config.py)
# CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# PROJECT_ROOT_DIR = os.path.join(CURRENT_DIR, os.pardir)

# NFT_ABI_PATH = os.path.join(PROJECT_ROOT_DIR, "artifacts", "contracts", "ScientificContentNFT.sol", "ScientificContentNFT.json")
# MARKETPLACE_ABI_PATH = os.path.join(PROJECT_ROOT_DIR, "artifacts", "contracts", "DnAContentMarketplace.sol", "DnAContentMarketplace.json")

# # Nomi degli eventi da monitorare
# NFT_EVENT_NAMES_TO_MONITOR = [
#     "Approval",
#     "ApprovalForAll",
#     "BaseURIUpdated",
#     "CoordinatorSet",
#     "MintingFailed",
#     "NFTMinted",
#     "OwnershipTransferRequested",
#     "OwnershipTransferred",
#     "ProtocolFeeReceiverUpdated",
#     "ProtocolFeesWithdrawn",
#     "Transfer"
# ]

# MARKETPLACE_EVENT_NAMES_TO_MONITOR = [
#     "AuctionEnded",
#     "AuctionStarted",
#     "NFTClaimed",
#     "NFTListedForSale",
#     "NFTPurchased",
#     "NFTSaleRemoved",
#     "NewBid",
#     "OwnershipTransferred",
#     "ProtocolFeeReceiverUpdated",
#     "ProtocolFeeUpdated",
#     "ProtocolFeesWithdrawn",
#     "RefundProcessed"
# ]

# # Configurazione MongoDB
# MONGODB_URI = os.getenv("MONGODB_URI")
# DB_NAME = os.getenv("DB_NAME", "DnaContentMarketplaceDB")
# COLLECTION_NAME = os.getenv("COLLECTION_NAME", "events")

# # Altre configurazioni
# POLLING_INTERVAL_SECONDS = 1500
# MAX_BLOCKS_TO_SCAN_PER_CYCLE = 100 # non lo imposto a 1000 per non saturare il free tier di Alchemy

# # BLOCCHI INIZIALI DI DEPLOY DEI CONTRATTI
# INITIAL_START_BLOCKS = {
#     NFT_CONTRACT_ADDRESS: 176973932,
#     MARKETPLACE_CONTRACT_ADDRESS: 176973973
# }

# # ********************************************************************************
# # NUOVA VARIABILE D'AMBIENTE PER OVERRIDE DEL BLOCCO DI PARTENZA
# # ********************************************************************************
# # Se impostata (es. OVERRIDE_START_BLOCK=170800000 nel .env o nella shell),
# # il listener inizierà la scansione da questo blocco, ignorando lo stato nel DB
# # e i blocchi di deploy. Utile per testare solo eventi futuri.
# # Assicurati che sia un intero.
# OVERRIDE_START_BLOCK = os.getenv("OVERRIDE_START_BLOCK")

# # ********************************************************************************
# # NUOVA CONFIGURAZIONE REDIS PER IL LISTENER IN TEMPO REALE
# # ********************************************************************************
# REDIS_URL = os.getenv("REDIS_URL")
# REDIS_CHANNEL = os.getenv("REDIS_CHANNEL", "blockchain_events") # Canale Pub/Sub su Redis





# # backend-event-listener/config.py

# import os
# from dotenv import load_dotenv

# load_dotenv() # Carica le variabili d'ambiente dal file .env

# # Configurazione Blockchain
# RPC_URL = os.getenv("ARBITRUM_SEPOLIA_RPC_URL", "https://sepolia-rollup.arbitrum.io/rpc")

# # Indirizzi dei Contratti
# NFT_CONTRACT_ADDRESS = os.getenv("SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS")
# MARKETPLACE_CONTRACT_ADDRESS = os.getenv("SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS")

# # Calcola i percorsi ABI relativamente alla posizione di questo file (config.py)
# CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# PROJECT_ROOT_DIR = os.path.join(CURRENT_DIR, os.pardir)

# NFT_ABI_PATH = os.path.join(PROJECT_ROOT_DIR, "artifacts", "contracts", "ScientificContentNFT.sol", "ScientificContentNFT.json")
# MARKETPLACE_ABI_PATH = os.path.join(PROJECT_ROOT_DIR, "artifacts", "contracts", "DnAContentMarketplace.sol", "DnAContentMarketplace.json")

# # Nomi degli eventi da monitorare
# NFT_EVENT_NAMES_TO_MONITOR = [
#     "Approval",
#     "ApprovalForAll",
#     "BaseURIUpdated",
#     "CoordinatorSet",
#     "MintingFailed",
#     "NFTMinted",
#     "OwnershipTransferRequested",
#     "OwnershipTransferred",
#     "ProtocolFeeReceiverUpdated",
#     "ProtocolFeesWithdrawn",
#     "Transfer"
# ]

# MARKETPLACE_EVENT_NAMES_TO_MONITOR = [
#     "AuctionEnded",
#     "AuctionStarted",
#     "NFTClaimed",
#     "NFTListedForSale",
#     "NFTPurchased",
#     "NFTSaleRemoved",
#     "NewBid",
#     "OwnershipTransferred",
#     "ProtocolFeeReceiverUpdated",
#     "ProtocolFeeUpdated",
#     "ProtocolFeesWithdrawn",
#     "RefundProcessed"
# ]

# # Configurazione MongoDB
# MONGODB_URI = os.getenv("MONGODB_URI")
# DB_NAME = os.getenv("DB_NAME", "DnaContentMarketplaceDB")
# COLLECTION_NAME = os.getenv("COLLECTION_NAME", "events")

# # Altre configurazioni
# POLLING_INTERVAL_SECONDS = 1500
# MAX_BLOCKS_TO_SCAN_PER_CYCLE = 100 # non lo imposto a 1000 per non saturare il free tier di Alchemy

# # BLOCCHI INIZIALI DI DEPLOY DEI CONTRATTI  
# INITIAL_START_BLOCKS = {
#     NFT_CONTRACT_ADDRESS: 176973932,
#     MARKETPLACE_CONTRACT_ADDRESS: 176973973
# }

# # ********************************************************************************
# # NUOVA VARIABILE D'AMBIENTE PER OVERRIDE DEL BLOCCO DI PARTENZA
# # ********************************************************************************
# # Se impostata (es. OVERRIDE_START_BLOCK=170800000 nel .env o nella shell),
# # il listener inizierà la scansione da questo blocco, ignorando lo stato nel DB
# # e i blocchi di deploy. Utile per testare solo eventi futuri.
# # Assicurati che sia un intero.
# OVERRIDE_START_BLOCK = os.getenv("OVERRIDE_START_BLOCK")

