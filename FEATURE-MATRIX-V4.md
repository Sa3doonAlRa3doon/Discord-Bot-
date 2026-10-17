# Hatclanker v4 feature matrix — items 61–100

Status meanings: **Ready** works locally; **Live API** uses a public data service; **Adapter** needs a configured provider endpoint; **Guarded** includes explicit permission, consent, or opt-in controls.

| # | Requested feature | Status | Implementation |
|---:|---|---|---|
| 61 | Shared Pomodoro timers | Ready | Per-channel synchronized focus/break cycles, joins, status, participant pings, owner/mod stop. |
| 62 | Flashcard reviewers | Ready | Persistent shared decks with private answer-reveal buttons. |
| 63 | Google Calendar 2-way sync | Adapter | Outbound event creation and five-minute inbound bridge polling. |
| 64 | Kanban integrations | Adapter | Configured emoji-to-action webhook bridge for Trello, Notion, or another board. |
| 65 | Habit trackers | Ready | Private daily check-ins and persistent UTC-day streaks. |
| 66 | Math expression resolver | Ready | Evaluation, simplification, derivatives, and symbolic integrals. |
| 67 | Dictionary and thesaurus | Live API | Definitions, examples, phonetics source link, and synonym extraction. |
| 68 | Anonymous compliment boxes | Guarded | Anonymous recipient DM; sender is visible only in the staff moderation log for abuse review. |
| 69 | Wikipedia summary puller | Live API | Compact article summaries with source links and thumbnails. |
| 70 | Daily writing prompts | Ready | On-demand prompt plus configurable daily channel delivery. |
| 71 | Image generation | Adapter | Stable Diffusion/Midjourney-compatible JSON provider contract. |
| 72 | Voice-to-text transcription | Guarded adapter | Transcribes deliberately uploaded audio; no silent voice-channel recording. |
| 73 | Text-to-speech | Adapter | Generates an audio file and plays it in the requester’s current voice channel when possible. |
| 74 | AI upscaling | Adapter | Uploaded-image provider workflow. |
| 75 | Face swapping | Guarded adapter | Refuses to run without explicit permission confirmation. |
| 76 | AI code reviewer | Ready with Ollama | Private review covering correctness, security, performance, and maintenance; code is never executed. |
| 77 | Background removal | Adapter | Uploaded-image provider workflow. |
| 78 | Subtitle file maker | Adapter | Transcription segments converted into a downloadable SRT file. |
| 79 | AI story continuer | Ready with Ollama | Persistent cooperative story per channel. |
| 80 | Color palette generator | Ready | Local image sampling with hex swatch PNG. |
| 81 | Counting game enforcer | Ready | Configurable channel, sequential counts, no consecutive turns, reset on error. |
| 82 | Virtual pet care | Ready | Shared persistent hunger, happiness, cleanliness, feeding, cleaning, play, naming, and time decay. |
| 83 | Horoscope and tarot | Ready | Deterministic daily entertainment readings with a clear disclaimer. |
| 84 | Starboard gallery | Ready | Configurable ⭐ threshold and Hall-of-Fame mirroring. |
| 85 | Akinator-style game | Ready | Local privacy-friendly character database and interactive yes/no/not-sure buttons. |
| 86 | Urban Dictionary | Live API | Top community definition and example with accuracy warning. |
| 87 | Weather visualizer | Live API | Current conditions plus three-day forecast for any geocoded city. |
| 88 | Flight radar tracking | Adapter | Licensed live-flight endpoint contract for status, route, altitude, and speed. |
| 89 | Random facts | Ready | Curated science/history facts with a source link on every result. |
| 90 | Compliment/roast spinner | Ready | Friendly compliments and clean, non-protected-trait jokes. |
| 91 | Filtered message purge | Guarded | Staff-only filters by member, link, or text across up to 100 recent messages. |
| 92 | Channel duplicator | Guarded | Staff-only clone including topic, settings, and permission overwrites. |
| 93 | Bot status rotator | Ready | Configurable JSON status list with a 30-second minimum interval. |
| 94 | Guild icon animator | Guarded | Configured seasonal icon gallery with a six-hour minimum rate limit. |
| 95 | Spam honeypot | Guarded | Visible only to a configured quarantine role; staff/bots exempt; persistent audit trail. |
| 96 | Audit log exporting | Guarded | Staff-only UTF-8 text export of up to 100 recent audit entries. |
| 97 | Ping testing | Ready | Interaction, gateway, and active Discord voice WebSocket/UDP latency. |
| 98 | Direct-message broadcasts | Guarded | Explicit member opt-in and staff-only delivery with success/failure totals. |
| 99 | Emoji cloner | Guarded | Staff-only HTTPS image import using Discord’s expression permission. |
| 100 | Self-destruct messages | Ready | Mention-safe temporary messages deleted after 5–3,600 seconds. |
