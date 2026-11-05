# 🥣 FrostedFlakes

An AI notepad for people in back-to-back meetings. You take rough notes, FrostedFlakes
transcribes the meeting from your own device (no bot joins the call), and then **enhances** your notes by
combining them with the transcript. Built with Next.js and Claude.

## Features

| | |
|---|---|
| **Bot-free live transcription** | Hit **Record** and FrostedFlakes listens through your mic in the browser (Web Speech API), with a live level meter and timer. Pause and resume whenever you like. You can also paste a transcript. |
| **Notepad first** | A plain, distraction-free editor. Type short fragments during the call and let the AI fill in the rest. |
| **✨ Enhance notes** | Claude merges your notes with the transcript into structured notes: a summary, sections, and action items with owners. **Your points show in black and AI additions in gray**, so you can tell what came from you. Click any line to edit it. |
| **Templates** | Built in: Auto, 1:1, Stand-up, Customer Discovery, Sales Call (BANT), Candidate Interview, Brainstorm. You can add your own sections and instructions. Switching template regenerates the notes. |
| **Ask (per meeting)** | Chat with a meeting: "Write a follow-up email", "What did I miss?", "Draft a Slack recap". |
| **Ask FrostedFlakes (across meetings)** | Chat across every meeting, or just one folder: "What did I commit to this week?", "Prep me for my next call". |
| **Calendar** | Paste a private iCal URL (Google, Outlook, iCloud) to see upcoming meetings. One click starts a note with the title and attendees already filled in. Recurring events are supported. |
| **Folders & search** | Organize notes into folders and search full text across notes, enhanced notes and transcripts. |
| **Sharing** | Create a public read-only link, copy the notes as Markdown, or download a `.md` file. |
| **Speaker labels** | Lines are marked Me/Them. Click a label to switch it. |

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Use **Chrome or Edge** for live transcription; Safari works too. Firefox doesn't support the Web Speech API,
but note-taking, pasted transcripts and every AI feature still work there.

Data is stored locally in `data/db.json`, which is gitignored.

## How it works

- `src/lib/ai.ts` handles the Claude calls (`claude-opus-5-5` with adaptive thinking):
  - **Enhance** uses structured outputs (a JSON schema) so each bullet carries `source: "user" | "ai"`.
  - **Chat** streams its answer as plain text. The meeting material goes in a cached system block, so follow-up questions are cheap.
  - Server-side refusal fallback (`fallbacks: "default"`) is turned on.
- `src/components/useTranscriber.ts` does browser speech-to-text, restarts automatically, and drives the audio level meter.
- `src/lib/ics.ts` is a dependency-free iCal parser. It handles TZIDs, DST and DAILY/WEEKLY RRULEs.
- `src/lib/db.ts` is a JSON-file store with serialized writes.

## Known MVP limitations

- Transcription uses the **microphone only**. On a call with headphones, the other people's voices aren't captured.
  Capturing system or tab audio needs a desktop app or a streaming speech-to-text service like Deepgram or AssemblyAI.
  That's the natural next step.
- There's no speaker diarization beyond Me/Them, which you set by hand.
- It's single-user and local, with no auth. Share links are public to anyone who has the URL and can reach your server.
