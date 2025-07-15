// frontend-dapp/src/app/api/transactions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb'; // Importa ObjectId

// Carica le variabili d'ambiente
const MONGODB_URI = process.env.MONGODB_URI;

const TARGET_DB_NAME = "DnaContentMarketplaceDB"; // Nome esatto del DB desiderato dal frontend
const TARGET_COLLECTION_NAME = "events"; // Nome esatto della Collection desiderata dal frontend

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in .env.local');
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// Inizializza il client MongoDB globalmente per riutilizzare la connessione
let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

async function connectToMongo() {
    if (clientPromise) {
        return clientPromise;
    }

    client = new MongoClient(MONGODB_URI!, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });

    clientPromise = client.connect();
    try {
        const connectedClient = await clientPromise;
        console.log("Connected to MongoDB from Next.js API.");

        const db = connectedClient.db(TARGET_DB_NAME);
        const collection = db.collection(TARGET_COLLECTION_NAME);

        // *****************************************************************
        // INDICE UNICO PER GLI EVENTI
        // Fondamentale per evitare duplicati e per l'upsert degli eventi.
        // *****************************************************************
        try {
            await collection.createIndex(
                { transactionHash: 1, logIndex: 1, event: 1 },
                { unique: true, name: "unique_event_tx_log_event" }
            );
            console.log(`Unique index 'unique_event_tx_log_event' created or already exists on '${TARGET_COLLECTION_NAME}' collection.`);
        } catch (e: any) {
            // Un warning è sufficiente qui, se l'indice esiste già è OK.
            console.warn(`Warning: Could not create unique index for frontend API. May be already created by backend or another instance: ${e?.message}`);
        }

        return connectedClient;
    } catch (error) {
        client = null;
        clientPromise = null;
        throw error;
    }
}

export async function POST(req: NextRequest) {
    try {
        const {
            transactionHash,
            from,
            to,
            value,
            gasPrice,
            gasUsed,
            blockNumber,
            timestamp,
            methodName,
            contractName,
            chainId,
            status,
            errorMessage,
            // ATTENZIONE: Questi campi `args`, `logIndex`, `transactionIndex`, `blockHash`
            // arrivano direttamente se `status === "event_minted"`
            args, // Contiene gli argomenti decodificati dell'evento
            logIndex, // Indice del log all'interno della transazione
            transactionIndex, // Indice della transazione nel blocco
            blockHash, // Hash del blocco
            metadata // Metadati aggiuntivi del frontend, come `source`
        } = await req.json();

        if (!transactionHash || !from || !to || value === undefined || !chainId || !status) {
            return NextResponse.json({ error: 'Missing required transaction fields' }, { status: 400 });
        }

        const mongoClient = await connectToMongo();
        const db = mongoClient.db(TARGET_DB_NAME);
        const collection = db.collection(TARGET_COLLECTION_NAME);

        let recordToSave: any;
        let filterQuery: any;

        // *****************************************************************
        // LOGICA PER UNIFORMARE LA STRUTTURA DEI RECORD DEGLI EVENTI
        // *****************************************************************
        if (status === "event_minted") {
            // Questo è un record di un EVENTO decodificato dal frontend.
            // Lo vogliamo salvare con una struttura simile a quella del Python.

            // Dobbiamo assicurarci che 'args' contenga il campo 'event'.
            // Il frontend invia `args: { event: "NFTMinted", ...otherArgs }`
            const eventName = args?.event || "UnknownEvent"; // Prende il nome dell'evento da args
            const eventLogIndex = logIndex !== undefined ? parseInt(logIndex) : null;
            const eventTransactionIndex = transactionIndex !== undefined ? parseInt(transactionIndex) : null;
            const eventBlockHash = blockHash || null;
            const eventAddress = to; // L'indirizzo del contratto che ha emesso l'evento è 'to'

            // Costruiamo il record esattamente come quello Python
            recordToSave = {
                // _id sarà generato automaticamente da MongoDB se non specificato.
                // Usiamo un filtro per `updateOne` che farà l'upsert basandosi su `transactionHash` e `logIndex`
                // per garantire l'unicità degli eventi.
                args: {
                    // I singoli parametri dell'evento (es. tokenId, contentId, owner)
                    // sono direttamente nell'oggetto `args` inviato dal frontend.
                    // Assicurati che i BigInt siano stati convertiti in stringhe nel frontend
                    // e convertili in tipi numerici qui se necessario (es. parseInt).
                    ...args, // Copia tutti i campi che il frontend ha messo in `args`
                    // Esegui la conversione a numero per i BigInt se necessario
                    tokenId: args?.tokenId ? parseInt(args.tokenId) : undefined,
                    contentId: args?.contentId ? parseInt(args.contentId) : undefined,
                    copyNumber: args?.copyNumber ? parseInt(args.copyNumber) : undefined,
                },
                event: eventName, // "NFTMinted", "Transfer", ecc.
                logIndex: eventLogIndex,
                transactionIndex: eventTransactionIndex,
                transactionHash: transactionHash,
                address: eventAddress, // Indirizzo del contratto che ha emesso l'evento
                blockHash: eventBlockHash,
                blockNumber: blockNumber ? parseInt(blockNumber) : null,
                timestamp_processed: new Date(timestamp || Date.now()), // Usa il timestamp del frontend o corrente
                // Aggiungi un campo `source` per identificare l'origine del record
                source: metadata?.source || 'frontend_event_decoded',
            };

            // Il filtro per gli eventi deve basarsi sui campi che garantiscono l'unicità
            filterQuery = {
                transactionHash: transactionHash,
                logIndex: recordToSave.logIndex,
                event: recordToSave.event,
            };

            // Assicurati che logIndex non sia null, altrimenti l'indice unico fallirà
            if (recordToSave.logIndex === null) {
                console.warn("Event_minted received with null logIndex. Cannot use unique index. Using transactionHash for fallback filter.");
                // Fallback a un filtro meno specifico se logIndex è mancante (non dovrebbe accadere)
                filterQuery = {
                    transactionHash: transactionHash,
                    'metadata.status': "event_minted_fallback" // Cerca il record di fallback
                };
                // Modifica il record per riflettere il fallback status
                recordToSave.status = "event_minted_fallback";
                recordToSave.errorMessage = "Missing logIndex, saved as fallback.";
                recordToSave.metadata = { // Sposta i metadati passati dal frontend qui
                    ...metadata,
                    originalArgs: args, // Salva gli args originali per debug
                    source: 'frontend_event_status_fallback_no_logIndex',
                };
            }

        } else {
            // *****************************************************************
            // Per le transazioni di STATO (pending, success, failed, etc.)
            // Mantieni questi record distinti dagli eventi puri.
            // *****************************************************************
            const transactionRecordId = `${transactionHash}_frontend_tx_status`; // ID per le transazioni di stato

            recordToSave = {
                _id: transactionRecordId,
                transactionHash,
                from,
                to,
                value: value,
                gasPrice: gasPrice || null,
                gasUsed: gasUsed || null,
                blockNumber: blockNumber || null,
                timestamp: timestamp || new Date().toISOString(),
                methodName: methodName || null,
                contractName: contractName || null,
                chainId,
                status: status,
                errorMessage: errorMessage || null,
                // Metadati specifici del frontend per il tracciamento dello stato della transazione
                metadata_frontend_tx: metadata || {},
                source: 'frontend_tx_status',
                createdAt: new Date().toISOString()
            };
            filterQuery = { _id: transactionRecordId as string };
        }

        // Utilizza updateOne con upsert: true per inserire o aggiornare
        const result = await collection.updateOne(
            filterQuery,
            { $set: recordToSave },
            { upsert: true }
        );

        console.log(`Record for transaction ${transactionHash} (status: ${status}) saved/updated.`, result.upsertedId || result.modifiedCount);

        return NextResponse.json({ message: 'Transaction data saved successfully', transactionHash, status }, { status: 200 });

    } catch (error) {
        console.error('Error saving transaction data from frontend:', error);
        return NextResponse.json({ error: 'Failed to save transaction data', details: (error as Error).message }, { status: 500 });
    }
}
