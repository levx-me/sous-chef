// SPDX-License-Identifier: MIT
pragma solidity =0.8.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IMultipleRewardStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RewardBucket is Ownable, IMultipleRewardStrategy {
    struct RewardToken {
        address rewardToken;
        uint256 rewardRatio;
    }

    address public immutable override sousChef;
    RewardToken[] public rewardTokens;

    event SetRewardToken(uint256 id, address rewardToken);

    constructor(
        address _sousChef,
        address[] memory _rewardTokens,
        uint256[] memory _rewardRatio
    ) {
        sousChef = _sousChef;

        for (uint256 i = 0; i < _rewardTokens.length; i++) {
            require(_rewardTokens[i] != address(0), "SOUSCHEF: INVALID_TOKEN_ADDRESS");
            rewardTokens.push(RewardToken({rewardToken: _rewardTokens[i], rewardRatio: _rewardRatio[i]}));
            emit SetRewardToken(i, _rewardTokens[i]);
        }
    }

    function setRewardTokens(
        uint256[] calldata ids,
        address[] calldata _rewardTokens,
        uint256[] memory _rewardRatio
    ) external onlyOwner {
        for (uint256 i = 0; i < ids.length; i++) {
            rewardTokens[ids[i]] = RewardToken({rewardToken: _rewardTokens[i], rewardRatio: _rewardRatio[i]});
            emit SetRewardToken(ids[i], _rewardTokens[i]);
        }
    }

    function claimReward(address user, uint256 yieldTokenAmount) external override {
        require(msg.sender == sousChef, "SOUSCHEF: FORBIDDEN");

        uint256 length = rewardTokens.length;
        if (length > 0) {
            for (uint256 i = 0; i < length; i++) {
                RewardToken memory _rToken = rewardTokens[i];
                if (
                    _rToken.rewardToken != address(0) &&
                    IERC20(_rToken.rewardToken).balanceOf(address(this)) * _rToken.rewardRatio != 0
                ) {
                    safeTokenTransfer(IERC20(_rToken.rewardToken), user, yieldTokenAmount * _rToken.rewardRatio);
                }
            }
        }
    }

    function withdrawRewardTokens(address to, uint256[] calldata ids, uint256[] calldata amounts) external onlyOwner {
        for (uint256 i = 0; i < ids.length; i++) {
            safeTokenTransfer(IERC20(rewardTokens[ids[i]].rewardToken), to, amounts[i]);
        }
    }

    function safeTokenTransfer(
        IERC20 token,
        address _to,
        uint256 _amount
    ) internal {
        uint256 tokenBal = token.balanceOf(address(this));
        if (_amount > tokenBal) {
            token.transfer(_to, tokenBal);
        } else {
            token.transfer(_to, _amount);
        }
    }
}
