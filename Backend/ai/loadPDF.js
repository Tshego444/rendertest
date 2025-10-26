const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");

class PDFReader {
  constructor(docsPath = ".") { // Changed to current directory since your files are in root
    this.docsPath = docsPath;
  }

  // Extract text from a single PDF file
  async extractTextFromPDF(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`PDF file not found: ${filePath}`);
        return null;
      }

      const pdfBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(pdfBuffer);
      
      // Clean up the extracted text
      const cleanText = this.cleanExtractedText(pdfData.text);
      
      return {
        fileName: path.basename(filePath),
        text: cleanText,
        pages: pdfData.numpages,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error extracting text from ${filePath}:`, error);
      return null;
    }
  }

  // Clean up extracted PDF text (remove extra whitespace, fix formatting)
  cleanExtractedText(text) {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .replace(/[^\w\s\n.,!?()-]/g, '') // Remove special characters except basic punctuation
      .trim();
  }

  // Load all JobSeekr documentation files
  async loadAllJobSeekrDocs() {
    const docFiles = [
      path.join(this.docsPath, "EPE_321_Project_Proposal_u22646494.pdf"),
      path.join(this.docsPath, "EPE_321_SRS_u22646494.pdf"),
      path.join(this.docsPath, "EPE_Group_11_Design_Doc.pdf"),
      path.join(this.docsPath, "moreInfo.pdf")
    ];

    const extractedDocs = {};
    
    for (const filePath of docFiles) {
      console.log(`Trying to load: ${filePath}`); // Debug line
      const extracted = await this.extractTextFromPDF(filePath);
      if (extracted) {
        const docType = this.getDocumentType(extracted.fileName);
        extractedDocs[docType] = extracted;
        console.log(`✅ Loaded ${extracted.fileName} as ${docType}`); // Debug line
      } else {
        console.log(`❌ Failed to load ${filePath}`); // Debug line
      }
    }

    return extractedDocs;
  }

  // Determine document type from filename - actual files
  getDocumentType(fileName) {
    const name = fileName.toLowerCase();
    if (name.includes('proposal')) return 'proposal';
    if (name.includes('srs')) return 'requirements';
    if (name.includes('design')) return 'design';
    if (name.includes('moreinfo')) return 'moreInfo';
    return 'general';
  }

  // Format all docs into AI-friendly knowledge base
  async createKnowledgeBase() {
    try {
      const docs = await this.loadAllJobSeekrDocs();
      
      let knowledgeBase = "JobSeekr Application Documentation:\n\n";
      
      // Add each document section - UPDATED for your document types
      if (docs.proposal) {
        knowledgeBase += `=== PROJECT PROPOSAL ===\n${docs.proposal.text}\n\n`;
      }
      
      if (docs.requirements) {
        knowledgeBase += `=== SOFTWARE REQUIREMENTS SPECIFICATION ===\n${docs.requirements.text}\n\n`;
      }
      
      if (docs.design) {
        knowledgeBase += `=== DESIGN DOCUMENT ===\n${docs.design.text}\n\n`;
      }

      if (docs.moreInfo) { // ✅ Added section
        knowledgeBase += `=== ADDITIONAL INFORMATION ===\n${docs.moreInfo.text}\n\n`;
      }
      
      // Add any other general docs
      Object.keys(docs).forEach(key => {
        if (!['proposal', 'requirements', 'design'].includes(key)) {
          knowledgeBase += `=== ${key.toUpperCase()} ===\n${docs[key].text}\n\n`;
        }
      });

      return {
        knowledgeBase,
        documentCount: Object.keys(docs).length,
        loadedAt: new Date().toISOString(),
        documents: docs
      };
    } catch (error) {
      console.error("Error creating knowledge base:", error);
      return null;
    }
  }

  // Save extracted knowledge to JSON file (optional - for caching)
  async saveKnowledgeToFile(outputPath = "./knowledge-base.json") {
    try {
      const knowledge = await this.createKnowledgeBase();
      if (knowledge) {
        fs.writeFileSync(outputPath, JSON.stringify(knowledge, null, 2));
        console.log(`✅ Knowledge base saved to ${outputPath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error saving knowledge base:", error);
      return false;
    }
  }

  // Load knowledge from saved JSON file (faster than re-parsing PDFs)
  loadKnowledgeFromFile(filePath = "./knowledge-base.json") {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error("Error loading knowledge from file:", error);
      return null;
    }
  }
}

// Utility function to get knowledge base for chatbot
// Replace your getJobSeekrKnowledge function with this:

async function getJobSeekrKnowledge() {
  const pdfReader = new PDFReader();
  
  // DELETE the cache file first to force fresh loading
  if (fs.existsSync("./knowledge-base.json")) {
    fs.unlinkSync("./knowledge-base.json");
    console.log("Deleted old cache file");
  }
  
  console.log("Loading JobSeekr documentation from PDFs...");
  const knowledge = await pdfReader.createKnowledgeBase();
  
  // Save for future use
  if (knowledge) {
    await pdfReader.saveKnowledgeToFile();
    
    // TRUNCATE to fit token limits
    // Roughly 4000 characters = ~1000 tokens (safe limit)
    const maxChars = 4000;
    let truncatedText = knowledge.knowledgeBase;
    
    if (truncatedText.length > maxChars) {
      truncatedText = truncatedText.substring(0, maxChars);
      // Find last complete sentence to avoid cutting mid-sentence
      const lastPeriod = truncatedText.lastIndexOf('.');
      if (lastPeriod > maxChars - 200) {
        truncatedText = truncatedText.substring(0, lastPeriod + 1);
      }
      truncatedText += "\n\n[Note: Content truncated due to size limits. Full documentation contains additional details.]";
    }
    
    console.log(`Knowledge truncated: ${truncatedText.length} characters (was ${knowledge.knowledgeBase.length})`);
    return truncatedText;
  }
  
  return null;
}

module.exports = { 
  PDFReader, 
  getJobSeekrKnowledge 
};