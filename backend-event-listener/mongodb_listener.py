# backend-event-listener/mongodb_listener.py

import os
import logging
import json
import asyncio
from datetime import datetime
from bson.objectid import ObjectId
import sys

# **********************************************
# MODIFICA IMPORTANTE: Usiamo Motor per MongoDB asincrono
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure, OperationFailure, ConfigurationError
# **********************************************

import redis.asyncio as redis

# Importa le configurazioni dal file config.py
try:
    from config import (
        MONGODB_URI,
        DB_NAME,
        COLLECTION_NAME,
        REDIS_URL,
        REDIS_CHANNEL
    )
    logging.info("Configurazioni importate con successo da config.py.")
except ImportError as e:
    logging.critical(f"ERRORE CRITICO: Impossibile importare config.py. Assicurati che sia nel path corretto. Errore: {e}")
    sys.exit(1)
except Exception as e:
    logging.critical(f"ERRORE CRITICO: Errore durante l'importazione delle configurazioni: {e}", exc_info=True)
    sys.exit(1)

# Configurazione del logging
# Imposta a INFO per l'output in produzione, usa DEBUG per il debug
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("Logging configurato.")

async def connect_to_mongodb_changestream():
    """Connette a MongoDB Atlas e restituisce un client per Change Stream."""
    logging.info("Tentativo di connessione a MongoDB Atlas per Change Stream (con Motor)...")
    client = None
    try:
        client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        await client.admin.command('ping')
        logging.info("Connessione a MongoDB Atlas riuscita.")
        db = client.get_database(DB_NAME)
        collection = db.get_collection(COLLECTION_NAME)
        logging.info(f"Database '{DB_NAME}' e collezione '{COLLECTION_NAME}' selezionati.")
        return collection
    except ConnectionFailure as e:
        logging.critical(f"CRITICO: Impossibile connettersi a MongoDB Atlas per Change Stream. Errore: {e}", exc_info=True)
        if client: client.close()
        return None
    except OperationFailure as e:
        logging.critical(f"CRITICO: Errore di operazione MongoDB. Errore: {e}. Controlla credenziali, ruoli e che il DB sia un replica set.", exc_info=True)
        if client: client.close()
        return None
    except ConfigurationError as e:
        logging.critical(f"CRITICO: Errore di configurazione MongoDB. Spesso indica che il DB non è un replica set. Errore: {e}", exc_info=True)
        if client: client.close()
        return None
    except Exception as e:
        logging.critical(f"CRITICO: Errore generico durante la connessione a MongoDB per Change Stream. Errore: {e}", exc_info=True)
        if client: client.close()
        return None

async def connect_to_redis():
    """Connette a Redis."""
    logging.info("Tentativo di connessione a Redis...")
    r = None
    try:
        r = redis.from_url(REDIS_URL, decode_responses=True)
        await r.ping()
        logging.info("Connessione a Redis riuscita.")
        return r
    except Exception as e:
        logging.critical(f"CRITICO: Impossibile connettersi a Redis. Errore: {e}", exc_info=True)
        if r: await r.close()
        return None

async def process_change_event(change, redis_client):
    """
    Processa un evento Change Stream e pubblica i dati su Redis.
    """
    logging.debug(f"Ricevuto evento Change Stream: {change.get('operationType', 'N/A')}")
    try:
        operation_type = change.get('operationType')
        full_document = change.get('fullDocument')

        if full_document:
            # Serializzazione di ObjectId in stringa
            if '_id' in full_document and isinstance(full_document['_id'], ObjectId):
                full_document['_id'] = str(full_document['_id'])
                logging.debug(f"Convertito ObjectId a stringa per _id: {full_document['_id']}")      

            # Gestione di altri tipi non serializzabili JSON, se presenti
            for key, value in full_document.items():
                if isinstance(value, datetime):
                    full_document[key] = value.isoformat()
                elif isinstance(value, bytes):
                    try:
                        full_document[key] = value.decode('utf-8')
                    except UnicodeDecodeError:
                        full_document[key] = value.hex()

            # --- NUOVA LOGICA: DARE PRIORITÀ AL CAMPO 'event' O A 'methodName' ---
            event_name = full_document.get('event')
            if not event_name and full_document.get('source') == 'frontend_tx_status':
                event_name = full_document.get('methodName')
                logging.info(f"Usando 'methodName' come nome evento di fallback: {event_name}")
            
            if not event_name:
                event_name = 'N/A'
            # ********************************************************************

            # Costruisci l'oggetto JSON per il frontend, usando le chiavi corrette
            message = {
                "operationType": operation_type,
                "fullDocument": full_document,
                "wallClockTime": datetime.utcnow().isoformat(),
                "eventName": event_name # Aggiungi esplicitamente il nome dell'evento per il frontend
            }

            try:
                json_message = json.dumps(message)
                await redis_client.publish(REDIS_CHANNEL, json_message)

                logging.info(f"Pubblicato evento '{event_name}' su Redis Channel '{REDIS_CHANNEL}' per transazione: {full_document.get('transactionHash', 'N/A')} (ID: {full_document.get('_id', 'N/A')}).")
            except TypeError as e:
                logging.error(f"ERRORE DI SERIALIZZAZIONE JSON: Controlla i tipi di dati. Errore: {e}. Evento: {message}", exc_info=True)
            except Exception as e:
                logging.error(f"Errore durante la pubblicazione su Redis: {e}. Messaggio: {message}", exc_info=True)
        else:
            logging.warning(f"Evento Change Stream senza 'fullDocument' per operationType: {operation_type}. Evento completo: {change}")
            error_message = {
                "operationType": operation_type,
                "fullDocument": {
                    "_id": "N/A",
                    "transactionHash": "N/A",
                    "event": "FullDocumentMancante"
                },
                "wallClockTime": datetime.utcnow().isoformat(),
                "eventName": "FullDocumentMancante"
            }
            await redis_client.publish(REDIS_CHANNEL, json.dumps(error_message))

    except Exception as e:
        logging.error(f"Errore generico nel processare l'evento Change Stream: {e}. Evento: {change}", exc_info=True)


async def listen_for_db_changes():
    """Ascolta i cambiamenti nel database MongoDB e li pubblica su Redis."""
    collection = None
    redis_client = None

    while True:
        if collection is None:
            collection = await connect_to_mongodb_changestream()
            if collection is None:
                logging.error("Connessione a MongoDB fallita. Riprovo tra 10 secondi...")
                await asyncio.sleep(10)
                continue

        if redis_client is None:
            redis_client = await connect_to_redis()
            if redis_client is None:
                logging.error("Connessione a Redis fallita. Riprovo tra 10 secondi...")
                await asyncio.sleep(10)
                continue

        pipeline = [
            {
                '$match': {
                    'operationType': { '$in': ['insert', 'update'] }
                }
            }
        ]
        logging.info(f"Tentativo di avviare il Change Stream su '{DB_NAME}.{COLLECTION_NAME}'...")

        try:
            async with collection.watch(pipeline=pipeline, full_document='updateLookup') as stream:
                logging.info("Change Stream listener avviato con successo.")
                async for change in stream:
                    await process_change_event(change, redis_client)
        except (OperationFailure, ConnectionFailure, ConfigurationError) as e:
            logging.error(f"Errore di connessione/operazione Change Stream: {e}. Riprovo tra 5 secondi...", exc_info=True)
            collection = None
            await asyncio.sleep(5)
        except Exception as e:
            logging.error(f"Errore generico inatteso nel Change Stream listener: {e}. Riprovo tra 5 secondi...", exc_info=True)
            collection = None
            redis_client = None
            await asyncio.sleep(5)

async def main():
    logging.info("Avvio del processo principale listen_for_db_changes.")
    await listen_for_db_changes()

if __name__ == "__main__":
    logging.info("Script mongodb_redis_sync.py avviato.")
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("MongoDB-Redis sync listener interrotto dall'utente (KeyboardInterrupt).")        
    except Exception as e:
        logging.critical(f"ERRORE FATALE: Il MongoDB-Redis sync listener è terminato in modo inaspettato: {e}", exc_info=True)
    finally:
        logging.info("MongoDB-Redis sync listener terminato.")
