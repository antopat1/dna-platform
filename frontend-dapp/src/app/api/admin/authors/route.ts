// frontend-dapp/src/app/api/admin/authors/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import WhitelistedAuthorEOA from '@/models/WhitelistedAuthorEOA';
import { isAddress } from 'viem'; // Per validare l'indirizzo

// Handler per GET (recupera tutti gli autori)
export async function GET() {
  await dbConnect();
  try {
    const authors = await WhitelistedAuthorEOA.find({});
    return NextResponse.json({ success: true, data: authors });
  } catch (error: any) {
    console.error('Error fetching whitelisted authors:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}

// Handler per POST (aggiunge un nuovo autore)
export async function POST(req: Request) {
  await dbConnect();
  try {
    const body = await req.json();
    const { address, name, email } = body;

    if (!address || !isAddress(address)) {
      return NextResponse.json({ success: false, message: 'Invalid or missing Ethereum address.' }, { status: 400 });
    }
    if (!name) {
        return NextResponse.json({ success: false, message: 'Author name is required.' }, { status: 400 });
    }

    const author = await WhitelistedAuthorEOA.create({ address: address.toLowerCase(), name, email });
    return NextResponse.json({ success: true, data: author }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding whitelisted author:', error);
    if (error.code === 11000) {
      return NextResponse.json({ success: false, message: 'Author address already exists.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}