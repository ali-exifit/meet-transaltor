// Floating Caption Overlay - Chrome Live Caption Style
// Draggable, Resizable, Persists Across Tabs

class FloatingCaption {
  constructor() {
    this.container = null;
    this.header = null;
    this.content = null;
    this.resizeHandle = null;
    this.isDragging = false;
    this.isResizing = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.startWidth = 0;
    this.startHeight = 0;
    this.startX = 0;
    this.startY = 0;
    this.captions = [];
    this.maxCaptions = 5;
    this.settings = {
      width: 400,
      height: 200,
      x: window.innerWidth - 420,
      y: window.innerHeight - 250,
      bgColor: '#000000',
      textColor: '#ffffff',
      fontSize: 18,
      opacity: 0.95,
      borderRadius: 12,
      showBorder: true,
      alwaysOnTop: true
    };
    
    this.init();
  }

  init() {
    this.loadSettings();
    this.createUI();
    this.setupEventListeners();
    this.startMessageListener();
  }

  loadSettings() {
    chrome.storage.local.get(['floatingCaptionSettings'], (result) => {
      if (result.floatingCaptionSettings) {
        this.settings = { ...this.settings, ...result.floatingCaptionSettings };
        this.applySettings();
      }
    });
  }

  createUI() {
    // Main container
    this.container = document.createElement('div');
    this.container.id = 'mt-floating-caption';
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-label', 'Live Captions');
    
    this.container.style.cssText = `
      position: fixed;
      left: ${this.settings.x}px;
      top: ${this.settings.y}px;
      width: ${this.settings.width}px;
      height: ${this.settings.height}px;
      min-width: 200px;
      min-height: 100px;
      max-width: 800px;
      max-height: 600px;
      background-color: ${this.settings.bgColor};
      color: ${this.settings.textColor};
      opacity: ${this.settings.opacity};
      border-radius: ${this.settings.borderRadius}px;
      border: ${this.settings.showBorder ? '2px solid rgba(255,255,255,0.2)' : 'none'};
      box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif;
      transition: opacity 0.2s ease;
      user-select: none;
    `;

    // Header (drag handle)
    this.header = document.createElement('div');
    this.header.className = 'mt-caption-header';
    this.header.style.cssText = `
      height: 32px;
      min-height: 32px;
      background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
      border-bottom: 1px solid rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      cursor: move;
      flex-shrink: 0;
    `;

    // Title
    const title = document.createElement('span');
    title.textContent = '🔴 Live';
    title.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: ${this.settings.textColor};
      opacity: 0.8;
      display: flex;
      align-items: center;
      gap: 6px;
    `;

    // Controls
    const controls = document.createElement('div');
    controls.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    // Settings button
    const settingsBtn = this.createIconButton('⚙️', 'Settings');
    settingsBtn.onclick = () => this.openSettingsPanel();
    
    // Close button
    const closeBtn = this.createIconButton('✕', 'Close');
    closeBtn.onclick = () => this.hide();

    controls.appendChild(settingsBtn);
    controls.appendChild(closeBtn);
    this.header.appendChild(title);
    this.header.appendChild(controls);

    // Content area
    this.content = document.createElement('div');
    this.content.className = 'mt-caption-content';
    this.content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      font-size: ${this.settings.fontSize}px;
      line-height: 1.5;
      scroll-behavior: smooth;
    `;
    this.content.addEventListener('mouseenter', () => {
      this.container.style.opacity = '1';
    });
    this.content.addEventListener('mouseleave', () => {
      this.container.style.opacity = this.settings.opacity;
    });

    // Resize handle
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'mt-caption-resize';
    this.resizeHandle.style.cssText = `
      position: absolute;
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: nwse-resize;
      background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.3) 50%);
      border-radius: 0 0 ${this.settings.borderRadius}px 0;
      z-index: 1;
    `;

    this.container.appendChild(this.header);
    this.container.appendChild(this.content);
    this.container.appendChild(this.resizeHandle);
    document.body.appendChild(this.container);

    // Make draggable and resizable
    this.makeDraggable();
    this.makeResizable();
  }

  createIconButton(icon, title) {
    const btn = document.createElement('button');
    btn.textContent = icon;
    btn.title = title;
    btn.style.cssText = `
      background: transparent;
      border: none;
      color: ${this.settings.textColor};
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      opacity: 0.7;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    btn.onmouseover = () => btn.style.opacity = '1';
    btn.onmouseout = () => btn.style.opacity = '0.7';
    return btn;
  }

  makeDraggable() {
    this.header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      this.isDragging = true;
      this.dragOffsetX = e.clientX - this.container.offsetLeft;
      this.dragOffsetY = e.clientY - this.container.offsetTop;
      this.container.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const newX = e.clientX - this.dragOffsetX;
      const newY = e.clientY - this.dragOffsetY;
      
      // Boundary checks
      const maxX = window.innerWidth - this.container.offsetWidth;
      const maxY = window.innerHeight - this.container.offsetHeight;
      
      this.container.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
      this.container.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
      
      this.savePosition();
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.container.style.transition = 'opacity 0.2s ease';
    });
  }

  makeResizable() {
    this.resizeHandle.addEventListener('mousedown', (e) => {
      this.isResizing = true;
      this.startWidth = this.container.offsetWidth;
      this.startHeight = this.container.offsetHeight;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.container.style.transition = 'none';
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isResizing) return;
      
      const deltaX = e.clientX - this.startX;
      const deltaY = e.clientY - this.startY;
      
      const newWidth = Math.max(200, Math.min(800, this.startWidth + deltaX));
      const newHeight = Math.max(100, Math.min(600, this.startHeight + deltaY));
      
      this.container.style.width = `${newWidth}px`;
      this.container.style.height = `${newHeight}px`;
      
      this.settings.width = newWidth;
      this.settings.height = newHeight;
    });

    document.addEventListener('mouseup', () => {
      if (this.isResizing) {
        this.isResizing = false;
        this.container.style.transition = 'opacity 0.2s ease';
        this.saveSettings();
      }
    });
  }

  savePosition() {
    this.settings.x = parseInt(this.container.style.left);
    this.settings.y = parseInt(this.container.style.top);
    this.saveSettings();
  }

  saveSettings() {
    chrome.storage.local.set({ floatingCaptionSettings: this.settings });
  }

  applySettings() {
    if (this.container) {
      this.container.style.backgroundColor = this.settings.bgColor;
      this.container.style.color = this.settings.textColor;
      this.container.style.opacity = this.settings.opacity;
      this.container.style.borderRadius = `${this.settings.borderRadius}px`;
      this.container.style.border = this.settings.showBorder ? '2px solid rgba(255,255,255,0.2)' : 'none';
      if (this.content) {
        this.content.style.fontSize = `${this.settings.fontSize}px`;
      }
    }
  }

  addCaption(text, speaker = '', isTranslated = false) {
    const captionEl = document.createElement('div');
    captionEl.className = 'mt-caption-item';
    captionEl.style.cssText = `
      margin-bottom: 8px;
      padding: 8px 12px;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      animation: mtFadeIn 0.3s ease;
    `;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let content = '';
    if (speaker) {
      content += `<strong style="opacity: 0.8;">${speaker}</strong>: `;
    }
    content += `<span style="${isTranslated ? 'color: #4CAF50;' : ''}">${text}</span>`;
    content += `<span style="float: right; font-size: 10px; opacity: 0.5;">${time}</span>`;
    
    captionEl.innerHTML = content;
    this.content.appendChild(captionEl);
    
    // Auto-scroll to bottom
    this.content.scrollTop = this.content.scrollHeight;
    
    // Limit captions
    const items = this.content.querySelectorAll('.mt-caption-item');
    if (items.length > this.maxCaptions) {
      items[0].remove();
    }

    // Store in history
    this.captions.push({
      text,
      speaker,
      isTranslated,
      timestamp: Date.now()
    });
    
    // Broadcast to service worker for archiving
    chrome.runtime.sendMessage({
      type: 'CAPTION_ADDED',
      data: { text, speaker, isTranslated, timestamp: Date.now() }
    });
  }

  clearCaptions() {
    this.content.innerHTML = '';
    this.captions = [];
  }

  hide() {
    this.container.style.display = 'none';
  }

  show() {
    this.container.style.display = 'flex';
  }

  toggle() {
    if (this.container.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }

  openSettingsPanel() {
    // Create settings panel
    const panel = document.createElement('div');
    panel.id = 'mt-caption-settings';
    panel.style.cssText = `
      position: absolute;
      top: 40px;
      right: 12px;
      width: 280px;
      background: ${this.settings.bgColor};
      color: ${this.settings.textColor};
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      z-index: 2147483648;
      font-size: 13px;
      border: 1px solid rgba(255,255,255,0.1);
    `;

    panel.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">Caption Settings</div>
      
      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; opacity: 0.8;">Font Size: ${this.settings.fontSize}px</label>
        <input type="range" id="mt-font-size" min="12" max="32" value="${this.settings.fontSize}" 
          style="width: 100%; accent-color: #4CAF50;">
      </div>
      
      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; opacity: 0.8;">Opacity: ${(this.settings.opacity * 100).toFixed(0)}%</label>
        <input type="range" id="mt-opacity" min="0.5" max="1" step="0.05" value="${this.settings.opacity}" 
          style="width: 100%; accent-color: #4CAF50;">
      </div>
      
      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; opacity: 0.8;">Background Color</label>
        <input type="color" id="mt-bg-color" value="${this.settings.bgColor}" 
          style="width: 100%; height: 30px; border: none; cursor: pointer;">
      </div>
      
      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; opacity: 0.8;">Text Color</label>
        <input type="color" id="mt-text-color" value="${this.settings.textColor}" 
          style="width: 100%; height: 30px; border: none; cursor: pointer;">
      </div>
      
      <div style="margin-bottom: 12px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" id="mt-show-border" ${this.settings.showBorder ? 'checked' : ''}>
          Show Border
        </label>
      </div>
      
      <div style="display: flex; gap: 8px; margin-top: 16px;">
        <button id="mt-reset-position" 
          style="flex: 1; padding: 8px; background: rgba(255,255,255,0.1); border: none; border-radius: 6px; color: inherit; cursor: pointer;">
          Reset Position
        </button>
        <button id="mt-close-settings" 
          style="flex: 1; padding: 8px; background: #4CAF50; border: none; border-radius: 6px; color: white; cursor: pointer;">
          Done
        </button>
      </div>
    `;

    // Event listeners
    panel.querySelector('#mt-font-size').addEventListener('input', (e) => {
      this.settings.fontSize = parseInt(e.target.value);
      this.content.style.fontSize = `${this.settings.fontSize}px`;
      panel.querySelector('label[for="mt-font-size"]').textContent = `Font Size: ${this.settings.fontSize}px`;
      this.saveSettings();
    });

    panel.querySelector('#mt-opacity').addEventListener('input', (e) => {
      this.settings.opacity = parseFloat(e.target.value);
      this.container.style.opacity = this.settings.opacity;
      panel.querySelector('label[for="mt-opacity"]').textContent = `Opacity: ${(this.settings.opacity * 100).toFixed(0)}%`;
      this.saveSettings();
    });

    panel.querySelector('#mt-bg-color').addEventListener('input', (e) => {
      this.settings.bgColor = e.target.value;
      this.container.style.backgroundColor = this.settings.bgColor;
      this.saveSettings();
    });

    panel.querySelector('#mt-text-color').addEventListener('input', (e) => {
      this.settings.textColor = e.target.value;
      this.container.style.color = this.settings.textColor;
      this.header.querySelector('span').style.color = this.settings.textColor;
      this.saveSettings();
    });

    panel.querySelector('#mt-show-border').addEventListener('change', (e) => {
      this.settings.showBorder = e.target.checked;
      this.container.style.border = this.settings.showBorder ? '2px solid rgba(255,255,255,0.2)' : 'none';
      this.saveSettings();
    });

    panel.querySelector('#mt-reset-position').addEventListener('click', () => {
      this.settings.x = window.innerWidth - 420;
      this.settings.y = window.innerHeight - 250;
      this.container.style.left = `${this.settings.x}px`;
      this.container.style.top = `${this.settings.y}px`;
      this.saveSettings();
    });

    panel.querySelector('#mt-close-settings').addEventListener('click', () => {
      panel.remove();
    });

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!panel.contains(e.target) && e.target !== this.header) {
          panel.remove();
          document.removeEventListener('click', close);
        }
      });
    }, 100);

    this.container.appendChild(panel);
  }

  startMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'SHOW_CAPTION') {
        this.addCaption(message.text, message.speaker || '', message.isTranslated || false);
        sendResponse({ success: true });
      } else if (message.type === 'CLEAR_CAPTIONS') {
        this.clearCaptions();
        sendResponse({ success: true });
      } else if (message.type === 'TOGGLE_CAPTION') {
        this.toggle();
        sendResponse({ success: true });
      } else if (message.type === 'GET_CAPTIONS') {
        sendResponse({ captions: this.captions });
      } else if (message.type === 'UPDATE_SETTINGS') {
        if (message.settings) {
          this.settings = { ...this.settings, ...message.settings };
          this.applySettings();
          this.saveSettings();
        }
        sendResponse({ success: true });
      }
      return true;
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.floatingCaption = new FloatingCaption();
  });
} else {
  window.floatingCaption = new FloatingCaption();
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes mtFadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  #mt-floating-caption::-webkit-scrollbar,
  .mt-caption-content::-webkit-scrollbar {
    width: 6px;
  }
  
  #mt-floating-caption::-webkit-scrollbar-track,
  .mt-caption-content::-webkit-scrollbar-track {
    background: rgba(255,255,255,0.05);
    border-radius: 3px;
  }
  
  #mt-floating-caption::-webkit-scrollbar-thumb,
  .mt-caption-content::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.2);
    border-radius: 3px;
  }
  
  #mt-floating-caption::-webkit-scrollbar-thumb:hover,
  .mt-caption-content::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.3);
  }
`;
document.head.appendChild(style);
