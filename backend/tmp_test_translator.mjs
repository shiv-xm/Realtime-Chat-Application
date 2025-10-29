import { translateText } from './src/lib/translator.js';

(async () => {
  try {
    const res = await translateText('Hello world', 'es');
    console.log('translateText returned:', res);
    process.exit(0);
  } catch (err) {
    console.error('Error running translateText:', err);
    process.exit(1);
  }
})();