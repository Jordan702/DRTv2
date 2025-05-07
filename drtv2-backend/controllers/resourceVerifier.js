const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const { evaluateResourcePrompt } = require('../services/openaiService');
require('dotenv').config();

const provider = new ethers.JsonRpcProvider(process.env.MAINNET_RPC_URL);
const signer = new ethers.Wallet(process.env.MINTER_PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.DRT_CONTRACT_ADDRESS, require('../DRT_abi.json'), signer);

const submissionHistory = new Map();

function hashProofFile(buffer) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function logSubmission({ walletAddress, valueEstimate, tokensMinted, description, hash }) {
  const logFolder = path.join(__dirname, '../logs');
  if (!fs.existsSync(logFolder)) fs.mkdirSync(logFolder);

  const timestamp = new Date().toISOString();
  const logData = `[${timestamp}]\nWallet: ${walletAddress}\nEstimate: $${valueEstimate.toFixed(2)}\nTokens Minted: ${tokensMinted}\nHash: ${hash}\nDescription: ${description}\n---\n`;

  fs.appendFileSync(path.join(logFolder, 'submissions.log'), logData);
}

exports.verifyAndMint = async (req, res) => {
  try {
    const { name, walletAddress, description } = req.body;
    const file = req.file;

    if (!file || !file.buffer) {
      return res.status(400).json({ error: 'No proof file uploaded.' });
    }

    const fileHash = hashProofFile(file.buffer);
    const key = `${walletAddress}_${description.trim().toLowerCase()}_${fileHash}`;
    const cooldownMinutes = 10;
    const now = Date.now();

    if (submissionHistory.has(key)) {
      const lastTime = submissionHistory.get(key);
      const minutesAgo = (now - lastTime) / 60000;
      if (minutesAgo < cooldownMinutes) {
        return res.status(429).json({ error: `Cooldown active. Try again in ${Math.ceil(cooldownMinutes - minutesAgo)} minutes.` });
      }
    }

    const { data: { text: extractedText } } = await Tesseract.recognize(file.buffer, 'eng');

    const forbiddenTerms = ['cash', 'payment', 'invoice', 'receipt', 'paid', 'usd', 'bank', '$', 'salary', 'amount'];
    if (forbiddenTerms.some(word => extractedText.toLowerCase().includes(word))) {
      return res.status(400).json({ error: 'Submissions with financial documentation are not accepted as valid proof.' });
    }

    const prompt = `Evaluate this contribution for the DRTv2 protocol. Estimate a fair USD value based on this description and the extracted text from attached proof. Respond with a numeric value only.\n\nDescription: ${description}\n\nProof Content: ${extractedText}`;
    const content = await evaluateResourcePrompt(prompt);
    let valueEstimate = parseFloat(content?.trim());
    if (isNaN(valueEstimate)) valueEstimate = 0;

    const tokensToMint = Math.min(valueEstimate / 1_000_000, 100);
    const mintAmount = ethers.parseUnits(tokensToMint.toString(), 18);

    const tx = await contract.mint(walletAddress, mintAmount);
    await tx.wait();

    submissionHistory.set(key, now);

    logSubmission({ walletAddress, valueEstimate, tokensMinted: tokensToMint, description, hash: fileHash });

    console.log(`✅ Minted ${tokensToMint} DRTv2 to ${walletAddress}`);
    res.json({
      message: `✅ Minted ${tokensToMint} DRTv2 to ${walletAddress}`,
      openAiResponse: valueEstimate.toFixed(2)
    });
  } catch (err) {
    console.error('❌ Submission error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};

