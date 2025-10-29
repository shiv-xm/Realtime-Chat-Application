import fs from 'fs';
import path from 'path';
const file = path.join(process.cwd(), 'backend', '.env');
let txt = '';
try{
  txt = fs.readFileSync(file, 'utf8');
  console.log('Read .env length', txt.length);
  const m = txt.match(/GEMINI_API_KEY\s*=\s*(.+)/);
  if(m){
    console.log('Matched raw key:', JSON.stringify(m[1]));
    console.log('Trimmed key:', JSON.stringify(m[1].trim()));
    console.log('StartsWith AIza?', m[1].trim().startsWith('AIza'));
  } else {
    console.log('No GEMINI_API_KEY line found in .env');
  }
} catch(e){
  console.error('Read .env error:', e.message || e);
}
