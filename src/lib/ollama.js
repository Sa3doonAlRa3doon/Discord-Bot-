const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'llama3.2:1b';

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function ollamaSettings(env = process.env) {
  return {
    baseUrl: String(env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: String(env.OLLAMA_MODEL || DEFAULT_MODEL),
    timeoutMs: boundedInteger(env.OLLAMA_TIMEOUT_MS, 120_000, 5_000, 600_000),
    historyMessages: boundedInteger(env.OLLAMA_HISTORY_MESSAGES, 8, 2, 20),
    numPredict: boundedInteger(env.OLLAMA_NUM_PREDICT, 320, 64, 2_048),
    keepAlive: String(env.OLLAMA_KEEP_ALIVE || '10m')
  };
}

async function ollamaRequest(path, init = {}, env = process.env) {
  const settings = ollamaSettings(env);
  let response;
  try {
    response = await fetch(`${settings.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(settings.timeoutMs)
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new Error(`Ollama timed out after ${Math.round(settings.timeoutMs / 1000)} seconds. Try a smaller model such as ${DEFAULT_MODEL}.`);
    }
    if (error?.cause?.code === 'ECONNREFUSED') {
      throw new Error(`Ollama is not reachable at ${settings.baseUrl}. Start it with: sudo systemctl start ollama`);
    }
    throw new Error(`Ollama is not reachable at ${settings.baseUrl}. ${error.message}`);
  }

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 300) };
    }
  }
  if (!response.ok) {
    const detail = String(data.error || data.message || `HTTP ${response.status}`).slice(0, 300);
    throw new Error(`Ollama returned ${response.status}: ${detail}`);
  }
  return data;
}

export async function chatWithOllama(messages, env = process.env) {
  const settings = ollamaSettings(env);
  const data = await ollamaRequest('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: settings.model,
      messages,
      stream: false,
      keep_alive: settings.keepAlive,
      options: { num_predict: settings.numPredict }
    })
  }, env);
  return String(data.message?.content || '').trim();
}

export async function ollamaStatus(env = process.env) {
  const settings = ollamaSettings(env);
  const data = await ollamaRequest('/api/tags', {}, env);
  const models = Array.isArray(data.models) ? data.models.map((entry) => entry.name).filter(Boolean) : [];
  return {
    ...settings,
    models,
    selectedInstalled: models.some((name) => name === settings.model || name.startsWith(`${settings.model}:`))
  };
}
