const express = require('express');
const { QueryProcessor } = require('./queryProcessor.js');
const crypto = require('crypto'); // Add this for session ID generation
const app = express();
app.use(express.json());
const cors = require('cors');
app.use(cors());
app.use(express.static('.')); // Serves files

// Initialize query processor
const qp = new QueryProcessor();

// CONTEXT MEMORY CLASS
class ConversationContext {
  constructor() {
    this.sessions = new Map();
    this.cleanup(); // Start cleanup timer
  }

  // Generates unique session identifier for each conversation
  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  // Retrieves or creates session data for a user
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

  // Updates session with new query data and user patterns
  updateSession(sessionId, userQuery, botResponse, metadata) {
    const session = this.getSession(sessionId);
    
    session.messageCount++;
    
    // Track recent queries (keep last 5)
    session.recentQueries.push({
      query: userQuery,
      intent: metadata.intent,
      confidence: metadata.confidence,
      timestamp: Date.now()
    });
    
    if (session.recentQueries.length > 5) {
      session.recentQueries.shift();
    }
    
    // Track topics discussed
    if (metadata.intent) {
      session.topics.add(metadata.intent);
      session.userPreferences[metadata.intent] = (session.userPreferences[metadata.intent] || 0) + 1;
    }
    
    // Track common words user uses
    const words = userQuery.toLowerCase().split(' ').filter(word => word.length > 3);
    words.forEach(word => {
      session.userPatterns.commonWords.set(word, 
        (session.userPatterns.commonWords.get(word) || 0) + 1
      );
    });
    
    // Track low confidence queries for help
    if (metadata.confidence < 0.6) {
      session.problematicQueries.push({
        query: userQuery,
        confidence: metadata.confidence,
        timestamp: Date.now()
      });
      
      // Keep only last 3 problematic queries
      if (session.problematicQueries.length > 3) {
        session.problematicQueries.shift();
      }
    }
    
    return session;
  }

  // Check if query is nonesense or random keyboard mashing
  isNonsensicalQuery(query) {
    const cleanQuery = query.toLowerCase().trim();
    
    // Check for keyboard mashing or random characters
    const hasRepeatingChars = /(.)\1{3,}/.test(cleanQuery); // 4+ repeated chars
    const hasRandomChars = /[qwerty]{5,}|[asdfgh]{5,}|[zxcvbn]{5,}/.test(cleanQuery); // keyboard mashing
    const wordCount = cleanQuery.split(' ').filter(word => word.length > 1).length;
    const avgWordLength = cleanQuery.replace(/\s/g, '').length / Math.max(wordCount, 1);
    
    // Mark as nonsensical if:
    // - Has repeating characters or keyboard mashing
    // - Very long "words" (average > 8 chars per word)
    // - Too few actual words relative to length
    return hasRepeatingChars || hasRandomChars || avgWordLength > 8 || wordCount < 2;
  }

  // Creates personalized greetings based on user history
  getPersonalizedGreeting(session, userQuery) {
    const query = userQuery.toLowerCase();
    
    // Check if it's a greeting
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

  // Returns appropriate greeting based on current time
  getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning!";
    if (hour < 17) return "Good afternoon!";
    return "Good evening!";
  }

  // Enhances responses with conversation context and history
  getContextualResponse(sessionId, baseResponse, userQuery, metadata) {
    const session = this.getSession(sessionId);
    
    // Handle greetings with personalized welcome
    const personalizedGreeting = this.getPersonalizedGreeting(session, userQuery);
    if (personalizedGreeting) {
      return personalizedGreeting;
    }
    
    let response = baseResponse;
    
    //Handle nonsensical queries first - before similarity check
    if (this.isNonsensicalQuery(userQuery)) {
      return "I'm sorry, but your question isn't clear to me. Could you please rephrase it or try asking about specific JobSeekr features like job applications, CV uploads, or account management?";
    }
    
    // Check for repeated questions
    const similarPastQuery = session.recentQueries.find(q => 
      this.calculateSimilarity(q.query.toLowerCase(), userQuery.toLowerCase()) > 0.7
    );
    
    if (similarPastQuery && session.messageCount > 1) {
      response = "I notice you asked something similar recently. Let me provide more details:\n\n" + response;
    }
    
    // Add contextual suggestions based on conversation history
    if (session.messageCount > 2 && Math.random() < 0.3) { // 30% chance to add suggestions
      const suggestions = this.getContextualSuggestions(session, metadata.intent);
      if (suggestions) {
        response += "\n\n" + suggestions;
      }
    }
    
    // Help with repeated low confidence queries
    if (session.problematicQueries.length >= 2) {
      const recentProblems = session.problematicQueries.filter(q => 
        Date.now() - q.timestamp < 10 * 60 * 1000 // Last 10 minutes
      );
      
      if (recentProblems.length >= 2) {
        response += "\n\nI notice you might be having trouble finding what you need. Feel free to ask more specific questions, or try the quick action buttons above for common topics!";
      }
    }
    
    // Add encouragement for new users
    if (session.messageCount === 2) {
      response += "\n\nTip: You can use the quick action buttons above for common questions, or just ask me anything about JobSeekr!";
    }
    
    return response;
  }

  // Calculates similarity between two queries using word overlap
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

  // Finds user's most discussed topic from preferences
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

  // Generates relevant suggestions based on user's conversation history
  getContextualSuggestions(session, currentIntent) {
    const topTopics = Object.entries(session.userPreferences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([topic]) => topic);
    
    // Don't suggest current topic
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

  // Automatically removes old session data to prevent memory leaks
  cleanup() {
    // Clean up sessions older than 2 hours
    setInterval(() => {
      const now = Date.now();
      const twoHours = 2 * 60 * 60 * 1000; // Fixed the variable name
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

  // Returns comprehensive statistics about a user's session
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

// INITIALIZE CONTEXT MEMORY
const conversationContext = new ConversationContext();

// Initialize once when the server starts
(async () => {
  console.log('🚀 Starting JobSeekr Bot Server...');
  await qp.initialize();
  console.log('🧠 Context Memory initialized');
})();

// ENHANCED CHAT ENDPOINT WITH CONTEXT MEMORY
// Handles incoming chat messages and provides contextual responses
app.post('/chat', async (req, res) => {
  console.log('\n🔄 Received chat request');
  
  // Get or generate session ID
  let { message, sessionId } = req.body;
  if (!sessionId) {
    sessionId = conversationContext.generateSessionId();
    console.log('🆕 New session created:', sessionId);
  }
  
  console.log('📝 User message:', message);
  console.log('🔑 Session ID:', sessionId.substring(0, 8) + '...');

  if (!message || message.trim() === "") {
    return res.json({
      response: "Please enter a valid question.",
      source: "error",
      confidence: 0,
      sessionId
    });
  }

  try {
    console.log('🔍 Processing query with context...');
    
    // Process the query
    const result = await qp.processQuery(message);
    
    // Update conversation context
    const session = conversationContext.updateSession(sessionId, message, result.response, result);
    
    // Get contextual response
    result.response = conversationContext.getContextualResponse(
      sessionId, 
      result.response, 
      message, 
      result
    );
    
    // Add session information
    result.sessionId = sessionId;
    result.sessionStats = conversationContext.getSessionStats(sessionId);
    
    console.log('✅ Query processed with context:');
    console.log(`   Source: ${result.source}`);
    console.log(`   Session messages: ${result.sessionStats.messageCount}`);
    console.log(`   Topics discussed: ${result.sessionStats.topicsDiscussed.join(', ')}`);
    console.log(`   Response preview: ${result.response.substring(0, 80)}...`);
    
    // Artificial delay for FAQ responses (simulate "thinking")
    if (result.source === "faq") {
      console.log("⏳ Simulating 3s delay for FAQ response...");
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    res.json(result);
  } catch (error) {
    console.error('❌ Error in chat endpoint:', error);
    res.json({
      response: "I encountered an error processing your request. Please try again.",
      source: "error",
      confidence: 0,
      sessionId,
      error: error.message
    });
  }
});

// ADD SESSION INFO ENDPOINT
// Returns detailed statistics about a specific session
app.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const stats = conversationContext.getSessionStats(sessionId);
  res.json(stats);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`📱 Open http://localhost:${PORT}/index.html in your browser (local only)`);
  console.log('🧠 Context memory active - conversations will be personalized!');
});