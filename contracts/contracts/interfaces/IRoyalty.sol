// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRoyalty {
    struct RoyaltyInfo {
        address payable creator;
        uint256 royaltyPercentage;
        uint256 totalEarned;
    }

    event RoyaltySet(bytes32 indexed contentId, address indexed creator, uint256 percentage);
    event LicensePurchased(bytes32 indexed contentId, address indexed buyer, uint256 amount);
    event RoyaltyPaid(bytes32 indexed contentId, address indexed creator, uint256 amount);

    function setRoyalty(bytes32 _contentId, uint256 _royaltyPercentage) external;

    function purchaseLicense(bytes32 _contentId) external payable;

    function getRoyaltyInfo(bytes32 _contentId) external view returns (RoyaltyInfo memory);

    function hasContentLicense(bytes32 _contentId, address _user) external view returns (bool);
}
