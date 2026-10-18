# Hatclanker v4 setup

This guide covers features 61–100. Core features work after `npm.cmd run register` and `npm.cmd start`; provider-backed features stay safely disabled until their endpoint is configured.

## Start the upgrade

```powershell
Copy-Item .env.example .env
notepad .env
npm.cmd install
npm.cmd run register
npm.cmd test
npm.cmd start
```

Keep `DISCORD_GUILD_ID` filled while testing so updated commands appear immediately. The bot needs the Server Members and Message Content privileged intents in the Discord Developer Portal.

## Ready without external accounts

These commands work locally: `/pomodoro`, `/flashcard`, `/habit`, `/math`, `/compliment`, `/writing-prompt`, `/image-tool action:palette`, `/pet`, `/fortune`, `/akinator`, `/random-fact`, `/spin`, `/purge-filter`, `/channel-clone`, `/system-tools`, `/audit-export`, `/ping`, `/dm-alerts`, `/dm-broadcast`, `/emoji-clone`, and `/self-destruct`.

`/dictionary`, `/wiki`, `/urban`, and `/weather` use public web data. If one provider is unavailable, only that command fails; the rest of Hatclanker stays online.

## Google Calendar two-way bridge

Set:

```dotenv
GOOGLE_CALENDAR_BRIDGE_URL=https://your-bridge.example/calendar
CALENDAR_CHANNEL_ID=123456789012345678
INTEGRATION_BRIDGE_TOKEN=replace-with-a-long-secret
```

`POST` receives `{ action, guildId, requestedBy, title, details, start, end }`. `GET ?since=<ISO timestamp>` returns `{ "events": [{ "title": "...", "start": "..." }] }`. Hatclanker polls inbound changes every five minutes and posts them to `CALENDAR_CHANNEL_ID`. Put OAuth and Google refresh tokens in the bridge—not in Discord messages or this repository.

## Trello or Notion Kanban bridge

```dotenv
KANBAN_BRIDGE_URL=https://your-bridge.example/kanban
KANBAN_REACTION_MAP={"✅":"done","🔄":"doing","📥":"backlog"}
INTEGRATION_BRIDGE_TOKEN=replace-with-a-long-secret
```

When someone adds a configured reaction, Hatclanker posts the action plus guild, channel, message, link, and reacting user to the bridge. The bridge owns the Trello/Notion OAuth token and moves the card or task.

## AI and media providers

Each variable expects an HTTPS service controlled by the server owner or a trusted provider:

- `IMAGE_GENERATION_API_URL` — JSON request `{ prompt, userId, guildId }`; return `url`, `imageUrl`, or base64.
- `TRANSCRIPTION_API_URL` — multipart audio upload; return `text` and optional timed `segments`.
- `TTS_API_URL` — JSON request `{ text, voice }`; return audio bytes, URL, or base64. If the requester is in voice, Hatclanker plays the result there.
- `UPSCALER_API_URL`, `BACKGROUND_REMOVAL_API_URL`, `FACE_SWAP_API_URL` — receive `{ imageUrl, consentConfirmed }`.
- `MEDIA_API_TOKEN` — optional bearer token shared with those providers.

Face swapping will not run unless the member explicitly confirms permission from every person shown. TTS uses named provider presets; do not configure voices that imitate a real person without permission. Voice transcription operates on a deliberately uploaded recording, avoiding silent voice-channel recording.

Local `/ai`, `/code-review`, and `/story continue` use `OLLAMA_BASE_URL` and `OLLAMA_MODEL`. `/ai-status` checks the connection and selected model, while `/ai-reset` clears the requesting member’s short in-memory conversation. Raspberry Pi users should follow `PI5-OLLAMA-SETUP.md`.

## Live flight provider

Set `FLIGHT_TRACKING_API_URL` and optional `FLIGHT_TRACKING_API_TOKEN`. The endpoint receives `?flight=EK202` and should return JSON fields such as `status`, `origin`, `destination`, `altitude`, `speed`, and `updatedAt`.

## Scheduled features

Set `WRITING_PROMPT_CHANNEL_ID` and `WRITING_PROMPT_HOUR` for one prompt per day. `BOT_STATUS_MESSAGES` is a JSON array; status changes are at least 30 seconds apart. `GUILD_ICON_URLS` is a JSON array and icon changes are rate-limited to at least six hours.

## Counting, starboard, broadcasts, and honeypot

- Run `/system-tools counting` and `/system-tools starboard` to select channels.
- Members must run `/dm-alerts choice:Opt in` before staff can include them in `/dm-broadcast`.
- The honeypot refuses creation until `HONEYPOT_EXPOSED_ROLE_ID` names a dedicated quarantine/unverified role. It never auto-bans staff or bot accounts. `/honeypot disable` leaves the channel for staff review instead of deleting evidence.
- `/purge-filter` is limited to 100 recently fetched messages; Discord automatically skips bulk deletion for messages older than 14 days.

## Clean-language guarantee

`config/server.json` ships with `swearMode: false`, and the v4 loader forces clean mode. User-provided content may still contain language that the server should handle through `config/security.json`.
