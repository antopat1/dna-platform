import asyncio
import os
import json
import logging
import urllib.parse
import redis.asyncio as redis
import websockets
from websockets.exceptions import ConnectionClosedOK, ConnectionClosedError


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


logger.info("Lettura delle variabili d'ambiente...")
REDIS_URL = os.getenv("REDIS_URL")
if not REDIS_URL:
    logger.warning("Variabile d'ambiente REDIS_URL non trovata. Il listener Redis non sarà disponibile.")
    REDIS_ENABLED = False
else:
    REDIS_ENABLED = True
    try:
        url = urllib.parse.urlparse(REDIS_URL)
        log_host = f"{url.hostname}:{url.port}" if url.port else url.hostname
        logger.info(f"Variabile REDIS_URL trovata. Connessione a {log_host}...")
    except Exception as e:
        logger.warning(f"Impossibile analizzare REDIS_URL per il logging: {e}")
        
REDIS_CHANNEL = os.getenv("REDIS_CHANNEL", "blockchain_events")
logger.info(f"Canale Redis impostato su '{REDIS_CHANNEL}'.")


WS_PORT = int(os.getenv("PORT", 8080))
logger.info(f"Porta WebSocket impostata su {WS_PORT}.")


websocket_clients = set()

async def redis_listener():
    if not REDIS_ENABLED:
        logger.warning("Redis non configurato. Listener disabilitato.")
        
        await asyncio.Event().wait()
        return
    
    logger.info("Avvio del listener Redis...")
    redis_client = None
    pubsub = None

    while True:
        try:
            if redis_client is None:
                logger.info("Tentativo di connessione a Redis...")
                redis_client = redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
                await redis_client.ping()
                logger.info("Connessione a Redis riuscita per il listener.")

            if pubsub is None:
                pubsub = redis_client.pubsub()
                await pubsub.subscribe(REDIS_CHANNEL)
                logger.info(f"Iscritto al canale Redis '{REDIS_CHANNEL}'. In attesa di messaggi...")
            
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True) 
                
                if message and message['type'] == 'message':
                    data = message['data']
                    logger.info(f"Ricevuto messaggio da Redis: {data[:200]}...")

                    logger.info(f"Tentativo di inoltrare il messaggio. Client attivi: {len(websocket_clients)}")
                    if not websocket_clients:
                        logger.warning("Nessun client WebSocket connesso nel momento della ricezione del messaggio Redis.")
                    
                    
                    websockets.broadcast(websocket_clients, data)
                    logger.info(f"Messaggio inoltrato a {len(websocket_clients)} client.")
                
                await asyncio.sleep(0.01)

        except redis.ConnectionError as e:
            logger.error(f"Errore di connessione/comunicazione a Redis: {e}. Riprovo tra 5 secondi...", exc_info=True)
            if redis_client: 
                try: await redis_client.close()
                except Exception: pass
            redis_client = None 
            pubsub = None 
            await asyncio.sleep(5)
        except Exception as e:
            logger.error(f"Errore critico nel redis_listener: {e}. Riprovo tra 5 secondi...", exc_info=True)
            if redis_client:
                try: await redis_client.close()
                except Exception: pass
            redis_client = None 
            pubsub = None 
            await asyncio.sleep(5)

async def websocket_handler(websocket):
    
    logger.info(f"Nuova connessione WebSocket da: {websocket.remote_address}. Client attivi prima dell'aggiunta: {len(websocket_clients)}")
    websocket_clients.add(websocket)
    logger.info(f"Client {websocket.remote_address} aggiunto. Client attivi totali: {len(websocket_clients)}")
    try:
        
        await websocket.wait_closed()
    except Exception as e:
        logger.error(f"Errore nel websocket_handler per {websocket.remote_address}: {e}")
    finally:
        if websocket in websocket_clients:
            websocket_clients.remove(websocket)
            logger.info(f"Client {websocket.remote_address} rimosso. Client attivi: {len(websocket_clients)}")

async def main():
    logger.info("Avvio del WebSocket server e del listener Redis.")
    
    
    async with websockets.serve(
        websocket_handler, 
        "0.0.0.0", 
        WS_PORT, 
    ):
        logger.info(f"Server WebSocket avviato con successo su porta {WS_PORT}")
        

        redis_task = asyncio.create_task(redis_listener())
        logger.info("Task per il listener Redis creato.")
        
        await asyncio.Future()

if __name__ == "__main__":
    logger.info("Script main.py per websocket-server avviato.")
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server WebSocket interrotto manualmente.")
    except Exception as e:
        logger.critical(f"Errore fatale nell'applicazione: {e}", exc_info=True)
        exit(1)