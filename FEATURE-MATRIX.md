# Hatclanker v3 feature matrix

Status meanings:

- **Ready** — implemented locally and available after command registration/configuration.
- **Adapter** — implemented through a configurable provider/feed/endpoint; the server owner supplies the account or URL.
- **Guarded** — deliberately limited because it changes server structure, handles payments, or records people.

| # | Requested feature | Status | Hatclanker implementation |
|---:|---|---|---|
| 1 | Automated content filtering | Ready | Configurable whole-word, phrase, and domain filters with deletion and strikes. |
| 2 | Anti-spam | Ready | Rapid-fire, repeated-message, and excessive-caps detection. |
| 3 | Anti-raid | Ready | Join-rate detection, temporary quarantine, staff logging, and channel lockdown commands. |
| 4 | Warnings and timeouts | Ready | Persistent strikes with configurable timeout, kick, and optional ban thresholds. |
| 5 | Action logging | Ready | Deleted/edited messages and kick/ban/unban actions go to the moderation log. |
| 6 | CAPTCHA verification | Ready | Math CAPTCHA modal before the verified role is assigned. |
| 7 | Phishing/scam blocker | Ready | Configurable blocked domains and scam phrases. |
| 8 | Role-based enforcement | Ready | Discord default command permissions plus runtime moderator checks. |
| 9 | Welcome/goodbye messages | Ready | Personalized messages and channel configuration. |
| 10 | Reaction/self roles | Ready | Dropdown role panel for ping, pronoun, or gaming roles. |
| 11 | Onboarding questionnaire | Ready | Interest selection panel mapped to roles/channels. |
| 12 | Rule acceptance gate | Ready | “I Agree & Verify” panel with verified-role unlock. |
| 13 | Welcome cards | Ready | Dynamically rendered PNG with avatar, name, and member count. |
| 14 | Chat and voice leveling | Ready | Persistent chat XP, timed voice XP, anti-spam cooldown, rank cards. |
| 15 | Leaderboards | Ready | Top-ten chat/voice XP leaderboard. |
| 16 | Automated role rewards | Ready | Level-to-role mappings in `config/security.json`. |
| 17 | Birthday announcements | Ready | Member-managed birthdays with daily announcements. |
| 18 | Polls and voting | Ready | Reaction polls with 2–5 options. |
| 19 | Quotes and confessions | Ready | Persistent quotes and anonymous confession posting. |
| 20 | Giveaways | Ready | Timed giveaway button, persistent entries, random winner. |
| 21 | Voice music | Ready | YouTube/SoundCloud search or URL playback; Spotify tracks resolve through a playable match. |
| 22 | Queue and playlists | Ready | Queue, pause, resume, skip, stop, loop, and shuffle. |
| 23 | Hands-free voice commands | Adapter | Music controls exist; speech-to-text wake words require an external STT service and are not silently enabled. |
| 24 | Live-stream audio | Ready | `/music play` accepts supported live/direct sources. |
| 25 | Meme generation | Ready | Captioned PNG memes generated from uploaded images. |
| 26 | Mini-games | Ready | Persistent-per-channel Hangman plus dice and choice games. |
| 27 | Economy and shop | Ready | Clank-coins, daily reward, work, transfers, inventory, and optional role items. |
| 28 | RPG dice | Ready | `NdM+modifier` parser up to 20 dice and 1,000 sides. |
| 29 | Character sheets | Ready | Member-linked D&D/Pathfinder/other sheet URLs. |
| 30 | Live gaming stats | Adapter | Configurable JSON gaming-stat providers using `{player}` URL substitution. |
| 31 | Free-game notifications | Adapter | Add an Epic/Steam/GOG feed to the RSS integration list. |
| 32 | Support tickets | Ready | Private member/staff channels with owner/moderator close controls. |
| 33 | Events and reminders | Ready | Timed events, interest buttons, listing, and start announcements. |
| 34 | Social feed alerts | Adapter | RSS/Atom feed watcher for Twitch, YouTube, blogs, and compatible feeds. |
| 35 | Custom commands | Ready | Owner-managed `!trigger` responses with safe mentions. |
| 36 | Embeds and announcements | Ready | Staff announcement builder and existing server-guide embeds. |
| 37 | Invite tracking | Ready | Compares Discord invite-use counts and records valid joins. |
| 38 | Member-count channel | Ready | Updates a configured channel name with the live member count. |
| 39 | Timezone and currency | Ready | IANA timezone output and keyless Frankfurter reference-rate conversion. |
| 40 | AI companion | Adapter | Local Ollama chat; no paid cloud API key required. |
| 41 | Job simulation | Ready | Hourly virtual workshop jobs award economy currency. |
| 42 | Translation | Adapter | Slash translation plus automatic source-to-target channel routes through a LibreTranslate-compatible endpoint. |
| 43 | Server backup/templates | Guarded | Safe JSON export of role/channel structure. Automatic restore is intentionally not run against a friend’s server. |
| 44 | Voice recording | Guarded | Not activated: recording people requires explicit participant consent and jurisdiction-specific review. |
| 45 | Poll analytics | Ready | Exports a PNG chart and CSV from a poll message. |
| 46 | Applications/forms | Ready | Modal application form, review channel, accept/reject buttons, applicant DM. |
| 47 | Tournament brackets | Ready | Create, display, eliminate teams, and declare the final champion. |
| 48 | Payments/monetization | Guarded | Displays server-owner-configured payment links; Hatclanker never handles card data. |
| 49 | Reaction-to-thread | Ready | Configurable emoji and reaction threshold automatically create a side thread. |
| 50 | Webhooks/integrations | Adapter | Authenticated localhost JSON webhook listener plus RSS and gaming provider adapters. |

## Important boundaries

Hatclanker does not secretly record voice, process payment credentials, restore/overwrite a server, or send data to a cloud AI service. Those operations carry privacy, financial, or destructive risk. The safe local or provider-adapter behavior above is the shipped implementation.
