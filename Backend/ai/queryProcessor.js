const FAQDatabase = require('./faqDatabase.js');
const { JobSeekrAI } = require('./aiClient.js');
const { pipeline } = require('@xenova/transformers');
const fs = require('fs');
const path = require('path');


//These are smart suggestions uses will be prompted to ask for follow up or if the bot is confused 
class SmartSuggestions {
  constructor() {
    this.commonQuestions = [
      "How do I apply for jobs?",
      "How do I upload my CV?", 
      "How do I reset my password?",
      "How does job matching work?",
      "How do I delete my account?",
      "How do I contact employers?",
      "How do I withdraw my application?",
      "What file formats are supported for CV?",
      "How do I update my profile?",
      "How do I change my password?",
      "How do I search for jobs?",
      "Can I edit my application?",
      "How long does review take?",
      "How do I get more matches?",
      "What should I include in my CV?",
      "How do I message employers?",
      "Can I save job searches?",
      "How do I set job preferences?"
    ];
    
    // Category-based questions for better suggestions
    this.categoryQuestions = {
      'account': [
        "How do I sign up?",
        "How do I log in?",
        "How do I reset my password?",
        "How do I delete my account?"
      ],
      'profile': [
        "How do I upload my CV?",
        "How do I edit my profile?",
        "Can I upload multiple CVs?",
        "Can I build my CV in the app?"
      ],
      'applications': [
        "How do I apply for a job?",
        "Can I withdraw an application?",
        "How do I see the jobs I applied for?",
        "How do employers see my application?"
      ],
      'jobs': [
        "What happens when I swipe left?",
        "What happens when I swipe right?",
        "How do I reject a job?",
        "What happens if there are no more jobs?"
      ],
      'messaging': [
        "Can employers message me directly?",
        "Can job seekers message employers first?",
        "How do I chat with an employer?"
      ],
      'employers': [
        "How do employers create job listings?",
        "How do employers post a job?",
        "How do employers manage job listings?",
        "Can employers update job listings?"
      ]
    };
  }

  // AI help bot now considers category for better suggestions
  findSimilarQuestions(userQuery, category = null) {
    const query = userQuery.toLowerCase();
    const suggestions = [];
    const keywords = query.split(' ').filter(word => word.length > 2);
    
    // If we have a category, prioritize questions from that category
    let questionsToSearch = this.commonQuestions;
    if (category && this.categoryQuestions[category]) {
      questionsToSearch = [
        ...this.categoryQuestions[category], 
        ...this.commonQuestions.filter(q => !this.categoryQuestions[category].includes(q))
      ];
    }
    
    //searches for questions in faqDatabase here
    questionsToSearch.forEach(question => {
      let score = 0;
      const questionLower = question.toLowerCase();
      
      // Higher score for same-category questions
      if (category && this.categoryQuestions[category] && this.categoryQuestions[category].includes(question)) {
        score += 1;
      }
      
      // Check for keyword matches
      keywords.forEach(keyword => {
        if (questionLower.includes(keyword)) {
          score += 1;
        }
      });
      
      // Check for partial matches
      if (questionLower.includes(query) || query.includes(questionLower.split(' ')[0])) {
        score += 2;
      }
      
      if (score > 0) {
        suggestions.push({ question, score });
      }
    });

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.question);
  }
}

class QueryProcessor {
  constructor(faqFilePath = './faq_and_knowledge.json') {
    this.faqDatabase = new FAQDatabase(faqFilePath);
    this.aiClient = new JobSeekrAI();
    this.isInitialized = false;
    this.embedder = null;
    this.faqEmbeddings = [];
    this.faqFilePath = path.isAbsolute(faqFilePath) ? faqFilePath : path.join(__dirname, faqFilePath);

    //New feature: Category mapping for better intent detection
    this.categoryNames = {
      'account': 'Account Management',
      'profile': 'Profile & CV',
      'applications': 'Job Applications', 
      'jobs': 'Job Browsing',
      'messaging': 'Communication',
      'employers': 'For Employers',
      'matching': 'Job Matching',
      'security': 'Security & Privacy',
      'interviews': 'Interviews',
      'general': 'General Information'
    };

    // Watch for file changes
    this.setupFileWatcher();
  }

  // Initialize FAQ + AI + Semantic Model
  async initialize() {
    console.log('🔧 Initializing Semantic Query Processor...');
    try {
      this.faqDatabase.load();
      console.log(` Loaded ${this.faqDatabase.faqs.length} FAQ responses from JSON`);

      console.log('Loading semantic model...');
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log(' Semantic model loaded');

      await this.precomputeFAQEmbeddings();
      console.log(' FAQ embeddings computed');

      const aiSuccess = await this.aiClient.initialize();
      if (aiSuccess) {
        console.log(' AI fallback ready');
      } else {
        console.log('⚠️ AI fallback initialized without PDF knowledge');
      }

      this.isInitialized = true;
      console.log('Query Processor ready: FAQ first, AI fallback');
      return true;
    } catch (error) {
      console.error('❌Error initializing Query Processor:', error);
      this.isInitialized = false;
      return false;
    }
  }

  setupFileWatcher() {
    try {
      fs.watch(this.faqFilePath, (eventType, filename) => {
        if (eventType === 'change') {
          console.log(`\n📁 FAQ file changed, reloading...`);
          this.reloadFAQs();
        }
      });
      console.log(`👀 Watching ${path.basename(this.faqFilePath)} for changes`);
    } catch (error) {
      console.error('Could not set up file watcher:', error);
    }
  }

  //here the code checks if anything has changed in the faq json file
  async reloadFAQs() {
    try {
      console.log(' Reloading FAQ database...');
      this.faqDatabase.load(true);
      console.log(` Reloaded ${this.faqDatabase.faqs.length} FAQs`);

      await this.precomputeFAQEmbeddings();
      console.log(' FAQ embeddings recomputed');
    } catch (error) {
      console.error(' Error reloading FAQs:', error);
    }
  }

  //vectorised values for strings turned to vectors for analysis
  async precomputeFAQEmbeddings() {
    console.log('Computing embeddings for FAQ questions...');
    this.faqEmbeddings = [];

    for (let i = 0; i < this.faqDatabase.faqs.length; i++) {
      const faq = this.faqDatabase.faqs[i];
      const embedding = await this.getEmbedding(faq.question);

      this.faqEmbeddings.push({
        index: i,
        question: faq.question,
        answer: faq.answer,
        category: faq.category || 'general', // NEW: Include category
        tags: faq.tags || [], // NEW: Include tags
        embedding: embedding,
        keywords: this.extractKeywords(faq.question),
      });
    }

    console.log(`✅ Computed embeddings for ${this.faqEmbeddings.length} FAQ questions`);
  }

  async getEmbedding(text) {
    try {
      const output = await this.embedder(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  }

  //a value assigned to the faq and the user input represented in numerical form
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  extractKeywords(text) {
    const jobseekrKeywords = [
      'apply', 'application', 'job', 'jobs', 'cv', 'resume', 'upload', 'profile',
      'swipe', 'match', 'employer', 'password', 'login', 'account', 'delete',
      'withdraw', 'interview', 'salary', 'preferences', 'notification',
    ];

    const words = text.toLowerCase().split(/\s+/);
    return words.filter(word => jobseekrKeywords.includes(word));
  }

  //semantic match is the most likely value from user input which is closest to the question from the json file faqs
  async findSemanticFAQMatch(userQuery) {
    if (!this.embedder || this.faqEmbeddings.length === 0) {
      console.log('Semantic matching not available');
      return null;
    }

    try {
      const queryEmbedding = await this.getEmbedding(userQuery);
      if (!queryEmbedding) return null;

      let bestMatch = null;
      let bestScore = 0;
      const queryKeywords = this.extractKeywords(userQuery);

      for (const faqItem of this.faqEmbeddings) {
        const semanticScore = this.cosineSimilarity(queryEmbedding, faqItem.embedding);
        const keywordOverlap = queryKeywords.filter(k => faqItem.keywords.includes(k)).length;
        const keywordBonus = keywordOverlap > 0 ? 0.1 * keywordOverlap : 0;
        const totalScore = semanticScore + Math.min(keywordBonus, 0.3);

        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestMatch = {
            question: faqItem.question,
            answer: faqItem.answer,
            category: faqItem.category, // Include category in match(new stuff)
            tags: faqItem.tags, // Include tags in match(new stuff)
            semanticScore: semanticScore,
            keywordBonus: keywordBonus,
            totalScore: totalScore,
          };
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('Error in semantic matching:', error);
      return null;
    }
  }

  //Intent Classification with category mapping
  classifyIntent(query) {
    const q = query.toLowerCase();
    
    // Map intents to categories for better organization
    if (q.includes('withdraw')) return { intent: 'withdraw_application', category: 'applications' };
    if (q.includes('apply') || q.includes('application')) return { intent: 'apply_job', category: 'applications' };
    if (q.includes('upload') && q.includes('cv')) return { intent: 'upload_cv', category: 'profile' };
    if (q.includes('login') || q.includes('sign in')) return { intent: 'login', category: 'account' };
    if (q.includes('sign up') || q.includes('register')) return { intent: 'signup', category: 'account' };
    if (q.includes('password')) return { intent: 'reset_password', category: 'account' };
    if (q.includes('interview')) return { intent: 'interview', category: 'interviews' };
    if (q.includes('message') || q.includes('chat')) return { intent: 'messaging', category: 'messaging' };
    if (q.includes('delete') || q.includes('remove')) return { intent: 'delete_account', category: 'account' };
    if (q.includes('swipe')) return { intent: 'swipe_jobs', category: 'jobs' };
    if (q.includes('employer') && q.includes('post')) return { intent: 'employer_post', category: 'employers' };
    
    return { intent: 'general', category: 'general' };
  }

  // --- Entity Extraction ---
  extractEntities(query) {
    const entities = [];
    const lower = query.toLowerCase();

    if (lower.includes('cv') || lower.includes('resume')) entities.push('CV');
    if (lower.includes('password')) entities.push('Password');
    if (lower.includes('job')) entities.push('Job');
    if (lower.includes('interview')) entities.push('Interview');
    if (lower.includes('employer')) entities.push('Employer');

    return entities;
  }

  // Get category display name
  getCategoryDisplayName(category) {
    return this.categoryNames[category] || 'General Information';
  }

  // Add category context to responses
  addCategoryContext(response, category, isFromFAQ = false) {
    if (!category || category === 'general') return response;
    
    const categoryName = this.getCategoryDisplayName(category);
    const contextPrefix = isFromFAQ 
      // ? `**${categoryName}:** ` 
      // : `Here's help with **${categoryName}**: `;
    
    return response;
  }

  async processQuery(userQuery) {
    if (!this.isInitialized) {
      console.log('⚠️ Query Processor not initialized, initializing now...');
      await this.initialize();
    }

    console.log(`🔍 Processing: "${userQuery}"`);
    const startTime = Date.now();

    try {
      const intentResult = this.classifyIntent(userQuery);
      const intent = intentResult.intent;
      const detectedCategory = intentResult.category;
      const entities = this.extractEntities(userQuery);

      console.log(`Detected intent: ${intent} (${detectedCategory})`);
      console.log(`Extracted entities: ${entities.join(', ') || 'None'}`);

      const faqMatch = await this.findSemanticFAQMatch(userQuery);

      if (faqMatch && this.isGoodFAQMatch(faqMatch)) {
        const processingTime = Date.now() - startTime;

        // ENHANCED: Add category context to FAQ responses
        const enhancedResponse = this.addCategoryContext(faqMatch.answer, faqMatch.category, true);

        const result = {
          response: enhancedResponse,
          source: 'faq',
          matchedQuestion: faqMatch.question,
          category: faqMatch.category, // Include category in result
          categoryName: this.getCategoryDisplayName(faqMatch.category), // Human-readable category
          tags: faqMatch.tags, // Include tags
          processingTime,
          confidence: faqMatch.totalScore,
          intent,
          entities,
        };

        // ENHANCED: Use category-aware suggestions
        if (faqMatch.totalScore < 0.85) {
          const suggestions = new SmartSuggestions();
          const similar = suggestions.findSimilarQuestions(userQuery, faqMatch.category);
          
          if (similar.length > 0) {
            result.suggestions = similar;
          }
        }

        return result;
      }

      console.log('🤖 No FAQ match found, using AI fallback...');
      const aiResponse = await this.aiClient.generateResponse(userQuery);
      const processingTime = Date.now() - startTime;

      // ENHANCED: Add category context to AI responses too
      const enhancedAIResponse = this.addCategoryContext(aiResponse, detectedCategory, false);

      const result = {
        response: enhancedAIResponse,
        source: 'ai',
        category: detectedCategory, //  Include detected category
        categoryName: this.getCategoryDisplayName(detectedCategory), // Human readable category
        processingTime,
        confidence: 0.85,
        intent,
        entities,
      };

      // ENHANCED: Category-aware suggestions for AI responses
      if (result.confidence < 0.7 || result.source === 'error') {
        const suggestions = new SmartSuggestions();
        const similar = suggestions.findSimilarQuestions(userQuery, detectedCategory);
        
        if (similar.length > 0) {
          result.suggestions = similar;
          
          if (result.confidence < 0.7) {
            result.response += "\n\nYou might also be interested in:\n" + 
              similar.map((q, i) => `• ${q}`).join('\n');
          }
        }
      }

      return result;

    } catch (error) {
      console.error('❌ Error processing query:', error);
      const processingTime = Date.now() - startTime;

      const result = {
        response: "I'm having trouble right now. Please try again or contact supportjobseekr@gmail.com",
        source: 'error',
        category: 'general',
        categoryName: 'General Information',
        processingTime,
        confidence: 0,
        intent: 'error',
        entities: [],
      };

      // ENHANCED: Category-aware suggestions for errors too
      const suggestions = new SmartSuggestions();
      const similar = suggestions.findSimilarQuestions(userQuery);
      
      if (similar.length > 0) {
        result.suggestions = similar;
        result.response = "I'm not sure about that specific question. Did you mean one of these?\n\n" + 
          similar.map((q, i) => `${i + 1}. ${q}`).join('\n');
      }

      return result;
    }
  }

  isGoodFAQMatch(faqMatch) {
    const threshold = 0.70;
    return faqMatch.totalScore >= threshold;
  }

  async testQuery(query) {
    console.log('\n' + '='.repeat(60));
    console.log(`🧪 TESTING: "${query}"`);
    console.log('='.repeat(60));

    const result = await this.processQuery(query);

    console.log(`🎯 RESULT:`);
    console.log(`   Source: ${result.source.toUpperCase()}`);
    console.log(`   Category: ${result.categoryName} (${result.category})`); //  Show category (new stuff)
    console.log(`   Time: ${result.processingTime}ms`);
    console.log(`   Confidence: ${result.confidence.toFixed(3)}`);
    console.log(`   Intent: ${result.intent}`);
    console.log(`   Entities: ${result.entities.join(', ') || 'None'}`);
    if (result.tags) {
      console.log(`   Tags: ${result.tags.join(', ')}`); // Show tags (new stuff)
    }
    if (result.matchedQuestion) {
      console.log(`   Matched: "${result.matchedQuestion}"`);
    }
    if (result.suggestions) {
      console.log(`   Suggestions: ${result.suggestions.join(', ')}`);
    }
    console.log(`   Response: "${result.response.substring(0, 100)}..."`);
    console.log('='.repeat(60));

    return result;
  }

  getStats() {
    return {
      initialized: this.isInitialized,
      faqCount: this.faqDatabase.faqs.length,
      semanticModelLoaded: this.embedder !== null,
      aiReady: this.aiClient.knowledgeBase !== null,
      categoriesAvailable: Object.keys(this.categoryNames), // Available categories
    };
  }
}

module.exports = { QueryProcessor };