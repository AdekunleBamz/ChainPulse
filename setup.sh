#!/bin/bash
# ChainPulse Quick Start Script
# Stacks Builder Challenge Week 2

echo "🚀 ChainPulse Setup Script"
echo "=========================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found: $(node -v)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm found: $(npm -v)${NC}"

# Check Clarinet (optional but recommended)
if command -v clarinet &> /dev/null; then
    echo -e "${GREEN}✓ Clarinet found: $(clarinet --version)${NC}"
else
    echo -e "${YELLOW}⚠ Clarinet not found - needed for contract deployment${NC}"
    echo "  Install: https://docs.hiro.so/clarinet/installation"
fi

echo -e "\n${YELLOW}Setting up project...${NC}"

# Install backend dependencies
echo -e "\n📦 Installing backend dependencies..."
cd backend
npm install
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend dependencies installed${NC}"
else
    echo -e "${RED}❌ Failed to install backend dependencies${NC}"
    exit 1
fi

# Install frontend dependencies
echo -e "\n📦 Installing frontend dependencies..."
cd ../frontend
npm install
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
else
    echo -e "${RED}❌ Failed to install frontend dependencies${NC}"
    exit 1
fi

cd ..

# Create .env template
echo -e "\n📝 Creating .env template..."
if [ ! -f backend/.env ]; then
    cat > backend/.env << 'EOF'
# ChainPulse Backend Configuration
# Fill in these values before running

# Required: Get from https://platform.hiro.so
HIRO_API_KEY=your_api_key_here

# Network: mainnet or testnet
STACKS_NETWORK=mainnet

# Contract addresses (update after deployment)
PULSE_CORE_CONTRACT=YOUR_ADDRESS.pulse-core
PULSE_REWARDS_CONTRACT=YOUR_ADDRESS.pulse-rewards
PULSE_BADGE_CONTRACT=YOUR_ADDRESS.pulse-badge-nft

# Webhook configuration
WEBHOOK_URL=https://your-deployed-backend.com/api/chainhook/events
WEBHOOK_SECRET=generate_a_random_secret_here

# Server
PORT=3001
EOF
    echo -e "${GREEN}✓ Created backend/.env template${NC}"
else
    echo -e "${YELLOW}⚠ backend/.env already exists, skipping${NC}"
fi

# Summary
echo -e "\n${GREEN}=============================="
echo -e "Setup Complete!"
echo -e "==============================${NC}"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Get your Hiro API key from https://platform.hiro.so"
echo "2. Edit backend/.env with your configuration"
echo "3. Deploy contracts: clarinet deployment apply -p deployments/default.mainnet-plan.yaml"
echo "4. Update contract addresses in backend/.env"
echo "5. Register chainhooks: cd backend && npm run chainhook:register"
echo "6. Start backend: cd backend && npm run dev"
echo "7. Start frontend: cd frontend && npm run dev"

echo -e "\n${YELLOW}GitHub Commit Strategy:${NC}"
echo "Push with 50+ separate commits for maximum GitHub progress!"
echo "See WINNING_STRATEGY.md for detailed commit plan."

echo -e "\n${YELLOW}Fee Generation:${NC}"
echo "Run: cd backend && npm run activity:generate"
echo "Each user should do 69+ activities daily"

echo -e "\n🏆 Good luck winning the challenge!"
