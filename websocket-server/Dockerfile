# websocket-server/Dockerfile
# Usa un'immagine base Python leggera
FROM python:3.9-slim-buster

# Imposta la directory di lavoro all'interno del container
WORKDIR /app

# Copia il file requirements.txt e installa le dipendenze
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia il resto del codice dell'applicazione
COPY main.py .

# Espone la porta su cui il server WebSocket ascolterà.
# Deve corrispondere a WS_PORT in main.py
EXPOSE 8080

# Comando per avviare l'applicazione quando il container viene eseguito
CMD ["python", "main.py"]