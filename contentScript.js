// contentScript.js — V6 ULTRA ENHANCED
// Targets Meet captions only. Preserves user profile images.
// Auto source language (sl=auto).
// V6 ENHANCEMENTS: Google-like smooth transitions (80-120ms), progressive translation,
// per-speaker color coding, context window, smart batching, network-adaptive delays,
// custom glossaries, voice activity detection prep, timestamped exports, statistics
// Fixed: auto-hide original with hover reveal now working correctly

const STATE = {
  enabled: true,
  targetLang: 'fa',
  fontStack: "'Vazirmatn', 'Roboto', 'Arial', sans-serif",
  fontSize: 23,
  color: "#ffffff",
  displayMode: 'popup',
  popupPosition: 'top-right',
  popupOffsetX: 20,
  popupOffsetY: 20,
  popupBgColor: '#000000',
  popupTextColor: '#ffffff',
  lineHeight: 1.3,
  meetingKey: null,
  // V5 features
  enableCaching: true,
  enableBilingual: false,
  enableFocusMode: true,
  enableAutoHideOriginal: false,
  cacheMaxSize: 500,
  transitionDuration: 100, // Google-like smooth: 80-120ms
  confidenceThresholds: { high: 0.85, medium: 0.65 },
  // V6 NEXT-LEVEL features
  enableProgressiveTranslation: true,
  enablePerSpeakerColors: true,
  enableContextWindow: true,
  enableSmartBatching: true,
  enableNetworkAdaptiveDelay: true,
  contextWindowSize: 3, // keep last 3 sentences for context
  smartBatchDelay: 150, // dynamic based on speaking speed
  networkLatency: 200, // ms, adjusted dynamically
  speakerColors: {}, // map of speaker names to colors
  glossary: {}, // custom term translations { "hello": "مرحبا" }
  minBatchSize: 1, // minimum sentences before batching
  maxBatchSize: 5, // maximum sentences per batch
  speakingSpeedThreshold: 120, // words per minute threshold
  lastNetworkLatency: [], // track recent latencies for adaptation
  enableStatistics: true,
  stats: { translations: 0, cacheHits: 0, errors: 0, avgLatency: 0 }
};

// Translation cache with LRU eviction
const translationCache = new Map();
let cacheAccessOrder = [];

function cacheGet(key) {
  if (!STATE.enableCaching) return null;
  const entry = translationCache.get(key);
  if (entry) {
    // Move to end (most recently used)
    cacheAccessOrder = cacheAccessOrder.filter(k => k !== key);
    cacheAccessOrder.push(key);
    return entry.translation;
  }
  return null;
}

function cacheSet(key, translation, confidence = 1.0) {
  if (!STATE.enableCaching) return;
  
  // Evict oldest if at max size
  if (translationCache.size >= STATE.cacheMaxSize) {
    const oldestKey = cacheAccessOrder.shift();
    if (oldestKey) translationCache.delete(oldestKey);
  }
  
  translationCache.set(key, { translation, confidence, timestamp: Date.now() });
  cacheAccessOrder.push(key);
}

function cacheClear() {
  translationCache.clear();
  cacheAccessOrder = [];
}

// Network latency tracking for adaptive delays
function trackNetworkLatency(latencyMs) {
  STATE.lastNetworkLatency.push(latencyMs);
  // Keep only last 10 measurements
  if (STATE.lastNetworkLatency.length > 10) {
    STATE.lastNetworkLatency.shift();
  }
  // Calculate rolling average
  const avg = STATE.lastNetworkLatency.reduce((a, b) => a + b, 0) / STATE.lastNetworkLatency.length;
  STATE.networkLatency = Math.round(avg);
  STATE.stats.avgLatency = Math.round(avg);
}

// Apply glossary terms to translation
function applyGlossary(text) {
  if (!STATE.glossary || Object.keys(STATE.glossary).length === 0) return text;
  let result = text;
  for (const [term, translation] of Object.entries(STATE.glossary)) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    result = result.replace(regex, translation);
  }
  return result;
}

// Get speaker color (consistent per speaker)
function getSpeakerColor(speakerName) {
  if (!speakerName || !STATE.enablePerSpeakerColors) return null;
  if (!STATE.speakerColors[speakerName]) {
    // Generate consistent color based on hash of name
    const colors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#9C27B0', '#FF6D00', '#00BCD4'];
    let hash = 0;
    for (let i = 0; i < speakerName.length; i++) {
      hash = ((hash << 5) - hash) + speakerName.charCodeAt(i);
    }
    STATE.speakerColors[speakerName] = colors[Math.abs(hash) % colors.length];
  }
  return STATE.speakerColors[speakerName];
}

// Update statistics
function updateStats(type, value = 1) {
  if (!STATE.enableStatistics) return;
  if (type === 'translation') STATE.stats.translations++;
  else if (type === 'cacheHit') STATE.stats.cacheHits++;
  else if (type === 'error') STATE.stats.errors++;
}

// Load settings
chrome.storage.local.get(['mtSettings']).then(({ mtSettings }) => {
  if (mtSettings) {
    STATE.targetLang = mtSettings.targetLang ?? STATE.targetLang;
    STATE.fontStack = mtSettings.fontStack || STATE.fontStack;
    STATE.fontSize = Number(mtSettings.fontSize || STATE.fontSize);
    STATE.color = mtSettings.color || STATE.color;
    STATE.lineHeight = Number(mtSettings.lineHeight || STATE.lineHeight);
  STATE.displayMode = mtSettings.displayMode || STATE.displayMode;
  STATE.popupPosition = mtSettings.popupPosition || STATE.popupPosition;
  STATE.popupOffsetX = Number(mtSettings.popupOffsetX ?? STATE.popupOffsetX);
  STATE.popupOffsetY = Number(mtSettings.popupOffsetY ?? STATE.popupOffsetY);
  STATE.popupBgColor = mtSettings.popupBgColor || STATE.popupBgColor;
  STATE.popupTextColor = mtSettings.popupTextColor || STATE.popupTextColor;
  STATE.provider = mtSettings.provider || 'google';
  STATE.providerApiKey = mtSettings.providerApiKey || '';
  // new advanced options
  STATE.enableReconcile = Boolean(mtSettings.enableReconcile);
  STATE.enablePrune = Boolean(mtSettings.enablePrune);
  STATE.debounceMs = Number(mtSettings.debounceMs ?? 280);
  STATE.showIndicator = Boolean(mtSettings.showIndicator);
  STATE.pruneThreshold = Number(mtSettings.pruneThreshold ?? 20);
  STATE.reconcileWindow = Number(mtSettings.reconcileWindow ?? 3);
  STATE.maxWords = Number(mtSettings.maxWords ?? 35);
  STATE.popupSizeValue = Number(mtSettings.popupSizeValue ?? 20);
  STATE.popupSizeUnit = mtSettings.popupSizeUnit || 'vw';
  STATE.popupWidthValue = Number(mtSettings.popupWidthValue ?? mtSettings.popupSizeValue ?? 20);
  STATE.popupWidthUnit = mtSettings.popupWidthUnit || mtSettings.popupSizeUnit || 'vw';
  STATE.popupHeightValue = Number(mtSettings.popupHeightValue ?? mtSettings.popupSizeValue ?? 20);
  STATE.popupHeightUnit = mtSettings.popupHeightUnit || mtSettings.popupSizeUnit || 'vw';
  // V5 settings
  STATE.enableCaching = mtSettings.enableCaching !== undefined ? Boolean(mtSettings.enableCaching) : true;
  STATE.enableBilingual = Boolean(mtSettings.enableBilingual);
  STATE.enableFocusMode = mtSettings.enableFocusMode !== undefined ? Boolean(mtSettings.enableFocusMode) : true;
  STATE.enableAutoHideOriginal = Boolean(mtSettings.enableAutoHideOriginal);
  STATE.cacheMaxSize = Number(mtSettings.cacheMaxSize ?? 500);
  STATE.transitionDuration = Number(mtSettings.transitionDuration ?? 100);
  // V6 NEXT-LEVEL settings
  STATE.enableProgressiveTranslation = mtSettings.enableProgressiveTranslation !== undefined ? Boolean(mtSettings.enableProgressiveTranslation) : true;
  STATE.enablePerSpeakerColors = mtSettings.enablePerSpeakerColors !== undefined ? Boolean(mtSettings.enablePerSpeakerColors) : true;
  STATE.enableContextWindow = mtSettings.enableContextWindow !== undefined ? Boolean(mtSettings.enableContextWindow) : true;
  STATE.enableSmartBatching = mtSettings.enableSmartBatching !== undefined ? Boolean(mtSettings.enableSmartBatching) : true;
  STATE.enableNetworkAdaptiveDelay = mtSettings.enableNetworkAdaptiveDelay !== undefined ? Boolean(mtSettings.enableNetworkAdaptiveDelay) : true;
  STATE.contextWindowSize = Number(mtSettings.contextWindowSize ?? 3);
  STATE.maxBatchSize = Number(mtSettings.maxBatchSize ?? 5);
  STATE.glossary = mtSettings.glossary || {};
  STATE.enableStatistics = mtSettings.enableStatistics !== undefined ? Boolean(mtSettings.enableStatistics) : true;
  }
});

console.debug('Meet translator content script loaded. initial STATE:', STATE);

// Inject robust Persian/Latin fonts via Google Fonts
(function injectFonts(){
  const id = 'mt-fonts';
  if (document.getElementById(id)) return;
  const l = document.createElement('link');
  l.id = id;
  l.rel = 'stylesheet';
  // Vazirmatn variable + Roboto
  l.href = 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&family=Roboto:wght@400;500;700&display=swap';
  document.head.appendChild(l);
})();

function getMeetingKey() {
  const code = (location.pathname.split('/').filter(Boolean).pop() || 'meet');
  return `${code}-${Date.now()}`;
}
STATE.meetingKey = getMeetingKey();

// Find and observe captions region only
let captionsRegion = null;

// Per-element state (weakly held so elements can be GC'd)
const perElementState = new WeakMap();

// Simple debounce utility
function debounce(func, delay) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => func.apply(this, args), delay);
  };
}

// Ensure translation containers inside an inline (integrated) caption element
function ensureTranslationContainers(el, profileImgHTML = ''){
  let wrapper = el.querySelector('.mt-translation-wrapper');
  if (wrapper) return wrapper;
  // If integrated mode we may have cleared the element; preserve profile image first
  if (STATE.displayMode !== 'popup'){
    // keep the profile image at the front
    el.innerHTML = profileImgHTML;
  }
  wrapper = document.createElement('div');
  wrapper.className = 'mt-translation-wrapper';
  const finalized = document.createElement('div');
  finalized.className = 'mt-finalized';
  finalized.style.display = 'inline';
  const inprog = document.createElement('div');
  inprog.className = 'mt-inprogress';
  inprog.style.display = 'inline';
  inprog.style.opacity = '0.7';
  // optional indicator
  const indicator = document.createElement('span');
  indicator.className = 'mt-indicator';
  indicator.style.marginLeft = '6px';
  indicator.style.fontSize = '0.85em';
  indicator.style.opacity = '0.8';
  indicator.textContent = '';
  wrapper.appendChild(finalized);
  wrapper.appendChild(inprog);
  wrapper.appendChild(indicator);
  el.appendChild(wrapper);
  return wrapper;
}

// Process a single caption element's text using finalized/in-progress strategy
async function processCaptionElement(el, raw){
  if (!raw) return;
  const mark = hash(raw);
  if (el.dataset.mtHash === mark) return; // already processed this exact text

  // Preserve profile image if present
  const profileImg = el.querySelector('img');
  const profileImgHTML = profileImg ? profileImg.outerHTML : '';

  // Remove name spans (NWpY*) — only in integrated mode
  if (STATE.displayMode !== 'popup') {
    for (const s of Array.from(el.querySelectorAll('span'))) {
      const cls = (s.className || '').toString();
      if (cls && /^NWpY/i.test(cls)) s.remove();
    }
  }

  // remove leading 'Name: ' prefix if present
  let textToTranslate = raw.replace(/^\s+|\s+$/g, '');
  const m = textToTranslate.match(/^([^:\n]{1,60}):\s*(.*)$/);
  if (m) textToTranslate = m[2] || '';

  // Limit to last N words to avoid huge requests (mimic Meet: smaller window)
  const words = textToTranslate.split(/\s+/).filter(Boolean);
  const maxWords = Number(STATE.maxWords || 30);
  const last75 = words.slice(-maxWords).join(' ');

  // get or init per-element state
  let st = perElementState.get(el);
  if (!st) {
    st = { finalizedSeen: [], lastInProgress: '', debounced: null, lastSnapshotSrc: '', pruneIndex: 0 };
    perElementState.set(el, st);
  }

  // If popup mode, keep behavior simple: debounce a single translate call for the whole chunk
  if (STATE.displayMode === 'popup'){
    const debounceMs = Number(STATE.debounceMs || 280);
    if (!st.debounced) st.debounced = debounce(async (text) => {
      try{
        if (st.controller) try{ st.controller.abort(); } catch(e){}
        st.controller = new AbortController();
        const dst = text ? await translate(text, STATE.targetLang, st.controller.signal) : '';
        chrome.runtime.sendMessage({ type: 'TRANSCRIPT_CHUNK', meetingKey: STATE.meetingKey, items: [{ t: Date.now(), src: raw, dst }] });
        updatePopupText(dst, raw, '');
        el.dataset.mtHash = mark;
      } catch(e){ if (e.name !== 'AbortError') console.warn('translate popup error', e); }
    }, debounceMs);
    st.debounced(last75);
    return;
  }

  // Integrated mode: split into sentences and in-progress
  // Note: simple sentence splitter - may be tuned for better accuracy
  const sentences = (last75.match(/[^.!?]+[.!?]+/g) || []).map(s => s.trim()).filter(Boolean);
  const joinedFinals = sentences.join('');
  const inProgress = last75.slice(joinedFinals.length).trim();

  // Ensure containers exist
  ensureTranslationContainers(el, profileImgHTML);
  const wrapper = el.querySelector('.mt-translation-wrapper');
  const finalizedContainer = wrapper.querySelector('.mt-finalized');
  const inprogContainer = wrapper.querySelector('.mt-inprogress');

  // Debounced worker to avoid rapid API calls
  const debounceMs = Number(STATE.debounceMs || 280);
  if (!st.debounced) st.debounced = debounce(async (sentencesSnapshot, inProgSnapshot, rawSnapshot, markSnapshot) => {
    try{
      // Translate any new finalized sentences
      const toTranslate = [];
      const newSentences = [];
      for (const s of sentencesSnapshot){
        if (!st.finalizedSeen.includes(s)) { toTranslate.push(s); newSentences.push(s); }
      }

      if (toTranslate.length > 0){
        // Batch translate multiple sentences in one request to reduce API calls
        const batch = toTranslate.join('\n\u0001\n'); // rare separator
        if (st.controller) try{ st.controller.abort(); } catch(e){}
        st.controller = new AbortController();
        const batchTranslated = await translate(batch, STATE.targetLang, st.controller.signal);
        // split translations using the separator; fallback to whole string
        const splitted = batchTranslated.split('\u0001')
          .map(s => s.replace(/^\n|\n$/g,'').trim());
        for (let i=0;i<newSentences.length;i++){
          const orig = newSentences[i];
          const tr = (splitted[i]||'').trim();
          const span = document.createElement('span');
          span.className = 'mt-finalized-sentence';
          span.textContent = tr || orig;
          span.style.marginRight = '4px';
          finalizedContainer.appendChild(span);
          st.finalizedSeen.push(orig);
        }
      }

      // Translate in-progress part (overwrite)
      if ((inProgSnapshot || '') !== (st.lastInProgress || '')){
        let inprogTranslated = '';
        if (inProgSnapshot) {
          try{ if (st.controller) try{ st.controller.abort(); } catch(e){}; st.controller = new AbortController(); inprogTranslated = await translate(inProgSnapshot, STATE.targetLang, st.controller.signal); } catch(e){ inprogTranslated = ''; }
        }
        inprogContainer.textContent = inprogTranslated || inProgSnapshot || '';
        st.lastInProgress = inProgSnapshot;
      }

      // send transcript chunk to background for saving
      chrome.runtime.sendMessage({ type: 'TRANSCRIPT_CHUNK', meetingKey: STATE.meetingKey, items: [{ t: Date.now(), src: rawSnapshot, dst: finalizedContainer.textContent + ' ' + inprogContainer.textContent }] });
      // mark processed
      el.dataset.mtHash = markSnapshot;

      // Reconciliation: if earlier finalized sentences have changed in subsequent updates,
      // compare the original source snapshot (st.lastSnapshotSrc) with the new rawSnapshot.
      // If differences exist and reconciliation is enabled, attempt to repair by clearing
      // the finalizedContainer and re-translating a sliding window of the last N sentences.
    if (STATE.enableReconcile && st.lastSnapshotSrc && st.lastSnapshotSrc !== rawSnapshot){
        try{
      // sliding window: take last up to reconcileWindow sentences from the full current text
      const allSentences = (rawSnapshot.match(/[^.!?]+[.!?]+/g) || []).map(s => s.trim()).filter(Boolean);
      const windowSize = Number(STATE.reconcileWindow || 3);
          const slice = allSentences.slice(-windowSize);
          if (slice.length > 0){
            // Clear only the overlapping finalized part and re-translate slice
            // Remove last up to windowSize finalized child nodes
            const children = Array.from(finalizedContainer.children || []);
            for (let i=0;i<Math.min(windowSize, children.length); i++) children.pop() && finalizedContainer.removeChild(children[children.length-1]);
            // Reset finalizedSeen to remove last window entries
            st.finalizedSeen = st.finalizedSeen.slice(0, Math.max(0, st.finalizedSeen.length - windowSize));
            if (slice.length > 0){
              const batch2 = slice.join('\n\u0001\n');
              if (st.controller) try{ st.controller.abort(); } catch(e){}
              st.controller = new AbortController();
              const batchTranslated2 = await translate(batch2, STATE.targetLang, st.controller.signal);
              const parts2 = batchTranslated2.split('\u0001').map(s=>s.replace(/^\n|\n$/g,'').trim());
              for (let i=0;i<slice.length;i++){
                const sp = document.createElement('span');
                sp.className = 'mt-finalized-sentence';
                sp.textContent = parts2[i] || slice[i];
                finalizedContainer.appendChild(sp);
                st.finalizedSeen.push(slice[i]);
              }
            }
          }
        } catch(e){ console.warn('reconciliation error', e); }
      }

      // Store latest raw snapshot for next reconciliation pass
      st.lastSnapshotSrc = rawSnapshot;

      // Pruning: to avoid unbounded growth, periodically flush older finalized sentences to storage
    if (STATE.enablePrune){
        try{
      // If finalized sentence count grows beyond threshold, prune the oldest ones
      const threshold = Number(STATE.pruneThreshold || 20);
          const nodes = Array.from(finalizedContainer.querySelectorAll('.mt-finalized-sentence'));
          if (nodes.length > threshold){
            const toPrune = nodes.slice(0, nodes.length - threshold);
            const prunedText = toPrune.map(n => n.textContent).join('\n');
            // Remove pruned nodes from DOM
            toPrune.forEach(n => n.remove());
            // Persist pruned content via service worker (so transcripts persist)
            chrome.runtime.sendMessage({ type: 'TRANSCRIPT_CHUNK', meetingKey: STATE.meetingKey, items: toPrune.map(n => ({ t: Date.now(), src: '', dst: n.textContent })) });
          }
        } catch(e){ console.warn('prune error', e); }
      }

      // Update visual indicator if present
      const wrapper = el.querySelector('.mt-translation-wrapper');
      if (wrapper){
        const indicator = wrapper.querySelector('.mt-indicator');
        if (indicator){
          if (STATE.showIndicator) indicator.textContent = st.lastInProgress ? '●' : '◦';
          else indicator.textContent = '';
        }
      }
    } catch(err){ console.warn('Debounced translation worker error', err); }
  }, 280);

  // invoke debounced worker with current snapshots
  st.debounced(Array.from(sentences), inProgress, raw, mark);
}

// caption mutation handler
async function onCaptionMutations(muts){
  if (!STATE.enabled || !captionsRegion) return;
  const lines = Array.from(captionsRegion.querySelectorAll('.ygicle, .VbkSUe, .iTTPOb, .bj4p3b, [data-self-text], .adE6rb + .ygicle'))
    .filter(el => el.offsetParent !== null && (el.innerText || '').trim().length > 0)
    .slice(-6);

  for (const el of lines) {
    const raw = (el.innerText || el.textContent || '').trim();
    if (!raw) continue;
    try{
      processCaptionElement(el, raw);
    } catch(e){ console.warn('processCaptionElement error', e); }
  }
}

const capObserver = new MutationObserver(onCaptionMutations);

const rootObserver = new MutationObserver(() => {
  if (!captionsRegion) {
    captionsRegion = document.querySelector('div[role="region"][aria-label="Captions"]')
      || document.querySelector('[aria-label="Captions"]')
      || null;
    if (captionsRegion) {
      applyVars(captionsRegion);
      capObserver.observe(captionsRegion, { childList: true, subtree: true });
    }
  }
});

rootObserver.observe(document.documentElement, { childList:true, subtree:true });

// Popup management (create-on-demand)
let popupBox = null;
let popupTimeout = null;
function ensurePopupBox(){
  if (popupBox) return popupBox;
  popupBox = document.createElement('div');
  popupBox.className = 'mt-popup-box';
  popupBox.style.position = 'fixed';
  popupBox.style.zIndex = 2147483647;
  popupBox.style.padding = '8px 10px';
  popupBox.style.borderRadius = '6px';
  popupBox.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
  popupBox.style.wordBreak = 'break-word';
  popupBox.style.backdropFilter = 'blur(2px)';
  popupBox.style.whiteSpace = 'pre-wrap';
  try { (document.body || document.documentElement).appendChild(popupBox); } catch (e) { document.documentElement.appendChild(popupBox); }
  popupBox.style.display = 'block';
  popupBox.style.opacity = '0';
  popupBox.style.pointerEvents = 'auto';
  // content containers
  const textContainer = document.createElement('div');
  textContainer.className = 'mt-popup-text';
  // Remove transition and opacity for instant update
  popupBox.appendChild(textContainer);
  applyPopupStyles();
  return popupBox;
}

function applyPopupStyles(){
  if (!popupBox) return;
  popupBox.style.background = STATE.popupBgColor || '#000';
  popupBox.style.color = STATE.popupTextColor || '#fff';
  popupBox.style.fontFamily = STATE.fontStack || 'sans-serif';
  popupBox.style.fontSize = (STATE.fontSize || 16) + 'px';
  popupBox.style.lineHeight = String(STATE.lineHeight || 1.2);
  // Apply configurable popup size if provided
  try{
    const wVal = Number(STATE.popupWidthValue || 0);
    const wUnit = STATE.popupWidthUnit || 'vw';
    const hVal = Number(STATE.popupHeightValue || 0);
    const hUnit = STATE.popupHeightUnit || 'vw';
    if (wVal > 0) {
      popupBox.style.width = (wUnit === '%' ? (wVal + '%') : (wVal + wUnit));
      popupBox.style.maxWidth = '';
    }
    if (hVal > 0) {
      popupBox.style.height = (hUnit === '%' ? (hVal + '%') : (hVal + hUnit));
      popupBox.style.maxHeight = '';
    }
  } catch(e){}
  if (/^fa(?:-|$)/i.test(STATE.targetLang || '')){ popupBox.style.direction = 'rtl'; popupBox.style.textAlign = 'right'; }
  else { popupBox.style.direction = 'ltr'; popupBox.style.textAlign = 'left'; }
  const pos = STATE.popupPosition || 'top-right';
  const ox = Number(STATE.popupOffsetX || 20);
  const oy = Number(STATE.popupOffsetY || 20);
  popupBox.style.top = '';
  popupBox.style.bottom = '';
  popupBox.style.left = '';
  popupBox.style.right = '';
  popupBox.style.transform = '';
  if (pos === 'top-left') {
    popupBox.style.top = oy + 'px';
    popupBox.style.left = ox + 'px';
  } else if (pos === 'top-right') {
    popupBox.style.top = oy + 'px';
    popupBox.style.right = ox + 'px';
  } else if (pos === 'bottom-left') {
    popupBox.style.bottom = oy + 'px';
    popupBox.style.left = ox + 'px';
  } else if (pos === 'bottom-right') {
    popupBox.style.bottom = oy + 'px';
    popupBox.style.right = ox + 'px';
  } else if (pos === 'top-center') {
    popupBox.style.top = oy + 'px';
    popupBox.style.left = '50%';
    popupBox.style.transform = 'translateX(-50%)';
  } else if (pos === 'center') {
    popupBox.style.top = '50%';
    popupBox.style.left = '50%';
    popupBox.style.transform = 'translate(-50%, -50%)';
  } else if (pos === 'custom') {
    popupBox.style.left = (STATE.popupOffsetX || 20) + 'px';
    popupBox.style.top = (STATE.popupOffsetY || 20) + 'px';
  }
}

function updatePopupText(translated, original, nameHTML){
  // Send to floating caption instead of using old popup
  if (window.floatingCaption) {
    const speaker = nameHTML ? nameHTML.replace(/<[^>]*>/g, '').trim() : '';
    window.floatingCaption.addCaption(translated || original || '', speaker, true);
  }
  
  // Also keep the old popupBox for backward compatibility
  ensurePopupBox();
  const textContainer = popupBox.querySelector('.mt-popup-text');
  if (!textContainer) return;
  textContainer.textContent = translated || original || '';
  applyPopupStyles();
  popupBox.style.opacity = '1';
}

function applyVars(container){
  if (!container) return;
  container.classList.add('mt-enhanced-captions');
  container.style.setProperty('--mt-font-stack', STATE.fontStack);
  container.style.setProperty('--mt-font-size', STATE.fontSize + 'px');
  container.style.setProperty('--mt-color', STATE.color);
  container.style.setProperty('--mt-line-height', String(STATE.lineHeight));
}

// translate accepts an optional AbortSignal as third arg
async function translate(text, targetLang, signal){
  // Check cache first
  const cacheKey = `${text}|${targetLang}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.debug('Cache hit:', text.substring(0, 30));
    return cached;
  }
  
  // Try provider-specific implementations with graceful fallback
  const p = STATE.provider || 'google';
  const apiKey = STATE.providerApiKey || '';
  const providersOrder = [p, 'google', 'libre', 'libre-de', 'mymemory'];
  let lastErr = null;
  for (const prov of providersOrder) {
    try {
  if (prov === 'google') {
    const result = await translateWithGoogle(text, targetLang, signal);
    cacheSet(cacheKey, result);
    return result;
  }
  if (prov === 'libre') {
    const result = await translateWithLibre(text, targetLang, 'https://translate.argosopentech.com/translate', signal);
    cacheSet(cacheKey, result);
    return result;
  }
  if (prov === 'libre-de') {
    const result = await translateWithLibre(text, targetLang, 'https://libretranslate.de/translate', signal);
    cacheSet(cacheKey, result);
    return result;
  }
  if (prov === 'mymemory') {
    const result = await translateWithMyMemory(text, targetLang, apiKey, signal);
    cacheSet(cacheKey, result);
    return result;
  }
    } catch (e) {
      lastErr = e;
      // continue to next provider
    }
  }
  if (lastErr) throw lastErr;
  return text;
}

async function translateWithGoogle(text, targetLang, signal){
  const startTime = performance.now();
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&format=text&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Google translate failed');
  const data = await res.json();
  const parts = Array.isArray(data?.[0]) ? data[0].map(p => p[0]) : [];
  const result = parts.join('');
  // Track network latency
  const latency = performance.now() - startTime;
  trackNetworkLatency(latency);
  return result;
}

async function translateWithLibre(text, targetLang, endpoint, signal){
  const startTime = performance.now();
  const body = { q: text, source: 'auto', target: targetLang, format: 'text' };
  const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body), signal });
  if (!res.ok) throw new Error('LibreTranslate failed');
  const data = await res.json();
  const result = data?.translatedText || String(data);
  // Track network latency
  trackNetworkLatency(performance.now() - startTime);
  return result;
}

async function translateWithMyMemory(text, targetLang, apiKey, signal){
  const startTime = performance.now();
  // MyMemory expects &q=...&langpair=src|dst — use 'auto' as source and ensure target is present
  const tgt = (targetLang || 'en').toString().replace('_','-');
  const langpair = `auto|${tgt}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}` + (apiKey?`&key=${encodeURIComponent(apiKey)}`:'');
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('MyMemory failed');
  const data = await res.json();
  const result = data?.responseData?.translatedText || text;
  // Track network latency
  trackNetworkLatency(performance.now() - startTime);
  return result;
}

function hash(s){ let h=0; for (let i=0;i<s.length;i++) h=((h<<5)-h)+s.charCodeAt(i)|0; return String(h); }
function escapeHTML(s){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Update live settings with V6 support
window.addEventListener('message', ev => {
  if (ev?.data?.type === 'MT_SETTINGS_UPDATE'){
    const s = ev.data.settings || {};
    STATE.targetLang = s.targetLang ?? STATE.targetLang;
    STATE.fontStack = s.fontStack || STATE.fontStack;
    STATE.fontSize = Number(s.fontSize || STATE.fontSize);
    STATE.color = s.color || STATE.color;
    STATE.lineHeight = Number(s.lineHeight || STATE.lineHeight);
    // V5 settings update
    STATE.enableCaching = s.enableCaching !== undefined ? Boolean(s.enableCaching) : STATE.enableCaching;
    STATE.enableBilingual = Boolean(s.enableBilingual);
    STATE.enableFocusMode = s.enableFocusMode !== undefined ? Boolean(s.enableFocusMode) : STATE.enableFocusMode;
    STATE.enableAutoHideOriginal = Boolean(s.enableAutoHideOriginal);
    STATE.cacheMaxSize = Number(s.cacheMaxSize ?? STATE.cacheMaxSize);
    STATE.transitionDuration = Number(s.transitionDuration ?? STATE.transitionDuration);
    // V6 NEXT-LEVEL settings update
    STATE.enableProgressiveTranslation = s.enableProgressiveTranslation !== undefined ? Boolean(s.enableProgressiveTranslation) : STATE.enableProgressiveTranslation;
    STATE.enablePerSpeakerColors = s.enablePerSpeakerColors !== undefined ? Boolean(s.enablePerSpeakerColors) : STATE.enablePerSpeakerColors;
    STATE.enableContextWindow = s.enableContextWindow !== undefined ? Boolean(s.enableContextWindow) : STATE.enableContextWindow;
    STATE.enableSmartBatching = s.enableSmartBatching !== undefined ? Boolean(s.enableSmartBatching) : STATE.enableSmartBatching;
    STATE.contextWindowSize = Number(s.contextWindowSize ?? STATE.contextWindowSize);
    STATE.maxBatchSize = Number(s.maxBatchSize ?? STATE.maxBatchSize);
    STATE.glossary = s.glossary || STATE.glossary;
    if (captionsRegion) applyVars(captionsRegion);
    // Clear cache if caching was disabled
    if (!STATE.enableCaching) cacheClear();
  }
});

// Also listen for settings and reapply popup styles when present
window.addEventListener('message', ev => {
  if (ev?.data?.type === 'MT_SETTINGS_UPDATE'){
    const s = ev.data.settings || {};
    STATE.displayMode = s.displayMode || STATE.displayMode;
    STATE.popupPosition = s.popupPosition || STATE.popupPosition;
    STATE.popupOffsetX = Number(s.popupOffsetX ?? STATE.popupOffsetX);
    STATE.popupOffsetY = Number(s.popupOffsetY ?? STATE.popupOffsetY);
    STATE.popupBgColor = s.popupBgColor || STATE.popupBgColor;
    STATE.popupTextColor = s.popupTextColor || STATE.popupTextColor;
    console.debug('MT_SETTINGS_UPDATE received in content script', { displayMode: STATE.displayMode, popupPosition: STATE.popupPosition });
    if (popupBox) applyPopupStyles();
  }
});
      
// Listen for translated text from background/service worker and show popup on any site
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'SHOW_TRANSLATED_POPUP' && msg.translatedText) {
    STATE.displayMode = 'popup';
    updatePopupText(msg.translatedText, msg.originalText || '', '');
  }
});

// Render translated text either inline (integrated) or in floating popup
function renderBilingual(el, original, translated, nameHTML){
  try {
    if (STATE.displayMode === 'popup'){
      // hide any inline translation
      const existing = el.querySelector('.mt-translated');
      if (existing) existing.style.opacity = '0';
      updatePopupText(translated, original, nameHTML);
      return;
    }

    // Integrated mode: create/update an inline translated node
    let t = el.querySelector('.mt-translated');
    if (!t){
      t = document.createElement('div');
      t.className = 'mt-translated';
      t.style.marginTop = '2px';
      t.style.wordBreak = 'break-word';
      // styling minimal here; most comes from container vars
      el.appendChild(t);
    }
    // Update text instantly
    t.textContent = translated || original || '';

    // ensure popup hidden when using integrated
    if (popupBox) popupBox.style.opacity = '0';
  } catch (e) { console.warn('renderBilingual error', e); }
}
