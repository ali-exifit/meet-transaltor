// service_worker.js - V2.0 Enhanced with multi-language support and AI features

let sessionBuffer = [];
let lastMeetingKey = null;
let meetingStartTime = null;

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  // Handle transcript chunks
  if (msg?.type === "TRANSCRIPT_CHUNK") {
    ensureMeetingKey(msg.meetingKey);
    
    // Process each item in the chunk
    (msg.items || []).forEach(it => {
      // Add translated text if available
      if (it.dst) {
        it.translations = { [getTargetLang()]: it.dst };
      }
      sessionBuffer.push(it);
    });
    
    // Persist every 20 items or after 5 seconds of silence
    if (sessionBuffer.length % 20 === 0) {
      await persistBuffer();
    }
    
    sendResponse({ ok: true });
    return true;
  }

  // Handle download requests for specific meetings
  if (msg?.type === "DOWNLOAD_SPECIFIC_MEETING" && msg.meetingKey) {
    const { transcripts = {} } = await chrome.storage.local.get("transcripts");
    const meeting = transcripts[msg.meetingKey];
    if (!meeting) {
      sendResponse({ error: 'Meeting not found' });
      return true;
    }
    
    const title = sanitizeFilename(meeting.title || `Meeting_${msg.meetingKey}`);
    const items = meeting.items || [];
    const languages = meeting.languages || ['en', getTargetLang()];

    // Generate different format downloads
    if (msg.downloadType === 'original') {
      const original = items.map(it => formatTranscriptLine(it)).join('\n');
      const url = textToDataUrl(original, 'text/plain');
      chrome.downloads.download({ 
        url, 
        filename: `${title} - Original.txt`, 
        saveAs: true 
      });
    } else if (msg.downloadType === 'translated') {
      const translated = items.map(it => it.dst || it.src).join('\n');
      const url = textToDataUrl(translated, 'text/plain');
      chrome.downloads.download({ 
        url, 
        filename: `${title} - Translated.txt`, 
        saveAs: true 
      });
    } else if (msg.downloadType === 'csv') {
      const csv = generateCSV(items, languages);
      const url = textToDataUrl(csv, 'text/csv');
      chrome.downloads.download({ 
        url, 
        filename: `${title} - Transcript.csv`, 
        saveAs: true 
      });
    } else if (msg.downloadType === 'json') {
      const json = JSON.stringify(meeting, null, 2);
      const url = textToDataUrl(json, 'application/json');
      chrome.downloads.download({ 
        url, 
        filename: `${title} - Full.json`, 
        saveAs: true 
      });
    }
    
    sendResponse({ ok: true });
    return true;
  }
  
  // Handle analytics export
  if (msg?.type === "EXPORT_ANALYTICS") {
    const { mtSettings = {} } = await chrome.storage.local.get('mtSettings');
    const stats = mtSettings.stats || {};
    
    const csv = `Metric,Value\nTranslations,${stats.translations || 0}\nCache Hits,${stats.cacheHits || 0}\nAvg Latency (ms),${stats.avgLatency || 0}\nWords Translated,${stats.words || 0}\nDate,${new Date().toISOString()}`;
    const url = textToDataUrl(csv, 'text/csv');
    
    chrome.downloads.download({
      url,
      filename: `analytics_${new Date().toISOString().split('T')[0]}.csv`,
      saveAs: true
    });
    
    sendResponse({ ok: true });
    return true;
  }
  
  // Handle AI summary generation request
  if (msg?.type === "GENERATE_SUMMARY") {
    try {
      const summary = await generateAISummary(msg.text);
      sendResponse({ ok: true, summary });
    } catch (error) {
      sendResponse({ error: error.message });
    }
    return true;
  }
  
  // Handle sentiment analysis
  if (msg?.type === "ANALYZE_SENTIMENT") {
    try {
      const sentiment = await analyzeSentiment(msg.text);
      sendResponse({ ok: true, sentiment });
    } catch (error) {
      sendResponse({ error: error.message });
    }
    return true;
  }
});

// Helper functions
function ensureMeetingKey(key) {
  if (!lastMeetingKey) {
    lastMeetingKey = key || `meet-${Date.now()}`;
    meetingStartTime = Date.now();
  }
}

async function persistBuffer() {
  try {
    if (sessionBuffer.length === 0) return;
    
    const { transcripts = {} } = await chrome.storage.local.get("transcripts");
    const key = lastMeetingKey || `meet-${Date.now()}`;
    
    transcripts[key] = transcripts[key] || { 
      items: [], 
      createdAt: meetingStartTime || Date.now(), 
      title: key,
      languages: ['en', getTargetLang()]
    };
    
    transcripts[key].items = transcripts[key].items.concat(sessionBuffer);
    transcripts[key].updatedAt = Date.now();
    
    await chrome.storage.local.set({ transcripts });
    sessionBuffer = [];
    
    console.debug(`Persisted ${transcripts[key].items.length} items for meeting ${key}`);
  } catch(e) { 
    console.error('Persist error:', e); 
  }
}

function getTargetLang() {
  return 'fa'; // Default, will be updated from settings
}

function formatTranscriptLine(item) {
  const time = new Date(item.t).toLocaleTimeString();
  const speaker = item.speaker ? `${item.speaker}: ` : '';
  return `[${time}] ${speaker}${item.src}`;
}

function generateCSV(items, languages) {
  const headers = ['Time', 'Speaker', 'Original', ...languages.map(l => `Translated (${l})`)];
  const rows = items.map(it => {
    const time = new Date(it.t).toLocaleString();
    const speaker = (it.speaker || '').replace(/"/g, '""');
    const src = (it.src || '').replace(/"/g, '""');
    const translations = languages.map(l => (it.translations?.[l] || it.dst || '').replace(/"/g, '""'));
    return `"${time}","${speaker}","${src}",${translations.map(t => `"${t}"`).join(',')}`;
  });
  
  return [headers.join(','), ...rows].join('\n');
}

function textToDataUrl(text, mime) {
  const encoded = encodeURIComponent(text)
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
  return `data:${mime};charset=utf-8,${encoded}`;
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
}

// Free AI summarization using basic extractive approach
async function generateAISummary(text) {
  if (!text || text.length < 100) {
    return { summary: 'Text too short for meaningful summary.', method: 'none' };
  }
  
  // Simple extractive summarization (free, no API needed)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length < 3) {
    return { summary: text, method: 'full' };
  }
  
  // Score sentences by word frequency and position
  const wordFreq = {};
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  words.forEach(w => {
    if (w.length > 3) wordFreq[w] = (wordFreq[w] || 0) + 1;
  });
  
  const scored = sentences.map((s, i) => {
    const score = (s.toLowerCase().match(/\b\w+\b/g) || [])
      .reduce((sum, w) => sum + (wordFreq[w] || 0), 0) / Math.sqrt(s.length);
    const positionScore = i < sentences.length * 0.2 ? 1.5 : i > sentences.length * 0.8 ? 0.5 : 1;
    return { sentence: s.trim(), score: score * positionScore };
  });
  
  // Take top 20% of sentences
  const topSentences = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(3, Math.ceil(sentences.length * 0.2)))
    .sort((a, b) => sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence))
    .map(s => s.sentence);
  
  return {
    summary: topSentences.join(' '),
    method: 'extractive',
    compression: `${Math.round((topSentences.length / sentences.length) * 100)}%`
  };
}

// Free sentiment analysis using keyword approach
async function analyzeSentiment(text) {
  const positive = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'happy', 'pleased', 'satisfied', 'positive', 'yes', 'agree', 'correct', 'right', 'perfect', 'best', 'awesome', 'brilliant'];
  const negative = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'sad', 'angry', 'disappointed', 'frustrated', 'negative', 'no', 'disagree', 'wrong', 'incorrect', 'worst', 'poor', 'fail', 'problem', 'issue', 'difficult'];
  
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  let posCount = 0;
  let negCount = 0;
  
  words.forEach(w => {
    if (positive.includes(w)) posCount++;
    if (negative.includes(w)) negCount++;
  });
  
  const total = posCount + negCount;
  const score = total === 0 ? 0 : (posCount - negCount) / total;
  
  let sentiment = 'neutral';
  if (score > 0.1) sentiment = 'positive';
  if (score < -0.1) sentiment = 'negative';
  
  return {
    sentiment,
    score: Math.round(score * 100) / 100,
    positive: posCount,
    negative: negCount,
    method: 'keyword'
  };
}

// Clean up old meetings periodically (every hour)
chrome.alarms?.create('cleanup', { delayInMinutes: 60, periodInMinutes: 60 });
chrome.alarms?.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanup') {
    const { transcripts = {} } = await chrome.storage.local.get('transcripts');
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let changed = false;
    
    for (const key in transcripts) {
      if (transcripts[key].createdAt < thirtyDaysAgo) {
        delete transcripts[key];
        changed = true;
      }
    }
    
    if (changed) {
      await chrome.storage.local.set({ transcripts });
      console.log('Cleaned up old meetings');
    }
  }
});

console.debug('Meetranslator V2.0 service worker loaded');
