# Usa un'immagine base Python aggiornata (Debian Bookworm per repository APT attivi)
FROM python:3.10-slim-bookworm

# Installa certificati CA per SSL (aggiunta per risolvere problemi di connessione HTTPS/SSL)
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Imposta la directory di lavoro nel container
WORKDIR /app

# Copia il backend-event-listener e installa le dipendenze
COPY backend-event-listener/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia l'intera directory backend-event-listener nella directory di lavoro /app
COPY backend-event-listener/ .

# *** NUOVA RIGA CRUCIALE: Copia la directory degli artifacts ***
# Assicurati che il percorso di origine (il primo "artifacts")
# sia corretto rispetto alla root del tuo progetto locale.
# La destinazione "/app/artifacts" è sensata se il tuo codice cerca da /app.
COPY artifacts/ /app/artifacts/

# Comando per avviare l'applicazione (come da fly.toml)
CMD ["python", "main.py"]