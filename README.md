Recut  repurpose long lessons into short clips

Recut helps educators and experts turn long-form lesson videos into short-form clips (YouTube Shorts, Instagram Reels, TikTok) with minimal manual work. Upload or link a video and Recut will automatically identify promising moments and produce trimmed MP4s ready for sharing.

Status: Prototype (alpha)
- Core flows implemented in a minimal Next.js prototype.
- Clip suggestion is currently heuristic / mock-driven; transcript-based suggestions are planned.
- Trimming works via ffmpeg (and yt-dlp for YouTube sources) when available on the host.

Key features
- Analyze a source video or YouTube link and return suggested short clips with thumbnails.
- Trim a selected moment into an MP4 for direct download.
- Health endpoint to check availability of ffmpeg and yt-dlp.

Quickstart (developer)
1. Install dependencies:

```bash
npm install
```

2. Run the dev server:

```bash
npm run dev
```

Open http://localhost:3000

API endpoints (overview)
- POST /api/process  analyze a video URL and return suggested clips.
  - Payload: { "url": "<video-or-youtube-link>" }
  - Response: { "clips": [ { "id", "title", "start", "end", "thumbnail" }, ... ] }
- POST /api/trim  produce a trimmed MP4 clip.
  - Payload: { "url": "<video-or-youtube-link>", "start": <seconds>, "end": <seconds> }
  - Response: binary video/mp4 download on success.
- GET /api/health  reports ffmpeg, yt-dlp, and Node availability.

Requirements for trimming
- ffmpeg (required)
- yt-dlp (required for trimming from YouTube links)

Install via your OS package manager (Homebrew, apt, choco, etc.) or download from official sites.

Current limitations
- Clip suggestions are not yet transcript-aware (no speech-to-text integration).
- UI is minimal and intended as a prototype.
- No authentication or multi-user workflow yet.

Roadmap (next small improvements)
1. Add transcript-based clip detection (STT + chaptering).
2. Improve UI to preview clips before downloading.
3. Add clear server-side checks and user-facing errors when dependencies are missing.

Contributing
PRs welcome. See the LICENSE file for licensing (MIT).

License
MIT  see the LICENSE file.
