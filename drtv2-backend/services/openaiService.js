// backend/services/openaiService.js (DRTv2)

require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function evaluateResourcePrompt(prompt) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an autonomous verifier for the DRTv2 protocol. Your role is to assess whether a given user-submitted contribution provides verifiable real-world value (such as building, healing, educating, feeding, or restoring). Respond only with a numeric USD value estimate (no words, units, or formatting)."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 50,
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("OpenAI error:", error);
    return null;
  }
}

module.exports = {
  evaluateResourcePrompt,
};