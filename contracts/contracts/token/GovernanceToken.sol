// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GovernanceToken is ERC20, Ownable {
    mapping(address => bool) public hasClaimed;
    mapping(address => bool) public isMinter;

    constructor() ERC20("Copyright Governance Token", "CGT") Ownable(msg.sender) {
        _mint(msg.sender, 1000000 * 10 ** decimals()); // Initial supply: 1M tokens
        isMinter[msg.sender] = true;
    }

    function setMinter(address _minter, bool _status) external onlyOwner {
        isMinter[_minter] = _status;
    }

    function claim() external {
        require(!hasClaimed[msg.sender], "Already claimed");
        hasClaimed[msg.sender] = true;
        _mint(msg.sender, 100 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) external {
        require(isMinter[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
