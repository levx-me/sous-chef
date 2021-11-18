// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract TestRewardTokenMintable is ERC20("TestRewardToken", "REWARD") {
    mapping(address => bool) public isMinter;

    function setMinter(address target, bool _isMinter) external {
        isMinter[target] = _isMinter;
    }

    function mint(address to, uint256 amount) external {
        require(isMinter[msg.sender], "Forbidden");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}
