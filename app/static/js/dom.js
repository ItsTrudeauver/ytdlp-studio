/**
 * Centralized DOM element registry for yt-dlp Studio.
 * Maps UI controls to operational nodes seamlessly.
 */
export const els = {
  // Global notice & status elements
  healthPill: document.getElementById('healthPill'),
  serverlessNotice: document.getElementById('serverlessNotice'),
  toast: document.getElementById('toast'),
  workspace: document.getElementById('workspace'),

  // Target input configuration row
  urlInput: document.getElementById('urlInput'),
  modeSelect: document.getElementById('modeSelect'),
  playlistLimit: document.getElementById('playlistLimit'),
  analyzeBtn: document.getElementById('analyzeBtn'),

  // Layout workspace navigation tabs
  tabs: document.querySelectorAll('.tab'),
  tabPages: document.querySelectorAll('.tab-page'),

  // Media preview component references
  thumbnail: document.getElementById('thumbnail'),
  title: document.getElementById('title'),
  metaLine: document.getElementById('metaLine'),
  subsLine: document.getElementById('subsLine'),
  sourceLink: document.getElementById('sourceLink'),
  estimatedSize: document.getElementById('estimatedSize'),
  selectionSummary: document.getElementById('selectionSummary'),

  // Size optimization helper targets
  preset1080Size: document.getElementById('preset1080Size'),
  preset720Size: document.getElementById('preset720Size'),
  presetAudioSize: document.getElementById('presetAudioSize'),

  // Core advanced picker layout elements
  videoSelect: document.getElementById('videoSelect'),
  audioSelect: document.getElementById('audioSelect'),
  mergeSelect: document.getElementById('mergeSelect'),
  restrictFilenames: document.getElementById('restrictFilenames'),

  // Auxiliary output / text file builders
  previewFilenamesBtn: document.getElementById('previewFilenamesBtn'),
  writeInfoJson: document.getElementById('writeInfoJson'),
  writeDescription: document.getElementById('writeDescription'),
  writeThumbnail: document.getElementById('writeThumbnail'),
  embedThumbnail: document.getElementById('embedThumbnail'),
  embedMetadata: document.getElementById('embedMetadata'),
  embedChapters: document.getElementById('embedChapters'),
  outputTemplate: document.getElementById('outputTemplate'),
  downloadDir: document.getElementById('downloadDir'),
  filenamePreviewBox: document.getElementById('filenamePreviewBox'),

  // Authentication configuration blocks
  cookieSource: document.getElementById('cookieSource'),
  cookiesFileRow: document.getElementById('cookiesFileRow'),
  cookiesFile: document.getElementById('cookiesFile'),

  // Cross-platform control terminal items
  targetOsSelect: document.getElementById('targetOsSelect'),
  commandBox: document.getElementById('commandBox'),
  copyCommandBtn: document.getElementById('copyCommandBtn'),
  runDownloadBtn: document.getElementById('runDownloadBtn')
};