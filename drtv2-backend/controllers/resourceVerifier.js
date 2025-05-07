// drtv2-backend/controllers/resourceVerifier.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const { ethers } = require('ethers');
const { evaluateResourcePrompt } = require('../services/openaiService');

const DRT_ABI = require('../DRT_abi.json');

const provider = new ethers.JsonRpcProvider(process.env.MAINNET_RPC_URL);
const signer = new ethers.Wallet(process.env.MINTER_PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.DRT_CONTRACT_ADDRESS, DRT_ABI, signer);

(async () => {
  console.log("✅ DRTv2 Contract Loaded:", contract.target);
  console.log("✅ Signer:", await signer.getAddress());
})();

async function verifyAndMint(req, res) {
  const { walletAddress, description } = req.body;
  const proofFile = req.file;

  try {
    if (!walletAddress || !description || !proofFile) {
      return res.status(400).json({ error: 'Missing required fields or file' });
    }

    const proofPath = path.resolve(__dirname, '..', proofFile.path);
    const ocrResult = await Tesseract.recognize(proofPath, 'eng');
    const extractedText = ocrResult.data.text;
    fs.unlinkSync(proofPath); // Clean up uploaded file

    const prompt = `Evaluate this contribution for the DRTv2 protocol. Estimate a fair USD value based on this description and the extracted text from attached proof. Respond with a numeric value only.\n\nDescription: ${description}\n\nProof Content: ${extractedText}`;
    const content = await evaluateResourcePrompt(prompt);

    let valueEstimate = parseFloat(content?.trim());
    if (isNaN(valueEstimate)) valueEstimate = 0;
    const parsedValue = parseFloat(valueEstimate.toString().replace(/[^\d.]/g, ''));
    const tokensToMint = Math.min((parsedValue * 1000) / 100, 100); // Cap at 100
    const mintAmount = ethers.parseUnits(tokensToMint.toFixed(6), 18);

    const tx = await contract.mint(walletAddress, mintAmount);
    await tx.wait();

    res.json({
      message: `✅ Minted ${tokensToMint} DRTv2 to ${walletAddress}`,
      txHash: tx.hash,
      openAiResponse: content
    });

  } catch (err) {
    console.error('❌ verifyAndMint ERROR:', err);
    res.status(500).json({ error: 'Submission failed', details: err.message });
  }
}

module.exports = { verifyAndMint };
