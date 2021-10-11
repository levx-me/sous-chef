// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface IMultipleRewardStrategy {
    function sousChef() external view returns (address);

    function claimReward(address user, uint256 yieldTokenAmount) external;
}
