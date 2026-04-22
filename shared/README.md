# Shared Types and ABIs

This directory contains shared TypeScript types and contract ABIs used across the frontend and backend.

## Structure

```
shared/
├── abi/                    → Contract ABIs (auto-generated from compilation)
│   ├── CopyrightRegistry.json
│   ├── RoyaltyManager.json
│   └── DisputeDAO.json
│
└── types/                  → TypeScript type definitions
    └── contractTypes.ts
```

## Usage

### In Frontend
```typescript
import { Copyright, RoyaltyInfo } from '../../shared/types/contractTypes';
import CopyrightRegistryABI from '../../shared/abi/CopyrightRegistry.json';
```

### In Backend
```typescript
import { ContentMetadata, UploadResponse } from '../shared/types/contractTypes';
```

## Generating ABIs

After compiling the smart contracts, copy the ABIs from the artifacts:

```bash
cd contracts
npm run compile
cp artifacts/contracts/core/CopyrightRegistry.sol/CopyrightRegistry.json ../shared/abi/
cp artifacts/contracts/core/RoyaltyManager.sol/RoyaltyManager.json ../shared/abi/
cp artifacts/contracts/core/DisputeDAO.sol/DisputeDAO.json ../shared/abi/
```

## Type Definitions

See `types/contractTypes.ts` for all shared TypeScript interfaces and types.
