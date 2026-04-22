// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDispute {
    enum DisputeStatus { Pending, Resolved, Rejected }
    
    struct Dispute {
        bytes32 contentId;
        address claimant;
        address original;
        string evidence;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 createdAt;
        DisputeStatus status;
    }

    event DisputeCreated(
        uint256 indexed disputeId,
        bytes32 indexed contentId,
        address indexed claimant,
        address original
    );
    
    event VoteCast(uint256 indexed disputeId, address indexed voter, bool support);
    event DisputeResolved(uint256 indexed disputeId, DisputeStatus status);

    function createDispute(
        bytes32 _contentId,
        address _original,
        string memory _evidence
    ) external returns (uint256);

    function vote(uint256 _disputeId, bool _support) external;

    function resolveDispute(uint256 _disputeId) external;

    function getDispute(uint256 _disputeId) external view returns (Dispute memory);
}
