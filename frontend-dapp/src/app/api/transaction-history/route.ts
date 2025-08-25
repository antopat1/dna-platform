import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

export async function GET(request: NextRequest) {
    if (!uri) {
        return NextResponse.json({ error: 'Errore interno del server: Configurazione database mancante' }, { status: 500 });
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const database = client.db('DnaContentMarketplaceDB');
        const collection = database.collection('events');

        const { searchParams } = new URL(request.url);
        const userAddress = searchParams.get('address');
        const queryType = searchParams.get('queryType');

        if (!userAddress) {
            return NextResponse.json({ error: 'Indirizzo utente non specificato' }, { status: 400 });
        }

        const userAddressRegex = new RegExp(`^${userAddress}$`, 'i');
        let query: any = {};

        switch (queryType) {
            case 'purchases':
                query = {
                    methodName: 'purchaseNFT',
                    from: userAddressRegex
                };
                break;
            case 'minting':
                query = {
                    methodName: 'mintNFT',
                    from: userAddressRegex
                };
                break;
            case 'sales':
                query = { methodName: 'listNFTForSale', from: userAddressRegex };
                break;
            case 'auctions':
                query = {
                    $or: [
                        { event: 'AuctionStarted', 'args.seller': userAddressRegex },
                        { event: 'NewBid', 'args.bidder': userAddressRegex },
                        { event: 'AuctionEnded', 'args.winner': userAddressRegex }
                    ]
                };
                break;
            case 'transfers':
                query = {
                    methodName: 'safeTransferFrom',
                    $or: [
                        { from: userAddressRegex },
                        { to: userAddressRegex }
                    ]
                };
                break;
            case 'all':
            default:
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
                    'methodName': { '$exists': true }
                };
                break;
        }

        const events = await collection.find(query).sort({ timestamp: -1 }).limit(50).toArray();

        return NextResponse.json(events);

    } catch (error: any) {
        return NextResponse.json({ error: 'Errore interno del server: ' + error.message }, { status: 500 });
    } finally {
        await client.close();
    }
}
