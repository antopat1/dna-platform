import logging

# Configurazione iniziale del logging (sincrono, prima di qualsiasi import)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
logger.info("Script main.py avviato. Importazioni in corso...")

# Ora procedi con gli import, testandoli uno per uno
try:
    import asyncio
    import json
    import os
    from datetime import datetime
    from web3 import Web3
    from web3.middleware import ExtraDataToPOAMiddleware
    from pymongo import MongoClient, errors as pymongo_errors
    logger.info("Import di base completati con successo.")
except Exception as e:
    logger.error(f"Errore negli import di base: {e}")
    raise

try:
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
        OVERRIDE_START_BLOCK
    )
    logger.info("Config importato con successo.")
except Exception as e:
    logger.error(f"Errore import config.py: {e}")
    raise

try:
    # Assicurati che questo import sia corretto come da ultima discussione (senza backend_event_listener)
    from mongodb_listener import listen_for_db_changes
    logger.info("mongodb_listener importato con successo.")
except Exception as e:
    logger.error(f"Errore import mongodb_listener: {e}")
    raise

# --- Funzioni di supporto ---
def load_abi(filepath):
    """Carica un ABI da un file JSON."""
    logger.info(f"Tentativo di caricare ABI da: {filepath}")
    try:
        if not os.path.exists(filepath):
            logger.error(f"File ABI non trovato nel percorso specificato: {filepath}. Assicurati che il file esista nell'immagine Docker.")
            raise FileNotFoundError(f"ABI file not found: {filepath}")
        
        with open(filepath, 'r') as f:
            content = json.load(f)
            if 'abi' in content:
                logger.info(f"ABI caricato con successo dal campo 'abi' in: {filepath}")
                return content['abi']
            else:
                logger.info(f"ABI caricato con successo direttamente da: {filepath}")
                return content
    except FileNotFoundError:
        logger.error(f"File ABI non trovato: {filepath}.")
        raise
    except json.JSONDecodeError as e:
        logger.error(f"Errore di decodifica JSON nel file ABI: {filepath}. Dettagli: {e}")
        raise
    except Exception as e:
        logger.error(f"Errore inatteso durante il caricamento dell'ABI da {filepath}: {e}")
        raise

def connect_to_blockchain():
    """Connette a una nodeline blockchain."""
    logger.info(f"Tentativo di connessione alla blockchain tramite RPC_URL: {RPC_URL}")
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        if not w3.is_connected():
            logger.error("Impossibile connettersi alla blockchain. Controlla il tuo RPC_URL.")
            return None
        current_block = w3.eth.block_number
        logger.info(f"Connesso alla blockchain: {RPC_URL}. Blocco corrente: {current_block}")
        return w3
    except Exception as e:
        logger.error(f"Errore durante la connessione alla blockchain: {e}")
        return None

def connect_to_mongodb_for_blockchain_events(): # Rinominata per chiarezza
    """Connette a MongoDB Atlas e crea l'indice unico per gli eventi blockchain."""
    logger.info(f"Tentativo di connessione a MongoDB Atlas per eventi blockchain. URI: {MONGODB_URI}")
    try:
        client = MongoClient(MONGODB_URI)
        client.admin.command('ping')
        logger.info("Connesso a MongoDB Atlas per eventi blockchain.")
        db = client.get_database(DB_NAME)
        collection = db.get_collection(COLLECTION_NAME)

        logger.info(f"Verifica/Creazione indice unico 'unique_event_log' sulla collection '{COLLECTION_NAME}' nel DB '{DB_NAME}'.")
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
            logger.info("Indice unico 'unique_event_log' creato o già esistente.")
        except Exception as e:
            logger.error(f"Errore nella creazione dell'indice unico: {e}. I duplicati potrebbero non essere gestiti correttamente.")

        return collection
    except pymongo_errors.ConnectionFailure as e:
        logger.critical(f"CRITICO: Impossibile connettersi a MongoDB Atlas per eventi blockchain: {e}. Controlla MONGODB_URI e accesso al DB.")
        return None
    except Exception as e:
        logger.critical(f"CRITICO: Errore generico durante la connessione a MongoDB per eventi blockchain: {e}")
        return None

def get_last_processed_block(db_collection, contract_addresses):
    """
    Recupera l'ultimo blocco processato dal database o determina il blocco iniziale.
    Priorità: OVERRIDE_START_BLOCK (env var) > last_processed_block (DB) > INITIAL_START_BLOCKS (config).
    """
    logger.info("Tentativo di determinare l'ultimo blocco processato.")
    if OVERRIDE_START_BLOCK is not None:
        try:
            override_block = int(OVERRIDE_START_BLOCK)
            logger.warning(f"OVERRIDE_START_BLOCK='{OVERRIDE_START_BLOCK}' rilevato. "
                            f"Inizio scansione forzata dal blocco {override_block}.")
            logger.warning("ATTENZIONE: Gli eventi storici precedenti a questo blocco NON verranno processati. "
                            "Rimuovi la variabile OVERRIDE_START_BLOCK per il comportamento normale.")
            return override_block
        except ValueError:
            logger.error(f"Valore non valido per OVERRIDE_START_BLOCK: '{OVERRIDE_START_BLOCK}'. "
                            "IGNORATO. Procedo con la logica normale.")

    try:
        last_block_doc = db_collection.find_one({"_id": "last_processed_block"})
        if last_block_doc and 'block_number' in last_block_doc:
            logger.info(f"Ultimo blocco processato trovato nel DB: {last_block_doc['block_number']}")
            return last_block_doc['block_number']
        
        logger.info("Nessun ultimo blocco processato trovato nel DB. Determino il blocco iniziale dalle configurazioni o recente.")

        min_deploy_block = float('inf')
        for address in contract_addresses:
            if address in INITIAL_START_BLOCKS:
                min_deploy_block = min(min_deploy_block, INITIAL_START_BLOCKS[address])
            else:
                logger.warning(f"Blocco di deploy non specificato in INITIAL_START_BLOCKS per il contratto: {address}. Questo contratto potrebbe non essere scansionato dall'inizio.")
        
        if min_deploy_block == float('inf'):
            # Fallback se non ci sono blocchi di deploy configurati
            try:
                # Tentiamo di connetterci di nuovo per ottenere il blocco corrente, nel caso la 'w3' passata non sia aggiornata o sia None
                temp_w3 = connect_to_blockchain() 
                if temp_w3:
                    current_chain_block = temp_w3.eth.block_number
                    initial_block_fallback = max(0, current_chain_block - 100)
                    logger.warning(f"Nessun blocco di deploy configurato per i contratti e nessun blocco salvato. Inizio la scansione da un blocco recente: {initial_block_fallback} (attuale: {current_chain_block}).")
                    return initial_block_fallback
                else:
                    logger.error("Impossibile connettersi alla blockchain per ottenere il blocco corrente. Fallback a 0.")
                    return 0 # Ultima spiaggia
            except Exception as e:
                logger.error(f"Errore nel recupero del blocco corrente per fallback: {e}. Fallback a 0.")
                return 0 # Ultima spiaggia
            
        logger.info(f"Inizio scansione dal blocco di deploy più antico configurato: {min_deploy_block}")
        return min_deploy_block

    except Exception as e:
        logger.error(f"Errore nel recupero dell'ultimo blocco processato da MongoDB o nel determinare il blocco iniziale: {e}. Uso un blocco iniziale prudente (attuale_chain_block - 100).")
        # Tentiamo di ottenere il blocco corrente in caso di errore generico qui
        try:
            temp_w3 = connect_to_blockchain() 
            if temp_w3:
                current_chain_block = temp_w3.eth.block_number
                return max(0, current_chain_block - 100)
            else:
                return 0
        except Exception:
            return 0


def save_last_processed_block(db_collection, block_number):
    """Salva l'ultimo blocco processato nel database."""
    try:
        db_collection.update_one(
            {"_id": "last_processed_block"},
            {"$set": {"block_number": block_number, "timestamp": datetime.utcnow()}},
            upsert=True
        )
        # logging.debug(f"Ultimo blocco processato salvato: {block_number}") # Troppo verboso per INFO, decommenta per DEBUG
    except Exception as e:
        logger.error(f"Errore nel salvataggio dell'ultimo blocco processato in MongoDB: {e}")

async def handle_event(event, db_collection):
    """Processa un singolo evento e lo salva nel database."""
    logger.info(f"Evento rilevato: {event.event} nel blocco {event.blockNumber} (tx: {event.transactionHash.hex()}).")
    event_data = dict(event)
    event_data['args'] = dict(event.args) if hasattr(event.args, '__dict__') else event.args
    event_data['blockNumber'] = event.blockNumber
    event_data['transactionHash'] = event.transactionHash.hex()
    event_data['logIndex'] = event.logIndex

    try:
        event_data['timestamp_processed'] = datetime.utcnow()
        db_collection.insert_one(event_data)
        logger.info(f"Evento {event.event} dal blocco {event.blockNumber} (tx: {event.transactionHash.hex()}) salvato nel database.")
    except pymongo_errors.DuplicateKeyError:
        logger.warning(f"Evento duplicato rilevato e ignorato: {event.event} dal blocco {event.blockNumber} (tx: {event.transactionHash.hex()}).")
    except Exception as e:
        logger.error(f"Errore nel salvataggio dell'evento nel database: {e}")

async def scan_for_blockchain_events(w3, db_collection, nft_contract, marketplace_contract):
    """Scansiona la blockchain per nuovi eventi e li salva."""
    
    contract_addresses_to_monitor = [NFT_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS]
    last_block_processed = get_last_processed_block(db_collection, contract_addresses_to_monitor)
    
    logger.info(f"Inizio ciclo di scansione blockchain. Ultimo blocco processato inizialmente: {last_block_processed}")

    while True:
        try:
            current_block = w3.eth.block_number
            if current_block is None:
                logger.error("Impossibile recuperare il numero del blocco corrente dalla blockchain. Riprovo...")
                await asyncio.sleep(POLLING_INTERVAL_SECONDS)
                continue

            target_block_for_this_cycle = min(current_block, last_block_processed + MAX_BLOCKS_TO_SCAN_PER_CYCLE)

            if target_block_for_this_cycle > last_block_processed:
                logger.info(f"Scansione blocchi da {last_block_processed + 1} a {target_block_for_this_cycle}. Blocchi rimanenti per mettersi al passo: {current_block - target_block_for_this_cycle}")
                for block_num in range(last_block_processed + 1, target_block_for_this_cycle + 1):
                    logger.info(f"Processing block: {block_num}")
                    try:
                        # Ottieni gli eventi dal contratto NFT
                        for event_name in NFT_EVENT_NAMES_TO_MONITOR:
                            logger.debug(f"Tentativo di ottenere eventi '{event_name}' del contratto NFT per blocco {block_num}")
                            try:
                                events = nft_contract.events[event_name].get_logs(
                                    from_block=block_num,
                                    to_block=block_num
                                )
                                for event in events:
                                    await handle_event(event, db_collection)
                            except Exception as e:
                                logger.error(f"Errore nel recupero eventi '{event_name}' del contratto NFT per il blocco {block_num}: {e}")

                        # Ottieni gli eventi dal contratto Marketplace
                        for event_name in MARKETPLACE_EVENT_NAMES_TO_MONITOR:
                            logger.debug(f"Tentativo di ottenere eventi '{event_name}' del contratto Marketplace per blocco {block_num}")
                            try:
                                events = marketplace_contract.events[event_name].get_logs(
                                    from_block=block_num,
                                    to_block=block_num
                                )
                                for event in events:
                                    await handle_event(event, db_collection)
                            except Exception as e:
                                logger.error(f"Errore nel recupero eventi '{event_name}' del contratto Marketplace per il blocco {block_num}: {e}")

                        save_last_processed_block(db_collection, block_num)
                        last_block_processed = block_num
                        logger.debug(f"Terminato processing blocco {block_num}. Nuovo last_block_processed: {last_block_processed}")

                    except Exception as e:
                        logger.error(f"Errore durante la scansione del blocco {block_num}: {e}. Riproverò al prossimo ciclo.")
                        break # Esci dal loop interno per ritentare il ciclo principale dopo il sleep

            else:
                logger.info(f"Nessun nuovo blocco da processare al momento. Blocco attuale: {current_block}. Ultimo processato: {last_block_processed}.")

        except Exception as e:
            logger.error(f"Errore generale nel loop di scansione della blockchain: {e}")

        logger.info(f"Pausa di {POLLING_INTERVAL_SECONDS} secondi prima della prossima scansione.")
        await asyncio.sleep(POLLING_INTERVAL_SECONDS)

async def main():
    logger.info("Avvio dell'applicazione principale: Event DNA Platform Listener.")
    
    # Debugging: Stampa i valori delle variabili d'ambiente e config importanti
    logger.info(f"Configurazione RPC_URL: {RPC_URL}")
    logger.info(f"Configurazione MONGODB_URI (prime 20 char): {MONGODB_URI[:20]}...")
    logger.info(f"Configurazione DB_NAME: {DB_NAME}, COLLECTION_NAME: {COLLECTION_NAME}")
    logger.info(f"Configurazione NFT_CONTRACT_ADDRESS: {NFT_CONTRACT_ADDRESS}")
    logger.info(f"Configurazione MARKETPLACE_CONTRACT_ADDRESS: {MARKETPLACE_CONTRACT_ADDRESS}")
    logger.info(f"Configurazione NFT_ABI_PATH: {NFT_ABI_PATH}")
    logger.info(f"Configurazione MARKETPLACE_ABI_PATH: {MARKETPLACE_ABI_PATH}")
    logger.info(f"Configurazione POLLING_INTERVAL_SECONDS: {POLLING_INTERVAL_SECONDS}")
    logger.info(f"Configurazione MAX_BLOCKS_TO_SCAN_PER_CYCLE: {MAX_BLOCKS_TO_SCAN_PER_CYCLE}")
    logger.info(f"Configurazione OVERRIDE_START_BLOCK: {OVERRIDE_START_BLOCK}")

    # Inizializza sempre il listener di MongoDB Change Stream
    # Questo è il "listener veloce" che vuoi sempre attivo
    logger.info("Tentativo di avviare il listener MongoDB Change Stream (mongodb_listener.py).")
    mongo_change_stream_task = asyncio.create_task(listen_for_db_changes())
    logger.info("Listener MongoDB Change Stream avviato.")

    # Controlla la variabile d'ambiente per attivare il listener blockchain
    enable_blockchain_listener = os.getenv("ENABLE_BLOCKCHAIN_LISTENER", "0")
    logger.info(f"Valore di ENABLE_BLOCKCHAIN_LISTENER: '{enable_blockchain_listener}'.")
    
    blockchain_task = None
    if enable_blockchain_listener == "1":
        logger.info("ENABLE_BLOCKCHAIN_LISTENER è '1'. Preparo l'avvio del listener blockchain.")
        
        w3 = connect_to_blockchain()
        if w3 is None:
            logger.critical("Impossibile connettersi alla blockchain. Il listener blockchain non sarà attivo. Verificare RPC_URL.")
        else:
            db_collection = connect_to_mongodb_for_blockchain_events()
            if db_collection is None:
                logger.critical("Impossibile connettersi a MongoDB per eventi blockchain. Il listener blockchain non sarà attivo. Verificare MONGODB_URI.")
            else:
                if not NFT_CONTRACT_ADDRESS or not MARKETPLACE_CONTRACT_ADDRESS:
                    logger.error("Indirizzi contratto NFT o Marketplace mancanti. Il listener blockchain non sarà attivo.")
                else:
                    logger.info("Indirizzi contratto NFT e Marketplace presenti. Procedo con il caricamento degli ABI.")
                    nft_abi = None
                    marketplace_abi = None
                    try:
                        nft_abi = load_abi(NFT_ABI_PATH)
                        marketplace_abi = load_abi(MARKETPLACE_ABI_PATH)
                    except (FileNotFoundError, json.JSONDecodeError, Exception) as e:
                        logger.critical(f"Errore critico durante il caricamento degli ABI: {e}. Il listener blockchain non sarà attivo.")

                    if not nft_abi or not marketplace_abi:
                        logger.critical("Uno o entrambi gli ABI non sono stati caricati correttamente. Il listener blockchain non sarà attivo.")
                    else:
                        try:
                            nft_contract = w3.eth.contract(address=Web3.to_checksum_address(NFT_CONTRACT_ADDRESS), abi=nft_abi)
                            marketplace_contract = w3.eth.contract(address=Web3.to_checksum_address(MARKETPLACE_CONTRACT_ADDRESS), abi=marketplace_abi)
                            blockchain_task = asyncio.create_task(scan_for_blockchain_events(w3, db_collection, nft_contract, marketplace_contract))
                            logger.info("Listener blockchain avviato con successo.")
                        except Exception as e:
                            logger.critical(f"Errore nella creazione dell'istanza del contratto o avvio listener blockchain: {e}. Il listener blockchain non sarà attivo.")
    else:
        logger.info("ENABLE_BLOCKCHAIN_LISTENER non è '1' o non è impostato. Il listener blockchain non sarà avviato.")


    # Attendi che tutti i task attivi vengano completati
    tasks_to_run = [task for task in [mongo_change_stream_task, blockchain_task] if task is not None]
    
    if not tasks_to_run:
        logger.critical("Nessun listener è stato avviato. L'applicazione non farà nulla e uscirà.")
        return

    logger.info(f"Avviati {len(tasks_to_run)} task principali. L'applicazione è ora in attesa.")
    await asyncio.gather(*tasks_to_run)


if __name__ == "__main__":
    try:
        logger.info("Prima di asyncio.run(main())...")
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Applicazione interrotta dall'utente.")
    except Exception as e:
        logger.critical(f"Errore fatale nell'applicazione principale: {e}", exc_info=True)









# backend-event-listener\main.py

# from web3 import Web3
# from web3.middleware import ExtraDataToPOAMiddleware
# import logging
# import json
# from pymongo import MongoClient, errors as pymongo_errors
# import asyncio
# import time
# from datetime import datetime
# import os

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
#     INITIAL_START_BLOCKS,
#     MAX_BLOCKS_TO_SCAN_PER_CYCLE,
#     OVERRIDE_START_BLOCK # <--- Importa la nuova variabile
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
#     """Connette a MongoDB Atlas e crea l'indice unico."""
#     try:
#         client = MongoClient(MONGODB_URI)
#         client.admin.command('ping')
#         logging.info("Connesso a MongoDB Atlas.")
#         db = client.get_database(DB_NAME)
#         collection = db.get_collection(COLLECTION_NAME)

#         try:
#             collection.create_index(
#                 [
#                     ("blockNumber", 1),
#                     ("transactionHash", 1),
#                     ("logIndex", 1)
#                 ],
#                 unique=True,
#                 name="unique_event_log"
#             )
#             logging.info("Indice unico 'unique_event_log' creato o già esistente sulla collection 'events'.")
#         except Exception as e:
#             logging.error(f"Errore nella creazione dell'indice unico: {e}. I duplicati potrebbero non essere gestiti correttamente.")

#         return collection
#     except pymongo_errors.ConnectionFailure as e:
#         logging.error(f"Impossibile connettersi a MongoDB Atlas: {e}")
#         return None
#     except Exception as e:
#         logging.error(f"Errore generico durante la connessione a MongoDB: {e}")
#         return None

# def get_last_processed_block(db_collection, contract_addresses):
#     """
#     Recupera l'ultimo blocco processato dal database o determina il blocco iniziale.
#     Priorità: OVERRIDE_START_BLOCK (env var) > last_processed_block (DB) > INITIAL_START_BLOCKS (config).
#     """
#     # 1. Controlla OVERRIDE_START_BLOCK (massima priorità)
#     if OVERRIDE_START_BLOCK is not None:
#         try:
#             override_block = int(OVERRIDE_START_BLOCK)
#             logging.warning(f"OVERRIDE_START_BLOCK='{OVERRIDE_START_BLOCK}' rilevato. "
#                             f"Inizio scansione forzata dal blocco {override_block}.")
#             logging.warning("ATTENZIONE: Gli eventi storici precedenti a questo blocco NON verranno processati. "
#                             "Rimuovi la variabile OVERRIDE_START_BLOCK per il comportamento normale.")
#             return override_block
#         except ValueError:
#             logging.error(f"Valore non valido per OVERRIDE_START_BLOCK: '{OVERRIDE_START_BLOCK}'. "
#                           "IGNORATO. Procedo con la logica normale.")

#     # 2. Controlla last_processed_block nel database (priorità media)
#     try:
#         last_block_doc = db_collection.find_one({"_id": "last_processed_block"})
#         if last_block_doc and 'block_number' in last_block_doc:
#             logging.info(f"Ultimo blocco processato trovato nel DB: {last_block_doc['block_number']}")
#             return last_block_doc['block_number']
        
#         logging.info("Nessun ultimo blocco processato trovato nel DB.")

#         # 3. Fallback a INITIAL_START_BLOCKS (minima priorità)
#         min_deploy_block = float('inf')
#         for address in contract_addresses:
#             if address in INITIAL_START_BLOCKS:
#                 min_deploy_block = min(min_deploy_block, INITIAL_START_BLOCKS[address])
#             else:
#                 logging.warning(f"Blocco di deploy non specificato in INITIAL_START_BLOCKS per il contratto: {address}. Questo contratto potrebbe non essere scansionato dall'inizio.")
        
#         if min_deploy_block == float('inf'):
#             # Fallback generale se nessun blocco di deploy è configurato
#             current_chain_block = Web3(Web3.HTTPProvider(RPC_URL)).eth.block_number
#             initial_block_fallback = max(0, current_chain_block - 100) # Parte 100 blocchi indietro dal corrente
#             logging.warning(f"Nessun blocco di deploy configurato per i contratti. Inizio la scansione da un blocco recente: {initial_block_fallback}")
#             return initial_block_fallback
        
#         logging.info(f"Inizio scansione dal blocco di deploy più antico configurato: {min_deploy_block}")
#         return min_deploy_block

#     except Exception as e:
#         logging.error(f"Errore nel recupero dell'ultimo blocco processato da MongoDB o nel determinare il blocco iniziale: {e}. Uso un blocco iniziale prudente.")
#         current_chain_block = Web3(Web3.HTTPProvider(RPC_URL)).eth.block_number
#         return max(0, current_chain_block - 100) # Fallback generale

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
    
#     contract_addresses_to_monitor = [NFT_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS]
#     last_block_processed = get_last_processed_block(db_collection, contract_addresses_to_monitor)

#     while True:
#         try:
#             current_block = w3.eth.block_number
#             if current_block is None:
#                 logging.error("Impossibile recuperare il numero del blocco corrente. Riprovo...")
#                 await asyncio.sleep(POLLING_INTERVAL_SECONDS)
#                 continue

#             target_block_for_this_cycle = min(current_block, last_block_processed + MAX_BLOCKS_TO_SCAN_PER_CYCLE)

#             if target_block_for_this_cycle > last_block_processed:
#                 logging.info(f"Scansione blocchi da {last_block_processed + 1} a {target_block_for_this_cycle}")
#                 for block_num in range(last_block_processed + 1, target_block_for_this_cycle + 1):
#                     logging.info(f"Processing block: {block_num}")
#                     try:
#                         # Ottieni gli eventi dal contratto NFT
#                         for event_name in NFT_EVENT_NAMES_TO_MONITOR:
#                             try:
#                                 events = nft_contract.events[event_name].get_logs(
#                                     from_block=block_num,
#                                     to_block=block_num
#                                 )
#                                 for event in events:
#                                     await handle_event(event, db_collection)
#                             except Exception as e:
#                                 logging.error(f"Errore nel recupero eventi '{event_name}' del contratto NFT per il blocco {block_num}: {e}")

#                         # Ottieni gli eventi dal contratto Marketplace
#                         for event_name in MARKETPLACE_EVENT_NAMES_TO_MONITOR:
#                             try:
#                                 events = marketplace_contract.events[event_name].get_logs(
#                                     from_block=block_num,
#                                     to_block=block_num
#                                 )
#                                 for event in events:
#                                     await handle_event(event, db_collection)
#                             except Exception as e:
#                                 logging.error(f"Errore nel recupero eventi '{event_name}' del contratto Marketplace per il blocco {block_num}: {e}")

#                         # Salva il blocco processato solo se non stiamo overrideando (per non salvare uno stato intermedio inutile)
#                         # Nota: Se OVERRIDE_START_BLOCK è settato, il primo salvataggio nel DB sarà il blocco iniziale forzato,
#                         # e poi continuerà a salvare normalmente. Questo è il comportamento desiderato.
#                         save_last_processed_block(db_collection, block_num)
#                         last_block_processed = block_num

#                     except Exception as e:
#                         logging.error(f"Errore durante la scansione del blocco {block_num}: {e}. Riproverò al prossimo ciclo.")
#                         break

#             else:
#                 logging.info(f"Nessun nuovo blocco da processare al momento. Blocco attuale: {current_block}. Ultimo processato: {last_block_processed}.")

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
#         logging.error("NFT_CONTRACT_ADDRESS non trovato nel file .env o config.py.")
#         return
#     if not MARKETPLACE_CONTRACT_ADDRESS:
#         logging.error("MARKETPLACE_CONTRACT_ADDRESS non trovato nel file .env o config.py.")
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


