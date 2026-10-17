import {
  ChannelType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('Meet Hatclanker and open your personal server cockpit.'),
  new SlashCommandBuilder()
    .setName('guide')
    .setDescription('Jump straight to a section of the server guide.')
    .addStringOption((option) => option
      .setName('topic')
      .setDescription('What do you need?')
      .setRequired(false)
      .addChoices(
        { name: '🚀 Start here', value: 'start' },
        { name: '🗺️ Channel map', value: 'channels' },
        { name: '🛡️ Rules', value: 'rules' },
        { name: '⚡ Quick answers', value: 'faq' },
        { name: '🔧 Get help', value: 'support' }
      )),
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask Hatclanker a question about the server.')
    .addStringOption((option) => option
      .setName('question')
      .setDescription('Example: How do I get access?')
      .setMaxLength(300)
      .setRequired(true)),
  new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Show the server rules.'),
  new SlashCommandBuilder()
    .setName('faq')
    .setDescription('Show quick answers to common questions.'),
  new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Ask Hatclanker to remind you later.')
    .addStringOption((option) => option
      .setName('in')
      .setDescription('Examples: 10m, 2 hours, 3d (maximum 30 days)')
      .setMaxLength(30)
      .setRequired(true))
    .addStringOption((option) => option
      .setName('message')
      .setDescription('What should I remind you about?')
      .setMaxLength(500)
      .setRequired(true)),
  new SlashCommandBuilder()
    .setName('server')
    .setDescription('Show a quick server status card.'),
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show your XP rank—or spy on someone else’s.')
    .addUserOption((option) => option
      .setName('member')
      .setDescription('Member to inspect')
      .setRequired(false)),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server’s top ten chatterboxes.'),
  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Launch a reaction poll.')
    .addStringOption((option) => option
      .setName('question')
      .setDescription('What are people voting on?')
      .setMaxLength(200)
      .setRequired(true))
    .addStringOption((option) => option
      .setName('choices')
      .setDescription('Two to five choices separated with |')
      .setMaxLength(410)
      .setRequired(true)),
  new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Drop an idea into the server suggestion box.')
    .addStringOption((option) => option
      .setName('idea')
      .setDescription('Your brilliant—or beautifully chaotic—idea')
      .setMaxLength(1000)
      .setRequired(true)),
  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll dice like 2d20+3.')
    .addStringOption((option) => option
      .setName('dice')
      .setDescription('Notation: d20, 2d6, 4d8+2')
      .setMaxLength(20)
      .setRequired(true)),
  new SlashCommandBuilder()
    .setName('choose')
    .setDescription('Make Hatclanker choose between your options.')
    .addStringOption((option) => option
      .setName('options')
      .setDescription('Two or more choices separated with |')
      .setMaxLength(1000)
      .setRequired(true)),
  new SlashCommandBuilder()
    .setName('member')
    .setDescription('Inspect a member profile and join history.')
    .addUserOption((option) => option
      .setName('user')
      .setDescription('Member to inspect')
      .setRequired(false)),
  new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Birthday announcements and calendar.')
    .addSubcommand((subcommand) => subcommand.setName('set').setDescription('Save your birthday.')
      .addIntegerOption((option) => option.setName('month').setDescription('Month number, 1–12').setMinValue(1).setMaxValue(12).setRequired(true))
      .addIntegerOption((option) => option.setName('day').setDescription('Day number, 1–31').setMinValue(1).setMaxValue(31).setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('remove').setDescription('Remove your saved birthday.'))
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('Show the birthday board.')),
  new SlashCommandBuilder()
    .setName('quote')
    .setDescription('Community quotes and anonymous confessions.')
    .addSubcommand((subcommand) => subcommand.setName('add').setDescription('Save a quote.')
      .addStringOption((option) => option.setName('text').setDescription('Quote text').setMaxLength(1000).setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('random').setDescription('Pull a random saved quote.'))
    .addSubcommand((subcommand) => subcommand.setName('confess').setDescription('Post an anonymous confession.')
      .addStringOption((option) => option.setName('text').setDescription('Confession text').setMaxLength(1500).setRequired(true))),
  new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Clank-coins, work, rewards, and the shop.')
    .addSubcommand((subcommand) => subcommand.setName('balance').setDescription('Check a balance.')
      .addUserOption((option) => option.setName('member').setDescription('Member to inspect').setRequired(false)))
    .addSubcommand((subcommand) => subcommand.setName('daily').setDescription('Claim your daily clank-coins.'))
    .addSubcommand((subcommand) => subcommand.setName('work').setDescription('Work a virtual shift for coins.'))
    .addSubcommand((subcommand) => subcommand.setName('pay').setDescription('Pay another member.')
      .addUserOption((option) => option.setName('member').setDescription('Recipient').setRequired(true))
      .addIntegerOption((option) => option.setName('amount').setDescription('Amount to send').setMinValue(1).setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('shop').setDescription('Browse the virtual shop.'))
    .addSubcommand((subcommand) => subcommand.setName('buy').setDescription('Buy a shop item.')
      .addStringOption((option) => option.setName('item').setDescription('Shop item ID').setRequired(true))),
  new SlashCommandBuilder()
    .setName('custom')
    .setDescription('Manage custom server commands.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) => subcommand.setName('add').setDescription('Create or update a !command.')
      .addStringOption((option) => option.setName('trigger').setDescription('Trigger without spaces').setMaxLength(32).setRequired(true))
      .addStringOption((option) => option.setName('response').setDescription('Response text').setMaxLength(1800).setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('remove').setDescription('Remove a !command.')
      .addStringOption((option) => option.setName('trigger').setDescription('Trigger').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List custom commands.')),
  new SlashCommandBuilder()
    .setName('character')
    .setDescription('Store or display a TTRPG character sheet.')
    .addSubcommand((subcommand) => subcommand.setName('set').setDescription('Save your sheet link.')
      .addStringOption((option) => option.setName('game').setDescription('D&D 5e, Pathfinder, etc.').setMaxLength(80).setRequired(true))
      .addStringOption((option) => option.setName('url').setDescription('Character sheet URL').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('show').setDescription('Show a saved character sheet.')
      .addUserOption((option) => option.setName('member').setDescription('Member to inspect').setRequired(false))),
  new SlashCommandBuilder()
    .setName('game')
    .setDescription('Run an in-chat mini-game.')
    .addSubcommand((subcommand) => subcommand.setName('hangman').setDescription('Start Hangman in this channel.'))
    .addSubcommand((subcommand) => subcommand.setName('guess').setDescription('Guess a Hangman letter.')
      .addStringOption((option) => option.setName('letter').setDescription('One letter').setMinLength(1).setMaxLength(1).setRequired(true))),
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start a timed giveaway.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption((option) => option.setName('prize').setDescription('What can people win?').setMaxLength(200).setRequired(true))
    .addStringOption((option) => option.setName('duration').setDescription('Example: 30m, 2h, 3d').setRequired(true)),
  new SlashCommandBuilder()
    .setName('event')
    .setDescription('Schedule server events and reminders.')
    .addSubcommand((subcommand) => subcommand.setName('create').setDescription('Schedule an event.')
      .addStringOption((option) => option.setName('title').setDescription('Event title').setMaxLength(150).setRequired(true))
      .addStringOption((option) => option.setName('in').setDescription('Starts in: 30m, 2h, 3d').setRequired(true))
      .addStringOption((option) => option.setName('details').setDescription('Event details').setMaxLength(1000).setRequired(false)))
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('Show upcoming events.')),
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Open or close a private support ticket.')
    .addSubcommand((subcommand) => subcommand.setName('open').setDescription('Create your private ticket.'))
    .addSubcommand((subcommand) => subcommand.setName('close').setDescription('Close the current ticket.')),
  new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Open the server application form.'),
  new SlashCommandBuilder()
    .setName('tournament')
    .setDescription('Create and track an elimination tournament.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand((subcommand) => subcommand.setName('create').setDescription('Create a tournament.')
      .addStringOption((option) => option.setName('name').setDescription('Tournament name').setMaxLength(100).setRequired(true))
      .addStringOption((option) => option.setName('teams').setDescription('Teams separated with |').setMaxLength(1500).setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('eliminate').setDescription('Eliminate a team.')
      .addStringOption((option) => option.setName('team').setDescription('Exact team name').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Show the current bracket.')),
  new SlashCommandBuilder()
    .setName('support-links')
    .setDescription('Show configured payment and membership links.'),
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Post verification and self-role panels.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) => subcommand.setName('rules').setDescription('Post rule acceptance and CAPTCHA verification.')
      .addChannelOption((option) => option.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText).setRequired(false)))
    .addSubcommand((subcommand) => subcommand.setName('roles').setDescription('Post the self-role chooser.')
      .addChannelOption((option) => option.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText).setRequired(false)))
    .addSubcommand((subcommand) => subcommand.setName('interests').setDescription('Post the onboarding interests form.')
      .addChannelOption((option) => option.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText).setRequired(false))),
  new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Show tracked successful invites.')
    .addUserOption((option) => option.setName('member').setDescription('Member to inspect').setRequired(false)),
  new SlashCommandBuilder()
    .setName('music')
    .setDescription('Voice music and queue controls.')
    .addSubcommand((subcommand) => subcommand.setName('play').setDescription('Play a search, URL, or live audio source.')
      .addStringOption((option) => option.setName('query').setDescription('YouTube, Spotify, SoundCloud, or search').setMaxLength(500).setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('skip').setDescription('Skip the current track.'))
    .addSubcommand((subcommand) => subcommand.setName('stop').setDescription('Stop and clear the queue.'))
    .addSubcommand((subcommand) => subcommand.setName('pause').setDescription('Pause playback.'))
    .addSubcommand((subcommand) => subcommand.setName('resume').setDescription('Resume playback.'))
    .addSubcommand((subcommand) => subcommand.setName('shuffle').setDescription('Shuffle queued tracks.'))
    .addSubcommand((subcommand) => subcommand.setName('loop').setDescription('Toggle track looping.')
      .addBooleanOption((option) => option.setName('enabled').setDescription('Loop current track').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('queue').setDescription('Show the current queue.')),
  new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Generate a captioned meme from an uploaded image.')
    .addAttachmentOption((option) => option.setName('image').setDescription('Image under 8 MB').setRequired(true))
    .addStringOption((option) => option.setName('top').setDescription('Top caption').setMaxLength(100).setRequired(false))
    .addStringOption((option) => option.setName('bottom').setDescription('Bottom caption').setMaxLength(100).setRequired(false)),
  new SlashCommandBuilder()
    .setName('moderate')
    .setDescription('Warnings, timeouts, and message cleanup.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((subcommand) => subcommand.setName('warn').setDescription('Issue a persistent strike.')
      .addUserOption((option) => option.setName('member').setDescription('Member').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setMaxLength(500).setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('warnings').setDescription('View a member’s strikes.')
      .addUserOption((option) => option.setName('member').setDescription('Member').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('timeout').setDescription('Temporarily mute a member.')
      .addUserOption((option) => option.setName('member').setDescription('Member').setRequired(true))
      .addIntegerOption((option) => option.setName('minutes').setDescription('1–10080 minutes').setMinValue(1).setMaxValue(10080).setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setMaxLength(500).setRequired(false)))
    .addSubcommand((subcommand) => subcommand.setName('clear').setDescription('Delete recent messages.')
      .addIntegerOption((option) => option.setName('amount').setDescription('1–100 messages').setMinValue(1).setMaxValue(100).setRequired(true))),
  new SlashCommandBuilder()
    .setName('security')
    .setDescription('Inspect or control server security.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Show filter and raid status.'))
    .addSubcommand((subcommand) => subcommand.setName('lockdown').setDescription('Lock a text channel.')
      .addChannelOption((option) => option.setName('channel').setDescription('Defaults to current channel').addChannelTypes(ChannelType.GuildText).setRequired(false)))
    .addSubcommand((subcommand) => subcommand.setName('unlock').setDescription('Restore a locked channel.')
      .addChannelOption((option) => option.setName('channel').setDescription('Defaults to current channel').addChannelTypes(ChannelType.GuildText).setRequired(false))),
  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post a polished staff announcement.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) => option.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption((option) => option.setName('title').setDescription('Announcement title').setMaxLength(200).setRequired(true))
    .addStringOption((option) => option.setName('message').setDescription('Announcement body').setMaxLength(3000).setRequired(true)),
  new SlashCommandBuilder()
    .setName('time')
    .setDescription('Show the current time in any timezone.')
    .addStringOption((option) => option.setName('timezone').setDescription('Example: Asia/Dubai').setRequired(true)),
  new SlashCommandBuilder()
    .setName('currency')
    .setDescription('Convert currencies using current reference rates.')
    .addNumberOption((option) => option.setName('amount').setDescription('Amount').setMinValue(0).setRequired(true))
    .addStringOption((option) => option.setName('from').setDescription('Three-letter code, e.g. AED').setMinLength(3).setMaxLength(3).setRequired(true))
    .addStringOption((option) => option.setName('to').setDescription('Three-letter code, e.g. USD').setMinLength(3).setMaxLength(3).setRequired(true)),
  new SlashCommandBuilder()
    .setName('ai')
    .setDescription('Chat with Hatclanker through an optional local Ollama model.')
    .addStringOption((option) => option.setName('prompt').setDescription('What do you want to ask?').setMaxLength(1500).setRequired(true)),
  new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate text through a configured LibreTranslate service.')
    .addStringOption((option) => option.setName('text').setDescription('Text to translate').setMaxLength(1500).setRequired(true))
    .addStringOption((option) => option.setName('target').setDescription('Target language code, e.g. ar, en, fr').setMaxLength(10).setRequired(true)),
  new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Export a safe server channel and role template.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('poll-results')
    .setDescription('Export reaction-vote analytics as a chart and CSV.')
    .addStringOption((option) => option.setName('message_id').setDescription('Poll message ID in this channel').setRequired(true)),
  new SlashCommandBuilder()
    .setName('game-stats')
    .setDescription('Fetch live player stats from a configured gaming provider.')
    .addStringOption((option) => option.setName('service').setDescription('Configured service ID').setRequired(true))
    .addStringOption((option) => option.setName('player').setDescription('Player name or ID').setRequired(true)),
  new SlashCommandBuilder()
    .setName('pomodoro')
    .setDescription('Run a shared focus timer in this channel.')
    .addSubcommand((sub) => sub.setName('start').setDescription('Start a synchronized focus room.')
      .addIntegerOption((option) => option.setName('focus').setDescription('Focus minutes').setMinValue(1).setMaxValue(180).setRequired(false))
      .addIntegerOption((option) => option.setName('break').setDescription('Break minutes').setMinValue(1).setMaxValue(60).setRequired(false))
      .addIntegerOption((option) => option.setName('cycles').setDescription('Number of focus cycles').setMinValue(1).setMaxValue(12).setRequired(false)))
    .addSubcommand((sub) => sub.setName('join').setDescription('Join the active room.'))
    .addSubcommand((sub) => sub.setName('status').setDescription('Show the active timer.'))
    .addSubcommand((sub) => sub.setName('stop').setDescription('Stop the active timer.')),
  new SlashCommandBuilder()
    .setName('flashcard')
    .setDescription('Create and review shared flashcard decks.')
    .addSubcommand((sub) => sub.setName('create').setDescription('Create a deck.')
      .addStringOption((option) => option.setName('deck').setDescription('Deck name').setMaxLength(50).setRequired(true)))
    .addSubcommand((sub) => sub.setName('add').setDescription('Add a card.')
      .addStringOption((option) => option.setName('deck').setDescription('Deck name').setMaxLength(50).setRequired(true))
      .addStringOption((option) => option.setName('question').setDescription('Front of card').setMaxLength(500).setRequired(true))
      .addStringOption((option) => option.setName('answer').setDescription('Back of card').setMaxLength(1000).setRequired(true)))
    .addSubcommand((sub) => sub.setName('review').setDescription('Draw a card with a hidden answer.')
      .addStringOption((option) => option.setName('deck').setDescription('Deck name').setMaxLength(50).setRequired(true)))
    .addSubcommand((sub) => sub.setName('list').setDescription('List available decks.')),
  new SlashCommandBuilder()
    .setName('calendar')
    .setDescription('Send an event to the configured Google Calendar bridge.')
    .addSubcommand((sub) => sub.setName('add').setDescription('Create a calendar event.')
      .addStringOption((option) => option.setName('title').setDescription('Event title').setMaxLength(150).setRequired(true))
      .addStringOption((option) => option.setName('start').setDescription('ISO date/time, e.g. 2026-10-20T18:00+04:00').setRequired(true))
      .addIntegerOption((option) => option.setName('minutes').setDescription('Duration').setMinValue(5).setMaxValue(1440).setRequired(false))
      .addStringOption((option) => option.setName('details').setDescription('Optional notes').setMaxLength(1000).setRequired(false)))
    .addSubcommand((sub) => sub.setName('status').setDescription('Check Calendar bridge configuration.')),
  new SlashCommandBuilder()
    .setName('habit')
    .setDescription('Track daily habits and streaks.')
    .addSubcommand((sub) => sub.setName('add').setDescription('Add a habit.')
      .addStringOption((option) => option.setName('name').setDescription('Habit name').setMaxLength(50).setRequired(true)))
    .addSubcommand((sub) => sub.setName('check').setDescription('Check in today.')
      .addStringOption((option) => option.setName('name').setDescription('Habit name').setMaxLength(50).setRequired(true)))
    .addSubcommand((sub) => sub.setName('status').setDescription('Show your habits.'))
    .addSubcommand((sub) => sub.setName('remove').setDescription('Remove a habit.')
      .addStringOption((option) => option.setName('name').setDescription('Habit name').setMaxLength(50).setRequired(true))),
  new SlashCommandBuilder()
    .setName('math')
    .setDescription('Evaluate, simplify, differentiate, or integrate math.')
    .addStringOption((option) => option.setName('expression').setDescription('A math expression').setMaxLength(500).setRequired(true))
    .addStringOption((option) => option.setName('mode').setDescription('Operation').setRequired(false).addChoices(
      { name: 'Evaluate', value: 'evaluate' }, { name: 'Simplify', value: 'simplify' },
      { name: 'Derivative', value: 'derivative' }, { name: 'Integral', value: 'integral' }))
    .addStringOption((option) => option.setName('variable').setDescription('Variable for calculus, default x').setMaxLength(20).setRequired(false)),
  new SlashCommandBuilder()
    .setName('dictionary')
    .setDescription('Look up definitions, phonetics, and synonyms.')
    .addStringOption((option) => option.setName('word').setDescription('Word to define').setMaxLength(80).setRequired(true)),
  new SlashCommandBuilder()
    .setName('compliment')
    .setDescription('Send a kind anonymous note to a server member.')
    .addUserOption((option) => option.setName('member').setDescription('Recipient').setRequired(true))
    .addStringOption((option) => option.setName('message').setDescription('Keep it kind').setMaxLength(500).setRequired(true)),
  new SlashCommandBuilder()
    .setName('wiki')
    .setDescription('Get a compact Wikipedia topic summary.')
    .addStringOption((option) => option.setName('topic').setDescription('Article topic').setMaxLength(150).setRequired(true)),
  new SlashCommandBuilder()
    .setName('writing-prompt')
    .setDescription('Draw a creative writing prompt.'),
  new SlashCommandBuilder()
    .setName('imagine')
    .setDescription('Generate artwork with the configured image provider.')
    .addStringOption((option) => option.setName('prompt').setDescription('Describe the image').setMaxLength(1000).setRequired(true)),
  new SlashCommandBuilder()
    .setName('transcribe')
    .setDescription('Turn an audio attachment into searchable text.')
    .addAttachmentOption((option) => option.setName('audio').setDescription('Audio file').setRequired(true)),
  new SlashCommandBuilder()
    .setName('tts')
    .setDescription('Generate speech using configured, consent-safe voices.')
    .addStringOption((option) => option.setName('text').setDescription('Text to speak').setMaxLength(1000).setRequired(true))
    .addStringOption((option) => option.setName('voice').setDescription('Configured voice preset').setMaxLength(50).setRequired(false)),
  new SlashCommandBuilder()
    .setName('image-tool')
    .setDescription('Analyze or transform an uploaded image.')
    .addStringOption((option) => option.setName('action').setDescription('Image operation').setRequired(true).addChoices(
      { name: 'Color palette', value: 'palette' }, { name: 'Upscale', value: 'upscale' },
      { name: 'Remove background', value: 'background' }, { name: 'Face swap', value: 'face-swap' }))
    .addAttachmentOption((option) => option.setName('image').setDescription('Source image').setRequired(true))
    .addBooleanOption((option) => option.setName('consent').setDescription('You have permission from people shown').setRequired(false)),
  new SlashCommandBuilder()
    .setName('code-review')
    .setDescription('Review code with the configured local AI model.')
    .addStringOption((option) => option.setName('code').setDescription('Code to review').setMaxLength(3500).setRequired(true))
    .addStringOption((option) => option.setName('language').setDescription('Programming language').setMaxLength(30).setRequired(false)),
  new SlashCommandBuilder()
    .setName('subtitles')
    .setDescription('Create an SRT subtitle file from audio.')
    .addAttachmentOption((option) => option.setName('audio').setDescription('Audio file').setRequired(true)),
  new SlashCommandBuilder()
    .setName('story')
    .setDescription('Continue a cooperative channel story with local AI.')
    .addSubcommand((sub) => sub.setName('continue').setDescription('Add a sentence and generate the next passage.')
      .addStringOption((option) => option.setName('sentence').setDescription('Your contribution').setMaxLength(1000).setRequired(true)))
    .addSubcommand((sub) => sub.setName('show').setDescription('Show the current story.'))
    .addSubcommand((sub) => sub.setName('reset').setDescription('Reset this channel story.')),
  new SlashCommandBuilder()
    .setName('pet')
    .setDescription('Care for the server’s shared virtual mascot.')
    .addSubcommand((sub) => sub.setName('status').setDescription('Check the pet.'))
    .addSubcommand((sub) => sub.setName('feed').setDescription('Feed the pet.'))
    .addSubcommand((sub) => sub.setName('clean').setDescription('Clean the pet.'))
    .addSubcommand((sub) => sub.setName('play').setDescription('Play with the pet.'))
    .addSubcommand((sub) => sub.setName('name').setDescription('Name the pet.')
      .addStringOption((option) => option.setName('name').setDescription('New name').setMaxLength(30).setRequired(true))),
  new SlashCommandBuilder()
    .setName('fortune')
    .setDescription('Get an entertainment-only horoscope or tarot draw.')
    .addStringOption((option) => option.setName('type').setDescription('Reading type').setRequired(true).addChoices(
      { name: 'Horoscope', value: 'horoscope' }, { name: 'Tarot', value: 'tarot' }))
    .addStringOption((option) => option.setName('sign').setDescription('Your zodiac sign').setMaxLength(20).setRequired(false)),
  new SlashCommandBuilder()
    .setName('akinator')
    .setDescription('Play Hatclanker’s local 20-questions character guesser.')
    .addSubcommand((sub) => sub.setName('start').setDescription('Start a guessing round.'))
    .addSubcommand((sub) => sub.setName('stop').setDescription('Stop your round.')),
  new SlashCommandBuilder()
    .setName('urban')
    .setDescription('Look up internet slang through Urban Dictionary.')
    .addStringOption((option) => option.setName('term').setDescription('Slang term').setMaxLength(80).setRequired(true)),
  new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Show current conditions and a short forecast.')
    .addStringOption((option) => option.setName('city').setDescription('City or place').setMaxLength(100).setRequired(true)),
  new SlashCommandBuilder()
    .setName('flight')
    .setDescription('Check a flight through the configured live-flight provider.')
    .addStringOption((option) => option.setName('number').setDescription('Flight number, e.g. EK202').setMaxLength(15).setRequired(true)),
  new SlashCommandBuilder()
    .setName('random-fact')
    .setDescription('Drop a sourced science or history fact.'),
  new SlashCommandBuilder()
    .setName('spin')
    .setDescription('Give a friend praise or a playful clean roast.')
    .addStringOption((option) => option.setName('type').setDescription('Choose the vibe').setRequired(true).addChoices(
      { name: 'Compliment', value: 'compliment' }, { name: 'Playful roast', value: 'roast' }))
    .addUserOption((option) => option.setName('member').setDescription('Target member').setRequired(true)),
  new SlashCommandBuilder()
    .setName('purge-filter')
    .setDescription('Delete recent messages matching a precise filter.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) => option.setName('filter').setDescription('What to match').setRequired(true).addChoices(
      { name: 'Specific member', value: 'user' }, { name: 'Messages containing links', value: 'links' }, { name: 'Text contains', value: 'text' }))
    .addIntegerOption((option) => option.setName('scan').setDescription('Recent messages to scan').setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption((option) => option.setName('member').setDescription('Required for member filter').setRequired(false))
    .addStringOption((option) => option.setName('text').setDescription('Required for text filter').setMaxLength(100).setRequired(false)),
  new SlashCommandBuilder()
    .setName('channel-clone')
    .setDescription('Clone a channel’s settings and permission overwrites.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((option) => option.setName('channel').setDescription('Channel to clone').setRequired(true))
    .addStringOption((option) => option.setName('name').setDescription('Optional new name').setMaxLength(90).setRequired(false)),
  new SlashCommandBuilder()
    .setName('system-tools')
    .setDescription('Configure counting, starboard, and rotating status tools.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('counting').setDescription('Choose the counting-game channel.')
      .addChannelOption((option) => option.setName('channel').setDescription('Counting channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((sub) => sub.setName('starboard').setDescription('Choose the starboard channel.')
      .addChannelOption((option) => option.setName('channel').setDescription('Starboard channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addIntegerOption((option) => option.setName('threshold').setDescription('Stars required').setMinValue(1).setMaxValue(25).setRequired(false)))
    .addSubcommand((sub) => sub.setName('status').setDescription('Show utility configuration.')),
  new SlashCommandBuilder()
    .setName('honeypot')
    .setDescription('Create or disable a guarded spam-trap channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('create').setDescription('Create a trap channel for unverified accounts.')
      .addStringOption((option) => option.setName('name').setDescription('Channel name').setMaxLength(90).setRequired(false)))
    .addSubcommand((sub) => sub.setName('disable').setDescription('Disable a trap without deleting it.')),
  new SlashCommandBuilder()
    .setName('audit-export')
    .setDescription('Export recent Discord audit-log entries as a text file.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
    .addIntegerOption((option) => option.setName('limit').setDescription('Entries, 1–100').setMinValue(1).setMaxValue(100).setRequired(false)),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Measure bot gateway and interaction latency.'),
  new SlashCommandBuilder()
    .setName('dm-alerts')
    .setDescription('Opt in or out of server emergency DM alerts.')
    .addStringOption((option) => option.setName('choice').setDescription('Your preference').setRequired(true).addChoices(
      { name: 'Opt in', value: 'in' }, { name: 'Opt out', value: 'out' })),
  new SlashCommandBuilder()
    .setName('dm-broadcast')
    .setDescription('DM an emergency notice only to opted-in members.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('message').setDescription('Emergency announcement').setMaxLength(1500).setRequired(true)),
  new SlashCommandBuilder()
    .setName('emoji-clone')
    .setDescription('Add an externally hosted emoji to this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
    .addStringOption((option) => option.setName('name').setDescription('New emoji name').setMinLength(2).setMaxLength(32).setRequired(true))
    .addStringOption((option) => option.setName('url').setDescription('Direct image URL').setRequired(true)),
  new SlashCommandBuilder()
    .setName('self-destruct')
    .setDescription('Post a message that automatically disappears.')
    .addStringOption((option) => option.setName('message').setDescription('Temporary message').setMaxLength(1800).setRequired(true))
    .addIntegerOption((option) => option.setName('seconds').setDescription('5–3600 seconds').setMinValue(5).setMaxValue(3600).setRequired(false)),
  new SlashCommandBuilder()
    .setName('about')
    .setDescription('Who—or what—is Hatclanker?'),
  new SlashCommandBuilder()
    .setName('doctor')
    .setDescription('Check why Hatclanker cannot send messages, embeds, or emoji.')
    .addChannelOption((option) => option
      .setName('channel')
      .setDescription('Channel to diagnose; defaults to the current channel')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)),
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Post the permanent Hatclanker welcome panel in a channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) => option
      .setName('channel')
      .setDescription('Where the welcome panel should live')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true))
].map((command) => command.setContexts(InteractionContextType.Guild).toJSON());
