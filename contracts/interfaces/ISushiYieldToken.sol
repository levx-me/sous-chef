// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISushiYieldToken is IERC20 {
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);

    function sousChef() external view returns (address);

    function pid() external view returns (uint256);

    function lpToken() external view returns (address);

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function PERMIT_TYPEHASH() external view returns (bytes32);

    function nonces(address owner) external view returns (uint256);

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function mint(address to, uint256 amount) external;

    function burn(address from, uint256 amount) external;
}
