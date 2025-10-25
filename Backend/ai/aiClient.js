const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { default: ModelClient, isUnexpected } = require("@azure-rest/ai-inference");
const { AzureKeyCredential } = require("@azure/core-auth");
const { getJobSeekrKnowledge } = require('./loadPDF.js'); // Import your PDF reader

const token = process.env["token"];
const endpoint = "https://models.github.ai/inference";
const model = "openai/GPT-4.1-nano";

console.log("AI Token loaded:", token ? "YES (hidden)" : "NO - MISSING!");
console.log("Token length:", token ? token.length : 0);
class JobSeekrAI {
  constructor() {
    this.client = ModelClient(endpoint, new AzureKeyCredential(token));
    this.model = model;
    this.knowledgeBase = null;
  }

  
  async initialize() {
  console.log("🤖 Initializing JobSeekr AI...");
  
  try {
    const knowledgeText = await getJobSeekrKnowledge(); // This returns the text directly
    
    if (knowledgeText && knowledgeText.length > 0) {
      this.knowledgeBase = knowledgeText;
      console.log(`✅ AI loaded with PDF knowledge`);
      console.log(`📊 Knowledge base: ${knowledgeText.length} characters`);
      return true;
    } else {
      console.log("⚠️ No PDF knowledge loaded - AI will work with general knowledge only");
      return false;
    }
  } catch (error) {
    console.error(" Error loading PDF knowledge:", error);
    return false;
  }
}

findRelevantContent(userQuery, maxChunks = 2) {
  if (!this.knowledgeBase) return "";
  
  const query = userQuery.toLowerCase();
  const sections = this.knowledgeBase.split('===');
  
  // Score sections by relevance
  const scored = sections.map(section => ({
    text: section,
    score: (section.toLowerCase().match(new RegExp(query.split(' ').join('|'), 'g')) || []).length
  }));
  
  // Get top relevant sections
  const relevant = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)
    .map(s => s.text)
    .join('\n===');
  
  return relevant || sections.slice(0, 2).join('\n==='); // Fallback to first 2 sections
}

  // Generate response with PDF context
  async generateResponse(userQuery, additionalContext = "") {
    try {
    // Get only relevant content instead of full knowledge base
    const relevantContent = this.findRelevantContent(userQuery);
    
    let fullContext = "";
    if (relevantContent) {
      fullContext = `Relevant Documentation:\n${relevantContent}\n\n`;
    }
    
    if (additionalContext) {
      fullContext += `Additional Context: ${additionalContext}\n\n`;
    }

      const response = await this.client.path("/chat/completions").post({
        body: {
          messages: [
            {
              role: "system",
              content: this.getSystemPrompt()
            },
            {
              role: "user", 
              content: `${fullContext}User Question: ${userQuery}`
            }
          ],
          temperature: 0.7,
          model: this.model
        }
      });

      if (isUnexpected(response)) {
        throw new Error(`API Error: ${response.status} ${response.body?.error?.message || 'Unknown error'}`);
      }

      return response.body.choices[0].message.content;

    } catch (error) {
      console.error("Error generating AI response:", error);
      return "I'm sorry, I'm having trouble processing your request right now. Please try again later.";
    }
  }

  // Enhanced system prompt that mentions PDF knowledge
  getSystemPrompt() {
    return `You are a helpful assistant for JobSeekr, a job application platform. 

You have access to detailed documentation about JobSeekr including:
- Technical specifications and requirements
- Design documents and architecture  
- Project proposals and features
- User guides and functionality

Help users with:
- Job applications and the swiping interface
- Profile creation and CV uploads
- Account management
- Platform features and functionality
- Technical questions about the system

Guidelines:
- Use the provided documentation to give accurate, detailed answers
- Be concise but thorough
- If or where possible try not to give lengthy responses
- If the documentation doesn't contain specific information, clearly state this
- Always be helpful and professional
- Reference specific features or sections from the docs when relevant
-Do not mention project proposal only get information from it the user does not have to know where the source of information comes from
-You can also answer general questions, but always try to relate them back to JobSeekr when relevant.
 Use the provided documentation to give accurate answers about JobSeekr. For general questions, use your knowledge but be helpful and concise but do not answer stupid questions if possible.
-Do not ever talk about documentation talk like a regular human being.
-If you cannot find information in the documentation provided, say so and mention that feedback will be passed to the development team. do not ever talk about documentation talk like a regular human being.`;
  }

  // Refresh knowledge base (useful for updates)
  async refreshKnowledge() {
    console.log("🔄 Refreshing knowledge base...");
    return await this.initialize();
  }

  // Get info about loaded knowledge
  getKnowledgeInfo() {
    if (this.knowledgeBase) {
      return {
        loaded: true,
        characters: this.knowledgeBase.length,
        preview: this.knowledgeBase.substring(0, 200) + "..."
      };
    }
    return { loaded: false };
  }
}

// Main initialization function
async function main() {
  const jobSeekrAI = new JobSeekrAI();
  
  // Initialize with PDF knowledge
  const success = await jobSeekrAI.initialize();
  
  if (success) {
    console.log("JobSeekr AI is ready!");
    
    // Example usage
    // const response = await jobSeekrAI.generateResponse("How do I upload my CV to JobSeekr?");
    // console.log("AI Response:", response);
  } else {
    console.log("AI initialized without PDF knowledge");
  }
  
  return jobSeekrAI;
}

// For testing individual responses
async function testQuery(question) {
  const ai = await main();
  const response = await ai.generateResponse(question);
  console.log("\n" + "=".repeat(50));
  console.log(`Question: ${question}`);
  console.log("=".repeat(50));
  console.log(`Answer: ${response}`);
  console.log("=".repeat(50));
}
// testQuery("what is a stupid question to ask you");

// Export for use in other files
module.exports = { 
  JobSeekrAI, 
  main,
  testQuery
};

// Run if called directly
if (require.main === module) {
  main().catch((err) => {
    console.error("The sample encountered an error:", err);
  });
}