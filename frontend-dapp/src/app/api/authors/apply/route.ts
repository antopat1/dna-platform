// frontend-dapp/src/app/api/authors/apply/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import AuditAuthor, { IAuditAuthor } from '../../../../models/AuditAuthor';
import { whitelistAuthorOnChain } from '@/lib/secure-wallet';

// --- SOGLIE DECISIONALI CONFIGURABILI ---
const SCORE_THRESHOLD_APPROVE = 80;
const SCORE_THRESHOLD_REJECT = 60;

// Funzione di parsing (invariata dal tuo codice originale, ma resa riutilizzabile)
const parseGeminiResponse = (rawLLMResponse: any) => {
    let llmScore = 0;
    let llmComment = 'Parsing error';
    let llmApproved = false;

    try {
        let geminiResponse;
        if (typeof rawLLMResponse === 'string') {
          const cleanedString = rawLLMResponse.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
          geminiResponse = JSON.parse(cleanedString);
        } else {
          geminiResponse = rawLLMResponse;
        }

        let textContent = '';
        const parts = geminiResponse?.candidates?.[0]?.content?.parts;
        if (parts && parts[0]?.text) {
            textContent = parts[0].text;
        } else {
            throw new Error('Struttura `candidates` non trovata o malformata');
        }

        let cleanJson = textContent.trim();
        const jsonMatch = cleanJson.match(/```(json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[2]) {
            cleanJson = jsonMatch[2].trim();
        }

        const finalData = JSON.parse(cleanJson);

        llmScore = finalData.score || 0;
        llmComment = finalData.comment || 'Nessun commento disponibile';
        llmApproved = finalData.approved || false;
        
        console.log('🎉 Parsing AI completato con successo');
        return { llmScore, llmComment, llmApproved, error: null };

    } catch (parseError: any) {
        console.error('❌ ERRORE DI PARSING AI:', parseError);
        console.error('❌ Dati grezzi che hanno causato l\'errore:', rawLLMResponse);
        return { 
            llmScore: 0, 
            llmComment: `Errore di parsing della risposta AI: ${parseError.message}`, 
            llmApproved: false,
            error: parseError.message 
        };
    }
}


export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json();
    console.log('📥 Dati ricevuti:', JSON.stringify(body, null, 2));

    const isFromMake = body.rawLLMResponse !== undefined;

    if (isFromMake) {
      // GESTISCE LA CHIAMATA DA MAKE CON I RISULTATI DELL'IA
      console.log('🤖 Chiamata da Make con risultati LLM');
      const { walletAddress, rawLLMResponse } = body;

      if (!walletAddress) {
        return NextResponse.json({ message: 'walletAddress mancante.' }, { status: 400 });
      }

      const application = await AuditAuthor.findOne({ walletAddress });
      if (!application) {
        return NextResponse.json({ message: 'Applicazione non trovata per il wallet.', debug: { walletAddress } }, { status: 404 });
      }

      // 1. Parsing della risposta di Gemini
      const { llmScore, llmComment, llmApproved } = parseGeminiResponse(rawLLMResponse);

      // 2. Logica decisionale basata sullo score
      let finalStatus: IAuditAuthor['status'] = 'PENDING';
      let backendApproved = false;
      let finalMessage = '';
      
      if (llmScore >= SCORE_THRESHOLD_APPROVE) {
        finalStatus = 'APPROVED';
        backendApproved = true;
        finalMessage = 'Candidatura approvata automaticamente.';
      } else if (llmScore < SCORE_THRESHOLD_REJECT) {
        finalStatus = 'REJECTED';
        backendApproved = false;
        finalMessage = 'Candidatura rifiutata automaticamente.';
      } else {
        finalStatus = 'REVIEW_REQUIRED';
        backendApproved = false;
        finalMessage = 'La valutazione AI richiede una revisione manuale.';
      }
      console.log(`🧠 Decisione del backend: Score=${llmScore}, Status=${finalStatus}`);

      // 3. Esecuzione del Whitelisting On-Chain se approvato
      let txHash: string | null = null;
      if (finalStatus === 'APPROVED') {
        try {
          txHash = await whitelistAuthorOnChain(walletAddress);
          finalMessage += ' L\'indirizzo è stato aggiunto alla whitelist on-chain.';
        } catch (chainError: any) {
          console.error(`❌ Fallimento del whitelisting on-chain per ${walletAddress}:`, chainError.message);
          finalStatus = 'ERROR'; // Lo stato cambia in ERRORE se il whitelisting fallisce
          finalMessage = `Candidatura approvata, ma il whitelisting on-chain è fallito: ${chainError.message}`;
        }
      }

      // 4. Aggiornamento del Database
      application.status = finalStatus;
      application.llmScore = llmScore;
      application.llmComment = llmComment;
      application.llmApproved = backendApproved; // Usiamo la decisione del backend
      application.transactionHash = txHash ?? undefined;

      const savedApplication = await application.save();
      console.log('✅ Applicazione aggiornata con successo:', savedApplication._id);

      return NextResponse.json({
        success: true,
        message: finalMessage,
        applicationId: savedApplication._id.toString(),
        llmScore,
        llmComment,
        approved: backendApproved,
        status: finalStatus,
        transactionHash: txHash,
      }, { status: 200 });

    } else {
      // GESTISCE LA CHIAMATA DAL FORM (CREAZIONE INIZIALE)
      console.log('📝 Chiamata dal form per creazione');
      // ... la logica di creazione è invariata ...
      const {
        walletAddress, name, email, institution, researchArea, biography, publicationsLink, linkedinProfile,
      } = body;
      if (!walletAddress || !name || !email || !biography) {
        return NextResponse.json({ message: 'Dati richiesti mancanti.' }, { status: 400 });
      }
      if (biography.length < 200) {
        return NextResponse.json({ message: 'La biografia deve essere di almeno 200 caratteri.' }, { status: 400 });
      }
      const existingApplication = await AuditAuthor.findOne({ walletAddress });
      if (existingApplication) {
        return NextResponse.json({ message: 'Esiste già una candidatura con questo wallet.' }, { status: 409 });
      }
      const newApplication = new AuditAuthor({
        walletAddress, name, email, institution, researchArea, biography, publicationsLink, linkedinProfile, status: 'PENDING',
      });
      const savedApplication = await newApplication.save() as IAuditAuthor;
      console.log('✅ Nuova applicazione creata:', savedApplication._id);
      
      const webhookUrl = process.env.MAKE_WEBHOOK_URL;
      if (!webhookUrl) {
        console.error('❌ MAKE_WEBHOOK_URL non configurato');
        return NextResponse.json({
          message: 'Candidatura ricevuta ma l\'automazione non è configurata.',
          applicationId: savedApplication._id.toString()
        }, { status: 201 });
      }

      try {
        console.log('🚀 Invio webhook a Make:', webhookUrl);
        const webhookPayload = {
          applicationId: savedApplication._id.toString(),
          walletAddress, name, email, institution, researchArea, biography, publicationsLink, linkedinProfile
        };
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        });
      } catch (webhookError) {
        console.error('❌ Fallimento invio webhook a Make.com:', webhookError);
      }

      return NextResponse.json({
        success: true,
        message: 'Candidatura inviata con successo. Elaborazione in corso...',
        applicationId: savedApplication._id.toString()
      }, { status: 201 });
    }

  } catch (error: any) {
    console.error('❌ Errore API /api/authors/apply:', error);
    if (error.code === 11000) {
      return NextResponse.json({ message: 'Esiste già una candidatura per questo wallet.' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Errore interno del server: ' + error.message, error: error.toString() }, { status: 500 });
  }
}




