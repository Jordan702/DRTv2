// drtv2-backend/scripts/mintSeed.js

require('dotenv').config();
const { ethers } = require('ethers');
const abi = require('../DRT_abi.json'); // Make sure the ABI is correct for DRTv2

const provider = new ethers.JsonRpcProvider(process.env.MAINNET_RPC_URL);
const signer = new ethers.Wallet(process.env.MINTER_PRIVATE_KEY, provider);

const contract = new ethers.Contract(process.env.DRT_CONTRACT_ADDRESS, abi, signer);

// 👇 Replace this with your actual wallet address (the one that will seed the pool)
const recipient = '0x0A0f067e99fAc0BE77175bf461e7B8aa7684B2A1';

const amountToMint = ethers.parseUnits('0.0001', 18); // 0.0001 DRTv2

async function mintDRT() {
  try {
    const tx = await contract.mint(recipient, amountToMint);
    console.log('⏳ Minting transaction sent:', tx.hash);
    await tx.wait();
    console.log(`✅ Successfully minted 0.0001 DRTv2 to ${recipient}`);
  } catch (err) {
    console.error('❌ Minting failed:', err.message);
  }
}

mintDRT();
