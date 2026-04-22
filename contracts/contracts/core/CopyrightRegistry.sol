// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CopyrightRegistry
 * @notice On-chain registry for digital content ownership using IPFS + pHash
 * @dev Stores IPFS CID, pHash metadata CID, and royalty settings for each work
 */
interface IGovernanceToken {
    function mint(address to, uint256 amount) external;
}

contract CopyrightRegistry is Ownable, ReentrancyGuard {
    IGovernanceToken public governanceToken;

    struct Copyright {
        address creator;
        string  ipfsCID;           // IPFS CID of the original content file
        string  metadataCID;       // IPFS CID of the pHash metadata JSON
        string  contentHash;       // SHA-256 hash of the original file
        uint256 royaltyPercentage; // Basis points: 500 = 5%
        uint256 timestamp;
        bool    isActive;
    }

    uint256 public constant MAX_ROYALTY_BPS = 5000; // 50%

    mapping(bytes32 => Copyright) public copyrights;
    mapping(address => bytes32[]) public creatorWorks;
    mapping(string => bytes32) public ipfsCIDToContentId; // reverse lookup

    event CopyrightRegistered(
        bytes32 indexed contentId,
        address indexed creator,
        string  ipfsCID,
        string  metadataCID,
        uint256 royaltyPercentage,
        uint256 timestamp
    );

    event CopyrightRevoked(bytes32 indexed contentId, address indexed creator);
    
    event RoyaltyAgreementCreated(
        bytes32 indexed contentId,
        bytes32 indexed parentContentId,
        address indexed secondaryCreator,
        uint256 royaltyBps
    );

    constructor() Ownable(msg.sender) {}

    function setGovernanceToken(address _token) external onlyOwner {
        governanceToken = IGovernanceToken(_token);
    }

    /**
     * @notice Register ownership of digital content
     */
    function registerCopyright(
        string memory _ipfsCID,
        string memory _metadataCID,
        string memory _contentHash,
        uint256 _royaltyBps
    ) external returns (bytes32) {
        require(_royaltyBps <= MAX_ROYALTY_BPS, "Royalty too high");
        require(bytes(_ipfsCID).length > 0, "IPFS CID required");
        require(ipfsCIDToContentId[_ipfsCID] == bytes32(0), "CID already registered");

        // Reward 50 CGT for the FIRST original content
        if (address(governanceToken) != address(0) && creatorWorks[msg.sender].length == 0) {
            try governanceToken.mint(msg.sender, 50 * 10 ** 18) {} catch {}
        }

        bytes32 contentId = keccak256(
            abi.encodePacked(_ipfsCID, msg.sender, block.timestamp)
        );

        copyrights[contentId] = Copyright({
            creator:           msg.sender,
            ipfsCID:           _ipfsCID,
            metadataCID:       _metadataCID,
            contentHash:       _contentHash,
            royaltyPercentage: _royaltyBps,
            timestamp:         block.timestamp,
            isActive:          true
        });

        creatorWorks[msg.sender].push(contentId);
        ipfsCIDToContentId[_ipfsCID] = contentId;

        emit CopyrightRegistered(
            contentId, msg.sender, _ipfsCID, _metadataCID, _royaltyBps, block.timestamp
        );

        return contentId;
    }
    
    // ... (rest of the functions remain same)
    
    /**
     * @notice Register content that is similar to an existing work, agreeing to pay royalties
     * @param _ipfsCID           IPFS CID of the file
     * @param _metadataCID       IPFS CID of the metadata
     * @param _contentHash       SHA-256 of the file
     * @param _royaltyBps        Royalty agreed
     * @param _parentContentId   The original content's blockchain ID
     */
    function registerWithRoyaltyAgreement(
        string memory _ipfsCID,
        string memory _metadataCID,
        string memory _contentHash,
        uint256 _royaltyBps,
        bytes32 _parentContentId
    ) external returns (bytes32) {
        // Register the copyright first
        bytes32 contentId = this.registerCopyright(
            _ipfsCID,
            _metadataCID,
            _contentHash,
            _royaltyBps
        );
        
        // Emit the agreement event
        emit RoyaltyAgreementCreated(
            contentId,
            _parentContentId,
            msg.sender,
            _royaltyBps
        );
        
        return contentId;
    }

    function getCopyright(bytes32 _contentId) external view returns (Copyright memory) {
        return copyrights[_contentId];
    }

    function getCreatorWorks(address _creator) external view returns (bytes32[] memory) {
        return creatorWorks[_creator];
    }

    function lookupByCID(string memory _ipfsCID) external view returns (bytes32) {
        return ipfsCIDToContentId[_ipfsCID];
    }

    function revokeCopyright(bytes32 _contentId) external {
        Copyright storage c = copyrights[_contentId];
        require(c.creator == msg.sender, "Not the creator");
        require(c.isActive, "Already revoked");

        c.isActive = false;
        emit CopyrightRevoked(_contentId, msg.sender);
    }
}
