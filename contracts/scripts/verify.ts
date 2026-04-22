import { run } from "hardhat";

async function main() {
  const contracts = [
    {
      address: "YOUR_GOVERNANCE_TOKEN_ADDRESS",
      constructorArguments: []
    },
    {
      address: "YOUR_COPYRIGHT_REGISTRY_ADDRESS",
      constructorArguments: []
    },
    {
      address: "YOUR_ROYALTY_MANAGER_ADDRESS",
      constructorArguments: []
    },
    {
      address: "YOUR_DISPUTE_DAO_ADDRESS",
      constructorArguments: []
    },
    {
      address: "YOUR_CONTENT_NFT_ADDRESS",
      constructorArguments: []
    }
  ];

  for (const contract of contracts) {
    console.log(`Verifying contract at ${contract.address}...`);
    try {
      await run("verify:verify", {
        address: contract.address,
        constructorArguments: contract.constructorArguments,
      });
      console.log(`Contract verified successfully!`);
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("Contract already verified!");
      } else {
        console.error("Verification failed:", error);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
