from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
import logging
import json
from pymongo import MongoClient, errors as pymongo_errors
import asyncio
import time
from datetime import datetime
import os

# Importa le configurazioni dal file config.py
from config import (
    RPC_URL,
    NFT_CONTRACT_ADDRESS,
    MARKETPLACE_CONTRACT_ADDRESS,
    NFT_ABI_PATH,
    MARKETPLACE_ABI_PATH,
    NFT_EVENT_NAMES_TO_MONITOR,
    MARKETPLACE_EVENT_NAMES_TO_MONITOR,
    MONGODB_URI,
    DB_NAME,
    COLLECTION_NAME,
    POLLING_INTERVAL_SECONDS,
    INITIAL_START_BLOCKS,
    MAX_BLOCKS_TO_SCAN_PER_CYCLE,
    OVERRIDE_START_BLOCK # <--- Importa la nuova variabile
)

# Configurazione del logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def load_abi(filepath):
    """Carica un ABI da un file JSON."""
    try:
        with open(filepath, 'r') as f:
            content = json.load(f)
            if 'abi' in content:
                return content['abi']
            else:
                return content
    except FileNotFoundError:
        logging.error(f"File ABI non trovato: {filepath}. Assicurati che il percorso sia corretto.")
        raise FileNotFoundError(f"ABI file not found: {filepath}")
    except json.JSONDecodeError:
        logging.error(f"Errore di decodifica JSON nel file ABI: {filepath}.")
        raise json.JSONDecodeError(f"Error decoding ABI JSON: {filepath}", f.read(), 0)

def connect_to_blockchain():
    """Connette a una nodeline blockchain."""
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        if not w3.is_connected():
            logging.error("Impossibile connettersi alla blockchain. Controlla il tuo RPC_URL.")
            return None
        logging.info(f"Connesso alla blockchain: {RPC_URL}")
        return w3
    except Exception as e:
        logging.error(f"Errore durante la connessione alla blockchain: {e}")
        return None

def connect_to_mongodb():
    """Connette a MongoDB Atlas e crea l'indice unico."""
    try:
        client = MongoClient(MONGODB_URI)
        client.admin.command('ping')
        logging.info("Connesso a MongoDB Atlas.")
        db = client.get_database(DB_NAME)
        collection = db.get_collection(COLLECTION_NAME)

        try:
            collection.create_index(
                [
                    ("blockNumber", 1),
                    ("transactionHash", 1),
                    ("logIndex", 1)
                ],
                unique=True,
                name="unique_event_log"
            )
            logging.info("Indice unico 'unique_event_log' creato o già esistente sulla collection 'events'.")
        except Exception as e:
            logging.error(f"Errore nella creazione dell'indice unico: {e}. I duplicati potrebbero non essere gestiti correttamente.")

        return collection
    except pymongo_errors.ConnectionFailure as e:
        logging.error(f"Impossibile connettersi a MongoDB Atlas: {e}")
        return None
    except Exception as e:
        logging.error(f"Errore generico durante la connessione a MongoDB: {e}")
        return None

def get_last_processed_block(db_collection, contract_addresses):
    """
    Recupera l'ultimo blocco processato dal database o determina il blocco iniziale.
    Priorità: OVERRIDE_START_BLOCK (env var) > last_processed_block (DB) > INITIAL_START_BLOCKS (config).
    """
    # 1. Controlla OVERRIDE_START_BLOCK (massima priorità)
    if OVERRIDE_START_BLOCK is not None:
        try:
            override_block = int(OVERRIDE_START_BLOCK)
            logging.warning(f"OVERRIDE_START_BLOCK='{OVERRIDE_START_BLOCK}' rilevato. "
                            f"Inizio scansione forzata dal blocco {override_block}.")
            logging.warning("ATTENZIONE: Gli eventi storici precedenti a questo blocco NON verranno processati. "
                            "Rimuovi la variabile OVERRIDE_START_BLOCK per il comportamento normale.")
            return override_block
        except ValueError:
            logging.error(f"Valore non valido per OVERRIDE_START_BLOCK: '{OVERRIDE_START_BLOCK}'. "
                          "IGNORATO. Procedo con la logica normale.")

    # 2. Controlla last_processed_block nel database (priorità media)
    try:
        last_block_doc = db_collection.find_one({"_id": "last_processed_block"})
        if last_block_doc and 'block_number' in last_block_doc:
            logging.info(f"Ultimo blocco processato trovato nel DB: {last_block_doc['block_number']}")
            return last_block_doc['block_number']
        
        logging.info("Nessun ultimo blocco processato trovato nel DB.")

        # 3. Fallback a INITIAL_START_BLOCKS (minima priorità)
        min_deploy_block = float('inf')
        for address in contract_addresses:
            if address in INITIAL_START_BLOCKS:
                min_deploy_block = min(min_deploy_block, INITIAL_START_BLOCKS[address])
            else:
                logging.warning(f"Blocco di deploy non specificato in INITIAL_START_BLOCKS per il contratto: {address}. Questo contratto potrebbe non essere scansionato dall'inizio.")
        
        if min_deploy_block == float('inf'):
            # Fallback generale se nessun blocco di deploy è configurato
            current_chain_block = Web3(Web3.HTTPProvider(RPC_URL)).eth.block_number
            initial_block_fallback = max(0, current_chain_block - 100) # Parte 100 blocchi indietro dal corrente
            logging.warning(f"Nessun blocco di deploy configurato per i contratti. Inizio la scansione da un blocco recente: {initial_block_fallback}")
            return initial_block_fallback
        
        logging.info(f"Inizio scansione dal blocco di deploy più antico configurato: {min_deploy_block}")
        return min_deploy_block

    except Exception as e:
        logging.error(f"Errore nel recupero dell'ultimo blocco processato da MongoDB o nel determinare il blocco iniziale: {e}. Uso un blocco iniziale prudente.")
        current_chain_block = Web3(Web3.HTTPProvider(RPC_URL)).eth.block_number
        return max(0, current_chain_block - 100) # Fallback generale

def save_last_processed_block(db_collection, block_number):
    """Salva l'ultimo blocco processato nel database."""
    try:
        db_collection.update_one(
            {"_id": "last_processed_block"},
            {"$set": {"block_number": block_number, "timestamp": datetime.utcnow()}},
            upsert=True
        )
    except Exception as e:
        logging.error(f"Errore nel salvataggio dell'ultimo blocco processato in MongoDB: {e}")

async def handle_event(event, db_collection):
    """Processa un singolo evento e lo salva nel database."""
    logging.info(f"Evento rilevato: {event.event} nel blocco {event.blockNumber}")
    event_data = dict(event)
    event_data['args'] = dict(event.args) if hasattr(event.args, '__dict__') else event.args
    event_data['blockNumber'] = event.blockNumber
    event_data['transactionHash'] = event.transactionHash.hex()
    event_data['logIndex'] = event.logIndex

    try:
        event_data['timestamp_processed'] = datetime.utcnow()
        db_collection.insert_one(event_data)
        logging.info(f"Evento {event.event} dal blocco {event.blockNumber} (tx: {event.transactionHash.hex()}) salvato nel database.")
    except pymongo_errors.DuplicateKeyError:
        logging.warning(f"Evento duplicato rilevato e ignorato: {event.event} dal blocco {event.blockNumber} (tx: {event.transactionHash.hex()}).")
    except Exception as e:
        logging.error(f"Errore nel salvataggio dell'evento nel database: {e}")

async def scan_for_events(w3, db_collection, nft_contract, marketplace_contract):
    """Scansiona la blockchain per nuovi eventi e li salva."""
    
    contract_addresses_to_monitor = [NFT_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS]
    last_block_processed = get_last_processed_block(db_collection, contract_addresses_to_monitor)

    while True:
        try:
            current_block = w3.eth.block_number
            if current_block is None:
                logging.error("Impossibile recuperare il numero del blocco corrente. Riprovo...")
                await asyncio.sleep(POLLING_INTERVAL_SECONDS)
                continue

            target_block_for_this_cycle = min(current_block, last_block_processed + MAX_BLOCKS_TO_SCAN_PER_CYCLE)

            if target_block_for_this_cycle > last_block_processed:
                logging.info(f"Scansione blocchi da {last_block_processed + 1} a {target_block_for_this_cycle}")
                for block_num in range(last_block_processed + 1, target_block_for_this_cycle + 1):
                    logging.info(f"Processing block: {block_num}")
                    try:
                        # Ottieni gli eventi dal contratto NFT
                        for event_name in NFT_EVENT_NAMES_TO_MONITOR:
                            try:
                                events = nft_contract.events[event_name].get_logs(
                                    from_block=block_num,
                                    to_block=block_num
                                )
                                for event in events:
                                    await handle_event(event, db_collection)
                            except Exception as e:
                                logging.error(f"Errore nel recupero eventi '{event_name}' del contratto NFT per il blocco {block_num}: {e}")

                        # Ottieni gli eventi dal contratto Marketplace
                        for event_name in MARKETPLACE_EVENT_NAMES_TO_MONITOR:
                            try:
                                events = marketplace_contract.events[event_name].get_logs(
                                    from_block=block_num,
                                    to_block=block_num
                                )
                                for event in events:
                                    await handle_event(event, db_collection)
                            except Exception as e:
                                logging.error(f"Errore nel recupero eventi '{event_name}' del contratto Marketplace per il blocco {block_num}: {e}")

                        # Salva il blocco processato solo se non stiamo overrideando (per non salvare uno stato intermedio inutile)
                        # Nota: Se OVERRIDE_START_BLOCK è settato, il primo salvataggio nel DB sarà il blocco iniziale forzato,
                        # e poi continuerà a salvare normalmente. Questo è il comportamento desiderato.
                        save_last_processed_block(db_collection, block_num)
                        last_block_processed = block_num

                    except Exception as e:
                        logging.error(f"Errore durante la scansione del blocco {block_num}: {e}. Riproverò al prossimo ciclo.")
                        break

            else:
                logging.info(f"Nessun nuovo blocco da processare al momento. Blocco attuale: {current_block}. Ultimo processato: {last_block_processed}.")

        except Exception as e:
            logging.error(f"Errore generale nel loop di scansione: {e}")

        await asyncio.sleep(POLLING_INTERVAL_SECONDS)

async def main():
    w3 = connect_to_blockchain()
    if w3 is None:
        logging.critical("Impossibile connettersi alla blockchain. Uscita.")
        return

    db_collection = connect_to_mongodb()
    if db_collection is None:
        logging.critical("Impossibile connettersi a MongoDB. Uscita.")
        return

    if not NFT_CONTRACT_ADDRESS:
        logging.error("NFT_CONTRACT_ADDRESS non trovato nel file .env o config.py.")
        return
    if not MARKETPLACE_CONTRACT_ADDRESS:
        logging.error("MARKETPLACE_CONTRACT_ADDRESS non trovato nel file .env o config.py.")
        return

    logging.info(f"Indirizzo NFT: {NFT_CONTRACT_ADDRESS}")
    logging.info(f"Indirizzo Marketplace: {MARKETPLACE_CONTRACT_ADDRESS}")

    nft_abi = None
    marketplace_abi = None
    try:
        nft_abi = load_abi(NFT_ABI_PATH)
        marketplace_abi = load_abi(MARKETPLACE_ABI_PATH)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logging.critical(f"Errore critico durante il caricamento degli ABI: {e}. Uscita.")
        return

    if not nft_abi or not marketplace_abi:
        logging.critical("Uno o entrambi gli ABI non sono stati caricati correttamente. Uscita.")
        return

    try:
        nft_contract = w3.eth.contract(address=Web3.to_checksum_address(NFT_CONTRACT_ADDRESS), abi=nft_abi)
        marketplace_contract = w3.eth.contract(address=Web3.to_checksum_address(MARKETPLACE_CONTRACT_ADDRESS), abi=marketplace_abi)
    except Exception as e:
        logging.critical(f"Errore nella creazione dell'istanza del contratto: {e}")
        return

    await scan_for_events(w3, db_collection, nft_contract, marketplace_contract)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Listener interrotto dall'utente.")
    except Exception as e:
        logging.critical(f"Errore fatale nell'applicazione principale: {e}")



# # backend-event-listener/main.py

# from web3 import Web3
# from web3.middleware import ExtraDataToPOAMiddleware
# import logging
# import json
# from pymongo import MongoClient, errors as pymongo_errors
# import asyncio
# import time
# from datetime import datetime

# # Importa le configurazioni dal file config.py
# from config import (
#     RPC_URL,
#     NFT_CONTRACT_ADDRESS,
#     MARKETPLACE_CONTRACT_ADDRESS,
#     NFT_ABI_PATH,
#     MARKETPLACE_ABI_PATH,
#     NFT_EVENT_NAMES_TO_MONITOR,
#     MARKETPLACE_EVENT_NAMES_TO_MONITOR,
#     MONGODB_URI,
#     DB_NAME,
#     COLLECTION_NAME,
#     POLLING_INTERVAL_SECONDS,
#     INITIAL_START_BLOCK
# )

# # Configurazione del logging
# logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# def load_abi(filepath):
#     """Carica un ABI da un file JSON."""
#     try:
#         with open(filepath, 'r') as f:
#             content = json.load(f)
#             if 'abi' in content:
#                 return content['abi']
#             else:
#                 return content
#     except FileNotFoundError:
#         logging.error(f"File ABI non trovato: {filepath}. Assicurati che il percorso sia corretto.")
#         raise FileNotFoundError(f"ABI file not found: {filepath}")
#     except json.JSONDecodeError:
#         logging.error(f"Errore di decodifica JSON nel file ABI: {filepath}.")
#         raise json.JSONDecodeError(f"Error decoding ABI JSON: {filepath}", f.read(), 0)

# def connect_to_blockchain():
#     """Connette a una nodeline blockchain."""
#     try:
#         w3 = Web3(Web3.HTTPProvider(RPC_URL))
#         w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

#         if not w3.is_connected():
#             logging.error("Impossibile connettersi alla blockchain. Controlla il tuo RPC_URL.")
#             return None
#         logging.info(f"Connesso alla blockchain: {RPC_URL}")
#         return w3
#     except Exception as e:
#         logging.error(f"Errore durante la connessione alla blockchain: {e}")
#         return None

# def connect_to_mongodb():
#     """Connette a MongoDB Atlas."""
#     try:
#         client = MongoClient(MONGODB_URI)
#         client.admin.command('ping')
#         logging.info("Connesso a MongoDB Atlas.")
#         return client.get_database(DB_NAME).get_collection(COLLECTION_NAME)
#     except pymongo_errors.ConnectionFailure as e:
#         logging.error(f"Impossibile connettersi a MongoDB Atlas: {e}")
#         return None
#     except Exception as e:
#         logging.error(f"Errore generico durante la connessione a MongoDB: {e}")
#         return None

# def get_last_processed_block(db_collection):
#     """Recupera l'ultimo blocco processato dal database."""
#     try:
#         last_block_doc = db_collection.find_one({"_id": "last_processed_block"})
#         if last_block_doc and 'block_number' in last_block_doc:
#             logging.info(f"Ultimo blocco processato trovato nel DB: {last_block_doc['block_number']}")
#             return last_block_doc['block_number']
#         logging.info(f"Nessun ultimo blocco processato trovato nel DB. Inizio da INITIAL_START_BLOCK: {INITIAL_START_BLOCK}")
#         return INITIAL_START_BLOCK
#     except Exception as e:
#         logging.error(f"Errore nel recupero dell'ultimo blocco processato da MongoDB: {e}. Uso INITIAL_START_BLOCK.")
#         return INITIAL_START_BLOCK

# def save_last_processed_block(db_collection, block_number):
#     """Salva l'ultimo blocco processato nel database."""
#     try:
#         db_collection.update_one(
#             {"_id": "last_processed_block"},
#             {"$set": {"block_number": block_number, "timestamp": datetime.utcnow()}},
#             upsert=True
#         )
#     except Exception as e:
#         logging.error(f"Errore nel salvataggio dell'ultimo blocco processato in MongoDB: {e}")

# async def handle_event(event, db_collection):
#     """Processa un singolo evento e lo salva nel database."""
#     logging.info(f"Evento rilevato: {event.event} nel blocco {event.blockNumber}")
#     event_data = dict(event)
#     event_data['args'] = dict(event.args) if hasattr(event.args, '__dict__') else event.args
#     event_data['blockNumber'] = event.blockNumber
#     event_data['transactionHash'] = event.transactionHash.hex()
#     event_data['logIndex'] = event.logIndex

#     try:
#         event_data['timestamp_processed'] = datetime.utcnow()
#         db_collection.insert_one(event_data)
#         logging.info(f"Evento {event.event} dal blocco {event.blockNumber} (tx: {event.transactionHash.hex()}) salvato nel database.")
#     except pymongo_errors.DuplicateKeyError:
#         logging.warning(f"Evento duplicato rilevato e ignorato: {event.event} dal blocco {event.blockNumber} (tx: {event.transactionHash.hex()}).")
#     except Exception as e:
#         logging.error(f"Errore nel salvataggio dell'evento nel database: {e}")

# async def scan_for_events(w3, db_collection, nft_contract, marketplace_contract):
#     """Scansiona la blockchain per nuovi eventi e li salva."""
#     last_block_processed = get_last_processed_block(db_collection)

#     while True:
#         try:
#             current_block = w3.eth.block_number
#             if current_block is None:
#                 logging.error("Impossibile recuperare il numero del blocco corrente. Riprovo...")
#                 await asyncio.sleep(POLLING_INTERVAL_SECONDS)
#                 continue

#             if current_block > last_block_processed:
#                 logging.info(f"Scansione blocchi da {last_block_processed + 1} a {current_block}")
#                 for block_num in range(last_block_processed + 1, current_block + 1):
#                     logging.info(f"Processing block: {block_num}")
#                     try:
#                         # ***************************************************************
#                         # CORREZIONE FINALE QUI: Usa from_block e to_block (con underscore)
#                         # ***************************************************************

#                         # Ottieni gli eventi dal contratto NFT
#                         for event_name in NFT_EVENT_NAMES_TO_MONITOR:
#                             try:
#                                 events = nft_contract.events[event_name].get_logs(
#                                     from_block=block_num, # Corretto
#                                     to_block=block_num    # Corretto
#                                 )
#                                 for event in events:
#                                     await handle_event(event, db_collection)
#                             except Exception as e:
#                                 logging.error(f"Errore nel recupero eventi '{event_name}' del contratto NFT per il blocco {block_num}: {e}")

#                         # Ottieni gli eventi dal contratto Marketplace
#                         for event_name in MARKETPLACE_EVENT_NAMES_TO_MONITOR:
#                             try:
#                                 events = marketplace_contract.events[event_name].get_logs(
#                                     from_block=block_num, # Corretto
#                                     to_block=block_num    # Corretto
#                                 )
#                                 for event in events:
#                                     await handle_event(event, db_collection)
#                             except Exception as e:
#                                 logging.error(f"Errore nel recupero eventi '{event_name}' del contratto Marketplace per il blocco {block_num}: {e}")

#                         save_last_processed_block(db_collection, block_num)
#                         last_block_processed = block_num

#                     except Exception as e:
#                         logging.error(f"Errore durante la scansione del blocco {block_num}: {e}")
#             else:
#                 logging.info(f"Nessun nuovo blocco da processare. Blocco attuale: {current_block}. Ultimo processato: {last_block_processed}.")

#         except Exception as e:
#             logging.error(f"Errore generale nel loop di scansione: {e}")

#         await asyncio.sleep(POLLING_INTERVAL_SECONDS)

# async def main():
#     w3 = connect_to_blockchain()
#     if w3 is None:
#         logging.critical("Impossibile connettersi alla blockchain. Uscita.")
#         return

#     db_collection = connect_to_mongodb()
#     if db_collection is None:
#         logging.critical("Impossibile connettersi a MongoDB. Uscita.")
#         return

#     if not NFT_CONTRACT_ADDRESS:
#         logging.error("SCIENTIFIC_CONTENT_NFT_CONTRACT_ADDRESS non trovato nel file .env o config.py.")
#         return
#     if not MARKETPLACE_CONTRACT_ADDRESS:
#         logging.error("SCIENTIFIC_CONTENT_MARKETPLACE_CONTRACT_ADDRESS non trovato nel file .env o config.py.")
#         return

#     logging.info(f"Indirizzo NFT: {NFT_CONTRACT_ADDRESS}")
#     logging.info(f"Indirizzo Marketplace: {MARKETPLACE_CONTRACT_ADDRESS}")

#     nft_abi = None
#     marketplace_abi = None
#     try:
#         nft_abi = load_abi(NFT_ABI_PATH)
#         marketplace_abi = load_abi(MARKETPLACE_ABI_PATH)
#     except (FileNotFoundError, json.JSONDecodeError) as e:
#         logging.critical(f"Errore critico durante il caricamento degli ABI: {e}. Uscita.")
#         return

#     if not nft_abi or not marketplace_abi:
#         logging.critical("Uno o entrambi gli ABI non sono stati caricati correttamente. Uscita.")
#         return

#     try:
#         nft_contract = w3.eth.contract(address=Web3.to_checksum_address(NFT_CONTRACT_ADDRESS), abi=nft_abi)
#         marketplace_contract = w3.eth.contract(address=Web3.to_checksum_address(MARKETPLACE_CONTRACT_ADDRESS), abi=marketplace_abi)
#     except Exception as e:
#         logging.critical(f"Errore nella creazione dell'istanza del contratto: {e}")
#         return

#     await scan_for_events(w3, db_collection, nft_contract, marketplace_contract)


# if __name__ == "__main__":
#     try:
#         asyncio.run(main())
#     except KeyboardInterrupt:
#         logging.info("Listener interrotto dall'utente.")
#     except Exception as e:
#         logging.critical(f"Errore fatale nell'applicazione principale: {e}")

