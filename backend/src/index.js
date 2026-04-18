const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// app.use(cors({
//   origin: process.env.FRONTEND_URL || 'http://localhost:3000',
//   credentials: true,
// }));
import cors from "cors";

app.use(cors({
  origin: [
    "https://voucher-zeta.vercel.app", // your frontend
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', require('./routes'));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Start cron scheduler after server is up
  const { initCronScheduler } = require('./jobs/scheduler');
  initCronScheduler();
});
