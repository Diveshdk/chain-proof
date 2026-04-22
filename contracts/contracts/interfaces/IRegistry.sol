// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRegistry {
    struct Copyright {
        address creator;
        string contentHash;
        string metadataURI;
        uint256 timestamp;
        bool isActive;
    }

    event CopyrightRegistered(
        bytes32 indexed contentId,
        address indexed creator,
        string contentHash,
        uint256 timestamp
    );
    
    event CopyrightRevoked(bytes32 indexed contentId, address indexed creator);

    function registerCopyright(
        string memory _contentHash,
        string memory _metadataURI
    ) external returns (bytes32);

    function getCopyright(bytes32 _contentId) external view returns (Copyright memory);

    function getCreatorWorks(address _creator) external view returns (bytes32[] memory);

    function revokeCopyright(bytes32 _contentId) external;
}
