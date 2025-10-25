// backend/ai/bot.js
const { QueryProcessor } = require('./queryProcessor.js');
const crypto = require('crypto');

// CONTEXT MEMORY CLASS
class ConversationContext {
  constructor() {
    this.sessions = new Map();
    this.cleanup();
  }

  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  getSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        startTime: Date.now(),
        messageCount: 0,
        topics: new Set(),
        userPreferences: {},
        lastActivity: Date.now(),
        recentQueries: [],
        problematicQueries: [],
        userPatterns: {
          commonWords: new Map(),
          preferredTopics: new Map()
        }
      });
    }
    
    const session = this.sessions.get(sessionId);
    session.lastActivity = Date.now();
    return session;
  }

  updateSession(sessionId, userQuery, botResponse, metadata) {
    const session = this.getSession(sessionId);
    
    session.messageCount++;
    
    session.recentQueries.push({
      query: userQuery,
      intent: metadata.intent,
      confidence: metadata.confidence,
      timestamp: Date.now()
    });
    
    if (session.recentQueries.length > 5) {
      session.recentQueries.shift();
    }
    
    if (metadata.intent) {
      session.topics.add(metadata.intent);
      session.userPreferences[metadata.intent] = (session.userPreferences[metadata.intent] || 0) + 1;
    }
    
    const words = userQuery.toLowerCase().split(' ').filter(word => word.length > 3);
    words.forEach(word => {
      session.userPatterns.commonWords.set(word, 
        (session.userPatterns.commonWords.get(word) || 0) + 1
      );
    });
    
    if (metadata.confidence < 0.6) {
      session.problematicQueries.push({
        query: userQuery,
        confidence: metadata.confidence,
        timestamp: Date.now()
      });
      
      if (session.problematicQueries.length > 3) {
        session.problematicQueries.shift();
      }
    }
    
    return session;
  }

  isNonsensicalQuery(query) {
    const cleanQuery = query.toLowerCase().trim();
    const hasRepeatingChars = /(.)\1{3,}/.test(cleanQuery);
    const hasRandomChars = /[qwerty]{5,}|[asdfgh]{5,}|[zxcvbn]{5,}/.test(cleanQuery);
    const wordCount = cleanQuery.split(' ').filter(word => word.length > 1).length;
    const avgWordLength = cleanQuery.replace(/\s/g, '').length / Math.max(wordCount, 1);
    
    return hasRepeatingChars || hasRandomChars || avgWordLength > 8 || wordCount < 2;
  }

  getPersonalizedGreeting(session, userQuery) {
    const query = userQuery.toLowerCase();
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
    const isGreeting = greetings.some(greeting => 
      query.includes(greeting) || query === greeting
    );
    
    if (!isGreeting) return null;
    
    if (session.messageCount === 1) {
      const timeGreeting = this.getTimeBasedGreeting();
      return `${timeGreeting} Welcome to JobSeekr! I'm here to help you with job applications, CV uploads, and account management. What can I assist you with today?`;
    } else if (session.messageCount < 5) {
      return "Hello again! How can I help you with JobSeekr today?";
    } else {
      const topTopic = this.getTopPreference(session.userPreferences);
      if (topTopic) {
        const topicMessages = {
          'apply_job': "Welcome back! Ready for more job application help?",
          'upload_cv': "Hi there! Need more assistance with your CV or profile?",
          'account_management': "Hello! More account questions today?",
          'reset_password': "Hi again! Having more login or password issues?",
          'delete_account': "Welcome back! How can I help you today?"
        };
        return topicMessages[topTopic] || "Welcome back! How can I assist you today?";
      }
      return "Welcome back! What can I help you with today?";
    }
  }

  getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning!";
    if (hour < 17) return "Good afternoon!";
    return "Good evening!";
  }

  getContextualResponse(sessionId, baseResponse, userQuery, metadata) {
    const session = this.getSession(sessionId);
    
    const personalizedGreeting = this.getPersonalizedGreeting(session, userQuery);
    if (personalizedGreeting) {
      return personalizedGreeting;
    }
    
    let response = baseResponse;
    
    if (this.isNonsensicalQuery(userQuery)) {
      return "I'm sorry, but your question isn't clear to me. Could you please rephrase it or try asking about specific JobSeekr features like job applications, CV uploads, or account management?";
    }
    
    const similarPastQuery = session.recentQueries.find(q => 
      this.calculateSimilarity(q.query.toLowerCase(), userQuery.toLowerCase()) > 0.7
    );
    
    if (similarPastQuery && session.messageCount > 1) {
      response = "I notice you asked something similar recently. Let me provide more details:\n\n" + response;
    }
    
    if (session.messageCount > 2 && Math.random() < 0.3) {
      const suggestions = this.getContextualSuggestions(session, metadata.intent);
      if (suggestions) {
        response += "\n\n" + suggestions;
      }
    }
    
    if (session.problematicQueries.length >= 2) {
      const recentProblems = session.problematicQueries.filter(q => 
        Date.now() - q.timestamp < 10 * 60 * 1000
      );
      
      if (recentProblems.length >= 2) {
        response += "\n\nI notice you might be having trouble finding what you need. Feel free to ask more specific questions, or try the quick action buttons above for common topics!";
      }
    }
    
    if (session.messageCount === 2) {
      response += "\n\nTip: You can use the quick action buttons above for common questions, or just ask me anything about JobSeekr!";
    }
    
    return response;
  }

  calculateSimilarity(str1, str2) {
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    
    let commonWords = 0;
    words1.forEach(word => {
      if (words2.includes(word) && word.length > 2) {
        commonWords++;
      }
    });
    
    return commonWords / Math.max(words1.length, words2.length);
  }

  getTopPreference(preferences) {
    let maxCount = 0;
    let topTopic = null;
    
    for (const [topic, count] of Object.entries(preferences)) {
      if (count > maxCount) {
        maxCount = count;
        topTopic = topic;
      }
    }
    
    return maxCount > 1 ? topTopic : null;
  }

  getContextualSuggestions(session, currentIntent) {
    const topTopics = Object.entries(session.userPreferences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([topic]) => topic);
    
    const suggestableTopics = topTopics.filter(topic => topic !== currentIntent);
    
    if (suggestableTopics.length === 0) return null;
    
    const suggestions = {
      'apply_job': "💡 Since you're interested in applications, you might also want to know about job matching or interview tips.",
      'upload_cv': "💡 For CV help, you might find our profile optimization and job search tips useful too.",
      'account_management': "💡 Need help with other features like job preferences or notification settings?",
      'reset_password': "💡 While you're here, you might want to check your account security settings too.",
      'job_matching': "💡 Want to know more about improving your job matches or application strategies?"
    };
    
    return suggestions[suggestableTopics[0]];
  }

  cleanup() {
    setInterval(() => {
      const now = Date.now();
      const twoHours = 2 * 60 * 60 * 1000;
      let cleaned = 0;
      
      for (const [sessionId, session] of this.sessions.entries()) {
        if (now - session.lastActivity > twoHours) {
          this.sessions.delete(sessionId);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} inactive sessions`);
      }
    }, 30 * 60 * 1000); 
  }

  getSessionStats(sessionId) {
    const session = this.getSession(sessionId);
    return {
      messageCount: session.messageCount,
      topicsDiscussed: Array.from(session.topics),
      sessionDuration: Date.now() - session.startTime,
      hasProblematicQueries: session.problematicQueries.length > 0,
      topWords: Array.from(session.userPatterns.commonWords.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([word, count]) => ({ word, count }))
    };
  }
}

// Initialize query processor and context
// Initialize query processor and context
const qp = new QueryProcessor();
const conversationContext = new ConversationContext();

let isInitialized = false;
let initializationPromise = null;
let initializationError = null;

// Start initialization when module loads
function ensureInitialized() {
  if (isInitialized) {
    return Promise.resolve();
  }
  
  if (initializationError) {
    return Promise.reject(initializationError);
  }
  
  if (!initializationPromise) {
    console.log('🚀 Starting JobSeekr Bot Module initialization...');
    
    initializationPromise = (async () => {
      try {
        console.log('⏳ Calling qp.initialize()...');
        await qp.initialize();
        
        console.log('🧠 Context Memory initialized');
        console.log('📊 Final stats:', qp.getStats());
        
        isInitialized = true;
        console.log('✅ Bot module FULLY ready - isInitialized =', isInitialized);
        
      } catch (error) {
        console.error('❌ Bot initialization failed:', error);
        console.error('Stack:', error.stack);
        initializationError = error;
        throw error;
      }
    })();
  }
  
  return initializationPromise;
}

// Start initialization immediately when module loads
console.log('🔧 Bot module loading - starting initialization...');
ensureInitialized().catch(err => {
  console.error('💥 Failed to initialize bot on module load:', err);
});

// Export the instances and handler function
// backend/ai/bot.js - FIXED EXPORTS SECTION
// Replace your existing module.exports with this:

module.exports = {
  queryProcessor: qp,
  conversationContext: conversationContext,
  
  // Export the initialization function so server can wait for it
  ensureInitialized,
  
  // Main chat handler function
  async handleChat(message, sessionId = null) {
    const startTime = Date.now();
    console.log('\n🔄 Bot processing message:', message.substring(0, 50));
    
    // CRITICAL: Ensure bot is initialized before processing
    if (!isInitialized) {
      console.log('⏳ Bot not ready yet, waiting for initialization...');
      try {
        await ensureInitialized();
        console.log('✅ Initialization complete, proceeding...');
      } catch (error) {
        console.error('❌ Initialization failed:', error);
        return {
          response: "The bot is still starting up. Please try again in a moment.",
          source: "error",
          confidence: 0,
          sessionId: sessionId || conversationContext.generateSessionId(),
          error: "Bot initialization failed",
          details: error.message
        };
      }
    }
    
    if (!sessionId) {
      sessionId = conversationContext.generateSessionId();
      console.log('🆕 New session created:', sessionId);
    }
    
    if (!message || message.trim() === "") {
      return {
        response: "Please enter a valid question.",
        source: "error",
        confidence: 0,
        sessionId
      };
    }

    try {
      console.log('🔍 Processing query with context...');
      
      const result = await qp.processQuery(message);
      
      console.log('   processQuery returned:', {
        source: result.source,
        confidence: result.confidence,
        responseLength: result.response?.length || 0
      });
      
      const session = conversationContext.updateSession(
        sessionId, 
        message, 
        result.response, 
        result
      );
      
      result.response = conversationContext.getContextualResponse(
        sessionId, 
        result.response, 
        message, 
        result
      );
      
      result.sessionId = sessionId;
      result.sessionStats = conversationContext.getSessionStats(sessionId);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Query processed in ${processingTime}ms`);
      
      // Natural delay for FAQ responses
      if (result.source === "faq" && processingTime < 2500) {
        const delay = 2500 - processingTime;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Error in bot handler:', error);
      console.error('Stack:', error.stack);
      return {
        response: "I encountered an error processing your request. Please try again.",
        source: "error",
        confidence: 0,
        sessionId,
        error: error.message
      };
    }
  },
  
  // Status check function
  getStatus() {
    return {
      initialized: isInitialized,
      initializationInProgress: !!initializationPromise && !isInitialized,
      hasError: !!initializationError,
      error: initializationError?.message || null,
      faqCount: qp.faqDatabase ? qp.faqDatabase.faqs.length : 0,
      embeddingsCount: qp.faqEmbeddings ? qp.faqEmbeddings.length : 0,
      semanticModelLoaded: qp.embedder !== null,
      aiReady: qp.aiClient && qp.aiClient.knowledgeBase !== null
    };
  }
};