import { state } from './js/state.js';
import { els } from './js/dom.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function toast(message, isError = false) {
  if (!els.toast) return;
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
  const id = select?.value;
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
  if (!els.videoSelect || !els.audioSelect) return;
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

  const subtitlesOnly = document.getElementById('subtitlesOnly');
  
  if (preset === 'audio') {
    const audio = pickSmallestAudio() || pickBestAudio();
    if(subtitlesOnly) subtitlesOnly.checked = false;
    if(els.videoSelect) els.videoSelect.value = 'none';
    if(els.audioSelect) els.audioSelect.value = audio ? audio.format_id : 'auto';
  } else if (preset === 'subtitles') {
    if(els.videoSelect) els.videoSelect.value = 'none';
    if(els.audioSelect) els.audioSelect.value = 'none';
    if(subtitlesOnly) subtitlesOnly.checked = true;
    const subtitlesMode = document.getElementById('subtitlesMode');
    if (subtitlesMode && subtitlesMode.value === 'none') subtitlesMode.value = 'manual';
  } else if (preset === 'best') {
    if(subtitlesOnly) subtitlesOnly.checked = false;
    if(els.videoSelect) els.videoSelect.value = 'auto';
    if(els.audioSelect) els.audioSelect.value = 'auto';
  } else if (preset === 'storage720') {
    if(subtitlesOnly) subtitlesOnly.checked = false;
    const video = pickSmallestAtMaxHeight(720) || pickBestVideo();
    const audio = pickSmallestAudio();
    if(els.videoSelect) els.videoSelect.value = video ? video.format_id : 'auto';
    if(els.audioSelect) els.audioSelect.value = audio ? audio.format_id : 'auto';
  } else if (preset === 'storage1080') {
    if(subtitlesOnly) subtitlesOnly.checked = false;
    const video = pickSmallestAtMaxHeight(1080) || pickBestVideo();
    const audio = pickSmallestAudio();
    if(els.videoSelect) els.videoSelect.value = video ? video.format_id : 'auto';
    if(els.audioSelect) els.audioSelect.value = audio ? audio.format_id : 'auto';
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

  if (preset === 'best' && els.videoSelect?.value === 'auto' && els.audioSelect?.value === 'auto') return 'bv*+ba/b';
  if (els.videoSelect?.value === 'none') return audio ? audio.format_id : 'ba';
  if (video && audio) return `${video.format_id}+${audio.format_id}`;
  return 'bv*+ba/b';
}

function getOptionsPayload() {
  const getVal = (id, fallback='') => document.getElementById(id)?.value || fallback;
  const isChecked = (id) => document.getElementById(id)?.checked || false;

  return {
    url: (els.urlInput?.value || '').trim(),
    format_selector: buildSelector(),
    merge_output_format: getVal('mergeSelect', 'auto'),
    output_template: getVal('outputTemplate', '%(title).180B.%(ext)s'),
    download_dir: getVal('downloadDir', '').trim(),
    playlist_items: [],
    playlist_download_mode: 'native',
    playlist_items_spec: '',
    concat_playlist: 'never',
    concat_output_template: '%(playlist)s - combined.%(ext)s',
    subtitles_mode: getVal('subtitlesMode', 'none'),
    subtitle_languages: getVal('subtitleLanguages', 'en'),
    subtitle_format: getVal('subtitleFormat', 'best'),
    convert_subtitles: getVal('convertSubtitles', 'none'),
    embed_subtitles: isChecked('embedSubtitles'),
    keep_subtitle_files: isChecked('keepSubtitleFiles'),
    exclude_live_chat: isChecked('excludeLiveChat'),
    subtitles_only: isChecked('subtitlesOnly'),
    use_download_archive: isChecked('useDownloadArchive'),
    cookie_source: getVal('cookieSource', 'none'),
    cookies_file: getVal('cookiesFile', '').trim(),
    restrict_filenames: getVal('restrictFilenames') === 'true',
    write_info_json: isChecked('writeInfoJson'),
    write_description: isChecked('writeDescription'),
    write_thumbnail: isChecked('writeThumbnail'),
    embed_thumbnail: isChecked('embedThumbnail'),
    embed_metadata: isChecked('embedMetadata'),
    embed_chapters: isChecked('embedChapters'),
  };
}

function updatePresetSizeHints() {
  const audio = pickSmallestAudio();
  const v1080 = pickSmallestAtMaxHeight(1080);
  const v720 = pickSmallestAtMaxHeight(720);
  if (els.presetAudioSize) els.presetAudioSize.textContent = audio ? bytesToHuman(formatSize(audio)) : '—';
  if (els.preset1080Size) els.preset1080Size.textContent = v1080 ? bytesToHuman(totalSelectedSize(v1080, audio)) : '—';
  if (els.preset720Size) els.preset720Size.textContent = v720 ? bytesToHuman(totalSelectedSize(v720, audio)) : '—';
  
  const video = selectedOptionFormat(els.videoSelect);
  const selAudio = selectedOptionFormat(els.audioSelect);
  const total = totalSelectedSize(video, selAudio);
  if (els.estimatedSize) els.estimatedSize.textContent = document.getElementById('subtitlesOnly')?.checked ? 'subtitles' : total ? bytesToHuman(total) : 'auto/unknown';
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
    if (els.commandBox) els.commandBox.textContent = data.command || '';
  } catch (err) {
    if (els.commandBox) els.commandBox.textContent = `# Error: ${err.message}`;
  }
}

async function analyze() {
  const url = els.urlInput?.value.trim();
  if (!url) {
    toast('Paste a URL first.', true);
    return;
  }
  
  if (els.analyzeBtn) {
    els.analyzeBtn.disabled = true;
    els.analyzeBtn.textContent = 'Analyzing…';
  }
  
  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        playlist_mode: els.modeSelect?.value === 'playlist',
        playlist_limit: Number(els.playlistLimit?.value) || 50
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Analysis failed.');
    
    state.info = data.info;
    state.current = data.info;
    
    const splits = splitFormats(data.info?.formats || []);
    state.videoFormats = splits.videoFormats;
    state.audioFormats = splits.audioFormats;
    state.formats = data.info?.formats || [];
    
    if (els.title) els.title.textContent = data.info.title || 'Untitled';
    if (els.thumbnail) els.thumbnail.src = data.info.thumbnail || '';
    if (els.sourceLink) els.sourceLink.href = data.info.webpage_url || url;
    
    if (els.metaLine) els.metaLine.textContent = `${data.info.duration_string || '?'} · ${data.info.view_count ? data.info.view_count.toLocaleString() + ' views' : ''}`;
    
    populateSelects();
    applyPreset('best');
    switchTab('downloadTab');
    toast('Analysis complete.');
  } catch (err) {
    toast(err.message || String(err), true);
  } finally {
    if (els.analyzeBtn) {
      els.analyzeBtn.disabled = false;
      els.analyzeBtn.textContent = 'Analyze';
    }
  }
}

async function previewFilenames() {
  if (!state.info) return;
  const btn = document.getElementById('previewFilenamesBtn');
  if(btn) btn.disabled = true;
  if(els.filenamePreviewBox) els.filenamePreviewBox.textContent = 'Fetching filenames...';
  try {
    const res = await fetch('/api/commands/filenames', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: getOptionsPayload() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Filename preview failed.');
    const lines = data.filenames?.length ? data.filenames : ['No filenames returned.'];
    const note = data.note ? `\n\n# ${data.note}` : '';
    if(els.filenamePreviewBox) els.filenamePreviewBox.textContent = lines.map((line, i) => `${String(i + 1).padStart(2, '0')}. ${line}`).join('\n') + note;
  } catch (err) {
    if(els.filenamePreviewBox) els.filenamePreviewBox.textContent = `# ${err.message || String(err)}`;
    toast(err.message || String(err), true);
  } finally {
    if(btn) btn.disabled = false;
  }
}

async function startDownload() {
  if (!state.info) return;
  if (els.runDownloadBtn) els.runDownloadBtn.disabled = true;
  try {
    const res = await fetch('/api/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: getOptionsPayload() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Download failed to start.');
    toast('Download triggered locally!');
  } catch (err) {
    toast(err.message || String(err), true);
  } finally {
    if (els.runDownloadBtn) els.runDownloadBtn.disabled = false;
  }
}

async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'ok') {
      if (els.healthPill) {
        els.healthPill.textContent = 'Backend online';
        els.healthPill.classList.add('ok');
      }
      if (data.is_vercel && els.serverlessNotice) {
        els.serverlessNotice.classList.remove('hidden');
        if (els.runDownloadBtn) els.runDownloadBtn.style.display = 'none';
      }
    }
  } catch (err) {
    if (els.healthPill) {
      els.healthPill.textContent = 'Backend unreachable';
      els.healthPill.classList.add('error');
    }
  }
}

function switchTab(tabId) {
  if (els.tabs) els.tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  if (els.tabPages) els.tabPages.forEach(page => page.classList.toggle('active', page.id === tabId));
}

document.addEventListener('DOMContentLoaded', () => {
  checkHealth();

  if (els.analyzeBtn) els.analyzeBtn.addEventListener('click', analyze);
  if (els.urlInput) els.urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') analyze(); });
  if (els.tabs) els.tabs.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  document.querySelectorAll('.preset-card').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  const changeListeners = [
    els.videoSelect, els.audioSelect, els.mergeSelect, els.outputTemplate,
    els.downloadDir, els.cookieSource, els.cookiesFile, document.getElementById('restrictFilenames'),
    document.getElementById('writeInfoJson'), document.getElementById('writeDescription'), document.getElementById('writeThumbnail'),
    document.getElementById('embedThumbnail'), document.getElementById('embedMetadata'), document.getElementById('embedChapters'),
    document.getElementById('targetOsSelect'), document.getElementById('subtitlesOnly')
  ];

  changeListeners.forEach(el => {
    if (el) {
      el.addEventListener('change', () => {
        if(el.tagName === 'SELECT' && (el.id === 'videoSelect' || el.id === 'audioSelect')) applyPreset('manual', true);
        updateCommand();
        updatePresetSizeHints();
      });
      if(el.tagName === 'INPUT' && el.type === 'text') el.addEventListener('input', updateCommand);
    }
  });

  if (els.cookieSource) {
    els.cookieSource.addEventListener('change', () => {
      if (els.cookiesFileRow) els.cookiesFileRow.classList.toggle('hidden', els.cookieSource.value !== 'cookies_txt');
    });
  }

  const previewBtn = document.getElementById('previewFilenamesBtn');
  if (previewBtn) previewBtn.addEventListener('click', previewFilenames);

  if (els.copyCommandBtn) {
    els.copyCommandBtn.addEventListener('click', () => {
      if (!els.commandBox) return;
      navigator.clipboard.writeText(els.commandBox.textContent).then(() => toast('Command copied to clipboard!'))
      .catch(err => toast('Failed to copy: ' + err.message, true));
    });
  }

  if (els.runDownloadBtn) els.runDownloadBtn.addEventListener('click', startDownload);
});