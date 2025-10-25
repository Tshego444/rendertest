// faqDatabase.js
const fs = require('fs');
const path = require('path');

class FAQDatabase {
  constructor(filePath = './faq_and_knowledge.json') { // Default to JSON file with q&a's
    this.filePath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
    this.faqs = [];
    this.lastLoaded = null;
  }
  
  load(force = false) {
    try {
      const stats = fs.statSync(this.filePath);

      // Always reload if file was modified since last load
      if (!force && this.lastLoaded && stats.mtime <= this.lastLoaded) {
        return; // No change since last load
      }

      const data = fs.readFileSync(this.filePath, 'utf-8');
      this.faqs = JSON.parse(data);
      this.lastLoaded = stats.mtime;

      console.log(`Reloaded ${this.faqs.length} FAQs from ${path.basename(this.filePath)}`);
    } catch (err) {
      console.error('Error loading FAQ data:', err);
      this.faqs = [];
    }
  }

  // Auto-reload before each search to ensure freshness
  find(query) {
    this.load(); // This will only reload if file changed
    
    if (!this.faqs || this.faqs.length === 0) return null;

    const lowerQuery = query.toLowerCase();
    
    return this.faqs.find(faq =>
      faq.question.toLowerCase().includes(lowerQuery)
    ) || null;
  }
}

module.exports = FAQDatabase;