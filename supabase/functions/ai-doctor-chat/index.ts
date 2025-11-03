import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const MEDICAL_DISCLAIMER = '\n\n  *Disclaimer: This information is for educational purposes only and does not replace professional medical advice. Always consult a qualified healthcare provider for personalized medical guidance.*';
const RESTRICTED_KEYWORDS = ['diagnose', 'prescription', 'prescribe', 'medication dosage', 'drug dosage', 'how much medicine'];

interface Message {
  role: string;
  content: string;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magA * magB);
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b\w+\b/g) || [];
}

function buildTFIDF(documents: string[]): { vectors: number[][], vocabulary: string[] } {
  const vocabulary = new Set<string>();
  const tokenizedDocs = documents.map(doc => {
    const tokens = tokenize(doc);
    tokens.forEach(token => vocabulary.add(token));
    return tokens;
  });

  const vocabArray = Array.from(vocabulary);
  const docCount = documents.length;
  const idf: { [key: string]: number } = {};

  vocabArray.forEach(term => {
    const docsWithTerm = tokenizedDocs.filter(tokens => tokens.includes(term)).length;
    idf[term] = Math.log(docCount / (docsWithTerm + 1));
  });

  const vectors = tokenizedDocs.map(tokens => {
    const tf: { [key: string]: number } = {};
    tokens.forEach(token => {
      tf[token] = (tf[token] || 0) + 1;
    });

    return vocabArray.map(term => {
      const termFreq = (tf[term] || 0) / tokens.length;
      return termFreq * (idf[term] || 0);
    });
  });

  return { vectors, vocabulary: vocabArray };
}

function findBestMatch(query: string, knowledge: any[]): { answer: string, confidence: number, question: string } | null {
  if (knowledge.length === 0) return null;

  const documents = knowledge.map(k => k.question);
  const allDocs = [...documents, query];
  const { vectors, vocabulary } = buildTFIDF(allDocs);

  const queryVector = vectors[vectors.length - 1];
  const docVectors = vectors.slice(0, -1);

  let bestMatch = { index: -1, score: 0 };
  docVectors.forEach((vec, idx) => {
    const score = cosineSimilarity(queryVector, vec);
    if (score > bestMatch.score) {
      bestMatch = { index: idx, score };
    }
  });

  if (bestMatch.score > 0.2) {
    return {
      answer: knowledge[bestMatch.index].answer,
      confidence: bestMatch.score,
      question: knowledge[bestMatch.index].question
    };
  }

  return null;
}

async function callOpenAI(messages: Message[], apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are Alex, a compassionate AI medical assistant. Provide helpful health information and guidance. Always remind users to consult healthcare professionals for serious concerns. Be empathetic and clear. When appropriate, suggest treatments or lifestyle changes, but emphasize these are general recommendations.'
        },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message, sessionId, openaiApiKey } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lowerMessage = message.toLowerCase();
    const hasRestricted = RESTRICTED_KEYWORDS.some(keyword => lowerMessage.includes(keyword));

    if (hasRestricted) {
      const warningResponse = "I cannot provide specific diagnoses, prescriptions, or medication dosages. Please consult a licensed healthcare provider for personalized medical advice and treatment." + MEDICAL_DISCLAIMER;
      return new Response(
        JSON.stringify({ 
          response: warningResponse,
          source: 'safety_filter',
          confidence: 1.0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({ created_at: new Date().toISOString(), last_active: new Date().toISOString() })
        .select()
        .single();

      if (sessionError) throw sessionError;
      currentSessionId = newSession.id;
    }

    await supabase
      .from('chat_messages')
      .insert({
        session_id: currentSessionId,
        role: 'user',
        content: message,
        created_at: new Date().toISOString()
      });

    const { data: knowledge } = await supabase
      .from('medical_knowledge')
      .select('*');

    const match = findBestMatch(message, knowledge || []);

    let responseText = '';
    let source = 'local';
    let confidence = 0;

    if (match && match.confidence > 0.4) {
      responseText = match.answer + MEDICAL_DISCLAIMER;
      source = 'local';
      confidence = match.confidence;
    } else if (openaiApiKey) {
      const { data: recentMessages } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', currentSessionId)
        .order('created_at', { ascending: false })
        .limit(10);

      const conversationHistory = (recentMessages || []).reverse();
      
      try {
        const aiResponse = await callOpenAI(conversationHistory, openaiApiKey);
        responseText = aiResponse + MEDICAL_DISCLAIMER;
        source = 'openai';
        confidence = 0.95;
      } catch (error) {
        responseText = "I'm having trouble processing your request right now. Could you please rephrase your question? For urgent medical concerns, please contact a healthcare provider immediately." + MEDICAL_DISCLAIMER;
        source = 'error';
        confidence = 0;
      }
    } else {
      responseText = "I don't have specific information about that. For personalized medical advice, please consult a healthcare professional. If you'd like more comprehensive AI assistance, you can provide an OpenAI API key in the settings." + MEDICAL_DISCLAIMER;
      source = 'fallback';
      confidence = 0.3;
    }

    await supabase
      .from('chat_messages')
      .insert({
        session_id: currentSessionId,
        role: 'assistant',
        content: responseText,
        metadata: { source, confidence },
        created_at: new Date().toISOString()
      });

    await supabase
      .from('chat_sessions')
      .update({ last_active: new Date().toISOString() })
      .eq('id', currentSessionId);

    return new Response(
      JSON.stringify({
        response: responseText,
        sessionId: currentSessionId,
        source,
        confidence,
        matchedQuestion: match?.question
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});