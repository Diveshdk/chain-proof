# Copyright Protocol

A decentralized copyright protection and royalty management system built on blockchain technology.

## Project Structure

```
copyright-protocol/
├── contracts/          → Smart Contracts (Solidity)
├── backend/           → Node.js API (Pinata + IPFS)
├── frontend/          → React DApp
├── shared/            → Shared ABIs & types
└── README.md
```

## Features

- **Copyright Registration**: Register digital content on the blockchain with IPFS storage
- **Royalty Management**: Automated royalty distribution for content licensing
- **Dispute Resolution**: DAO-based voting system for copyright disputes
- **Content Similarity**: Detect similar content using perceptual hashing
- **NFT Minting**: Mint NFTs for registered copyrighted content
- **Governance**: Token-based governance for protocol decisions

## Smart Contracts

### Core Contracts
- **CopyrightRegistry.sol**: Manages copyright registration and verification
- **RoyaltyManager.sol**: Handles royalty payments and license purchases
- **DisputeDAO.sol**: Decentralized dispute resolution system

### Token Contracts
- **GovernanceToken.sol**: ERC20 governance token for voting
- **ContentNFT.sol**: ERC721 NFT for copyrighted content

## Getting Started

### Prerequisites
- Node.js v18+
- npm or yarn
- MetaMask or similar Web3 wallet

### Installation

1. **Install Smart Contract Dependencies**
```bash
cd contracts
npm install
```

2. **Install Backend Dependencies**
```bash
cd backend
npm install
```

3. **Install Frontend Dependencies**
```bash
cd frontend
npm install
```

### Configuration

1. **Contracts Configuration**
Create `.env` in `contracts/` directory:
```env
BASE_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=your_wallet_private_key_here
```

2. **Backend Configuration**
Create `.env` in `backend/` directory:
```env
PINATA_API_KEY=your_pinata_api_key_here
PINATA_SECRET_KEY=your_pinata_secret_key_here
PINATA_JWT=your_pinata_jwt_here
PORT=5000
```

3. **Frontend Configuration**
Create `.env` in `frontend/` directory:
```env
VITE_CONTRACT_ADDRESS=your_deployed_contract_address
VITE_API_URL=http://localhost:5000
```

### Development

1. **Compile Smart Contracts**
```bash
cd contracts
npm run compile
```

2. **Run Tests**
```bash
cd contracts
npm test
```

3. **Deploy Contracts**
```bash
cd contracts
npm run deploy
```

4. **Start Backend Server**
```bash
cd backend
npm run dev
```

5. **Start Frontend**
```bash
cd frontend
npm run dev
```

## Testing

### Smart Contract Tests
```bash
cd contracts
npm test
```

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

## Deployment

### Deploy to Base Sepolia Testnet
```bash
cd contracts
npm run deploy
```

### Verify Contracts
```bash
cd contracts
npm run verify
```

## API Endpoints

### Upload API
- `POST /api/upload/file` - Upload file to IPFS
- `POST /api/upload/metadata` - Upload metadata to IPFS
- `GET /api/upload/:hash` - Get file from IPFS

### Dispute API
- `POST /api/dispute/similarity` - Check content similarity
- `POST /api/dispute/register` - Register content for similarity checking
- `GET /api/dispute/:disputeId/evidence` - Get dispute evidence
- `GET /api/dispute/royalty/:contentId` - Get royalty information
- `POST /api/dispute/royalty/calculate` - Calculate royalty amount

## Architecture

### Smart Contract Layer
- Handles copyright registration, royalty distribution, and dispute resolution
- Built with Solidity 0.8.20
- Uses OpenZeppelin contracts for security

### Backend Layer
- Node.js/Express API
- Pinata integration for IPFS storage
- Content hashing and similarity detection
- Metadata management

### Frontend Layer
- React + TypeScript
- Web3 wallet integration
- IPFS content display
- Real-time dispute voting

## Security Considerations

- All contracts use OpenZeppelin's battle-tested libraries
- ReentrancyGuard for all payment functions
- Access control for admin functions
- Input validation on all endpoints

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For issues and questions, please open an issue on GitHub.
# chain-proof
