const { ethers } = require('ethers');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const { evaluateResourcePrompt } = require('../services/openaiService');
const abi = require('../DRT_abi.json');
require('dotenv').config();

const provider = new ethers.JsonRpcProvider(process.env.MAINNET_RPC_URL);
const signer = new ethers.Wallet(process.env.MINTER_PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.DRT_CONTRACT_ADDRESS, abi, signer);

async function verifyAndMint(req, res) {
  const { name, walletAddress, description } = req.body;
  const file = req.file;

  if (!file || !walletAddress || !description) {
    return res.status(400).json({ error: 'Missing required fields or file.' });
  }

  const filePath = path.join(__dirname, '..', file.path);

  try {
    const ocrResult = await Tesseract.recognize(filePath, 'eng');
    const extractedText = ocrResult.data.text.trim();

    const prompt = `Evaluate this contribution for the DRTv2 protocol. Estimate a fair USD value based on this description and the extracted text from attached proof. Respond with a numeric value only.\n\nDescription: ${description}\n\nProof Content: ${extractedText}`;
    const content = await evaluateResourcePrompt(prompt);

    let valueEstimate = parseFloat(content?.trim().replace(/[^\d.]/g, ''));
    if (isNaN(valueEstimate)) valueEstimate = 0;

    const tokensToMint = Math.min(valueEstimate / 1, 100); // 1 DRTv2 per $1
    const mintAmount = ethers.parseUnits(tokensToMint.toFixed(6), 18);

    const tx = await contract.mint(walletAddress, mintAmount);
    await tx.wait();

    console.log(`✅ Minted ${tokensToMint} DRTv2 to ${walletAddress}`);

    return res.json({
      message: `✅ Minted ${tokensToMint} DRTv2 to ${walletAddress}`,
      openAiResponse: valueEstimate.toFixed(2),
    });
  } catch (err) {
    console.error('❌ Minting error:', err);
    return res.status(500).json({ error: 'Minting failed or evaluation error.' });
  } finally {
    fs.unlink(filePath, () => {}); // Cleanup uploaded file
  }
}

module.exports = { verifyAndMint };

