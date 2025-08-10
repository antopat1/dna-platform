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
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
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
        # Per sicurezza, analizziamo l'URL ma non stampiamo le credenziali
        url = urllib.parse.urlparse(REDIS_URL)
        logger.info(f"Variabile REDIS_URL trovata. Connessione a {url.hostname}:{url.port}...")
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
    """
    logger.info(f"Avvio del listener Redis...")
    while True:
        try:
            logger.info("Tentativo di connessione a Redis...")
            client = redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
            await client.ping()
            logger.info("Connessione a Redis riuscita per il listener.")

            pubsub = client.pubsub()
            await pubsub.subscribe(REDIS_CHANNEL)
            logger.info(f"Iscritto al canale Redis '{REDIS_CHANNEL}'. In attesa di messaggi...")

            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message['type'] == 'message':
                    data = message['data']
                    logger.debug(f"Ricevuto messaggio da Redis: {data}")
                    
                    # Inoltra il messaggio a tutti i client WebSocket
                    for client_ws in list(websocket_clients):
                        try:
                            await client_ws.send(data)
                            logger.debug(f"Inviato messaggio a client WebSocket.")
                        except (ConnectionClosedOK, ConnectionClosedError) as e:
                            logger.info(f"Client WebSocket disconnesso: {e.__class__.__name__}. Rimuovo il client.")
                            websocket_clients.remove(client_ws)
                        except Exception as e:
                            logger.error(f"Errore durante l'invio al client WebSocket: {e}", exc_info=True)
                            websocket_clients.remove(client_ws)
                await asyncio.sleep(0.1)
        except redis.ConnectionError as e:  # Modifica qui
            logger.critical(f"Errore di connessione a Redis nel listener: {e}. Riprovo tra 5 secondi...", exc_info=True)
            await asyncio.sleep(5)
        except Exception as e:
            logger.critical(f"Errore critico nel redis_listener: {e}", exc_info=True)
            await asyncio.sleep(5)

async def websocket_handler(websocket, path):
    """
    Gestisce le nuove connessioni WebSocket in ingresso.
    """
    logger.info(f"Nuova connessione WebSocket da: {websocket.remote_address}")
    websocket_clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
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
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server WebSocket interrotto manualmente.")
    except Exception as e:
        logger.critical(f"Errore fatale nell'applicazione: {e}", exc_info=True)