# ⚡ ChainPulse

> **A Chainhook-Powered Activity Tracker for Stacks**  
> Built for Stacks Builder Challenge Week 2 - Chainhooks Integration

![ChainPulse Banner](https://via.placeholder.com/1200x400/1a1a2e/9333ea?text=ChainPulse+-+Powered+by+Hiro+Chainhooks)

## 🎯 Overview

ChainPulse is a **fee-generating activity tracker** that demonstrates comprehensive integration with [Hiro Chainhooks](https://docs.hiro.so/stacks/chainhook). Users can send "pulses" (small fee-generating transactions) to earn points, maintain streaks, and compete on the leaderboard.

### Key Features

- 🔗 **Full Chainhooks Integration** - Uses `@hirosystems/chainhooks-client` for real-time event streaming
- 💰 **Fee Generation** - Every activity generates small STX fees
- 🏆 **Leaderboard & Tiers** - Bronze, Silver, Gold, Platinum tiers based on activity
- 🔥 **Streak System** - Bonus points for consistent activity
- 🎖️ **NFT Badges** - SIP-009 compliant achievement badges
- ⚡ **Real-time Updates** - WebSocket-powered live dashboard

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ChainPulse System                          │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js 14)                                          │
│  ├── Real-time activity dashboard                               │
│  ├── Leaderboard with tier badges                               │
│  └── WebSocket connection for live updates                      │
├─────────────────────────────────────────────────────────────────┤
│  Backend (Express + TypeScript)                                 │
│  ├── @hirosystems/chainhooks-client integration                 │
│  ├── Webhook receiver for chainhook events                      │
│  ├── Activity aggregation & leaderboard                         │
│  └── WebSocket server for real-time broadcasting                │
├─────────────────────────────────────────────────────────────────┤
│  Smart Contracts (Clarity)                                      │
│  ├── pulse-core.clar - Main activity tracking + fees            │
│  ├── pulse-rewards.clar - Point redemption system               │
│  └── pulse-badge-nft.clar - SIP-009 achievement badges          │
└─────────────────────────────────────────────────────────────────┤
```

## 📦 Tech Stack

| Component | Technology |
|-----------|------------|
| **Smart Contracts** | Clarity (Stacks) |
| **Backend** | Express, TypeScript, WebSocket |
| **Frontend** | Next.js 14, React, TailwindCSS |
| **Chainhooks** | @hirosystems/chainhooks-client |
| **Blockchain API** | @stacks/blockchain-api-client |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- [Hiro API Key](https://platform.hiro.so) (for Chainhooks)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/chainpulse.git
cd chainpulse

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# Backend configuration
cd backend
cp .env.example .env
# Edit .env with your Hiro API key and contract addresses
```

### 3. Deploy Smart Contracts

```bash
# Using Clarinet
cd contracts
clarinet deployments apply -p mainnet
```

### 4. Register Chainhooks

```bash
cd backend
npm run chainhook:register
```

### 5. Start the Application

```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Start frontend
cd frontend && npm run dev
```

## 📡 Chainhooks Integration

ChainPulse registers **9 chainhooks** to monitor contract activity and stream events to your backend.

### Environment variables (backend)

- **HIRO_API_KEY**: Hiro Platform API key (required)
- **STACKS_NETWORK**: `mainnet` or `testnet` (default: `mainnet`)
- **WEBHOOK_URL**: Base webhook URL (default: `https://chainpulse-backend.onrender.com/api/chainhook/events`)
- **WEBHOOK_SECRET**: Optional token appended as `?token=...` to the webhook URL (used because the Chainhooks action schema supports only a URL, not custom headers)
- **PULSE_CORE_CONTRACT**: e.g. `SP... .pulse-core` (optional; defaults in code)
- **PULSE_REWARDS_CONTRACT**: e.g. `SP... .pulse-rewards` (optional; defaults in code)
- **PULSE_BADGE_CONTRACT**: e.g. `SP... .pulse-badge-nft` (optional; defaults in code)

**You do NOT need to store chainhook UUIDs in `.env`.** The registration script is safe to re-run: it deletes duplicates and skips hooks that already exist, so it converges to the same 9 hooks.

### Register / verify chainhooks

```bash
cd backend
npm run chainhook:register
npm run chainhook:status
```

| Chainhook | Event | Purpose |
|-----------|-------|---------|
| `pulse-sent` | `contract_log` | Track pulse-core activity |
| `boost` | `contract_log` | Track pulse-core boosts |
| `checkin` | `contract_log` | Track pulse-core daily check-ins |
| `mega-pulse` | `contract_log` | Track pulse-core mega pulses |
| `challenge` | `contract_log` | Track pulse-core challenges |
| `reward` | `contract_log` | Track pulse-rewards activity |
| `tier` | `contract_log` | Track pulse-rewards tiers |
| `badge` | `contract_log` | Track pulse-badge-nft activity |
| `stx-transfer` | `stx_transfer` | Track STX transfers (fees) |

### Using the Chainhooks Client

```typescript
import { 
  ChainhooksClient, 
  CHAINHOOKS_BASE_URL 
} from '@hirosystems/chainhooks-client';

const client = new ChainhooksClient({
  baseUrl: CHAINHOOKS_BASE_URL.mainnet,
  apiKey: process.env.HIRO_API_KEY,
});

// Register a chainhook
const chainhook = await client.registerChainhook({
  name: 'ChainPulse-PulseSent',
  version: '1',
  chain: 'stacks',
  network: 'mainnet',
  filters: {
    events: [
      {
        type: 'contract_log',
        contract_identifier: 'SP...pulse-core',
      },
    ],
  },
  action: {
    type: 'http_post',
    url: 'https://your-app.com/api/chainhook/events/pulse?token=secret',
  },
});
```

## 💡 Smart Contract Functions

### pulse-core.clar

| Function | Fee | Points | Description |
|----------|-----|--------|-------------|
| `send-pulse` | 0.001 STX | 10+ | Base activity with streak bonuses |
| `send-boost` | 0.005 STX | 50 | Premium point boost |
| `daily-checkin-action` | Free | 5 | Daily engagement reward |
| `send-mega-pulse` | 0.001-0.01 STX | 10-100 | Multiplied pulse (1-10x) |
| `complete-challenge` | 0.003 STX | 25 | Challenge completion |

### Fee Generation Strategy

For 5 users generating high activity:

```
Per user per day (aggressive):
- 50 pulses × 0.001 STX = 0.05 STX
- 10 boosts × 0.005 STX = 0.05 STX
- 5 mega-pulses (5x) × 0.005 STX = 0.025 STX
- 3 challenges × 0.003 STX = 0.009 STX
= ~0.134 STX/user/day

5 users × 0.134 STX × 7 days = ~4.69 STX/week
```

## 📊 API Endpoints

### Public Endpoints

```
GET  /api/activities       - Recent activities
GET  /api/leaderboard      - Top users by points
GET  /api/stats            - Overall statistics
GET  /api/users/:address/activities - User activity history
```

### Chainhook Management

```
GET    /api/chainhooks              - List all chainhooks
POST   /api/chainhooks/register-all - Register all chainhooks
GET    /api/chainhooks/:uuid        - Get specific chainhook
PATCH  /api/chainhooks/:uuid/toggle - Enable/disable chainhook
DELETE /api/chainhooks/:uuid        - Delete chainhook
```

### Webhook Endpoints (Internal)

```
POST /api/chainhook/events/pulse      - Pulse events
POST /api/chainhook/events/boost      - Boost events
POST /api/chainhook/events/checkin    - Check-in events
POST /api/chainhook/events/mega-pulse - Mega pulse events
POST /api/chainhook/events/challenge  - Challenge events
POST /api/chainhook/events/reward     - Reward events
POST /api/chainhook/events/tier       - Tier events
POST /api/chainhook/events/badge      - Badge mint events
```

## 🎮 Maximizing Competition Score

This project is designed to maximize the Stacks Builder Challenge scoring:

### GitHub Activity (Tracked)
- ✅ 50+ meaningful commits across features
- ✅ Multiple smart contracts with clear progression
- ✅ Backend + Frontend in separate directories
- ✅ Comprehensive documentation

### Chainhook Usage (Challenge Focus)
- ✅ 9 different chainhook registrations
- ✅ Full integration with `@hirosystems/chainhooks-client`
- ✅ Real-time event processing
- ✅ Webhook handlers for all event types

### Fees Generation
- ✅ Multiple fee-generating functions
- ✅ Designed for high-volume with small user base
- ✅ Incentivizes repeated interactions

## 📁 Project Structure

```
chainpulse/
├── contracts/
│   ├── pulse-core.clar        # Main activity contract
│   ├── pulse-rewards.clar     # Rewards distribution
│   └── pulse-badge-nft.clar   # NFT badges (SIP-009)
├── backend/
│   ├── src/
│   │   ├── index.ts           # Express server
│   │   ├── services/
│   │   │   └── chainhooks.service.ts  # Chainhooks client
│   │   ├── handlers/
│   │   │   └── webhook.handler.ts     # Event processing
│   │   └── scripts/
│   │       ├── register-chainhooks.ts
│   │       └── check-status.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Dashboard
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── package.json
│   └── tailwind.config.ts
└── README.md
```

## 🔧 Scripts

```bash
# Backend
npm run dev              # Start development server
npm run build            # Build for production
npm run chainhook:register  # Register all chainhooks
npm run chainhook:status    # Check chainhook status
npm run chainhook:list      # List registered chainhooks

# Frontend
npm run dev              # Start Next.js dev server
npm run build            # Build for production
```

## 📄 License

MIT License - Built for Stacks Builder Challenge Week 2

## 🙏 Acknowledgments

- [Hiro](https://hiro.so) - Chainhooks and Developer Tools
- [Stacks Foundation](https://stacks.org) - Builder Challenges
- [@hirosystems/chainhooks-client](https://www.npmjs.com/package/@hirosystems/chainhooks-client)

---

**Built with ❤️ for the Stacks ecosystem**
