// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IGovernanceToken is IERC20 {
    function mint(address to, uint256 amount) external;
}

contract DisputeDAO is Ownable, ReentrancyGuard {
    enum DisputeStatus { Pending, Resolved, Rejected }
    
    struct Dispute {
        bytes32 contentId;
        address claimant;
        address original;
        string evidence;
        uint256 votesFor;      // Weighted by token balance
        uint256 votesAgainst;  // Weighted by token balance
        uint256 createdAt;
        DisputeStatus status;
    }

    IGovernanceToken public governanceToken;
    uint256 public rewardAmount = 10 * 10 ** 18; // 10 CGT reward for voting correctly

    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public voteDirection; // true = for, false = against
    mapping(uint256 => address[]) public voters;
    
    uint256 public disputeCount;
    uint256 public votingPeriod = 24 hours;
    uint256 public quorum = 100 * 10 ** 18; // 100 CGT quorum
    
    event DisputeCreated(
        uint256 indexed disputeId,
        bytes32 indexed contentId,
        address indexed claimant,
        address original
    );
    
    event VoteCast(uint256 indexed disputeId, address indexed voter, uint256 weight, bool support);
    event DisputeResolved(uint256 indexed disputeId, DisputeStatus status);

    constructor(address _governanceToken) Ownable(msg.sender) {
        governanceToken = IGovernanceToken(_governanceToken);
    }

    function createDispute(
        bytes32 _contentId,
        address _original,
        string memory _evidence
    ) external returns (uint256) {
        uint256 disputeId = disputeCount++;
        
        disputes[disputeId] = Dispute({
            contentId: _contentId,
            claimant: msg.sender,
            original: _original,
            evidence: _evidence,
            votesFor: 0,
            votesAgainst: 0,
            createdAt: block.timestamp,
            status: DisputeStatus.Pending
        });
        
        emit DisputeCreated(disputeId, _contentId, msg.sender, _original);
        
        return disputeId;
    }

    function vote(uint256 _disputeId, bool _support) external {
        require(_disputeId < disputeCount, "Invalid dispute ID");
        Dispute storage dispute = disputes[_disputeId];
        
        require(dispute.status == DisputeStatus.Pending, "Dispute not pending");
        require(!hasVoted[_disputeId][msg.sender], "Already voted");
        require(block.timestamp <= dispute.createdAt + votingPeriod, "Voting period ended");
        
        uint256 weight = governanceToken.balanceOf(msg.sender);
        require(weight > 0, "No voting power");

        hasVoted[_disputeId][msg.sender] = true;
        voteDirection[_disputeId][msg.sender] = _support;
        voters[_disputeId].push(msg.sender);
        
        if (_support) {
            dispute.votesFor += weight;
        } else {
            dispute.votesAgainst += weight;
        }
        
        emit VoteCast(_disputeId, msg.sender, weight, _support);
    }

    function resolveDispute(uint256 _disputeId) external nonReentrant {
        require(_disputeId < disputeCount, "Invalid dispute ID");
        Dispute storage dispute = disputes[_disputeId];
        
        require(dispute.status == DisputeStatus.Pending, "Dispute not pending");
        require(block.timestamp > dispute.createdAt + votingPeriod, "Voting period not ended");
        
        uint256 totalVotes = dispute.votesFor + dispute.votesAgainst;
        require(totalVotes >= quorum, "Quorum not reached");
        
        if (dispute.votesFor > dispute.votesAgainst) {
            dispute.status = DisputeStatus.Resolved;
        } else {
            dispute.status = DisputeStatus.Rejected;
        }

        // Reward voters who were on the winning side
        bool winningSide = (dispute.status == DisputeStatus.Resolved);
        address[] memory currentVoters = voters[_disputeId];
        
        for (uint256 i = 0; i < currentVoters.length; i++) {
            address voter = currentVoters[i];
            if (voteDirection[_disputeId][voter] == winningSide) {
                try governanceToken.mint(voter, rewardAmount) {} catch {}
            }
        }
        
        emit DisputeResolved(_disputeId, dispute.status);
    }

    function getDispute(uint256 _disputeId) external view returns (Dispute memory) {
        return disputes[_disputeId];
    }

    function setToken(address _newToken) external onlyOwner {
        governanceToken = IGovernanceToken(_newToken);
    }

    function setVotingPeriod(uint256 _newPeriod) external onlyOwner {
        votingPeriod = _newPeriod;
    }

    function setQuorum(uint256 _newQuorum) external onlyOwner {
        quorum = _newQuorum;
    }
}
