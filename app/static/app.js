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

function formatKind(fmt) {
  if (fmt.is_combined) return 'combined';
  if (fmt.is_audio_only) return 'audio';
  if (fmt.has_video) return 'video';
  return 'other';
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
    els.subtitlesOnly.checked = false;
    els.videoSelect.value = 'none';
    els.audioSelect.value = audio ? audio.format_id : 'auto';
  } else if (preset === 'subtitles') {
    els.videoSelect.value = 'none';
    els.audioSelect.value = 'none';
    els.subtitlesOnly.checked = true;
    if (els.subtitlesMode.value === 'none') els.subtitlesMode.value = 'manual';
  } else if (preset === 'best') {
    els.subtitlesOnly.checked = false;
    els.videoSelect.value = 'auto';
    els.audioSelect.value = 'auto';
  } else if (preset === 'storage720') {
    els.subtitlesOnly.checked = false;
    const video = pickSmallestAtMaxHeight(720) || pickBestVideo();
    const audio = pickSmallestAudio();
    els.videoSelect.value = video ? video.format_id : 'auto';
    els.audioSelect.value = audio ? audio.format_id : 'auto';
  } else if (preset === 'storage1080') {
    els.subtitlesOnly.checked = false;
    const video = pickSmallestAtMaxHeight(1080) || pickBestVideo();
    const audio = pickSmallestAudio();
    els.videoSelect.value = video ? video.format_id : 'auto';
    els.audioSelect.value = audio ? audio.format_id : 'auto';
  } else if (preset === 'manual' && !preserveManual) {
    els.videoSelect.value = els.videoSelect.value || 'auto';
    els.audioSelect.value = els.audioSelect.value || 'auto';
  }

  updatePresetSizeHints();
  updatePlaylistEstimate();
  updateCommand();
}

function buildSelector() {
  const preset = state.selectedPreset;
  const isPlaylist = state.info?.kind === 'playlist' && (selectedPlaylistUrls().length > 0 || els.playlistDownloadMode.value === 'native');
  const video = selectedOptionFormat(els.videoSelect);
  const audio = selectedOptionFormat(els.audioSelect);

  if (isPlaylist && preset === 'storage1080') return 'bv*[height<=1080]+ba/b[height<=1080]/b';
  if (isPlaylist && preset === 'storage720') return 'bv*[height<=720]+ba/b[height<=720]/b';
  if (isPlaylist && preset === 'best') return 'bv*+ba/b';
  if (isPlaylist && preset === 'audio') return 'ba';
  if (preset === 'subtitles') return 'bv*+ba/b';

  if (preset === 'best' && els.videoSelect.value === 'auto' && els.audioSelect.value === 'auto') return 'bv*+ba/b';
  if (els.videoSelect.value === 'none') return audio ? audio.format_id : 'ba';
  if (!video && els.videoSelect.value === 'auto') return audio ? `bv*+${audio.format_id}/b` : 'bv*+ba/b';
  if (video?.is_combined || (video?.has_audio && !audio)) return video.format_id;
  if (video && audio) return `${video.format_id}+${audio.format_id}`;
  if (video && els.audioSelect.value === 'auto' && !video.has_audio) return `${video.format_id}+ba`;
  if (video) return video.format_id;
  if (audio) return audio.format_id;
  return 'bv*+ba/b';
}

function estimateForPreset(item, preset = state.selectedPreset) {
  const split = splitFormats(item?.formats || []);
  if (preset === 'audio') {
    const audio = pickSmallestAudio(split.audioFormats);
    return audio ? formatSize(audio) : 0;
  }
  if (preset === 'subtitles') return 0;
  if (preset === 'storage720') {
    const video = pickSmallestAtMaxHeight(720, split.videoFormats) || pickBestVideo(split.videoFormats);
    const audio = pickSmallestAudio(split.audioFormats);
    return totalSelectedSize(video, audio);
  }
  if (preset === 'storage1080') {
    const video = pickSmallestAtMaxHeight(1080, split.videoFormats) || pickBestVideo(split.videoFormats);
    const audio = pickSmallestAudio(split.audioFormats);
    return totalSelectedSize(video, audio);
  }
  if (preset === 'best') return 0;
  return 0;
}

function estimateForCurrentSelection() {
  if (!state.info || els.subtitlesOnly.checked) return 0;
  if (state.selectedPreset === 'best' && els.videoSelect.value === 'auto' && els.audioSelect.value === 'auto') return 0;
  const video = selectedOptionFormat(els.videoSelect);
  const audio = selectedOptionFormat(els.audioSelect);
  return totalSelectedSize(video, audio);
}

function itemKey(item) {
  return String(item.id || item.webpage_url || item.playlist_index || item.title || Math.random());
}

function visiblePlaylistItems() {
  const filter = els.playlistFilter.value.trim().toLowerCase();
  if (!filter) return state.playlistOrder;
  return state.playlistOrder.filter((item) => String(item.title || '').toLowerCase().includes(filter));
}

function selectedPlaylistUrls() {
  if (state.info?.kind !== 'playlist') return [];
  return visiblePlaylistItems()
    .filter((item) => state.selectedPlaylistIds.has(itemKey(item)))
    .map((item) => item.webpage_url)
    .filter(Boolean);
}

function getOptionsPayload() {
  return {
    url: els.urlInput.value.trim(),
    format_selector: buildSelector(),
    merge_output_format: els.mergeSelect.value,
    output_template: els.outputTemplate.value || '%(title).180B.%(ext)s',
    download_dir: els.downloadDir.value.trim(),
    playlist_items: els.playlistDownloadMode.value === 'native' ? [] : currentPlaylistPayload(),
    playlist_download_mode: els.playlistDownloadMode.value,
    playlist_items_spec: els.playlistItemsSpec.value.trim(),
    concat_playlist: els.concatSelect.value,
    concat_output_template: els.concatOutputTemplate.value || '%(playlist)s - combined.%(ext)s',
    subtitles_mode: els.subtitlesMode.value,
    subtitle_languages: els.subtitleLanguages.value || 'en',
    subtitle_format: els.subtitleFormat.value || 'best',
    convert_subtitles: els.convertSubtitles.value,
    embed_subtitles: els.embedSubtitles.checked,
    keep_subtitle_files: els.keepSubtitleFiles.checked,
    exclude_live_chat: els.excludeLiveChat.checked,
    subtitles_only: els.subtitlesOnly.checked,
    use_download_archive: els.useDownloadArchive.checked,
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
  if (els.concatSelect.value !== 'never' && els.playlistDownloadMode.value !== 'native') {
    els.playlistDownloadMode.value = 'native';
  }
  const selector = buildSelector();
  const size = estimateForCurrentSelection();
  const playlistItems = selectedPlaylistUrls();
  const isPlaylistQueue = state.info.kind === 'playlist' && playlistItems.length > 0 && els.playlistDownloadMode.value === 'queue';
  const isNativePlaylist = state.info.kind === 'playlist' && els.playlistDownloadMode.value === 'native';

  els.estimatedSize.textContent = els.subtitlesOnly.checked ? 'subtitles' : size ? bytesToHuman(size) : isPlaylistQueue ? els.playlistEstimate.value : 'auto/unknown';
  const video = selectedOptionFormat(els.videoSelect);
  const audio = selectedOptionFormat(els.audioSelect);
  const parts = [];
  if (els.subtitlesOnly.checked) parts.push('subtitles only');
  else {
    if (video) parts.push(`video ${video.format_id} (${qualityText(video)})`);
    else parts.push(els.videoSelect.value === 'none' ? 'no video' : 'auto video');
    if (audio && !(video && video.is_combined)) parts.push(`audio ${audio.format_id}`);
    else if (video && video.is_combined) parts.push('audio included');
    else parts.push(els.audioSelect.value === 'none' ? 'no separate audio' : 'auto audio');
  }
  if (isPlaylistQueue) parts.push(`${playlistItems.length} queued item(s)`);
  if (isNativePlaylist) parts.push('native playlist URL');
  if (els.concatSelect.value !== 'never') parts.push('combine playlist into one long video');
  if (els.subtitlesMode.value !== 'none' || els.embedSubtitles.checked) parts.push(`subs: ${els.subtitlesMode.value}`);
  if (els.cookieSource.value !== 'none') parts.push(`cookies: ${els.cookieSource.value}`);
  if (els.restrictFilenames.value === 'true') parts.push('Windows-safe names');
  els.selectionSummary.textContent = `${parts.join(' + ')} · selector: ${selector}`;

  try {
    const res = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getOptionsPayload()),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Could not generate command.');
    els.commandBox.textContent = data.command;
  } catch (err) {
    els.commandBox.textContent = `# ${err.message || String(err)}\nyt-dlp -f "${selector}" "${els.urlInput.value.trim()}"`;
  }
}

function buildFilenameTemplate() {
  const parts = [];
  const add = (enabled, value) => { if (enabled) parts.push(value); };

  // Keep Title as the fallback so every side file has a readable base name.
  add(els.filenameTitle.checked || ![els.filenameId, els.filenameUploader, els.filenameSubscribers, els.filenameDate, els.filenameViews].some((el) => el.checked), '%(title).180B');
  add(els.filenameId.checked, '[%(id)s]');
  add(els.filenameUploader.checked, '%(uploader).80B');
  add(els.filenameSubscribers.checked, '%(channel_follower_count)s subs');
  add(els.filenameDate.checked, '%(upload_date)s');
  add(els.filenameViews.checked, '%(view_count)s views');

  return `${parts.join(' - ')}.%(ext)s`;
}

function updateFilenameTemplateFromChecks() {
  els.outputTemplate.value = buildFilenameTemplate();
  updateCommand();
}

async function previewFilenames() {
  if (!state.info) {
    toast('Analyze a URL first.', true);
    return;
  }
  els.previewFilenamesBtn.disabled = true;
  els.filenamePreviewBox.textContent = 'Previewing filenames with yt-dlp…';
  try {
    const payload = { ...getOptionsPayload(), preview_limit: 12 };
    const res = await fetch('/api/filename-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Filename preview failed.');
    const lines = data.filenames?.length ? data.filenames : ['No filenames returned.'];
    const note = data.note ? `\n\n# ${data.note}` : '';
    els.filenamePreviewBox.textContent = lines.map((line, i) => `${String(i + 1).padStart(2, '0')}. ${line}`).join('\n') + note;
  } catch (err) {
    els.filenamePreviewBox.textContent = `# ${err.message || String(err)}`;
    toast(err.message || String(err), true);
  } finally {
    els.previewFilenamesBtn.disabled = false;
  }
}

function updatePresetSizeHints() {
  const audio = pickSmallestAudio();
  const v1080 = pickSmallestAtMaxHeight(1080);
  const v720 = pickSmallestAtMaxHeight(720);
  els.presetAudioSize.textContent = audio ? bytesToHuman(formatSize(audio)) : 'unknown';
  els.preset1080Size.textContent = v1080 ? bytesToHuman(totalSelectedSize(v1080, audio)) : 'unknown';
  els.preset720Size.textContent = v720 ? bytesToHuman(totalSelectedSize(v720, audio)) : 'unknown';
}

function fmtDate(value) {
  if (!value) return '—';
  const text = String(value);
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  if (/^\d+(\.\d+)?$/.test(text) && text.length <= 10) {
    try { return new Date(Number(text) * 1000).toISOString().slice(0, 10); } catch { return text; }
  }
  return text;
}

function renderFormats() {
  els.formatsBody.innerHTML = '';
  const search = els.formatSearch.value.trim().toLowerCase();
  const filter = els.formatFilter.value;
  const rows = state.formats.filter((fmt) => {
    const kind = formatKind(fmt);
    if (filter !== 'all' && filter !== kind && !(filter === 'video' && fmt.has_video)) return false;
    if (!search) return true;
    return JSON.stringify(fmt).toLowerCase().includes(search);
  });

  rows.forEach((fmt) => {
    const kind = formatKind(fmt);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(fmt.format_id)}</strong></td>
      <td><span class="type-badge ${esc(kind)}">${esc(kind)}</span></td>
      <td>${esc(fmt.ext || '—')}</td>
      <td>${esc(qualityText(fmt))}</td>
      <td>${esc(fmt.fps || '—')}</td>
      <td>${esc(bytesToHuman(formatSize(fmt)))}</td>
      <td>${esc(fmt.vcodec || '—')}</td>
      <td>${esc(fmt.acodec || '—')}</td>
      <td>${esc(fmt.tbr || fmt.vbr || fmt.abr || '—')}</td>
      <td>${esc(fmt.format_note || fmt.protocol || '—')}</td>
    `;
    tr.addEventListener('click', () => {
      setActivePreset('manual');
      if (fmt.is_audio_only) {
        els.audioSelect.value = fmt.format_id;
        if (els.videoSelect.value === 'none') els.videoSelect.value = 'auto';
      } else {
        els.videoSelect.value = fmt.format_id;
        if (fmt.is_combined) els.audioSelect.value = 'none';
      }
      updatePlaylistEstimate();
      updateCommand();
    });
    els.formatsBody.appendChild(tr);
  });
}

function loadCurrentItem(item) {
  if (!item) return;
  state.current = item;
  state.formats = item.formats || [];
  const split = splitFormats(state.formats);
  state.videoFormats = split.videoFormats;
  state.audioFormats = split.audioFormats;
  state.combinedFormats = split.combinedFormats;

  els.title.textContent = item.title || 'Untitled';
  els.thumbnail.src = item.thumbnail || '';
  els.thumbnail.alt = item.title ? `${item.title} thumbnail` : 'Video thumbnail';
  const meta = [item.uploader || item.channel, item.duration_string, item.id, item.view_count ? `${item.view_count.toLocaleString?.() || item.view_count} views` : null].filter(Boolean).join(' · ');
  els.metaLine.textContent = meta || 'Metadata loaded.';
  const manualSubs = (item.subtitles || []).filter((v) => v !== 'live_chat');
  const autoSubs = (item.automatic_captions || []).filter((v) => v !== 'live_chat');
  els.subsLine.textContent = `Subtitles: ${manualSubs.length ? manualSubs.slice(0, 8).join(', ') : 'none found'} · Auto captions: ${autoSubs.length ? autoSubs.slice(0, 8).join(', ') : 'none found'}`;
  els.sourceLink.href = item.webpage_url || state.info?.webpage_url || els.urlInput.value.trim();

  populateSelects();
  applyPreset(state.selectedPreset || 'best');
  renderFormats();
}

function sortPlaylist() {
  const mode = els.playlistSort.value;
  const copy = [...state.playlistItems];
  const byTitle = (a, b) => String(a.title || '').localeCompare(String(b.title || ''));
  const byUpload = (a, b) => Number(a.upload_date || a.timestamp || 0) - Number(b.upload_date || b.timestamp || 0);
  const byDuration = (a, b) => Number(a.duration || 0) - Number(b.duration || 0);
  const byStorage = (a, b) => (estimateForPreset(a) || Number.MAX_SAFE_INTEGER) - (estimateForPreset(b) || Number.MAX_SAFE_INTEGER);

  if (mode === 'upload_newest') copy.sort((a, b) => byUpload(b, a));
  else if (mode === 'upload_oldest') copy.sort(byUpload);
  else if (mode === 'duration_asc') copy.sort(byDuration);
  else if (mode === 'duration_desc') copy.sort((a, b) => byDuration(b, a));
  else if (mode === 'storage_asc') copy.sort(byStorage);
  else if (mode === 'storage_desc') copy.sort((a, b) => byStorage(b, a));
  else if (mode === 'title_az') copy.sort(byTitle);
  else if (mode === 'title_za') copy.sort((a, b) => byTitle(b, a));
  else copy.sort((a, b) => (a.playlist_index || 0) - (b.playlist_index || 0));
  state.playlistOrder = copy;
}

function updatePlaylistEstimate() {
  if (state.info?.kind !== 'playlist') {
    els.playlistEstimate.value = '—';
    return;
  }
  let known = 0;
  let unknown = 0;
  let count = 0;
  visiblePlaylistItems().forEach((item) => {
    if (!state.selectedPlaylistIds.has(itemKey(item))) return;
    count += 1;
    const value = estimateForPreset(item);
    if (value) known += value;
    else unknown += 1;
  });
  els.playlistEstimate.value = count ? `${bytesToHuman(known)}${unknown ? ` + ${unknown} unknown` : ''} · ${count} item(s)` : 'nothing selected';
}

function renderPlaylist() {
  sortPlaylist();
  els.playlistBody.innerHTML = '';
  if (state.info?.kind !== 'playlist') {
    els.playlistSummary.textContent = 'This is not a playlist analysis.';
    els.playlistEstimate.value = '—';
    return;
  }

  const visible = visiblePlaylistItems();
  els.playlistSummary.textContent = `${state.info.title || 'Playlist'} · ${state.playlistItems.length} loaded item(s) · ${visible.length} visible`;
  visible.forEach((item, orderedIndex) => {
    const estimate = estimateForPreset(item);
    const id = itemKey(item);
    const checked = state.selectedPlaylistIds.has(id) ? 'checked' : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="checkbox-cell"><input class="playlist-check" type="checkbox" data-id="${esc(id)}" ${checked} /></td>
      <td>${esc(item.playlist_index || orderedIndex + 1)}</td>
      <td class="title-cell"><strong>${esc(item.title || 'Untitled')}</strong></td>
      <td>${esc(fmtDate(item.upload_date))}</td>
      <td>${esc(item.duration_string || '—')}</td>
      <td>${estimate ? bytesToHuman(estimate) : 'unknown'}</td>
      <td>${item.format_count || (item.formats || []).length || '—'}</td>
    `;
    tr.addEventListener('click', (event) => {
      if (event.target?.classList?.contains('playlist-check')) return;
      loadCurrentItem(item);
      switchTab('downloadTab');
      toast('Loaded playlist item into preview.');
    });
    els.playlistBody.appendChild(tr);
  });
  document.querySelectorAll('.playlist-check').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked) state.selectedPlaylistIds.add(input.dataset.id);
      else state.selectedPlaylistIds.delete(input.dataset.id);
      updatePlaylistEstimate();
      updateCommand();
    });
  });
  updatePlaylistEstimate();
}

async function analyze() {
  const url = els.urlInput.value.trim();
  if (!url) {
    toast('Paste a URL first.', true);
    return;
  }

  els.analyzeBtn.disabled = true;
  els.analyzeBtn.textContent = 'Analyzing…';

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        playlist_mode: els.modeSelect.value === 'playlist',
        playlist_limit: Number(els.playlistLimit.value || 50),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Analysis failed.');

    state.info = data;
    state.playlistItems = data.items || [];
    state.playlistOrder = [...state.playlistItems];
    state.selectedPlaylistIds = new Set(state.playlistItems.map((item) => itemKey(item)));
    els.workspace.classList.remove('hidden');
    els.emptyState.classList.add('hidden');

    if (data.kind === 'playlist') {
      loadCurrentItem(data.current || state.playlistItems[0]);
      renderPlaylist();
      switchTab('playlistTab');
      toast(`Playlist loaded: ${state.playlistItems.length} item(s).`);
    } else {
      loadCurrentItem(data.current || data);
      renderPlaylist();
      switchTab('downloadTab');
      toast('Analysis complete.');
    }
    updateCommand();
  } catch (err) {
    toast(err.message || String(err), true);
  } finally {
    els.analyzeBtn.disabled = false;
    els.analyzeBtn.textContent = 'Analyze';
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied.');
  } catch {
    toast('Clipboard failed. Select and copy manually.', true);
  }
}

function currentPlaylistPayload() {
  return state.info?.kind === 'playlist' ? selectedPlaylistUrls() : [];
}

async function copyCommand() {
  await copyText(els.commandBox.textContent);
}

function formatProgress(job) {
  if (job.status === 'error') return `Error: ${job.error || 'download failed'}`;
  if (job.status === 'cancelled') return 'Cancelled.';
  if (job.status === 'finished') return 'Finished. Check the downloads folder.';
  const pct = typeof job.percent === 'number' ? `${job.percent.toFixed(1)}%` : 'working';
  const total = job.total_text || 'unknown size';
  const speed = job.speed_text ? ` · ${job.speed_text}` : '';
  const eta = job.eta_text ? ` · ETA ${job.eta_text}` : '';
  const phase = job.paused ? 'paused' : (job.phase || job.status || 'working');
  const item = job.total_items > 1 ? `item ${job.current_index || '?'} / ${job.total_items} · ` : '';
  return `${item}${phase}: ${pct} of ${total}${speed}${eta}`;
}

async function startDownload() {
  if (!state.info) return;
  els.downloadBtn.disabled = true;
  els.downloadStatus.classList.remove('hidden');
  els.progressBar.style.width = '0%';
  els.progressText.textContent = 'Queued…';
  els.logTail.textContent = '';

  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getOptionsPayload()),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Download could not start.');
    state.activeJobId = data.job_id;
    pollJob(data.job_id);
  } catch (err) {
    els.downloadBtn.disabled = false;
    toast(err.message || String(err), true);
  }
}

function pollJob(jobId) {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const job = await res.json();
      if (!res.ok) throw new Error(job.detail || 'Could not read job.');
      const pct = typeof job.percent === 'number' ? job.percent : 0;
      els.progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      els.progressText.textContent = formatProgress(job);
      els.logTail.textContent = (job.log_tail || []).slice(-24).join('\n');
      els.pauseBtn.disabled = job.paused || !['running', 'downloading'].includes(job.status);
      els.resumeBtn.disabled = !job.paused;
      if (['finished', 'error', 'cancelled'].includes(job.status)) {
        clearInterval(state.pollTimer);
        els.downloadBtn.disabled = false;
        toast(job.status === 'finished' ? 'Download finished.' : job.status === 'cancelled' ? 'Download cancelled.' : 'Download failed.', job.status === 'error');
      }
    } catch (err) {
      clearInterval(state.pollTimer);
      els.downloadBtn.disabled = false;
      toast(err.message || String(err), true);
    }
  }, 850);
}

async function jobAction(action) {
  if (!state.activeJobId) return;
  try {
    const res = await fetch(`/api/jobs/${state.activeJobId}/${action}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `${action} failed`);
    toast(`${action[0].toUpperCase()}${action.slice(1)} requested.`);
  } catch (err) {
    toast(err.message || String(err), true);
  }
}

async function validateDirectory() {
  try {
    const res = await fetch('/api/directory/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: els.downloadDir.value.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Invalid directory');
    els.downloadDir.value = data.path;
    updateCommand();
    return data.path;
  } catch (err) {
    toast(err.message || String(err), true);
    return null;
  }
}

async function browseDirectory() {
  try {
    const res = await fetch('/api/directory/select', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Folder selection failed.');
    els.downloadDir.value = data.path;
    updateCommand();
  } catch (err) {
    toast(`${err.message || String(err)} You can still paste a folder path manually.`, true);
  }
}

async function openDirectory() {
  await validateDirectory();
  try {
    const res = await fetch('/api/directory/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: els.downloadDir.value.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Could not open folder.');
  } catch (err) {
    toast(err.message || String(err), true);
  }
}

function psEscape(value) {
  return String(value).replace(/`/g, '``').replace(/"/g, '`"');
}

function updateInstallCommands() {
  const dir = els.installDir.value.trim() || '$env:USERPROFILE\\Tools\\yt-dlp';
  const escaped = psEscape(dir);
  els.standaloneInstall.textContent = `$D="${escaped}"; New-Item -ItemType Directory -Force $D | Out-Null; Invoke-WebRequest "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile "$D\\yt-dlp.exe"; $Z="$env:TEMP\\ffmpeg-release-essentials.zip"; $X="$env:TEMP\\ffmpeg-yt-dlp-studio"; Invoke-WebRequest "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile $Z; Remove-Item $X -Recurse -Force -ErrorAction SilentlyContinue; Expand-Archive $Z $X -Force; Copy-Item "$X\\ffmpeg-*\\bin\\ffmpeg.exe","$X\\ffmpeg-*\\bin\\ffprobe.exe" $D -Force; $P=[Environment]::GetEnvironmentVariable("Path","User"); if(($P -split ";") -notcontains $D){[Environment]::SetEnvironmentVariable("Path", ($P.TrimEnd(";")+";"+$D), "User")}; Write-Host "Installed yt-dlp + ffmpeg to $D. Restart VSCode/terminal."`;
  els.wingetInstall.textContent = 'winget install -e --id yt-dlp.yt-dlp --accept-package-agreements --accept-source-agreements; winget install -e --id Gyan.FFmpeg --accept-package-agreements --accept-source-agreements';
  els.unixInstall.textContent = 'macOS Homebrew:\n  brew install yt-dlp ffmpeg\n\nUbuntu/Debian-ish:\n  python3 -m pip install -U yt-dlp\n  sudo apt install ffmpeg\n\nUpdate yt-dlp later:\n  yt-dlp -U';
  els.vercelDeploy.textContent = 'npm i -g vercel\nvercel login\nvercel\n# production deploy after testing:\nvercel --prod\n\n# In Vercel, this app is best as an analyzer/command generator. Run generated download commands locally for large files.';
}

function switchTab(id) {
  document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === id));
  document.querySelectorAll('.tab-page').forEach((page) => page.classList.toggle('active', page.id === id));
}

async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (!res.ok) throw new Error('backend not ready');
    state.health = data;
    const mode = data.serverless ? 'Vercel mode' : 'Local mode';
    els.healthPill.textContent = `${mode} · Python ${data.python}${data.ffmpeg ? ' · ffmpeg found' : ' · ffmpeg missing'}`;
    els.healthPill.classList.add('ok');
    els.downloadDir.value = data.download_dir || '';
    if (data.serverless) {
      els.serverlessNotice.classList.remove('hidden');
      els.downloadBtn.textContent = data.downloads_enabled ? 'Download' : 'Download disabled on Vercel';
      if (!data.downloads_enabled) els.downloadBtn.classList.add('danger');
    }
    updateCommand();
  } catch {
    els.healthPill.textContent = 'Backend offline';
    els.healthPill.classList.add('bad');
  }
}

function updateConcatMode() {
  if (els.concatSelect.value !== 'never') {
    els.playlistDownloadMode.value = 'native';
  }
  updateCommand();
}

els.analyzeBtn.addEventListener('click', analyze);
els.urlInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') analyze(); });
els.videoSelect.addEventListener('change', () => { setActivePreset('manual'); updatePlaylistEstimate(); updateCommand(); });
els.audioSelect.addEventListener('change', () => { setActivePreset('manual'); updatePlaylistEstimate(); updateCommand(); });
els.mergeSelect.addEventListener('change', updateCommand);
[els.filenameTitle, els.filenameId, els.filenameUploader, els.filenameSubscribers, els.filenameDate, els.filenameViews].forEach((input) => {
  input.addEventListener('change', updateFilenameTemplateFromChecks);
});
els.outputTemplate.addEventListener('input', updateCommand);
els.previewFilenamesBtn.addEventListener('click', previewFilenames);
els.playlistDownloadMode.addEventListener('change', updateCommand);
els.playlistItemsSpec.addEventListener('input', updateCommand);
els.concatSelect.addEventListener('change', updateConcatMode);
els.concatOutputTemplate.addEventListener('input', updateCommand);
els.subtitlesMode.addEventListener('change', updateCommand);
els.subtitleLanguages.addEventListener('input', updateCommand);
els.subtitleFormat.addEventListener('input', updateCommand);
els.convertSubtitles.addEventListener('change', updateCommand);
els.embedSubtitles.addEventListener('change', updateCommand);
els.keepSubtitleFiles.addEventListener('change', updateCommand);
els.excludeLiveChat.addEventListener('change', updateCommand);
els.subtitlesOnly.addEventListener('change', updateCommand);
els.useDownloadArchive.addEventListener('change', updateCommand);
els.cookieSource.addEventListener('change', updateCommand);
els.cookiesFile.addEventListener('input', updateCommand);
els.restrictFilenames.addEventListener('change', updateCommand);
els.writeInfoJson.addEventListener('change', updateCommand);
els.writeDescription.addEventListener('change', updateCommand);
els.writeThumbnail.addEventListener('change', updateCommand);
els.embedThumbnail.addEventListener('change', updateCommand);
els.embedMetadata.addEventListener('change', updateCommand);
els.embedChapters.addEventListener('change', updateCommand);
els.downloadDir.addEventListener('change', validateDirectory);
els.browseDirBtn.addEventListener('click', browseDirectory);
els.openDirBtn.addEventListener('click', openDirectory);
els.copyBtn.addEventListener('click', copyCommand);
els.downloadBtn.addEventListener('click', startDownload);
els.downloadSelectedBtn.addEventListener('click', () => { switchTab('downloadTab'); startDownload(); });
els.pauseBtn.addEventListener('click', () => jobAction('pause'));
els.resumeBtn.addEventListener('click', () => jobAction('resume'));
els.cancelBtn.addEventListener('click', () => jobAction('cancel'));
els.formatSearch.addEventListener('input', renderFormats);
els.formatFilter.addEventListener('change', renderFormats);
els.playlistSort.addEventListener('change', () => { renderPlaylist(); updateCommand(); });
els.playlistFilter.addEventListener('input', () => { renderPlaylist(); updateCommand(); });
els.selectAllBtn.addEventListener('click', () => {
  visiblePlaylistItems().forEach((item) => state.selectedPlaylistIds.add(itemKey(item)));
  renderPlaylist();
  updateCommand();
});
els.clearAllBtn.addEventListener('click', () => {
  visiblePlaylistItems().forEach((item) => state.selectedPlaylistIds.delete(itemKey(item)));
  renderPlaylist();
  updateCommand();
});
els.installDir.addEventListener('input', updateInstallCommands);
els.copyStandaloneInstall.addEventListener('click', () => copyText(els.standaloneInstall.textContent));
els.copyWingetInstall.addEventListener('click', () => copyText(els.wingetInstall.textContent));
els.copyVercelDeploy.addEventListener('click', () => copyText(els.vercelDeploy.textContent));

document.querySelectorAll('.preset-card').forEach((button) => {
  button.addEventListener('click', () => applyPreset(button.dataset.preset));
});

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.tab));
});

updateFilenameTemplateFromChecks();
updateInstallCommands();
checkHealth();
