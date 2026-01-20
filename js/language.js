// Language utility for HPC Thailand website
class LanguageManager {
  constructor() {
    this.currentLanguage = 'th'; // Default to Thai
    this.translations = null;
    this.callbacks = [];
  }

  async init() {
    try {
      const response = await fetch('data/translations.json');
      this.translations = await response.json();
      return true;
    } catch (error) {
      console.error('Failed to load translations:', error);
      return false;
    }
  }

  setLanguage(lang) {
    if (this.translations && this.translations[lang]) {
      this.currentLanguage = lang;
      this.updateLanguageButtons();
      this.notifyCallbacks();
      this.updatePageMeta();
      localStorage.setItem('hpc-language', lang);
    }
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }

  getTranslation(path) {
    if (!this.translations) return '';
    
    const keys = path.split('.');
    let value = this.translations[this.currentLanguage];
    
    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return '';
      }
    }
    
    return value || '';
  }

  translate(element, path, attribute = 'textContent') {
    const translation = this.getTranslation(path);
    if (element && translation) {
      if (attribute === 'placeholder') {
        element.placeholder = translation;
      } else if (attribute === 'title') {
        element.title = translation;
      } else {
        element.textContent = translation;
      }
    }
  }

  updateLanguageButtons() {
    const btnTh = document.getElementById('btn-th');
    const btnEn = document.getElementById('btn-en');
    
    if (btnTh && btnEn) {
      btnTh.classList.toggle('active', this.currentLanguage === 'th');
      btnEn.classList.toggle('active', this.currentLanguage === 'en');
    }
  }

  updatePageMeta() {
    const title = this.getTranslation('meta.title');
    const description = this.getTranslation('meta.description');
    
    if (title) {
      document.title = title;
    }
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription && description) {
      metaDescription.content = description;
    }
  }

  onLanguageChange(callback) {
    this.callbacks.push(callback);
  }

  notifyCallbacks() {
    this.callbacks.forEach(callback => callback(this.currentLanguage));
  }

  // Load saved language preference
  loadSavedLanguage() {
    const saved = localStorage.getItem('hpc-language');
    if (saved && this.translations && this.translations[saved]) {
      this.currentLanguage = saved;
    }
  }

  // Create language switcher HTML
  createLanguageSwitcher() {
    return `
      <div class="language-switch">
        <button id="btn-th" class="${this.currentLanguage === 'th' ? 'active' : ''}" onclick="languageManager.setLanguage('th')">ไทย</button>
        <button id="btn-en" class="${this.currentLanguage === 'en' ? 'active' : ''}" onclick="languageManager.setLanguage('en')">English</button>
      </div>
    `;
  }

  // Get data file path based on current language
  getDataFile(baseName) {
    if (baseName === 'hpc-timeline') {
      return this.currentLanguage === 'th' ? 'data/hpc-timeline-th.json' : 'data/hpc-timeline-en.json';
    }
    return `data/${baseName}.json`;
  }
}

// Global language manager instance
const languageManager = new LanguageManager();

// CSS for language switcher
const languageSwitcherCSS = `
.language-switch {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 25px;
  padding: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.language-switch button {
  background: transparent;
  border: none;
  padding: 8px 16px;
  margin: 0 2px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
  color: #667eea;
  font-size: 14px;
}

.language-switch button.active {
  background: #667eea;
  color: white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.language-switch button:hover:not(.active) {
  background: rgba(102, 126, 234, 0.1);
}

@media (max-width: 768px) {
  .language-switch {
    top: 10px;
    right: 10px;
    padding: 8px;
  }
  
  .language-switch button {
    padding: 6px 12px;
    font-size: 12px;
  }
}
`;

// Add CSS to head
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = languageSwitcherCSS;
  document.head.appendChild(style);
}
