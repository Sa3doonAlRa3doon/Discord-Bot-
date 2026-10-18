import 'dotenv/config';
import { ollamaStatus } from './lib/ollama.js';

try {
  const status = await ollamaStatus();
  console.log(`Ollama reachable: ${status.baseUrl}`);
  console.log(`Selected model: ${status.model} (${status.selectedInstalled ? 'installed' : 'NOT INSTALLED'})`);
  console.log(`Available models: ${status.models.join(', ') || 'none'}`);
  if (!status.selectedInstalled) {
    console.error(`Install it with: ollama pull ${status.model}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Ollama check failed: ${error.message}`);
  process.exitCode = 1;
}
