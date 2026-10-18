# Hatclanker AI on Raspberry Pi 5

Hatclanker talks to a local Ollama server at `127.0.0.1`. No cloud AI key is required and the Ollama port does not need to be exposed to the internet.

## 1. Install and start Ollama

On the Pi:

```bash
uname -m
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
sudo systemctl status ollama --no-pager -l
```

`uname -m` should normally report `aarch64` on a 64-bit Pi 5 installation.

## 2. Download a Pi-friendly model

Start with the 1B Llama model:

```bash
ollama pull llama3.2:1b
ollama list
```

The 1B model is the recommended starting point for CPU-only Pi use. Larger models need more RAM and respond more slowly.

## 3. Configure Hatclanker

Edit the existing private environment file:

```bash
cd ~/hatclanker
nano .env
```

Add or update these lines without changing the Discord values already there:

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:1b
OLLAMA_TIMEOUT_MS=120000
OLLAMA_HISTORY_MESSAGES=8
OLLAMA_NUM_PREDICT=320
OLLAMA_KEEP_ALIVE=10m
```

Save in nano with `Ctrl+O`, Enter, then `Ctrl+X`.

## 4. Verify, register, and restart

```bash
cd ~/hatclanker
npm install
npm run ollama:check
npm run register
sudo systemctl restart ollama hatclanker
sudo systemctl status ollama hatclanker --no-pager -l
journalctl -u hatclanker -n 40 --no-pager
```

In Discord, try:

- `/ai-status`
- `/ai prompt:Tell me one Raspberry Pi fact`
- `/ai-reset`
- `/game trivia`
- `/game rps`
- `/game number-start`
- `/game scramble`
- `/game slots`

Each user gets a short in-memory AI conversation. `/ai-reset` clears it, and restarting Hatclanker also clears it. AI output is passed through Hatclanker’s clean-language filter.

## Troubleshooting

- `Ollama is not reachable`: run `sudo systemctl restart ollama`, then `npm run ollama:check`.
- `model not found`: run `ollama pull llama3.2:1b`.
- Replies time out: keep the 1B model and reduce `OLLAMA_NUM_PREDICT` to `192`.
- Check Ollama logs with `journalctl -u ollama -n 50 --no-pager`.
- Check Pi throttling with `vcgencmd get_throttled`; `0x0` means no throttling is currently reported.
