# ⚙️ Fanbot Hatclanker

**Your personal Discord server co-pilot — loud style, zero confusion.**

Hatclanker v4.1 is a full multi-purpose Discord bot with **79 slash commands**: moderation, security, onboarding, productivity, study rooms, AI/media adapters, live utilities, games, server automation, music, economy, and configurable integrations. Its core works without a paid AI API; optional AI chat and code review use local Ollama.

![Hatclanker avatar](assets/hatclanker-avatar.png)

## What it can do

- `/start` — opens a private, button-driven server guide
- `/guide` — jumps to Start Here, Channel Map, Rules, FAQ, or Support
- `/ask` — matches a natural question against your custom FAQ
- `/remind` — sends a persistent DM reminder from 5 seconds to 30 days later
- `/server` — shows a live server status card
- `/rank` and `/leaderboard` — persistent XP progression with anti-spam cooldowns
- `/poll` — reaction polls with two to five choices
- `/suggest` — sends ideas to a dedicated suggestion channel for voting
- `/roll` — dice notation including `d20`, `2d6`, and modifiers
- `/choose` — picks from pipe-separated choices
- `/member` — member profile, join date, account age, and highest role
- `/doctor` — shows exactly which Discord channel permissions are missing
- `/setup` — lets an admin post a permanent public welcome panel
- Welcomes new members by DM and optionally in a public welcome channel
- Answers when mentioned, such as `@Hatclanker how do I verify?`
- Stays playful and family-friendly without swearing
- Filters banned words, scam links, rapid spam, repeated messages, and excessive caps
- Tracks persistent strikes and can escalate through timeout, kick, or optional ban
- Logs message edits/deletions and kick/ban actions to a staff channel
- Runs CAPTCHA verification, rule gates, self roles, interest onboarding, and welcome cards
- Tracks chat and voice XP, level roles, birthdays, invites, and member counts
- Runs giveaways, events, applications, tournaments, tickets, economy, Hangman, trivia, rock-paper-scissors, number guessing, word scrambles, slots, and character sheets
- Plays supported voice media with queue, pause, skip, loop, and shuffle controls
- Generates memes and exports poll analytics as PNG and CSV
- Connects local Ollama with short per-user conversations, status checks, clean output, Pi-friendly limits, LibreTranslate, RSS feeds, gaming APIs, and authenticated webhooks
- Runs shared Pomodoros, flashcard decks, habit streaks, math/calculus, dictionary, Wikipedia, and daily writing prompts
- Adds consent-safe AI image, transcription, TTS, upscaling, background removal, face-swap, code-review, subtitle, and story adapters
- Adds counting, a shared virtual pet, tarot/horoscope fun, starboard, character guessing, weather, facts, filtered purge, channel cloning, audit export, opt-in broadcasts, emoji cloning, and self-destructing messages

See [FEATURE-MATRIX.md](FEATURE-MATRIX.md) for the original feature set and [FEATURE-MATRIX-V4.md](FEATURE-MATRIX-V4.md) for items 61–100.
Use [V4-SETUP.md](V4-SETUP.md) for the new study, AI/media, Calendar/Kanban, weather, flight, and guarded admin features.
For local Raspberry Pi AI, follow [PI5-OLLAMA-SETUP.md](PI5-OLLAMA-SETUP.md).

## 1. Create the Discord bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and choose **New Application**.
2. Name it **Fanbot Hatclanker**.
3. Open **Bot**, choose **Reset Token**, and copy the token somewhere private.
4. On the same page, enable **Server Members Intent** and **Message Content Intent**.
5. Upload `assets/hatclanker-avatar.png` as the bot avatar.

## 2. Invite it

In **OAuth2 → URL Generator** select:

- Scopes: `bot`, `applications.commands`
- Bot permissions: View Channels, Send Messages, Embed Links, Read Message History

After adding `DISCORD_CLIENT_ID` to `.env`, generate a correctly permissioned invite:

```powershell
npm.cmd run invite
```

Open the printed URL and pick your friend’s server. Hatclanker does **not** need Administrator. If it is already installed, opening the new link safely updates the bot-role permissions.

The v4 invite requests granular moderation, role, channel, expression, voice, thread, reaction, attachment, invite, and audit-log permissions. Your friend can inspect every requested permission before approving it. Keep Hatclanker’s role above roles it must verify, reward, or moderate—but below the owner/admin roles.

## 3. Configure and run

This project needs Node.js 20 or newer.

```powershell
Copy-Item .env.example .env
notepad .env
npm.cmd install
npm.cmd run register
npm.cmd start
```

Fill in:

- `DISCORD_TOKEN`: the private bot token
- `DISCORD_CLIENT_ID`: the Application ID from **General Information**
- `DISCORD_GUILD_ID`: optional test-server ID; commands appear immediately there
- `WELCOME_CHANNEL_ID`: optional channel for public join greetings
- `SUGGESTIONS_CHANNEL_ID`: optional dedicated destination for `/suggest`
- `MOD_LOG_CHANNEL_ID`: staff-only moderation audit log
- `APPLICATION_CHANNEL_ID`: staff application review board
- `TICKET_CATEGORY_ID`: parent category for private tickets
- `VERIFIED_ROLE_ID`: role granted after rules and CAPTCHA
- `GOODBYE_CHANNEL_ID`, `BIRTHDAY_CHANNEL_ID`, `CONFESSION_CHANNEL_ID`
- `MEMBER_COUNT_CHANNEL_ID`: channel Hatclanker renames with the live count
- `OLLAMA_BASE_URL` and `OLLAMA_MODEL`: optional local AI; Pi 5 defaults are documented in `PI5-OLLAMA-SETUP.md`
- `TRANSLATE_API_URL`: optional LibreTranslate-compatible provider

Never share or commit `.env`.

If `DISCORD_GUILD_ID` is blank, commands are registered globally and Discord may take a while to distribute them. During development, using your test server ID is faster.

## 4. Make the server guide yours

Edit `config/server.json`:

- Replace `YOUR SERVER` with the real server name.
- Change the channel names and purposes.
- Replace the rules and FAQ entries.
- Set `supportRole` to the role members should contact.
- `swearMode` is locked off in v4; Hatclanker stays clean even if an older config tries to enable it.
- Use the `features` block to toggle leveling, level-up announcements, and the XP cooldown.
- Edit `config/security.json` for banned words, blocked domains, strike escalation, self roles, interest roles, level rewards, and reaction-to-thread behavior.
- Edit `config/economy.json` for currency, job payouts, shop items, and optional role rewards.
- Edit `config/integrations.json` for payment links, RSS feeds, gaming-stat endpoints, and the authenticated webhook listener.
- Pick a six-digit hex color for `accentColor`.

Restart the bot after editing the file. Then run `/setup #your-welcome-channel` in Discord to post the permanent welcome cockpit.

## Development checks

```powershell
npm.cmd run check
npm.cmd test
```

Reminders, XP, moderation strikes, economy balances, birthdays, giveaways, events, quotes, flashcards, habits, stories, pet state, opt-ins, counting, starboard, invitations, tournaments, custom commands, and integration state are stored under `data/`, so they survive a normal restart. Keep the bot process running for automated moderation and scheduled delivery.

## Project map

```text
assets/hatclanker-avatar.png   generated bot avatar
config/server.json             all server-specific words and guide content
src/index.js                   Discord events and command behavior
src/commands.js                slash command definitions
src/register-commands.js       Discord command registration
src/ui.js                      embeds, buttons, and selection menu
src/features/                  moderation-adjacent community, onboarding, media, and integrations
src/lib/                       storage, matching, security, reminders, XP, duration, config validation
config/security.json           filtering, anti-spam, roles, rewards, thread automation
config/economy.json            currency and shop configuration
config/integrations.json       provider-backed features and webhook settings
tests/                         automated logic checks
```

## Troubleshooting

- **Bot is online but commands are missing:** run `npm.cmd run register` again and verify the client ID and test-server ID.
- **Join welcome does not fire:** enable Server Members Intent in the Developer Portal.
- **Mention replies do not fire:** enable Message Content Intent.
- **The bot says Missing Access:** check its permissions in the target channel.
- **It cannot send messages or emoji:** run `/doctor` in the affected channel. Standard emoji require only Send Messages; custom emoji from another server also need Use External Emoji.
- **A permission is allowed on the role but still fails:** Discord channel overrides can deny it. Check **Edit Channel → Permissions → Hatclanker**.
- **Reminder DM fails:** the member may have disabled server DMs; Hatclanker retries once after a minute.
- **Music does not start:** confirm Hatclanker has Connect/Speak, you are in voice, and FFmpeg is installed and available in `PATH`.
- **Verification cannot add the role:** move Hatclanker’s role above the verified role.
- **Moderation cannot timeout or remove someone:** Hatclanker must be above that member’s highest role.
- **An integration says not configured:** fill its endpoint/channel fields in `.env` or `config/integrations.json`; disabled integrations never crash startup.

Built with Node.js and discord.js. No database or AI subscription required.
