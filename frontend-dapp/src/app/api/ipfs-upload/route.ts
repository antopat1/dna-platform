// frontend-dapp/src/app/api/ipfs-upload/route.ts
import { NextResponse } from 'next/server';
import { create } from 'ipfs-http-client'; // Useremo ipfs-http-client qui sul backend
import { Readable } from 'stream'; // Per convertire il file in ReadableStream
import { Buffer } from 'buffer'; // Per la gestione dei buffer

// Re-importa questi tipi per assicurare la compatibilità con le versioni di Node.js e TypeScript
// Le versioni recenti di Node.js supportano Buffer e Readable globalmente,
// ma a volte TS richiede import espliciti o polyfills per il browser.
// Dato che questa è una API Route (Node.js environment), sono ok.

// Configura IPFS con le credenziali Pinata dalle variabili d'ambiente
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
  throw new Error('PINATA_API_KEY and PINATA_SECRET_API_KEY must be defined in .env.local');
}

// Configura l'autenticazione per Pinata
const auth = 'Basic ' + Buffer.from(`${PINATA_API_KEY}:${PINATA_SECRET_API_KEY}`).toString('base64');

// Crea l'istanza IPFS client
const ipfs = create({
  host: 'ipfs.pinata.cloud', // Host specifico per Pinata
  port: 5001, // Pinata usa 5001 per il client IPFS (se non è un gateway HTTP)
  protocol: 'https',
  headers: {
    authorization: auth,
  },
});

export async function POST(req: Request) {
  try {
    // Next.js 13+ gestisce i form data con req.formData()
    const formData = await req.formData();
    const file = formData.get('file') as File; // 'file' è il nome del campo nel form

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded.' }, { status: 400 });
    }

    // Converti il file in un ReadableStream
    const fileStream = new Readable();
    fileStream.push(Buffer.from(await file.arrayBuffer()));
    fileStream.push(null); // Segnala la fine dello stream

    // Aggiungi il file a IPFS
    const result = await ipfs.add(fileStream, {
      pin: true, // Chiedi a Pinata di pinnare il contenuto
      wrapWithDirectory: false, // Non incapsulare in una directory extra
    });

    return NextResponse.json({ success: true, cid: result.cid.toString(), path: result.path });

  } catch (error: any) {
    console.error('Error uploading to IPFS:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to upload to IPFS.' }, { status: 500 });
  }
}

// Necessario per permettere a Next.js di parsare il body come form-data
export const config = {
  api: {
    bodyParser: false, // Disabilita il body parser di Next.js per gestire il form-data manualmente
  },
};