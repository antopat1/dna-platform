import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

export async function GET(request: NextRequest) {
    if (!uri) {
        console.error('SERVER_ERROR: MONGODB_URI non impostata nel file .env.local del backend. Assicurati che sia presente.');
        return NextResponse.json({ error: 'Errore interno del server: Configurazione database mancante' }, { status: 500 });
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const database = client.db('DnaContentMarketplaceDB'); // <<< VERIFICA QUESTO NOME DI DATABASE (es. 'dapp')
        const collection = database.collection('events'); // <<< VERIFICA QUESTO NOME DI COLLECTION (es. 'events')

        console.log(`\n--- API /transaction-history Request ---`);
        console.log(`  Database connected successfully.`);

        const { searchParams } = new URL(request.url);
        const userAddress = searchParams.get('address');
        const queryType = searchParams.get('queryType');

        console.log(`  Received: address=${userAddress}, queryType=${queryType}`);

        if (!userAddress) {
            console.error('[API Error] Indirizzo utente non specificato.');
            return NextResponse.json({ error: 'Indirizzo utente non specificato' }, { status: 400 });
        }

        const userAddressRegex = new RegExp(`^${userAddress}$`, 'i');
        let query: any = {};

        switch (queryType) {
            case 'purchases':
                // Acquisti: mintNFT (come acquirente iniziale) o purchaseNFT
                query = {
                    $or: [
                        { methodName: 'purchaseNFT', from: userAddressRegex },
                        { methodName: 'mintNFT', from: userAddressRegex } // Utente che avvia il mint
                    ]
                };
                console.log(`  Query Type: PURCHASES`);
                break;
            case 'sales':
                // Vendite: listNFTForSale
                query = { methodName: 'listNFTForSale', from: userAddressRegex };
                console.log(`  Query Type: SALES`);
                break;
            case 'auctions':
                // Aste: eventi specifici (potrebbero essere log raw o methodName se esistono)
                query = {
                    $or: [
                        { event: 'AuctionStarted', 'args.seller': userAddressRegex },
                        { event: 'NewBid', 'args.bidder': userAddressRegex },
                        { event: 'AuctionEnded', 'args.winner': userAddressRegex },
                        // Aggiungi qui i methodName per le aste se il tuo listener li produce
                        // es: { methodName: 'startAuction', from: userAddressRegex },
                        // es: { methodName: 'placeBid', from: userAddressRegex }
                    ]
                };
                console.log(`  Query Type: AUCTIONS`);
                break;
            case 'transfers':
                // Trasferimenti: safeTransferFrom (esclude i mint se 'from' è 0x0)
                query = {
                    methodName: 'safeTransferFrom',
                    $or: [
                        { from: userAddressRegex },
                        { to: userAddressRegex }
                    ]
                };
                console.log(`  Query Type: TRANSFERS`);
                break;
            case 'all':
            default:
                // Tutti gli eventi/metodi in cui l'indirizzo utente è coinvolto
                query = {
                    '$or': [
                        { 'from': userAddressRegex },
                        { 'to': userAddressRegex },
                        { 'args.buyer': userAddressRegex },
                        { 'args.seller': userAddressRegex },
                        { 'args.bidder': userAddressRegex },
                        { 'args.winner': userAddressRegex },
                        { 'args.from': userAddressRegex },
                        { 'args.to': userAddressRegex },
                        { 'args.owner': userAddressRegex },
                        { 'args.operator': userAddressRegex },
                        { 'args.author': userAddressRegex },
                        { 'args.newOwner': userAddressRegex },
                        { 'args.previousOwner': userAddressRegex },
                        { 'args.recipient': userAddressRegex }
                    ],
                    'methodName': { '$exists': true } // Assicurati di prendere solo i record tx_status, se è la tua fonte primaria
                };
                console.log(`  Query Type: ALL (Default)`);
                break;
        }

        console.log(`  MongoDB Query JSON: ${JSON.stringify(query, null, 2)}`);

        // Ordina per 'timestamp' che sembra essere il campo più consistente per la data di transazione nei tuoi record
        const events = await collection.find(query).sort({ timestamp: -1 }).limit(50).toArray();

        console.log(`  Found ${events.length} events.`);
        console.log(`--- End API /transaction-history Request ---\n`);

        return NextResponse.json(events);

    } catch (error: any) {
        console.error(`[API Error] Database operation failed: ${error.message}`);
        return NextResponse.json({ error: 'Errore interno del server: ' + error.message }, { status: 500 });
    } finally {
        await client.close();
    }
}