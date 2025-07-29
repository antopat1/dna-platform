# backend-event-listener/mongodb_redis_sync.py

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
# Imposta a DEBUG per avere un output molto più verboso
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("Logging configurato.")

# Variabili d'ambiente per il debug (opzionale, per testare)
# logging.debug(f"DEBUG_MONGODB_URI: {os.environ.get('MONGODB_URI')}")
# logging.debug(f"DEBUG_REDIS_URL: {os.environ.get('REDIS_URL')}")


async def connect_to_mongodb_changestream():
    """Connette a MongoDB Atlas e restituisce un client per Change Stream."""
    logging.info("Tentativo di connessione a MongoDB Atlas per Change Stream (con Motor)...")
    logging.debug(f"MONGODB_URI in uso: {MONGODB_URI}") # Attenzione: non loggare in produzione password!
    client = None
    try:
        # **********************************************
        # Usa AsyncIOMotorClient per connessioni asincrone
        client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        # Il ping è un'operazione asincrona in Motor
        await client.admin.command('ping')
        # **********************************************
        logging.info("Connessione a MongoDB Atlas riuscita.")
        db = client.get_database(DB_NAME)
        collection = db.get_collection(COLLECTION_NAME)
        logging.info(f"Database '{DB_NAME}' e collezione '{COLLECTION_NAME}' selezionati.")
        return collection
    except ConnectionFailure as e:
        logging.critical(f"CRITICO: Impossibile connettersi a MongoDB Atlas per Change Stream. Controlla URI, firewall, status del DB. Errore: {e}", exc_info=True)
        if client: client.close()
        return None
    except OperationFailure as e:
        # Questo errore potrebbe indicare problemi di autenticazione, permessi o configurazione del replica set.
        logging.critical(f"CRITICO: Errore di operazione MongoDB (es. autenticazione, permessi, o DB non replica set). Errore: {e}. Controlla credenziali, ruoli e che il DB sia un replica set.", exc_info=True)
        if client: client.close()
        return None
    except ConfigurationError as e:
        # Questo è specifico per i problemi di configurazione del replica set
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
    logging.debug(f"REDIS_URL in uso: {REDIS_URL}") # Attenzione: non loggare in produzione password!
    r = None
    try:
        r = redis.from_url(REDIS_URL, decode_responses=True)
        await r.ping()
        logging.info("Connessione a Redis riuscita.")
        return r
    except Exception as e:
        logging.critical(f"CRITICO: Impossibile connettersi a Redis. Controlla URL, firewall, status di Redis. Errore: {e}", exc_info=True)
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

            # Gestione di altri tipi non serializzabili JSON, se presenti (es. datetime, bytes)
            for key, value in full_document.items():
                if isinstance(value, datetime):
                    full_document[key] = value.isoformat()
                    logging.debug(f"Convertito datetime in ISO format per campo '{key}'")
                elif isinstance(value, bytes):
                    try:
                        full_document[key] = value.decode('utf-8')
                        logging.debug(f"Convertito bytes a stringa UTF-8 per campo '{key}'")
                    except UnicodeDecodeError:
                        full_document[key] = value.hex() # Se non è testo, lo converte in esadecimale
                        logging.warning(f"Impossibile decodificare bytes a UTF-8 per campo '{key}', convertito in esadecimale.")
                # Aggiungi qui altri casi se sai di avere tipi complessi (es. Decimal, UUID)

            full_document['redis_processed_at'] = datetime.utcnow().isoformat()
            message = {
                "type": operation_type,
                "data": full_document
            }

            try:
                json_message = json.dumps(message)
                await redis_client.publish(REDIS_CHANNEL, json_message)
                logging.info(f"Pubblicato '{operation_type}' evento su Redis Channel '{REDIS_CHANNEL}' per transazione: {full_document.get('transactionHash', 'N/A')} (ID: {full_document.get('_id', 'N/A')}).")
                logging.debug(f"Messaggio pubblicato: {json_message}")
            except TypeError as e:
                logging.error(f"ERRORE DI SERIALIZZAZIONE JSON: Controlla i tipi di dati nel tuo documento MongoDB. Errore: {e}. Evento: {message}", exc_info=True)
            except Exception as e:
                logging.error(f"Errore durante la pubblicazione su Redis: {e}. Messaggio: {message}", exc_info=True)
        else:
            logging.warning(f"Evento Change Stream senza 'fullDocument' per operationType: {operation_type}. Evento completo: {change}")

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
                logging.error("Connessione a MongoDB fallita o non disponibile. Riprovo tra 10 secondi...")
                await asyncio.sleep(10)
                continue

        if redis_client is None:
            redis_client = await connect_to_redis()
            if redis_client is None:
                logging.error("Connessione a Redis fallita o non disponibile. Riprovo tra 10 secondi...")
                await asyncio.sleep(10)
                continue

        pipeline = [
            {
                '$match': {
                    'operationType': { '$in': ['insert', 'update'] }
                }
            }
        ]
        logging.info(f"Tentativo di avviare il Change Stream su '{DB_NAME}.{COLLECTION_NAME}' con pipeline: {pipeline}...")

        try:
            # **********************************************
            # 'collection.watch()' di Motor restituisce un ChangeStream asincrono
            async with collection.watch(pipeline=pipeline, full_document='updateLookup') as stream:
            # **********************************************
                logging.info("Change Stream listener avviato con successo.")
                async for change in stream:
                    await process_change_event(change, redis_client)
        except (OperationFailure, ConnectionFailure, ConfigurationError) as e:
            logging.error(f"Errore di connessione/operazione Change Stream: {e}. Riprovo tra 5 secondi...", exc_info=True)
            collection = None # Forza la riconnessione a MongoDB
            await asyncio.sleep(5)
        except Exception as e:
            logging.error(f"Errore generico inatteso nel Change Stream listener: {e}. Riprovo tra 5 secondi...", exc_info=True)
            # Forza la riconnessione a entrambi per sicurezza in caso di errore non gestito
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