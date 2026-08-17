
const $ = s => document.querySelector(s);
async function load(){
  const defaults = { targetLang:'fa', fontStack:"'Vazirmatn', 'Roboto', 'Arial', sans-serif", fontSize:23, color:"#ffffff", lineHeight:1.7, provider: 'google', providerApiKey: '' };
  const { mtSettings = defaults } = await chrome.storage.local.get('mtSettings');
  $('#lang').value = mtSettings.targetLang || defaults.targetLang;
  $('#fontStack').value = mtSettings.fontStack || defaults.fontStack;
  $('#fontSize').value = Number(mtSettings.fontSize || defaults.fontSize);
  $('#color').value = mtSettings.color || defaults.color;
  $('#colorCode').value = mtSettings.color || defaults.color;
  $('#lineHeight').value = Number(mtSettings.lineHeight || defaults.lineHeight);
  $('#displayMode').value = mtSettings.displayMode || 'popup';
  $('#popupPosition').value = mtSettings.popupPosition || 'top-right';
  $('#popupOffsetX').value = Number(mtSettings.popupOffsetX ?? 10);
  $('#popupOffsetY').value = Number(mtSettings.popupOffsetY ?? 10);
  $('#popupBgColor').value = mtSettings.popupBgColor || '#000000';
  $('#popupBgColorCode').value = mtSettings.popupBgColor || '#000000';
  $('#popupTextColor').value = mtSettings.popupTextColor || '#ffffff';
  $('#popupTextColorCode').value = mtSettings.popupTextColor || '#ffffff';
  $('#provider').value = mtSettings.provider || defaults.provider;
  $('#providerApiKey').value = mtSettings.providerApiKey || defaults.providerApiKey;
  $('#enableReconcile').checked = Boolean(mtSettings.enableReconcile);
  $('#enablePrune').checked = Boolean(mtSettings.enablePrune);
  $('#debounceMs').value = Number(mtSettings.debounceMs || 280);
  $('#showIndicator').checked = Boolean(mtSettings.showIndicator);
  $('#pruneThreshold').value = Number(mtSettings.pruneThreshold || 20);
  $('#reconcileWindow').value = Number(mtSettings.reconcileWindow || 3);
  $('#maxWords').value = Number(mtSettings.maxWords || 35);
  $('#popupWidthValue').value = Number(mtSettings.popupWidthValue ?? mtSettings.popupSizeValue ?? 20);
  $('#popupWidthUnit').value = mtSettings.popupWidthUnit || mtSettings.popupSizeUnit || 'vw';
  $('#popupHeightValue').value = Number(mtSettings.popupHeightValue ?? mtSettings.popupSizeValue ?? 20);
  $('#popupHeightUnit').value = mtSettings.popupHeightUnit || mtSettings.popupSizeUnit || 'vw';

  // show/hide api key field when provider requires it
  function updateApiKeyVisibility(){
    const p = $('#provider').value;
    const show = (p === 'libre' || p === 'libre-de') ? false : false; // none require key by default, keep hidden
    $('#providerApiKey').style.display = show ? '' : 'none';
    $('#providerApiKeyLabel').style.display = show ? '' : 'none';
  }
  $('#provider').addEventListener('change', updateApiKeyVisibility);
  updateApiKeyVisibility();

  // show/hide popup controls
  const displayModeEl = $('#displayMode');
  const popupControls = $('#popupControls');
  const popupOffsetRow = $('#popupOffsetRow');
  function updatePopupControls(){
    const mode = displayModeEl.value;
    popupControls.style.display = mode === 'popup' ? '' : 'none';
    const pos = $('#popupPosition').value;
    popupOffsetRow.style.display = pos === 'custom' ? 'flex' : 'none';
  }
  displayModeEl.addEventListener('change', updatePopupControls);
  $('#popupPosition').addEventListener('change', updatePopupControls);
  updatePopupControls();
  $('#save').addEventListener('click', save);

  // Top tabs removed — keep settings page visible by default
  // downloadsPage remains accessible via the UI but there are no top tab buttons.

  // live preview
  const updatePreview = () => {
    const font = $('#fontStack').value.trim();
    const fs = Number($('#fontSize').value || 16);
    const lh = Number($('#lineHeight').value || 1.3);
    const color = $('#color').value;
    const pv = $('#preview');
    pv.style.fontFamily = font;
    pv.style.fontSize = fs + 'px';
    pv.style.lineHeight = lh;
    pv.style.color = color;
    // Keep the profile image and update only the text style
    const img = pv.querySelector('img');
    pv.innerHTML = '';
    if (img) pv.appendChild(img);
    pv.innerHTML += `<span class="mt-translated">سلام دنیا</span>`;
  };
  ['fontStack','fontSize','color','lineHeight'].forEach(id => $('#'+id).addEventListener('input', updatePreview));
  $('#color').addEventListener('input', e => {
    $('#colorCode').value = e.target.value;
    updatePreview();
  });
  $('#colorCode').addEventListener('input', e => {
    let val = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      $('#color').value = val;
      updatePreview();
    }
  });
  // popup color sync
  $('#popupBgColor').addEventListener('input', e => { $('#popupBgColorCode').value = e.target.value; });
  $('#popupBgColorCode').addEventListener('input', e => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) $('#popupBgColor').value = e.target.value; });
  $('#popupTextColor').addEventListener('input', e => { $('#popupTextColorCode').value = e.target.value; });
  $('#popupTextColorCode').addEventListener('input', e => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) $('#popupTextColor').value = e.target.value; });
  updatePreview();
}
async function save(){
  const settings = {
    targetLang: $('#lang').value.trim() || 'fa',
    fontStack: $('#fontStack').value.trim() || "'Vazirmatn', 'Roboto', 'Arial', sans-serif",
    fontSize: Number($('#fontSize').value || 23),
    color: $('#color').value || $('#colorCode').value || '#ffffff',
    lineHeight: Number($('#lineHeight').value || 1.7)
  };
  // popup-specific settings
  settings.displayMode = $('#displayMode').value || 'popup';
  settings.popupPosition = $('#popupPosition').value || 'top-right';
  settings.popupOffsetX = Number($('#popupOffsetX').value || 20);
  settings.popupOffsetY = Number($('#popupOffsetY').value || 20);
  settings.popupBgColor = $('#popupBgColor').value || '#000000';
  settings.popupTextColor = $('#popupTextColor').value || '#ffffff';
  settings.provider = $('#provider').value || 'google';
  settings.providerApiKey = $('#providerApiKey').value.trim() || '';
  settings.enableReconcile = !!$('#enableReconcile').checked;
  settings.enablePrune = !!$('#enablePrune').checked;
  settings.debounceMs = Number($('#debounceMs').value || 280);
  settings.showIndicator = !!$('#showIndicator').checked;
  settings.pruneThreshold = Number($('#pruneThreshold').value || 20);
  settings.reconcileWindow = Number($('#reconcileWindow').value || 3);
  settings.maxWords = Number($('#maxWords').value || 30);
  settings.popupWidthValue = Number($('#popupWidthValue').value || 20);
  settings.popupWidthUnit = $('#popupWidthUnit').value || 'vw';
  settings.popupHeightValue = Number($('#popupHeightValue').value || 20);
  settings.popupHeightUnit = $('#popupHeightUnit').value || 'vw';
  await chrome.storage.local.set({ mtSettings: settings });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id){
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (settings) => window.postMessage({ type:'MT_SETTINGS_UPDATE', settings }, '*'),
      args: [settings]
    });
  }
  window.close();
}

async function loadSavedMeetings() {
  const { transcripts = {} } = await chrome.storage.local.get('transcripts');
  // The popup may render different layouts; prefer '#savedMeetingsList' but
  // fall back to '#savedMeetingsListDownloads'. If neither exists, do nothing.
  const savedMeetingsList = $('#savedMeetingsList') || $('#savedMeetingsListDownloads');
  if (!savedMeetingsList) return;
  savedMeetingsList.innerHTML = ''; // Clear existing list

  if (Object.keys(transcripts).length === 0) {
    savedMeetingsList.innerHTML = '<li>No saved meetings yet.</li>';
    return;
  }

  for (const key in transcripts) {
    const meeting = transcripts[key];
    const listItem = document.createElement('li');
    const meetingTitle = meeting.title || `Meeting ${new Date(meeting.createdAt).toLocaleString()}`;
    listItem.innerHTML = `
      <span>${meetingTitle}</span>
      <button data-key="${key}" data-type="original" class="download-meeting-btn">Download Original</button>
      <button data-key="${key}" data-type="translated" class="download-meeting-btn">Download Translated</button>
      <button data-key="${key}" data-type="csv" class="download-meeting-btn">Download CSV</button>
    `;
    savedMeetingsList.appendChild(listItem);
  }

  savedMeetingsList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('download-meeting-btn')) {
      const key = e.target.dataset.key;
      const type = e.target.dataset.type;
      await chrome.runtime.sendMessage({ type: 'DOWNLOAD_SPECIFIC_MEETING', meetingKey: key, downloadType: type });
    }
  });
}

// Populate downloads tab list (same entries but with clearer layout)
async function loadSavedMeetingsDownloads() {
  const { transcripts = {} } = await chrome.storage.local.get('transcripts');
  const out = $('#savedMeetingsListDownloads');
  out.innerHTML = '';
  if (Object.keys(transcripts).length === 0) {
    out.innerHTML = '<li>No saved meetings yet.</li>';
    return;
  }
  for (const key in transcripts) {
    const meeting = transcripts[key];
    const title = meeting.title || `Meeting ${new Date(meeting.createdAt).toLocaleString()}`;
    const li = document.createElement('li');
    li.innerHTML = `<strong>${title}</strong><div style="display:flex;gap:6px;margin-top:6px;"><button data-key="${key}" data-type="original" class="download-meeting-btn">Original</button><button data-key="${key}" data-type="translated" class="download-meeting-btn">Translated</button><button data-key="${key}" data-type="csv" class="download-meeting-btn">CSV</button></div>`;
    out.appendChild(li);
  }

  out.addEventListener('click', async (e) => {
    if (e.target.classList.contains('download-meeting-btn')) {
      const key = e.target.dataset.key;
      const type = e.target.dataset.type;
      await chrome.runtime.sendMessage({ type: 'DOWNLOAD_SPECIFIC_MEETING', meetingKey: key, downloadType: type });
    }
  });
}

load();
loadSavedMeetings();
