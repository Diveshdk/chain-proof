// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RoyaltyManager is Ownable, ReentrancyGuard {
    struct RoyaltyInfo {
        address payable creator;
        uint256 royaltyPercentage; // Basis points (e.g., 500 = 5%)
        uint256 totalEarned;
    }

    mapping(bytes32 => RoyaltyInfo) public royalties;
    mapping(bytes32 => mapping(address => bool)) public hasLicense;
    
    uint256 public constant MAX_ROYALTY_PERCENTAGE = 5000; // 50%
    
    event RoyaltySet(bytes32 indexed contentId, address indexed creator, uint256 percentage);
    event LicensePurchased(bytes32 indexed contentId, address indexed buyer, uint256 amount);
    event RoyaltyPaid(bytes32 indexed contentId, address indexed creator, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function setRoyalty(
        bytes32 _contentId,
        uint256 _royaltyPercentage
    ) external {
        require(_royaltyPercentage <= MAX_ROYALTY_PERCENTAGE, "Royalty too high");
        require(royalties[_contentId].creator == address(0), "Royalty already set");
        
        royalties[_contentId] = RoyaltyInfo({
            creator: payable(msg.sender),
            royaltyPercentage: _royaltyPercentage,
            totalEarned: 0
        });
        
        emit RoyaltySet(_contentId, msg.sender, _royaltyPercentage);
    }

    function purchaseLicense(bytes32 _contentId) external payable nonReentrant {
        require(msg.value > 0, "Payment required");
        require(royalties[_contentId].creator != address(0), "Content not found");
        require(!hasLicense[_contentId][msg.sender], "License already owned");
        
        RoyaltyInfo storage royalty = royalties[_contentId];
        
        uint256 royaltyAmount = (msg.value * royalty.royaltyPercentage) / 10000;
        uint256 platformFee = msg.value - royaltyAmount;
        
        royalty.totalEarned += royaltyAmount;
        hasLicense[_contentId][msg.sender] = true;
        
        // Transfer royalty to creator
        (bool success, ) = royalty.creator.call{value: royaltyAmount}("");
        require(success, "Royalty transfer failed");
        
        emit LicensePurchased(_contentId, msg.sender, msg.value);
        emit RoyaltyPaid(_contentId, royalty.creator, royaltyAmount);
    }

    function getRoyaltyInfo(bytes32 _contentId) external view returns (RoyaltyInfo memory) {
        return royalties[_contentId];
    }

    function hasContentLicense(bytes32 _contentId, address _user) external view returns (bool) {
        return hasLicense[_contentId][_user];
    }
}
