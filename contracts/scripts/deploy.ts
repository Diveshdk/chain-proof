// @ts-ignore - ethers is injected by @nomicfoundation/hardhat-ethers at runtime
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const STATE_FILE = path.join(__dirname, "../deployment-state.json");

function loadState(): Record<string, string> {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  }
  return {};
}

function saveState(state: Record<string, string>) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function deployOrSkip(
  factory: any,
  name: string,
  state: Record<string, string>,
  args: any[] = []
): Promise<string> {
  if (state[name]) {
    console.log(`${name} already deployed at: ${state[name]} (skipping)`);
    return state[name];
  }
  console.log(`Deploying ${name}...`);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`${name} deployed to: ${address}`);
  state[name] = address;
  saveState(state);
  return address;
}

async function main() {
  console.log("Deploying Copyright Protocol contracts...");
  console.log("(Progress saved — safe to re-run if it fails)\n");

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const state = loadState();

  // Deploy GovernanceToken
  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  const governanceTokenAddr = await deployOrSkip(GovernanceToken, "governanceToken", state);
  await delay(2000);

  // Deploy CopyrightRegistry
  const CopyrightRegistry = await ethers.getContractFactory("CopyrightRegistry");
  await deployOrSkip(CopyrightRegistry, "copyrightRegistry", state);
  await delay(2000);

  // Deploy RoyaltyManager
  const RoyaltyManager = await ethers.getContractFactory("RoyaltyManager");
  await deployOrSkip(RoyaltyManager, "royaltyManager", state);
  await delay(2000);

  // Deploy DisputeDAO (requires GovernanceToken address)
  const DisputeDAO = await ethers.getContractFactory("DisputeDAO");
  await deployOrSkip(DisputeDAO, "disputeDAO", state, [governanceTokenAddr]);
  await delay(2000);

  // Deploy ContentNFT
  const ContentNFT = await ethers.getContractFactory("ContentNFT");
  await deployOrSkip(ContentNFT, "contentNFT", state);

  console.log("\n✅ Deployment completed!");
  console.log(JSON.stringify(state, null, 2));
  console.log(`\nState saved to: ${STATE_FILE}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
