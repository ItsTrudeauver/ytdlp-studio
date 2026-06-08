# yt-dlp Studio interface notes

v4.1 keeps the current layout but makes the visual language plainer and more tool-like.

## Direction

- AMOLED black base.
- YouTube red as the only primary accent.
- Simple mode first: paste URL, choose preset, choose filename parts, download.
- Advanced mode is intentionally dense and detailed.
- Help bubbles explain the effect on downloaded files, not technical jargon.

## Main-screen rules

The default visible controls should stay limited to the most common choices:

1. URL and analysis mode.
2. Simple preset.
3. Filename parts.
4. Download / command preview.

Everything else belongs in Advanced unless it is needed for the current action.

## Filename rule

The generated filename template applies to the main media file and side files:

- video/audio file
- separate subtitles/captions
- thumbnail
- description
- info JSON

That keeps split caption files aligned with the video filename.
