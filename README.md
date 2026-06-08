# yt-dlp Studio v4.1

A local-first browser UI for yt-dlp. v4.1 keeps the default screen simple, then exposes detailed controls under **Advanced settings**.

## v4.1 highlights

- Simple presets:
  - Best quality
  - 1080p MP4-ish
  - 720p small
  - Audio only
  - Subtitles only
- Advanced drawer with detailed controls instead of crowding the default screen.
- Cookie support for local runs:
  - Chrome
  - Edge
  - Firefox
  - Brave
  - cookies.txt file
- Filename preview before download using yt-dlp `--print filename`.
- Checkbox-based filename builder:
  - Title
  - Video ID
  - Uploader
  - Uploader subscribers
  - Date
  - Views
  - Default: Title only
- Inline `(?)` help bubbles for unclear options.
- Subtitle controls for manual subtitles, auto captions, language selection, conversion, embedding, and subtitle-only downloads.
- Native playlist mode and selected queue mode.
- Experimental playlist combining into one long video through yt-dlp `--concat-playlist`.
- Metadata and side-file options:
  - info JSON
  - description
  - thumbnail
  - embedded thumbnail
  - embedded metadata
  - embedded chapters
- Vercel deploy files remain included, but Vercel mode is intended for analysis/command generation, not large real downloads.

## Run locally from VS Code terminal

From the inner project folder, the one containing `requirements.txt`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8787 --reload
```

Open:

```text
http://127.0.0.1:8787
```

After first setup, you can also run:

```powershell
scripts\start_windows.bat
```

## Important: ffmpeg

Install ffmpeg for:

- best-quality video/audio merging
- MP4/MKV merge output
- subtitle conversion
- embedded subtitles
- embedded thumbnails
- embedded metadata
- playlist combining

The **Setup / deploy** tab includes install helper commands.

## Cookies/login design

v4.1 does **not** store site usernames, passwords, or Studio accounts.

Instead, it lets yt-dlp reuse cookies from browsers on your own machine:

```powershell
yt-dlp --cookies-from-browser chrome "https://example.com/video"
```

or from a local cookies file:

```powershell
yt-dlp --cookies "C:\path\to\cookies.txt" "https://example.com/video"
```

If you clear browser cookies, retrying login-only downloads may fail until you log into the video site again in that browser.

Do not upload cookie files to hosted/serverless deployments. Vercel mode is best used as a command generator.

## Filename preview

Open **Advanced settings → Output and filename preview**, check the filename parts you want, then press **Preview filenames**.

The preview uses yt-dlp without downloading. Final extensions can still change after merge/post-processing.

Default filename:

```text
%(title).180B.%(ext)s
```

Adding checkboxes updates the generated template automatically. The same base filename is used for side files such as separate subtitles/captions, thumbnails, descriptions, and info JSON.

## Playlist modes

### Selected queue mode

Uses the playlist table checkboxes and sorting. Downloads selected videos one by one.

### Native playlist mode

Passes the playlist URL directly to yt-dlp. This is required for yt-dlp's native playlist item ranges and making one long playlist video.

Examples for native playlist items:

```text
1:10
5,9,12
1:20:2
-10:
```

## Combining playlist videos into one long video

Use:

1. Analyze as Playlist mode.
2. Open Advanced settings.
3. Set Playlist download mode to Native playlist command.
4. Set Combine playlist videos into one long file to Auto or Always try.

This depends on ffmpeg and compatible streams. It is not guaranteed for every playlist.

## Vercel deployment

The repo includes:

- `api/index.py`
- `vercel.json`
- `.vercelignore`

Deploy commands:

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

In Vercel/serverless mode, real downloads are disabled by default. Generate commands there, then run them locally for large files, cookie-based access, and ffmpeg processing.

## Valid URLs

The UI accepts full `http://` or `https://` URLs only. This includes direct video URLs, playlist URLs, channel URLs, and normal webpages with embedded video players.

Blocked intentionally:

- `file://`
- `ftp://`
- local file paths
- shell text
- extractor pseudo-URLs like `ytsearch:`

This is a UI safety choice. yt-dlp itself can support more forms in raw CLI mode.


## v4.1 cleanup

- Backend split into routes, services, models, and core config.
- Main app entrypoint reduced to FastAPI setup and router mounting.
- AMOLED black + YouTube red theme.
- Outcome-based (?) help copy.
- Checkbox-based filename builder: Title, ID, Uploader, Uploader subscribers, Date, Views.
- Default filename is Title only. The same filename base applies to video files and side files such as separate captions, thumbnails, descriptions, and info JSON.
- Design notes live in `design/`.
