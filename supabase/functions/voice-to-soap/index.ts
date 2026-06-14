// Voice-to-SOAP: takes a raw dictation transcript and returns structured SOAP notes
// using Lovable AI Gateway (no user-provided key).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { transcript } = await req.json();
    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 3) {
      return new Response(JSON.stringify({ error: 'Transcript required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const system = `You are a dental clinical scribe. Convert the dentist's raw dictation into structured SOAP notes for a dental EHR.
Return STRICT JSON only, matching this schema:
{
  "chief_complaint": string,         // patient's main concern, 1-2 short sentences
  "subjective": string,              // patient-reported symptoms, history, pain scale, duration
  "objective": string,               // clinical findings: teeth involved, gums, occlusion, x-ray observations
  "assessment": string,              // diagnosis / clinical impression
  "plan": string,                    // treatment plan in clear bullet-style sentences
  "gum_condition": "normal"|"gingivitis"|"periodontitis"|"recession"|"swelling"|"bleeding"|"abscess",
  "alignment_condition": "normal"|"crowding"|"spacing"|"crossbite"|"overbite"|"underbite"|"open bite"|"deep bite"
}
Rules:
- Use dental terminology (FDI tooth numbers if mentioned, else as spoken).
- Never invent findings not in the dictation. Leave fields as empty string if not mentioned.
- Default gum_condition / alignment_condition to "normal" if not mentioned.
- Output JSON only, no markdown, no commentary.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Dictation:\n"""${transcript}"""` },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(JSON.stringify({ error: 'AI request failed', detail: errText }), {
        status: aiRes.status === 429 ? 429 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content ?? '{}';
    let soap: any = {};
    try { soap = JSON.parse(content); } catch { soap = { raw: content }; }

    return new Response(JSON.stringify({ soap }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
