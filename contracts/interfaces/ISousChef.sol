// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./ISushiBar.sol";
import "./ISushiYieldToken.sol";
import "./IUniswapV2ERC20.sol";
import "./IMultipleRewardStrategy.sol";

interface ISousChef {
    event YieldTokenCreated(uint256 indexed pid, address indexed lpToken, address indexed yieldToken, address strategy);
    event UpdateMultipleRewardStrategy(
        uint256 indexed pid,
        address indexed lpToken,
        address indexed yieldToken,
        address strategy
    );
    event Deposited(address indexed yieldToken, uint256 amount, address indexed to);
    event Withdrawn(address indexed yieldToken, uint256 amount, address indexed to);
    event Claimed(address indexed yieldToken, uint256 amount, address indexed to);

    function sushiBar() external view returns (ISushiBar);

    function yTokenInfoOf(uint256 pid)
        external
        view
        returns (
            IERC20 lpToken,
            ISushiYieldToken yieldToken,
            IMultipleRewardStrategy strategy,
            uint256 accXSushiPerShare
        );

    function userInfo(uint256 pid, address user)
        external
        view
        returns (
            uint256 userAmount,
            uint256 rewardDebt,
            uint256 xSushiRewardDebt
        );

    function yieldTokenCodeHash() external pure returns (bytes32);

    function createYieldTokens(uint256[] calldata pids, IMultipleRewardStrategy[] calldata strategies) external;

    function deposit(uint256 pid, uint256 amount) external returns (uint256 reward, uint256 yieldTokenReward);

    function withdraw(uint256 pid, uint256 amount) external returns (uint256 reward, uint256 yieldTokenReward);

    function burnYieldToken(ISushiYieldToken yieldToken, uint256 yieldTokenAmount)
        external
        returns (uint256 sushiReward);

    function claimSushiRewardWithBurningYieldToken(uint256 pid, uint256 yieldTokenAmount)
        external
        returns (uint256 sushiReward);

    function depositWithPermit(
        uint256 pid,
        uint256 amount,
        IUniswapV2ERC20 lpToken,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 yieldTokenAmount);

    function sushiRewardPerYieldToken() external view returns (uint256 sushiReward);

    function pendingSushiRewardWithYieldToken(uint256 pid, uint256 yieldTokenAmount)
        external
        view
        returns (uint256 sushiReward);

    function pendingYieldToken(uint256 pid) external view returns (uint256 yieldTokenAmount);
}
