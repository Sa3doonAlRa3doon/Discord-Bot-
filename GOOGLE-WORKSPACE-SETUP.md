# Private Google Workspace setup

Hatclanker can use one personal Google account from the Raspberry Pi. Access is disabled until an explicit Discord-user allowlist and a protected OAuth token are configured. Every `/google` reply is ephemeral, so Gmail subjects, contacts, tasks, and calendar entries are not posted publicly.

## Security model

- `GOOGLE_ALLOWED_USER_IDS` is required. An empty value denies everyone.
- The OAuth token stays outside this repository at `/home/pi5/jarvis-google/token.json`.
- Gmail message bodies are never displayed by the search and unread commands.
- Email is created as a draft first. Sending requires `/google gmail-send` with `confirm:true`.
- Drive uses `drive.file`, so Jarvis sees only files it creates or files deliberately shared with the app.
- Docs, Sheets, Slides, and Forms use that same limited `drive.file` grant for app-created files.
- `credentials.json`, `token.json`, and `client_secret_*.json` are ignored by Git.

## APIs Jarvis actually uses

Enable these APIs in the same Google Cloud project: Gmail, Google Calendar, Google Drive, Google Tasks, People, Google Docs, Google Sheets, Google Slides, and Google Forms. Meet links are created through Calendar, so the separate Meet API is not required for this feature.

A dash (`—`) in Google Cloud's request dashboard means **no requests were sent**; it is not an error. Do not enable unrelated infrastructure APIs such as BigQuery, Cloud SQL, Vertex AI, Cloud Storage, Dataplex, or Earth Engine just to remove those dashes. They do not add Discord assistant features and some require billing. Legacy Contacts is also unnecessary because Jarvis correctly uses the People API.

## Pi configuration

The OAuth files should already have been copied from Windows. Verify their ownership and permissions on the Pi:

```bash
stat -c '%a %U:%G %n' /home/pi5/jarvis-google/credentials.json /home/pi5/jarvis-google/token.json
```

Both files should report mode `600` and owner `pi5:pi5`. The directory should be mode `700`.

Find your Discord user ID by enabling Discord **Developer Mode**, right-clicking your account, and selecting **Copy User ID**. Then edit `~/hatclanker/.env`:

```dotenv
GOOGLE_ALLOWED_USER_IDS=YOUR_DISCORD_USER_ID
GOOGLE_TOKEN_PATH=/home/pi5/jarvis-google/token.json
```

Deploy the update:

```bash
cd ~/hatclanker
git pull origin main
npm install
npm run register
sudo systemctl restart hatclanker
sudo systemctl status hatclanker --no-pager -l
```

## Commands

- `/google status`
- `/google gmail-unread`
- `/google gmail-search query:from:school is:unread`
- `/google gmail-draft`
- `/google gmail-send` — requires the draft ID and `confirm:true`
- `/google calendar-list`
- `/google calendar-add`
- `/google drive-list`
- `/google doc-create`
- `/google doc-read`
- `/google sheet-create`
- `/google sheet-read`
- `/google sheet-write` — use `|` between columns and `;` between rows
- `/google slide-create`
- `/google form-create`
- `/google meet-create`
- `/google tasks-list`
- `/google tasks-add`
- `/google contacts-search`

If the OAuth app is still in Google **Testing** status, its refresh token normally expires after seven days. Generate a new token while testing, or finish the Google publishing configuration before relying on unattended long-term access.
