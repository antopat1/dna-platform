// frontend-dapp/src/app/api/events/history/route.ts

import { MongoClient } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';

// ===================================================================
// SOLUZIONE: Dice a Next.js di non provare a rendere questa route statica.
// Questa route deve essere sempre eseguita on-demand sul server.
export const dynamic = 'force-dynamic';
// ===================================================================

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = "DnaContentMarketplaceDB";

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

let cachedClient: MongoClient | null = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }
  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  cachedClient = client;
  return client;
}

export async function GET(request: NextRequest) {
  try {
    const client = await connectToDatabase();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection('events');
    

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    // Filtra gli eventi per includere solo quelli che hanno un 'event' o 'methodName'
    // e escludere i record di sistema come 'last_processed_block' o simili.
    const events = await collection
      .find({
        $or: [
          { event: { $exists: true } },
          { methodName: { $exists: true } }
        ]
      })
      // Ordina per blockNumber e logIndex per garantire un ordine cronologico corretto
      .sort({ blockNumber: -1, logIndex: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(events);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch event history' }, { status: 500 });
  }
}
