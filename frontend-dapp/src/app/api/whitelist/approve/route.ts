import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import dbConnect from '@/lib/dbConnect';
import AuditAuthor, { IAuditAuthor } from '../../../../models/AuditAuthor';

// Importa l'ABI del tuo contratto. Assicurati che il percorso sia corretto.
import ScientificContentRegistryABI from '../../../../lib/abi/ScientificContentRegistry.json';

// --- Funzione di Sicurezza ---
function verifyRequest(req: NextRequest) {
    const secret = req.headers.get('x-webhook-secret');
    return secret === process.env.MAKE_SHARED_SECRET;
}

export async function POST(req: NextRequest) {
    // 1. Sicurezza: Controlla il token segreto
    if (!verifyRequest(req)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { applicationId, llmScore, llmComment } = body;

        if (!applicationId) {
            return NextResponse.json({ message: 'Application ID mancante' }, { status: 400 });
        }

        await dbConnect();
        
        // 2. Recupera la candidatura dal DB
        const application = await AuditAuthor.findById(applicationId);

        if (!application) {
            return NextResponse.json({ message: 'Candidatura non trovata' }, { status: 404 });
        }
        if (application.status === 'APPROVED') {
            return NextResponse.json({ message: 'Autore già approvato' }, { status: 200 });
        }

        const walletAddress = application.walletAddress;

        // 3. Esegui la transazione On-Chain
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL!);
        const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY!, provider);
        const registryContract = new ethers.Contract(
            process.env.REGISTRY_CONTRACT_ADDRESS!,
            ScientificContentRegistryABI.abi,
            adminWallet
        );

        console.log(`Aggiungendo ${walletAddress} alla whitelist...`);
        const tx = await registryContract.addAuthorToWhitelist(walletAddress);
        
        // Attendi la conferma della transazione
        const receipt = await tx.wait();
        console.log(`Transazione confermata. Hash: ${receipt.hash}`);

        // 4. Aggiorna lo stato nel database
        application.status = 'APPROVED';
        application.llmScore = llmScore;
        application.llmComment = llmComment;
        await application.save();

        // TODO: Inviare email di notifica all'utente

        return NextResponse.json({ 
            message: 'Autore approvato e aggiunto alla whitelist con successo.', 
            transactionHash: receipt.hash 
        }, { status: 200 });

    } catch (error: any) {
        console.error('API Error /api/whitelist/approve:', error);
        // Potrebbe essere utile aggiornare il DB con uno stato di ERRORE
        return NextResponse.json({ message: 'Errore durante il processo di approvazione.', error: error.message }, { status: 500 });
    }
}