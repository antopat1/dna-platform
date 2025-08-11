# websocket-server/main.py

import asyncio
import os
import json
import logging
import urllib.parse
import redis.asyncio as redis
import websockets
from websockets.exceptions import ConnectionClosedOK, ConnectionClosedError

# --- Configurazione Logging ---
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(), # Default a INFO, imposta a DEBUG in ENV per dettagli
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- Configurazione Redis ---
logger.info("Lettura delle variabili d'ambiente...")
REDIS_URL = os.getenv("REDIS_URL")
if not REDIS_URL:
    logger.critical("Variabile d'ambiente REDIS_URL non trovata. Impossibile avviare. L'istanza si spegnerà.")
    exit(1)
else:
    try:
        url = urllib.parse.urlparse(REDIS_URL)
        log_host = f"{url.hostname}:{url.port}" if url.port else url.hostname
        logger.info(f"Variabile REDIS_URL trovata. Connessione a {log_host}...")
    except Exception as e:
        logger.warning(f"Impossibile analizzare REDIS_URL per il logging: {e}")
        
REDIS_CHANNEL = os.getenv("REDIS_CHANNEL", "blockchain_events")
logger.info(f"Canale Redis impostato su '{REDIS_CHANNEL}'.")

# --- Configurazione WebSocket Server ---
WS_PORT = int(os.getenv("PORT", 8080))
logger.info(f"Porta WebSocket impostata su {WS_PORT}.")

# Set globale per i client WebSocket connessi
websocket_clients = set()

async def redis_listener():
    """
    Ascolta i messaggi dal canale Redis e li inoltra ai client WebSocket connessi.
    Implementa una logica di riconnessione robusta.
    """
    logger.info("Avvio del listener Redis...")
    redis_client = None
    pubsub = None

    while True: # Loop esterno per gestire la riconnessione completa di Redis
        try:
            # Tenta di connettersi o riconnettersi a Redis
            if redis_client is None:
                logger.info("Tentativo di connessione a Redis...")
                redis_client = redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
                await redis_client.ping()
                logger.info("Connessione a Redis riuscita per il listener.")

            # Tenta di sottoscriversi al canale
            if pubsub is None:
                pubsub = redis_client.pubsub()
                await pubsub.subscribe(REDIS_CHANNEL)
                logger.info(f"Iscritto al canale Redis '{REDIS_CHANNEL}'. In attesa di messaggi...")
            
            # Loop interno per leggere i messaggi dal pubsub
            while True:
                # Usa get_message senza timeout per attesa bloccante finché non c'è un messaggio
                message = await pubsub.get_message(ignore_subscribe_messages=True) 
                
                if message and message['type'] == 'message':
                    data = message['data']
                    logger.info(f"Ricevuto messaggio da Redis: {data[:200]}...") # Logga solo l'inizio

                    # *** AGGIUNTA LOG PER DEBUGGING ***
                    logger.info(f"Tentativo di inoltrare il messaggio. Client attivi: {len(websocket_clients)}")
                    if not websocket_clients:
                        logger.warning("Nessun client WebSocket connesso nel momento della ricezione del messaggio Redis.")
                    # ***********************************
                    
                    # Inoltra il messaggio a tutti i client WebSocket connessi
                    for client_ws in list(websocket_clients): # Iteriamo su una copia del set
                        try:
                            await client_ws.send(data)
                            logger.info(f"Inviato messaggio a client WebSocket: {client_ws.remote_address}") # Cambiato a INFO
                        except (ConnectionClosedOK, ConnectionClosedError) as e:
                            logger.info(f"Client WebSocket disconnesso ({e.__class__.__name__}). Rimuovo il client: {client_ws.remote_address}.")
                            # È più sicuro rimuovere solo se il client è ancora nel set
                            if client_ws in websocket_clients: 
                                websocket_clients.remove(client_ws)
                        except Exception as e:
                            logger.error(f"Errore durante l'invio al client WebSocket {client_ws.remote_address}: {e}", exc_info=True)
                            if client_ws in websocket_clients:
                                websocket_clients.remove(client_ws)
                # Non è necessario un asyncio.sleep() qui se get_message è bloccante

        except redis.ConnectionError as e:
            logger.error(f"Errore di connessione/comunicazione a Redis nel listener: {e}. Riprovo tra 5 secondi...", exc_info=True)
            if redis_client: await redis_client.close() 
            redis_client = None 
            pubsub = None 
            await asyncio.sleep(5)
        except Exception as e:
            logger.critical(f"Errore critico inatteso nel redis_listener: {e}. Riprovo tra 5 secondi...", exc_info=True)
            if redis_client: await redis_client.close() 
            redis_client = None 
            pubsub = None 
            await asyncio.sleep(5)

async def websocket_handler(websocket, path):
    """
    Gestisce le nuove connessioni WebSocket in ingresso.
    """
    logger.info(f"Nuova connessione WebSocket da: {websocket.remote_address}. Client attivi prima dell'aggiunta: {len(websocket_clients)}")
    websocket_clients.add(websocket)
    logger.info(f"Client {websocket.remote_address} aggiunto. Client attivi totali: {len(websocket_clients)}")
    try:
        await websocket.wait_closed() # Mantiene la connessione aperta
    finally:
        # Rimuove il client dal set quando la connessione si chiude
        if websocket in websocket_clients:
            websocket_clients.remove(websocket)
            logger.info(f"Client {websocket.remote_address} rimosso. Client attivi: {len(websocket_clients)}")

async def main():
    logger.info("Avvio del WebSocket server e del listener Redis.")
    
    # Avvia il server WebSocket come task
    ws_server_task = websockets.serve(websocket_handler, "0.0.0.0", WS_PORT)
    logger.info("Task per il server WebSocket creato.")
    
    # Avvia il listener Redis come task
    redis_listener_task = asyncio.create_task(redis_listener())
    logger.info("Task per il listener Redis creato.")

    # Esegui entrambi i task in parallelo
    await asyncio.gather(ws_server_task, redis_listener_task)

if __name__ == "__main__":
    logger.info("Script main.py per websocket-server avviato.")
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server WebSocket interrotto manualmente.")
    except Exception as e:
        logger.critical(f"Errore fatale nell'applicazione: {e}", exc_info=True)
