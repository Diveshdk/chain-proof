#!/bin/bash

# Copyright Protocol - Quick Start Script

echo "🚀 Copyright Protocol - Quick Start"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -d "contracts" ] || [ ! -d "backend" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."
if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"
echo ""

# Contracts setup
echo "📦 Setting up smart contracts..."
cd contracts
if [ ! -f ".env" ]; then
    echo "⚠️  Creating .env file for contracts..."
    cat > .env << EOF
BASE_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=your_wallet_private_key_here
EOF
    echo "✅ Created contracts/.env - Please add your private key!"
fi

echo "📥 Installing contract dependencies (if needed)..."
npm install --silent
echo "✅ Contract dependencies ready"
echo ""

# Backend setup
echo "📦 Setting up backend..."
cd ../backend
if [ ! -f ".env" ]; then
    echo "⚠️  Creating .env file for backend..."
    cat > .env << EOF
PINATA_API_KEY=your_pinata_api_key_here
PINATA_SECRET_KEY=your_pinata_secret_key_here
PINATA_JWT=your_pinata_jwt_here
PORT=5000
NODE_ENV=development
EOF
    echo "✅ Created backend/.env - Please add your Pinata credentials!"
fi

echo "📥 Installing backend dependencies..."
npm install --silent
echo "✅ Backend dependencies installed"
echo ""

cd ..

# Summary
echo "✅ Setup Complete!"
echo ""
echo "📝 Next Steps:"
echo "----------------------------------------"
echo "1. Configure your environment variables:"
echo "   - contracts/.env (add your wallet private key)"
echo "   - backend/.env (add your Pinata API credentials)"
echo ""
echo "2. Compile and test contracts:"
echo "   cd contracts"
echo "   npm run compile"
echo "   npm test"
echo ""
echo "3. Deploy contracts:"
echo "   cd contracts"
echo "   npm run deploy"
echo ""
echo "4. Start the backend:"
echo "   cd backend"
echo "   npm run dev"
echo ""
echo "5. Initialize frontend (when ready):"
echo "   cd frontend"
echo "   npm create vite@latest . -- --template react-ts"
echo "   npm install"
echo ""
echo "📚 Read README.md for detailed instructions"
echo "✨ Happy building!"
