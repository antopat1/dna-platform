// frontend-dapp/src/app/api/authors/status/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import AuditAuthor from '../../../../../models/AuditAuthor';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ message: 'ID applicazione mancante' }, { status: 400 });
    }

    const application = await AuditAuthor.findById(id);
    
    if (!application) {
      return NextResponse.json({ message: 'Applicazione non trovata' }, { status: 404 });
    }

    return NextResponse.json({
      applicationId: application._id.toString(),
      status: application.status,
      llmScore: application.llmScore,
      llmComment: application.llmComment,
      llmApproved: application.llmApproved,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt
    });

  } catch (error: any) {
    console.error('❌ API Error /api/authors/status:', error);
    return NextResponse.json({ 
      message: 'Errore interno del server: ' + error.message 
    }, { status: 500 });
  }
}