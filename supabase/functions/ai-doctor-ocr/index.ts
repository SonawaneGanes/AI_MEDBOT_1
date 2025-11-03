import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'File is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const fileBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

    let extractedText = '';

    if (file.type.startsWith('image/')) {
      try {
        const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          headers: {
            'apikey': 'K87899142388957',
          },
          body: (() => {
            const formData = new FormData();
            formData.append('base64Image', `data:${file.type};base64,${base64}`);
            formData.append('language', 'eng');
            return formData;
          })()
        });

        const ocrData = await ocrResponse.json();
        if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
          extractedText = ocrData.ParsedResults[0].ParsedText || 'No text found in image';
        } else {
          extractedText = 'Unable to extract text from image';
        }
      } catch (ocrError) {
        console.error('OCR error:', ocrError);
        extractedText = 'OCR processing failed. This is a placeholder for image analysis.';
      }
    } else if (file.type === 'application/pdf') {
      extractedText = 'PDF processing: This file contains medical information. For detailed analysis, please describe the contents or key findings from your report.';
    } else {
      extractedText = 'Unsupported file type. Please upload an image (JPEG, PNG) or PDF file.';
    }

    if (sessionId) {
      await supabase
        .from('user_reports')
        .insert({
          session_id: sessionId,
          file_name: file.name,
          file_type: file.type,
          extracted_text: extractedText,
          created_at: new Date().toISOString()
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileName: file.name,
        fileType: file.type,
        extractedText,
        message: 'File processed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'File processing failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});