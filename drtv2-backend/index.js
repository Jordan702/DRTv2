// backend/index.js (DRTv2)

// Load environment variables
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

// Initialize Express app
const app = express();

// Enable CORS for DRTv2 frontend (adjust if hosted elsewhere)
app.use(cors({
  origin: 'http://localhost:5173', // Update this to match your DRTv2 frontend port if different
  methods: ['GET', 'POST'],
  credentials: false
}));

// Middleware to parse JSON
app.use(express.json());

// Setup multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Import and use the /api/verify submission route
const submitRoute = require('./routes/submit');
app.use('/api/verify', submitRoute);

// Test route
app.get('/', (req, res) => {
  res.send('DRTv2 Backend API is live 🚀');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ DRTv2 backend running on port ${PORT}`);
});
