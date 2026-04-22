import { expect } from "chai";
import { ethers } from "hardhat";
import { DisputeDAO } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("DisputeDAO", function () {
  let disputeDAO: DisputeDAO;
  let owner: SignerWithAddress;
  let claimant: SignerWithAddress;
  let original: SignerWithAddress;
  let voters: SignerWithAddress[];

  const contentId = ethers.id("test-content-id");
  const evidence = "ipfs://QmEvidence123";

  beforeEach(async function () {
    [owner, claimant, original, ...voters] = await ethers.getSigners();
    
    const DisputeDAO = await ethers.getContractFactory("DisputeDAO");
    disputeDAO = await DisputeDAO.deploy();
    await disputeDAO.waitForDeployment();
  });

  describe("Dispute Creation", function () {
    it("Should create a dispute", async function () {
      const tx = await disputeDAO.connect(claimant).createDispute(
        contentId,
        original.address,
        evidence
      );

      await expect(tx)
        .to.emit(disputeDAO, "DisputeCreated")
        .withArgs(0, contentId, claimant.address, original.address);

      const dispute = await disputeDAO.getDispute(0);
      expect(dispute.claimant).to.equal(claimant.address);
      expect(dispute.original).to.equal(original.address);
      expect(dispute.status).to.equal(0); // Pending
    });
  });

  describe("Voting", function () {
    beforeEach(async function () {
      await disputeDAO.connect(claimant).createDispute(
        contentId,
        original.address,
        evidence
      );
    });

    it("Should allow users to vote", async function () {
      await disputeDAO.connect(voters[0]).vote(0, true);
      await disputeDAO.connect(voters[1]).vote(0, false);

      const dispute = await disputeDAO.getDispute(0);
      expect(dispute.votesFor).to.equal(1);
      expect(dispute.votesAgainst).to.equal(1);
    });

    it("Should not allow double voting", async function () {
      await disputeDAO.connect(voters[0]).vote(0, true);

      await expect(
        disputeDAO.connect(voters[0]).vote(0, true)
      ).to.be.revertedWith("Already voted");
    });

    it("Should not allow voting after period ends", async function () {
      const votingPeriod = await disputeDAO.votingPeriod();
      await time.increase(votingPeriod + 1n);

      await expect(
        disputeDAO.connect(voters[0]).vote(0, true)
      ).to.be.revertedWith("Voting period ended");
    });
  });

  describe("Resolution", function () {
    beforeEach(async function () {
      await disputeDAO.connect(claimant).createDispute(
        contentId,
        original.address,
        evidence
      );

      // Set lower quorum for testing
      await disputeDAO.setQuorum(3);
    });

    it("Should resolve dispute in favor of claimant", async function () {
      await disputeDAO.connect(voters[0]).vote(0, true);
      await disputeDAO.connect(voters[1]).vote(0, true);
      await disputeDAO.connect(voters[2]).vote(0, false);

      const votingPeriod = await disputeDAO.votingPeriod();
      await time.increase(votingPeriod + 1n);

      await disputeDAO.resolveDispute(0);

      const dispute = await disputeDAO.getDispute(0);
      expect(dispute.status).to.equal(1); // Resolved
    });

    it("Should reject dispute", async function () {
      await disputeDAO.connect(voters[0]).vote(0, false);
      await disputeDAO.connect(voters[1]).vote(0, false);
      await disputeDAO.connect(voters[2]).vote(0, true);

      const votingPeriod = await disputeDAO.votingPeriod();
      await time.increase(votingPeriod + 1n);

      await disputeDAO.resolveDispute(0);

      const dispute = await disputeDAO.getDispute(0);
      expect(dispute.status).to.equal(2); // Rejected
    });

    it("Should not resolve before voting period ends", async function () {
      await disputeDAO.connect(voters[0]).vote(0, true);
      await disputeDAO.connect(voters[1]).vote(0, true);
      await disputeDAO.connect(voters[2]).vote(0, false);

      await expect(
        disputeDAO.resolveDispute(0)
      ).to.be.revertedWith("Voting period not ended");
    });
  });
});
