// frontend-dapp/src/app/api/admin/templates/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import NftTemplateDefinition from '@/models/NftTemplateDefinition';

// Handler per GET (recupera tutti i template)
export async function GET() {
  await dbConnect();
  try {
    const templates = await NftTemplateDefinition.find({});
    return NextResponse.json({ success: true, data: templates });
  } catch (error: any) {
    console.error('Error fetching NFT templates:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}

// Handler per POST (crea un nuovo template)
export async function POST(req: Request) {
  await dbConnect();
  try {
    const body = await req.json();
    const template = await NftTemplateDefinition.create(body);
    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating NFT template:', error);
    // MongoDB duplicate key error code is 11000
    if (error.code === 11000) {
      return NextResponse.json({ success: false, message: 'Template name already exists.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}