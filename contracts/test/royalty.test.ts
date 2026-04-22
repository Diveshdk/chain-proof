import { expect } from "chai";
import { ethers } from "hardhat";
import { RoyaltyManager } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("RoyaltyManager", function () {
  let royaltyManager: RoyaltyManager;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let buyer: SignerWithAddress;

  const contentId = ethers.id("test-content-id");
  const royaltyPercentage = 500; // 5%

  beforeEach(async function () {
    [owner, creator, buyer] = await ethers.getSigners();
    
    const RoyaltyManager = await ethers.getContractFactory("RoyaltyManager");
    royaltyManager = await RoyaltyManager.deploy();
    await royaltyManager.waitForDeployment();
  });

  describe("Royalty Management", function () {
    it("Should set royalty for content", async function () {
      await royaltyManager.connect(creator).setRoyalty(contentId, royaltyPercentage);

      const royaltyInfo = await royaltyManager.getRoyaltyInfo(contentId);
      expect(royaltyInfo.creator).to.equal(creator.address);
      expect(royaltyInfo.royaltyPercentage).to.equal(royaltyPercentage);
    });

    it("Should not allow royalty percentage above maximum", async function () {
      const tooHighPercentage = 6000; // 60%

      await expect(
        royaltyManager.connect(creator).setRoyalty(contentId, tooHighPercentage)
      ).to.be.revertedWith("Royalty too high");
    });

    it("Should purchase license and pay royalty", async function () {
      await royaltyManager.connect(creator).setRoyalty(contentId, royaltyPercentage);

      const licensePrice = ethers.parseEther("1.0");
      const expectedRoyalty = (licensePrice * BigInt(royaltyPercentage)) / BigInt(10000);

      const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);

      await royaltyManager.connect(buyer).purchaseLicense(contentId, {
        value: licensePrice
      });

      const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(expectedRoyalty);

      const hasLicense = await royaltyManager.hasContentLicense(contentId, buyer.address);
      expect(hasLicense).to.equal(true);
    });

    it("Should not allow purchasing license twice", async function () {
      await royaltyManager.connect(creator).setRoyalty(contentId, royaltyPercentage);

      const licensePrice = ethers.parseEther("1.0");

      await royaltyManager.connect(buyer).purchaseLicense(contentId, {
        value: licensePrice
      });

      await expect(
        royaltyManager.connect(buyer).purchaseLicense(contentId, {
          value: licensePrice
        })
      ).to.be.revertedWith("License already owned");
    });
  });
});
