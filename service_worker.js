
// service_worker.js - same persistence mechanics
let sessionBuffer = [];
let lastMeetingKey = null;

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg?.type === "TRANSCRIPT_CHUNK") {
    ensureMeetingKey(msg.meetingKey);
    (msg.items || []).forEach(it => sessionBuffer.push(it));
    if (sessionBuffer.length % 20 === 0) await persistBuffer();
    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === "DOWNLOAD_SPECIFIC_MEETING" && msg.meetingKey) {
    const { transcripts = {} } = await chrome.storage.local.get("transcripts");
    const meeting = transcripts[msg.meetingKey];
    if (!meeting) return;
    const title = meeting.title || `Meeting_${msg.meetingKey}`;
    const items = meeting.items || [];

    // Original transcript
    const original = items.map(it => it.src).join('\n');
    // Translated transcript
    const translated = items.map(it => it.dst).join('\n');
    // CSV transcript
    const csv = 'Time,Original,Translated\n' + items.map(it => `${new Date(it.t).toLocaleString()},"${it.src.replace(/"/g,'""')}","${it.dst.replace(/"/g,'""')}"`).join('\n');

    // Helper to convert text to data URL
    function textToDataUrl(text, mime) {
      const encoded = encodeURIComponent(text).replace(/'/g,"%27").replace(/\(/g,"%28").replace(/\)/g,"%29");
      return `data:${mime};charset=utf-8,${encoded}`;
    }

    // Download only the requested type
    if (msg.downloadType === 'original') {
      const url = textToDataUrl(original, 'text/plain');
      chrome.downloads.download({ url, filename: `${title} - Original.txt`, saveAs: true });
    } else if (msg.downloadType === 'translated') {
      const url = textToDataUrl(translated, 'text/plain');
      chrome.downloads.download({ url, filename: `${title} - Translated.txt`, saveAs: true });
    } else if (msg.downloadType === 'csv') {
      const url = textToDataUrl(csv, 'text/csv');
      chrome.downloads.download({ url, filename: `${title} - Transcript.csv`, saveAs: true });
    }
    sendResponse({ ok: true });
    return true;
  }
});

function ensureMeetingKey(key) {
  if (!lastMeetingKey) lastMeetingKey = key || `meet-${Date.now()}`;
}

async function persistBuffer() {
  try {
    const { transcripts = {} } = await chrome.storage.local.get("transcripts");
    const key = lastMeetingKey || `meet-${Date.now()}`;
    transcripts[key] = transcripts[key] || { items: [], createdAt: Date.now(), title: key };
    transcripts[key].items = transcripts[key].items.concat(sessionBuffer);
    await chrome.storage.local.set({ transcripts });
    sessionBuffer = [];
  } catch(e){ console.error(e); }
}
