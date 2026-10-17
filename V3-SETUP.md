# Hatclanker v3 deployment checklist

## 1. Update the Discord application

In the Discord Developer Portal, enable:

- Server Members Intent
- Message Content Intent

Then run:

```powershell
npm.cmd install
npm.cmd run register
npm.cmd run invite
```

Ask the server owner to approve the printed invite. Hatclanker does not request Administrator; v3 requests the specific moderation, role, voice, thread, reaction, and audit permissions its features use.

Move Hatclanker’s role above every verified, reward, self-assignable, ticket, and moderated member role. Keep it below owner/admin roles.

## 2. Configure channel and role IDs

Enable Discord Developer Mode, right-click a channel or role, and choose **Copy ID**. Add the IDs to `.env`:

```dotenv
WELCOME_CHANNEL_ID=
GOODBYE_CHANNEL_ID=
MOD_LOG_CHANNEL_ID=
APPLICATION_CHANNEL_ID=
TICKET_CATEGORY_ID=
VERIFIED_ROLE_ID=
BIRTHDAY_CHANNEL_ID=
CONFESSION_CHANNEL_ID=
MEMBER_COUNT_CHANNEL_ID=
SUGGESTIONS_CHANNEL_ID=
RAID_LOCKDOWN_CHANNEL_IDS=
```

For `RAID_LOCKDOWN_CHANNEL_IDS`, separate multiple channel IDs with commas.

## 3. Configure security and roles

Edit `config/security.json`.

Example self-role entry:

```json
{
  "label": "Game Night",
  "roleId": "ROLE_ID_HERE",
  "description": "Get game-night pings",
  "emoji": "🎮"
}
```

Example level reward:

```json
{
  "level": 5,
  "roleId": "ROLE_ID_HERE"
}
```

Replace the banned-word placeholder with the server’s actual banned terms. `banAt` is `0` by default, meaning automatic bans are disabled; timeouts and kicks still follow their configured thresholds.

Post onboarding panels after the bot starts:

```text
/panel rules
/panel roles
/panel interests
```

The server’s channel permissions must hide member channels from `@everyone` and allow the verified/interest roles if those panels are meant to unlock channels.

## 4. Configure economy and shop

Edit `config/economy.json`. A shop item can be virtual-only, or grant a role when `roleId` is provided. Hatclanker’s role must be above shop reward roles.

## 5. Configure optional providers

Edit `config/integrations.json`.

RSS/social/free-game feed example:

```json
{
  "id": "youtube-channel",
  "label": "New YouTube upload",
  "url": "https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID",
  "channelId": "DISCORD_CHANNEL_ID"
}
```

Gaming statistics example:

```json
{
  "id": "my-game",
  "label": "My Game Stats",
  "url": "https://provider.example/players/{player}",
  "headers": {
    "authorization": "Bearer PROVIDER_TOKEN"
  }
}
```

Do not commit provider tokens. Prefer environment-variable-capable endpoints or a private proxy if a provider requires a secret.

Automatic translation route example:

```json
{
  "sourceChannelId": "SOURCE_CHANNEL_ID",
  "targetChannelId": "TARGET_CHANNEL_ID",
  "targetLanguage": "ar"
}
```

Set `TRANSLATE_API_URL` to a LibreTranslate-compatible service. Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` to enable `/ai` using a local model.

## 6. Verify the installation

Run these in Discord:

```text
/doctor
/security status
/panel rules
/rank
/music queue
```

Use `/doctor` in every channel where messages, embeds, reactions, or media fail. Discord channel overrides can deny a permission even when the bot role allows it.

## Safety defaults

- Automatic bans are disabled until staff changes `banAt`.
- Webhook listening is disabled until a secret and channel are configured.
- Cloud AI is not used; `/ai` uses local Ollama.
- Voice recording is not enabled because recording requires participant consent and legal review.
- Server backup exports structure only; it never overwrites the friend’s server.
- Payment support displays owner-configured links and never handles card data.
