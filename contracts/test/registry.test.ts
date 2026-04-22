import { expect } from "chai";
import { ethers } from "hardhat";
import { CopyrightRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CopyrightRegistry", function () {
  let copyrightRegistry: CopyrightRegistry;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let other: SignerWithAddress;

  beforeEach(async function () {
    [owner, creator, other] = await ethers.getSigners();
    
    const CopyrightRegistry = await ethers.getContractFactory("CopyrightRegistry");
    copyrightRegistry = await CopyrightRegistry.deploy();
    await copyrightRegistry.waitForDeployment();
  });

  describe("Registration", function () {
    it("Should register a copyright", async function () {
      const contentHash = "QmTestHash123";
      const metadataURI = "ipfs://QmMetadata123";

      const tx = await copyrightRegistry.connect(creator).registerCopyright(contentHash, metadataURI);
      const receipt = await tx.wait();

      expect(receipt).to.not.be.null;
    });

    it("Should retrieve copyright details", async function () {
      const contentHash = "QmTestHash123";
      const metadataURI = "ipfs://QmMetadata123";

      const tx = await copyrightRegistry.connect(creator).registerCopyright(contentHash, metadataURI);
      await tx.wait();

      const works = await copyrightRegistry.getCreatorWorks(creator.address);
      expect(works.length).to.equal(1);

      const copyright = await copyrightRegistry.getCopyright(works[0]);
      expect(copyright.creator).to.equal(creator.address);
      expect(copyright.contentHash).to.equal(contentHash);
      expect(copyright.isActive).to.equal(true);
    });

    it("Should allow creator to revoke copyright", async function () {
      const contentHash = "QmTestHash123";
      const metadataURI = "ipfs://QmMetadata123";

      const tx = await copyrightRegistry.connect(creator).registerCopyright(contentHash, metadataURI);
      await tx.wait();

      const works = await copyrightRegistry.getCreatorWorks(creator.address);
      const contentId = works[0];

      await copyrightRegistry.connect(creator).revokeCopyright(contentId);

      const copyright = await copyrightRegistry.getCopyright(contentId);
      expect(copyright.isActive).to.equal(false);
    });

    it("Should not allow non-creator to revoke copyright", async function () {
      const contentHash = "QmTestHash123";
      const metadataURI = "ipfs://QmMetadata123";

      const tx = await copyrightRegistry.connect(creator).registerCopyright(contentHash, metadataURI);
      await tx.wait();

      const works = await copyrightRegistry.getCreatorWorks(creator.address);
      const contentId = works[0];

      await expect(
        copyrightRegistry.connect(other).revokeCopyright(contentId)
      ).to.be.revertedWith("Not the creator");
    });
  });
});
