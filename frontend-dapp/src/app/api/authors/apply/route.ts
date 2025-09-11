// frontend-dapp/src/app/api/authors/apply/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import AuditAuthor, { IAuditAuthor } from '../../../../models/AuditAuthor';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json();
    console.log('📥 Received data:', JSON.stringify(body, null, 2));

    // Check if the call is from Make (with LLM results) or from the form
    const isFromMake = body.rawLLMResponse !== undefined;

    if (isFromMake) {
      // HANDLE CALL FROM MAKE (with LLM results)
      console.log('🤖 Call from Make with LLM results');

      const {
        walletAddress,
        rawLLMResponse
      } = body;

      // Basic validation
      if (!walletAddress) {
        console.error('❌ Missing walletAddress');
        return NextResponse.json({ message: 'walletAddress is missing.' }, { status: 400 });
      }

      // COMPLETE PARSING OF GEMINI RESPONSE
      let llmScore = 0;
      let llmComment = 'Parsing error';
      let approved = false;

      console.log('🔍 Starting to parse rawLLMResponse...');
      console.log('Raw data type:', typeof rawLLMResponse);

      try {
        let geminiResponse;

        // Step 1: Parse the complete Gemini structure
        console.log('📤 Type of rawLLMResponse:', typeof rawLLMResponse);

        if (typeof rawLLMResponse === 'string') {
          console.log('📤 Parsing from JSON string...');
          // Clean the string before parsing
          const cleanedString = rawLLMResponse
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .trim();

          geminiResponse = JSON.parse(cleanedString);
        } else {
          console.log('📤 Using already parsed object...');
          geminiResponse = rawLLMResponse;
        }

        console.log('✅ Gemini structure parsed:', JSON.stringify(geminiResponse, null, 2));

        // Step 2: Extract the text from the candidates structure
        let textContent = '';
        const candidates = geminiResponse?.candidates;
        const parts = candidates?.[0]?.content?.parts;

        if (parts && parts[0]?.text) {
          textContent = parts[0].text;
          console.log('✅ Text extracted from candidates:', textContent);
        } else {
          throw new Error('Candidates structure not found or malformed');
        }

        // Step 3: Remove markdown backticks and extract the JSON
        let cleanJson = textContent.trim();

        if (cleanJson.includes('```json')) {
          console.log('🧹 Removing markdown backticks...');
          const jsonMatch = cleanJson.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            cleanJson = jsonMatch[1].trim();
            console.log('✅ JSON cleaned from backticks:', cleanJson);
          } else {
            throw new Error('Pattern ```json...``` not found');
          }
        } else if (cleanJson.includes('```')) {
          // Fallback for generic backticks
          const jsonMatch = cleanJson.match(/```\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            cleanJson = jsonMatch[1].trim();
            console.log('✅ JSON cleaned from generic backticks:', cleanJson);
          }
        }

        // Step 4: Parse the final JSON with score, comment, approved
        console.log('🎯 Parsing final JSON:', cleanJson);
        const finalData = JSON.parse(cleanJson);

        llmScore = finalData.score || 0;
        llmComment = finalData.comment || 'No comment available';
        approved = finalData.approved || false;

        console.log('🎉 PARSING COMPLETED SUCCESSFULLY:');
        console.log('- Score:', llmScore);
        console.log('- Comment:', llmComment);
        console.log('- Approved:', approved);

      } catch (parseError: any) { // Explicitly casting to `any` to allow access to properties
        console.error('❌ PARSING ERROR:', parseError);
        console.error('❌ Raw data that caused error:', rawLLMResponse);

        // Fallback values
        llmScore = 0;
        llmComment = `Error parsing AI response: ${parseError.message}`;
        approved = false;

        console.log('⚠️ Using fallback values:', { llmScore, llmComment, approved });
      }

      // Step 5: Update the database
      const application = await AuditAuthor.findOne({ walletAddress });

      if (!application) {
        console.error('❌ Application not found for wallet:', walletAddress);
        return NextResponse.json({
          message: 'Application not found.',
          debug: {
            walletAddress,
            searchResult: 'not found'
          }
        }, { status: 404 });
      }

      // Update with LLM results
      application.status = approved ? 'APPROVED' : 'REJECTED';
      application.llmScore = llmScore;
      application.llmComment = llmComment;
      application.llmApproved = approved;

      const savedApplication = await application.save();
      console.log('✅ Application updated successfully:', savedApplication._id);

      return NextResponse.json({
        success: true,
        message: `Application ${approved ? 'APPROVED' : 'REJECTED'} by AI.`,
        applicationId: savedApplication._id.toString(),
        llmScore: llmScore,
        llmComment: llmComment,
        approved: approved,
        status: application.status,
        debug: {
          parsingSteps: 'completed',
          finalValues: { llmScore, llmComment, approved }
        }
      }, { status: 200 });

    } else {
      // HANDLE CALL FROM FORM (initial creation)
      console.log('📝 Call from form for creation');

      const {
        walletAddress,
        name,
        email,
        institution,
        researchArea,
        biography,
        publicationsLink,
        linkedinProfile,
      } = body;

      // Validation
      if (!walletAddress || !name || !email || !biography) {
        return NextResponse.json({ message: 'Missing required data.' }, { status: 400 });
      }

      if (biography.length < 200) {
        return NextResponse.json({ message: 'The biography must be at least 200 characters long.' }, { status: 400 });
      }

      // Check if an application already exists
      const existingApplication = await AuditAuthor.findOne({ walletAddress });
      if (existingApplication) {
        return NextResponse.json({ message: 'An application with this wallet already exists.' }, { status: 409 });
      }

      // Create new application
      const newApplication = new AuditAuthor({
        walletAddress,
        name,
        email,
        institution,
        researchArea,
        biography,
        publicationsLink,
        linkedinProfile,
        status: 'PENDING',
      });

      const savedApplication = await newApplication.save() as IAuditAuthor;
      console.log('✅ New application created:', savedApplication._id);

      // Trigger webhook to Make
      const webhookUrl = process.env.MAKE_WEBHOOK_URL;

      if (!webhookUrl) {
        console.error('❌ MAKE_WEBHOOK_URL is not configured');
        return NextResponse.json({
          message: 'Application received but automation is not configured.',
          applicationId: savedApplication._id.toString()
        }, { status: 201 });
      }

      try {
        console.log('🚀 Sending webhook to Make:', webhookUrl);

        const webhookPayload = {
          applicationId: savedApplication._id.toString(),
          walletAddress,
          name,
          email,
          institution,
          researchArea,
          biography,
          publicationsLink,
          linkedinProfile
        };

        console.log('📤 Webhook payload:', webhookPayload);

        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
        });

        console.log('✅ Webhook response status:', webhookResponse.status);

        if (!webhookResponse.ok) {
          console.error('⚠️ Webhook responded with error:', webhookResponse.status);
        }

      } catch (webhookError) {
        console.error('❌ Failed to trigger Make.com webhook:', webhookError);
      }

      return NextResponse.json({
        success: true,
        message: 'Application submitted successfully. Processing is underway...',
        applicationId: savedApplication._id.toString()
      }, { status: 201 });
    }

  } catch (error: any) { // Explicitly casting to `any`
    console.error('❌ API Error /api/authors/apply:', error);
    console.error('❌ Stack trace:', error.stack);

    if (error.code === 11000) {
      return NextResponse.json({ message: 'An application already exists for this wallet address.' }, { status: 409 });
    }

    return NextResponse.json({
      message: 'Internal server error: ' + error.message,
      error: error.toString(),
      debug: {
        errorType: error.constructor.name,
        errorCode: error.code
      }
    }, { status: 500 });
  }
}




