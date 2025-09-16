// frontend-dapp/src/app/api/ipfs-upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import FormData from 'form-data';
import { Readable } from 'stream';
import axios from 'axios';

// Configurazione per Next.js 14 App Router (sostituisce export const config)
export const runtime = 'nodejs';
export const maxDuration = 60; // Timeout in secondi per upload file

const PINATA_JWT = process.env.PINATA_JWT;

async function* webStreamToNodeStream(webStream: ReadableStream<Uint8Array>) {
    const reader = webStream.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            yield value;
        }
    } finally {
        reader.releaseLock();
    }
}

export async function POST(request: NextRequest) {
    // Controlla solo la presenza del JWT
    if (!PINATA_JWT) {
        console.error('Pinata JWT is not set in environment variables.');
        return NextResponse.json({ success: false, message: 'Server configuration error: Pinata JWT missing.' }, { status: 500 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            return NextResponse.json({ success: false, message: 'No file uploaded.' }, { status: 400 });
        }

        const pinataFormData = new FormData();
        const nodeStream = Readable.from(webStreamToNodeStream(file.stream()));
        
        pinataFormData.append('file', nodeStream, {
            filepath: file.name,
            contentType: file.type
        });

        const axiosConfig = {
            method: 'post',
            url: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
            headers: {
                'Authorization': `Bearer ${PINATA_JWT}`,
                ...pinataFormData.getHeaders()
            },
            data: pinataFormData
        };

        const response = await axios(axiosConfig);
        
        if (response.status === 200) {
            return NextResponse.json({ success: true, cid: response.data.IpfsHash });
        } else {
            console.error('Pinata API error:', response.data);
            return NextResponse.json({ success: false, message: `Pinata upload failed: ${response.data.error || 'Unknown error'}` }, { status: response.status });
        }
    } catch (error: any) {
        console.error('IPFS upload error:', error);
        return NextResponse.json({ success: false, message: `IPFS upload failed: ${error.message || 'Unknown error'}` }, { status: 500 });
    }
}

// // frontend-dapp/src/app/api/ipfs-upload/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import FormData from 'form-data';
// import { Readable } from 'stream';
// import axios from 'axios';
// // Rimuovi: import jwt from 'jsonwebtoken';

// // Rimuovi: const PINATA_API_KEY = process.env.PINATA_API_KEY;
// // Rimuovi: const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
// const PINATA_JWT = process.env.PINATA_JWT; // <-- La tua nuova variabile d'ambiente

// // Rimuovi: function generatePinataJWT() { ... }

// async function* webStreamToNodeStream(webStream: ReadableStream<Uint8Array>) {
//     const reader = webStream.getReader();
//     try {
//         while (true) {
//             const { done, value } = await reader.read();
//             if (done) break;
//             yield value;
//         }
//     } finally {
//         reader.releaseLock();
//     }
// }

// export async function POST(request: NextRequest) {
//     // Controlla solo la presenza del JWT
//     if (!PINATA_JWT) {
//         console.error('Pinata JWT is not set in environment variables.');
//         return NextResponse.json({ success: false, message: 'Server configuration error: Pinata JWT missing.' }, { status: 500 });
//     }

//     try {
//         // Non c'è bisogno di generare il JWT, lo usi direttamente
//         // Rimuovi: const pinataJWT = generatePinataJWT();

//         const formData = await request.formData();
//         const file = formData.get('file') as File;

//         if (!file) {
//             return NextResponse.json({ success: false, message: 'No file uploaded.' }, { status: 400 });
//         }

//         const pinataFormData = new FormData();
//         const nodeStream = Readable.from(webStreamToNodeStream(file.stream()));

//         pinataFormData.append('file', nodeStream, {
//             filepath: file.name,
//             contentType: file.type
//         });

//         const axiosConfig = {
//             method: 'post',
//             url: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
//             headers: {
//                 'Authorization': `Bearer ${PINATA_JWT}`, // <-- Usa il JWT pre-generato qui!
//                 ...pinataFormData.getHeaders()
//             },
//             data: pinataFormData
//         };

//         const response = await axios(axiosConfig);

//         if (response.status === 200) {
//             return NextResponse.json({ success: true, cid: response.data.IpfsHash });
//         } else {
//             console.error('Pinata API error:', response.data);
//             return NextResponse.json({ success: false, message: `Pinata upload failed: ${response.data.error || 'Unknown error'}` }, { status: response.status });
//         }

//     } catch (error: any) {
//         console.error('IPFS upload error:', error);
//         return NextResponse.json({ success: false, message: `IPFS upload failed: ${error.message || 'Unknown error'}` }, { status: 500 });
//     }
// }

// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };