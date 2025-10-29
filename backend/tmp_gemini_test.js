(async ()=>{
  try{
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText';
    const url = apiKey && /^AIza[A-Za-z0-9_-]{10,}/.test(apiKey) ? `${endpoint}?key=${encodeURIComponent(apiKey)}` : endpoint;
    console.log('Requesting', apiKey ? url.replace(/(key=)[^&]+/,'$1[REDACTED]') : url);

    const body = { prompt:{ text: 'Translate the following into English, reply only with translated text:\n\nनमस्ते' }, temperature:0.0, max_output_tokens:200 };

    const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    console.log('Status', res.status, res.statusText);
    const txt = await res.text();
    console.log('Body:', txt);
  } catch(e){
    console.error('Fetch error:', e.message || e);
  }
})();
