import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatWithOllama, ollamaSettings, ollamaStatus } from '../src/lib/ollama.js';

afterEach(() => vi.unstubAllGlobals());

describe('local Ollama client', () => {
  it('uses Pi-friendly defaults and clamps unsafe settings', () => {
    expect(ollamaSettings({}).model).toBe('llama3.2:1b');
    expect(ollamaSettings({ OLLAMA_NUM_PREDICT: '99999' }).numPredict).toBe(2048);
    expect(ollamaSettings({ OLLAMA_HISTORY_MESSAGES: '0' }).historyMessages).toBe(2);
  });

  it('sends non-streaming chat requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: 'Hello from the Pi' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const answer = await chatWithOllama([{ role: 'user', content: 'Hello' }], { OLLAMA_BASE_URL: 'http://localhost:11434/', OLLAMA_MODEL: 'tiny' });
    expect(answer).toBe('Hello from the Pi');
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/api/chat');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ model: 'tiny', stream: false });
  });

  it('reports installed models', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [{ name: 'llama3.2:1b' }] }), { status: 200 })));
    const status = await ollamaStatus({ OLLAMA_MODEL: 'llama3.2:1b' });
    expect(status.selectedInstalled).toBe(true);
    expect(status.models).toEqual(['llama3.2:1b']);
  });
});
