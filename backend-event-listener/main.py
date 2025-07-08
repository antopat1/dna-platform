from web3 import Web3
from pymongo import MongoClient
import asyncio
import json
import logging
from hexbytes import HexBytes

from config import (
    MONGO_DB_URI, ARBITRUM_SEPOLIA_RPC_URL,
    SCIENTIFIC_CONTENT_NFT_ADDRESS, SCIENTIFIC_CONTENT_NFT_ABI,
    SCIENTIFIC_CONTENT_REGISTRY_ADDRESS, SCIENTIFIC_CONTENT_REGISTRY_ABI,
    SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS, SCIENTIFIC_CONTENT_MARKETPLACE_ABI
)

# Configura il logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Connessione a Web3
w3 = Web3(Web3.HTTPProvider(ARBITRUM_SEPOLIA_RPC_URL))

if not w3.is_connected():
    logging.error("Impossibile connettersi alla blockchain. Controlla l'URL RPC.")
    exit()
else:
    logging.info(f"Connesso alla blockchain: {ARBITRUM_SEPOLIA_RPC_URL}")
    logging.info(f"Block attuale: {w3.eth.block_number}")

# Connessione a MongoDB
try:
    client = MongoClient(MONGO_DB_URI)
    db = client.scientific_content_dapp # Nome del tuo database
    logging.info("Connesso a MongoDB Atlas.")
except Exception as e:
    logging.error(f"Errore di connessione a MongoDB: {e}")
    exit()

# Ottieni le istanze dei contratti
nft_contract = w3.eth.contract(address=Web3.to_checksum_address(SCIENTIFIC_CONTENT_NFT_ADDRESS), abi=SCIENTIFIC_CONTENT_NFT_ABI)
registry_contract = w3.eth.contract(address=Web3.to_checksum_address(SCIENTIFIC_CONTENT_REGISTRY_ADDRESS), abi=SCIENTIFIC_CONTENT_REGISTRY_ABI)
marketplace_contract = w3.eth.contract(address=Web3.to_checksum_address(SCIENTIFIC_CONTENT_MARKETPLACE_ADDRESS), abi=SCIENTIFIC_CONTENT_MARKETPLACE_ABI)

# Funzione helper per serializzare HexBytes a stringa
def decode_hexbytes(obj):
    if isinstance(obj, HexBytes):
        return obj.hex()
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

# --- Gestori di Eventi ---

async def handle_nft_minted_event(event):
    event_data = dict(event)
    event_data["args"] = dict(event_data["args"]) # Convertire le attribuzioni di args in un dict
    event_data['transactionHash'] = event_data['transactionHash'].hex()
    event_data['blockHash'] = event_data['blockHash'].hex()

    logging.info(f"NFT Minted Event: {event_data['args']}")
    try:
        db.nft_mint_events.insert_one(event_data)
        logging.info(f"Evento ScientificContentNFTMinted salvato per tokenId: {event_data['args']['tokenId']}")
    except Exception as e:
        logging.error(f"Errore salvataggio evento NFT Minted: {e}")

async def handle_content_registered_event(event):
    event_data = dict(event)
    event_data["args"] = dict(event_data["args"])
    event_data['transactionHash'] = event_data['transactionHash'].hex()
    event_data['blockHash'] = event_data['blockHash'].hex()

    logging.info(f"Content Registered Event: {event_data['args']}")
    try:
        db.content_registry_events.insert_one(event_data)
        logging.info(f"Evento ContentRegistered salvato per contentId: {event_data['args']['contentId']}")
    except Exception as e:
        logging.error(f"Errore salvataggio evento Content Registered: {e}")

async def handle_nft_listed_event(event):
    event_data = dict(event)
    event_data["args"] = dict(event_data["args"])
    event_data['transactionHash'] = event_data['transactionHash'].hex()
    event_data['blockHash'] = event_data['blockHash'].hex()
    event_data['args']['price'] = str(event_data['args']['price']) # Convertire BigInt a stringa

    logging.info(f"NFT Listed Event: {event_data['args']}")
    try:
        db.marketplace_events.insert_one(event_data)
        logging.info(f"Evento NFTListed salvato per listingId: {event_data['args']['listingId']}")
    except Exception as e:
        logging.error(f"Errore salvataggio evento NFT Listed: {e}")

async def handle_nft_sold_event(event):
    event_data = dict(event)
    event_data["args"] = dict(event_data["args"])
    event_data['transactionHash'] = event_data['transactionHash'].hex()
    event_data['blockHash'] = event_data['blockHash'].hex()
    event_data['args']['price'] = str(event_data['args']['price']) # Convertire BigInt a stringa

    logging.info(f"NFT Sold Event: {event_data['args']}")
    try:
        db.marketplace_events.insert_one(event_data)
        logging.info(f"Evento NFTSold salvato per listingId: {event_data['args']['listingId']}")
    except Exception as e:
        logging.error(f"Errore salvataggio evento NFT Sold: {e}")

async def handle_nft_listing_cancelled_event(event):
    event_data = dict(event)
    event_data["args"] = dict(event_data["args"])
    event_data['transactionHash'] = event_data['transactionHash'].hex()
    event_data['blockHash'] = event_data['blockHash'].hex()

    logging.info(f"NFT Listing Cancelled Event: {event_data['args']}")
    try:
        db.marketplace_events.insert_one(event_data)
        logging.info(f"Evento NFTListingCancelled salvato per listingId: {event_data['args']['listingId']}")
    except Exception as e:
        logging.error(f"Errore salvataggio evento NFT Listing Cancelled: {e}")

async def log_loop(event_filter, polling_interval, event_handler_func):
    logging.info(f"In ascolto per eventi da {event_filter.address}...")
    while True:
        try:
            for event in event_filter.get_new_entries():
                await event_handler_func(event)
            await asyncio.sleep(polling_interval)
        except Exception as e:
            logging.error(f"Errore nel loop di ascolto per {event_filter.address}: {e}")
            await asyncio.sleep(polling_interval * 2) # Aumenta l'intervallo in caso di errore

def main():
    # Creazione dei filtri per gli eventi
    # NOTA: Assicurati che i nomi degli eventi qui corrispondano esattamente a quelli nei tuoi ABI
    nft_minted_filter = nft_contract.events.ScientificContentNFTMinted.create_filter(fromBlock='latest')
    content_registered_filter = registry_contract.events.ContentRegistered.create_filter(fromBlock='latest')
    nft_listed_filter = marketplace_contract.events.NFTListed.create_filter(fromBlock='latest')
    nft_sold_filter = marketplace_contract.events.NFTSold.create_filter(fromBlock='latest')
    nft_listing_cancelled_filter = marketplace_contract.events.NFTListingCancelled.create_filter(fromBlock='latest')

    # Crea un loop di eventi asyncio e avvia i listener
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(
            asyncio.gather(
                log_loop(nft_minted_filter, 2, handle_nft_minted_event),
                log_loop(content_registered_filter, 2, handle_content_registered_event),
                log_loop(nft_listed_filter, 2, handle_nft_listed_event),
                log_loop(nft_sold_filter, 2, handle_nft_sold_event),
                log_loop(nft_listing_cancelled_filter, 2, handle_nft_listing_cancelled_event),
            )
        )
    except KeyboardInterrupt:
        logging.info("Interruzione del programma da tastiera.")
    finally:
        loop.close()
        client.close()
        logging.info("Connessione a MongoDB chiusa. Programma terminato.")

if __name__ == "__main__":
    main()