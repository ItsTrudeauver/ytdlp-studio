import { state } from './js/state.js';
import { els } from './js/dom.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function toast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.style.borderColor = isError ? 'rgba(255,78,69,.65)' : 'rgba(255,0,0,.45)';
  els.toast.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.add('hidden'), 5200);
}

function bytesToHuman(value) {
  if (!value || value <= 0) return 'unknown';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let size = Number(value);
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  const decimals = i === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(decimals)} ${units[i]}`;
}

function formatSize(fmt) {
  return fmt?.filesize || fmt?.filesize_approx || fmt?.size || 0;
}

function totalSelectedSize(video, audio) {
  if (!video && !audio) return 0;
  let total = 0;
  if (video) total += formatSize(video);
  if (audio && !(video && video.is_combined)) total += formatSize(audio);
  return total;
}

function qualityText(fmt) {
  if (!fmt) return '—';
  if (fmt.resolution && fmt.resolution !== 'audio only') return fmt.resolution;
  if (fmt.width && fmt.height) return `${fmt.width}x${fmt.height}`;
  if (fmt.height) return `${fmt.height}p`;
  return fmt.format_note || '—';
}

function optionLabel(fmt) {
  const size = bytesToHuman(formatSize(fmt));
  const codec = fmt.is_audio_only ? fmt.acodec : `${fmt.vcodec}${fmt.has_audio ? ` + ${fmt.acodec}` : ''}`;
  const note = fmt.format_note ? ` · ${fmt.format_note}` : '';
  return `${fmt.format_id} · ${fmt.ext || '?'} · ${qualityText(fmt)} · ${size} · ${codec}${note}`;
}

function selectedOptionFormat(select) {
  const id = select.value;
  if (!id || id === 'none' || id === 'auto') return null;
  return state.formats.find((fmt) => String(fmt.format_id) === String(id)) || null;
}

function bySmallestKnownSize(a, b) {
  const as = formatSize(a) || Number.MAX_SAFE_INTEGER;
  const bs = formatSize(b) || Number.MAX_SAFE_INTEGER;
  return as - bs;
}

function pickSmallestAudio(formats = state.audioFormats) {
  return [...formats].filter(formatSize).sort(bySmallestKnownSize)[0] || formats[0] || null;
}

function pickBestAudio(formats = state.audioFormats) {
  return [...formats].sort((a, b) => (b.abr || 0) - (a.abr || 0) || bySmallestKnownSize(a, b))[0] || null;
}

function pickSmallestAtMaxHeight(maxHeight, formats = state.videoFormats) {
  const candidates = formats.filter((fmt) => fmt.height && fmt.height <= maxHeight && formatSize(fmt));
  if (!candidates.length) return null;
  const bestHeight = Math.max(...candidates.map((fmt) => fmt.height || 0));
  return candidates.filter((fmt) => fmt.height === bestHeight).sort(bySmallestKnownSize)[0];
}

function pickBestVideo(formats = state.videoFormats) {
  return [...formats].sort((a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0))[0] || null;
}

function splitFormats(formats) {
  const combinedFormats = formats.filter((fmt) => fmt.is_combined).sort((a, b) => (b.height || 0) - (a.height || 0));
  const videoOnly = formats.filter((fmt) => fmt.has_video && !fmt.has_audio).sort((a, b) => (b.height || 0) - (a.height || 0) || bySmallestKnownSize(a, b));
  const videoFormats = [...videoOnly, ...combinedFormats];
  const audioFormats = formats.filter((fmt) => fmt.is_audio_only).sort((a, b) => (b.abr || 0) - (a.abr || 0) || bySmallestKnownSize(a, b));
  return { videoFormats, audioFormats, combinedFormats };
}

function populateSelects() {
  els.videoSelect.innerHTML = '';
  els.audioSelect.innerHTML = '';

  const vAuto = new Option('Auto video: best compatible selector', 'auto');
  const vNone = new Option('No video / audio only', 'none');
  els.videoSelect.add(vAuto);
  els.videoSelect.add(vNone);
  state.videoFormats.forEach((fmt) => els.videoSelect.add(new Option(optionLabel(fmt), fmt.format_id)));

  const aAuto = new Option('Auto audio', 'auto');
  const aNone = new Option('No separate audio', 'none');
  els.audioSelect.add(aAuto);
  els.audioSelect.add(aNone);
  state.audioFormats.forEach((fmt) => els.audioSelect.add(new Option(optionLabel(fmt), fmt.format_id)));
}

function setActivePreset(preset) {
  state.selectedPreset = preset;
  document.querySelectorAll('.preset-card').forEach((button) => {
    button.classList.toggle('active', button.dataset.preset === preset);
  });
}

function applyPreset(preset, preserveManual = false) {
  setActivePreset(preset);
  if (!state.current) return;

  if (preset === 'audio') {
    const audio = pickSmallestAudio() || pickBestAudio();
    els.videoSelect.value = 'none';
    els.audioSelect.value = audio ? audio.format_id : 'auto';
  } else if (preset === 'subtitles') {
    els.videoSelect.value = 'none';
    els.audioSelect.value = 'none';
  } else if (preset === 'best') {
    els.videoSelect.value = 'auto';
    els.audioSelect.value = 'auto';
  } else if (preset === 'storage720') {
    const video = pickSmallestAtMaxHeight(720) || pickBestVideo();
    const audio = pickSmallestAudio();
    els.videoSelect.value = video ? video.format_id : 'auto';
    els.audioSelect.value = audio ? audio.format_id : 'auto';
  } else if (preset === 'storage1080') {
    const video = pickSmallestAtMaxHeight(1080) || pickBestVideo();
    const audio = pickSmallestAudio();
    els.videoSelect.value = video ? video.format_id : 'auto';
    els.audioSelect.value = audio ? audio.format_id : 'auto';
  }

  updatePresetSizeHints();
  updateCommand();
}

function buildSelector() {
  const preset = state.selectedPreset;
  const isPlaylist = state.info?.kind === 'playlist';
  const video = selectedOptionFormat(els.videoSelect);
  const audio = selectedOptionFormat(els.audioSelect);

  if (isPlaylist && preset === 'storage1080') return 'bv*[height<=1080]+ba/b[height<=1080]/b';
  if (isPlaylist && preset === 'storage720') return 'bv*[height<=720]+ba/b[height<=720]/b';
  if (isPlaylist && preset === 'best') return 'bv*+ba/b';
  if (isPlaylist && preset === 'audio') return 'ba';
  if (preset === 'subtitles') return 'bv*+ba/b';

  if (preset === 'best' && els.videoSelect.value === 'auto' && els.audioSelect.value === 'auto') return 'bv*+ba/b';
  if (els.videoSelect.value === 'none') return audio ? audio.format_id : 'ba';
  if (video && audio) return `${video.format_id}+${audio.format_id}`;
  return 'bv*+ba/b';
}

function getOptionsPayload() {
  return {
    url: els.urlInput.value.trim(),
    format_selector: buildSelector(),
    merge_output_format: els.mergeSelect.value,
    output_template: els.outputTemplate.value || '%(title).180B.%(ext)s',
    download_dir: els.downloadDir.value.trim(),
    playlist_download_mode: 'native',
    cookie_source: els.cookieSource.value,
    cookies_file: els.cookiesFile.value.trim(),
    restrict_filenames: els.restrictFilenames.value === 'true',
    write_info_json: els.writeInfoJson.checked,
    write_description: els.writeDescription.checked,
    write_thumbnail: els.writeThumbnail.checked,
    embed_thumbnail: els.embedThumbnail.checked,
    embed_metadata: els.embedMetadata.checked,
    embed_chapters: els.embedChapters.checked,
  };
}

async function updateCommand() {
  if (!state.info) return;
  
  const options = getOptionsPayload();
  const targetOsElement = document.getElementById('targetOsSelect');
  const target_os = targetOsElement ? targetOsElement.value : 'linux';

  const payload = { options, target_os };

  try {
    const res = await fetch('/api/commands/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed preview generation.');
    els.commandBox.textContent = data.command || '';
  } catch (err) {
    els.commandBox.textContent = `# Error: ${err.message}`;
  }
}

// Bind dropdown change event to recalculate commands cleanly 
document.addEventListener('DOMContentLoaded', () => {
  const targetOsElement = document.getElementById('targetOsSelect');
  if (targetOsElement) {
    targetOsElement.addEventListener('change', updateCommand);
  }
});

function updatePresetSizeHints() {
  // Logic parsing inner tracking text fields directly 
}