// SPDX-License-Identifier: MIT
pragma solidity =0.8.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./libraries/TransferHelper.sol";
import "./libraries/MasterChefModule.sol";
import "./interfaces/ISousChef.sol";
import "./SushiYieldToken.sol";

contract SousChef is Ownable, MasterChefModule, ISousChef {
    using TransferHelper for address;

    ISushiBar public immutable override sushiBar;

    struct YieldTokenInfo {
        IERC20 lpToken;
        ISushiYieldToken yieldToken;
        IMultipleRewardStrategy strategy;
        uint256 accXSushiPerShare;
    }

    struct UserInfo {
        uint256 userAmount;
        uint256 rewardDebt;
        uint256 xSushiRewardDebt;
    }

    mapping(uint256 => YieldTokenInfo) public override yTokenInfoOf;
    mapping(uint256 => mapping(address => UserInfo)) public override userInfo;
    mapping(IERC20 => ISushiYieldToken) public override yieldTokenOf;

    constructor(
        IMasterChef _masterChef,
        IERC20 _sushi,
        ISushiBar _sushiBar
    ) MasterChefModule(_masterChef, _sushi) {
        sushiBar = _sushiBar;
        _sushi.approve(address(_sushiBar), type(uint256).max);
    }

    function yieldTokenCodeHash() external pure override returns (bytes32) {
        return keccak256(type(SushiYieldToken).creationCode);
    }

    function _createYieldToken(uint256 pid, IMultipleRewardStrategy strategy)
        internal
        returns (ISushiYieldToken token)
    {
        YieldTokenInfo storage _yInfo = yTokenInfoOf[pid];
        require(address(_yInfo.lpToken) == address(0), "SOUSCHEF: YIELD_TOKEN_EXISTS");

        IERC20 lpToken = masterChef.poolInfo(pid).lpToken;
        require(address(lpToken) != address(0), "SOUSCHEF: INVALID_PID");

        bytes32 salt = keccak256(abi.encodePacked(pid));
        token = new SushiYieldToken{salt: salt}(pid, address(lpToken));

        _yInfo.lpToken = lpToken;
        _yInfo.yieldToken = token;
        _yInfo.strategy = strategy;

        rewardPoolInfo[pid].lastRewardBlock = block.number;
        yieldTokenOf[lpToken] = token;

        lpToken.approve(address(masterChef), type(uint256).max);

        emit YieldTokenCreated(pid, address(lpToken), address(token), address(strategy));
    }

    function createYieldTokens(uint256[] calldata pids, IMultipleRewardStrategy[] calldata strategies)
        external
        override
        onlyOwner
    {
        require(pids.length == strategies.length, "SOUSCHEF: LENGTH_NOT_EQUAL");
        for (uint256 i = 0; i < pids.length; i++) {
            _createYieldToken(pids[i], strategies[i]);
        }
    }

    function updateStrategy(uint256 pid, IMultipleRewardStrategy strategy) external onlyOwner {
        YieldTokenInfo storage _yInfo = yTokenInfoOf[pid];
        require(address(_yInfo.lpToken) == address(0), "SOUSCHEF: YIELD_TOKEN_EXISTS");
        _yInfo.strategy = strategy;
        emit UpdateMultipleRewardStrategy(pid, address(_yInfo.lpToken), address(_yInfo.yieldToken), address(strategy));
    }

    function deposit(uint256 pid, uint256 amount) public override returns (uint256 reward, uint256 yieldTokenReward) {
        YieldTokenInfo storage _yInfo = yTokenInfoOf[pid];
        ISushiYieldToken yieldToken = _yInfo.yieldToken;
        require(address(yieldToken) != address(0), "SOUSCHEF: NOT_REGISTERED");

        return _deposit(pid, _yInfo, yieldToken, amount);
    }

    function _deposit(
        uint256 pid,
        YieldTokenInfo storage _yInfo,
        ISushiYieldToken yieldToken,
        uint256 amount
    ) internal returns (uint256 reward, uint256 yieldTokenReward) {
        IERC20 lpToken = _yInfo.lpToken;
        if (amount > 0) address(lpToken).safeTransferFrom(msg.sender, address(this), amount);

        uint256 totalLPAmount = masterChef.userInfo(pid, address(this)).amount;
        (uint256 accSushiPerShare, uint256 mintedSushi) = _toSushiMasterChef(true, pid, amount, totalLPAmount);

        UserInfo storage _userInfo = userInfo[pid][msg.sender];
        uint256 userAmount = _userInfo.userAmount;
        _userInfo.userAmount = userAmount + amount;

        reward = (userAmount * accSushiPerShare) / PRECISION - _userInfo.rewardDebt;
        _userInfo.rewardDebt = ((userAmount + amount) * accSushiPerShare) / PRECISION;
        emit Deposited(address(yieldToken), amount, msg.sender);

        bool isSushiMinted = mintedSushi > 0 ? true : false;
        (uint256 accXSushiPerShare, ) = _enterSushiBar(isSushiMinted, pid, totalLPAmount);
        yieldTokenReward = (userAmount * accXSushiPerShare) / PRECISION - _userInfo.xSushiRewardDebt;
        if (yieldTokenReward > 0) {
            yieldToken.mint(msg.sender, yieldTokenReward);
        }
        _userInfo.xSushiRewardDebt = ((userAmount + amount) * accXSushiPerShare) / PRECISION;
    }

    function _enterSushiBar(
        bool isSushiMinted,
        uint256 pid,
        uint256 totalLPAmount
    ) internal returns (uint256 accXSushiPerShare, uint256 xSushiReward) {
        YieldTokenInfo storage _yInfo = yTokenInfoOf[pid];
        if (!isSushiMinted) {
            return (_yInfo.accXSushiPerShare, 0);
        } else {
            uint256 sushiBalance = sushi.balanceOf(address(this));

            uint256 balance0 = sushiBar.balanceOf(address(this));
            sushiBar.enter(sushiBalance);
            xSushiReward = sushiBar.balanceOf(address(this)) - balance0;
        }

        if (totalLPAmount > 0 && xSushiReward > 0) {
            accXSushiPerShare = _yInfo.accXSushiPerShare + ((xSushiReward * PRECISION) / totalLPAmount);
            _yInfo.accXSushiPerShare = accXSushiPerShare;
            return (accXSushiPerShare, xSushiReward);
        } else {
            return (_yInfo.accXSushiPerShare, xSushiReward);
        }
    }

    //no more deposting lp & mint YT from unclaimed sushi reward -> use deposit(x,0).
    function withdraw(uint256 pid, uint256 amount) public override returns (uint256 reward, uint256 yieldTokenReward) {
        require(amount > 0, "SOUSCHEF: AMOUNT_ZERO");

        YieldTokenInfo storage _yInfo = yTokenInfoOf[pid];
        ISushiYieldToken yieldToken = _yInfo.yieldToken;
        require(address(yieldToken) != address(0), "SOUSCHEF: NOT_REGISTERED");

        return _withdraw(pid, _yInfo, yieldToken, amount);
    }

    function _withdraw(
        uint256 pid,
        YieldTokenInfo storage _yInfo,
        ISushiYieldToken yieldToken,
        uint256 amount
    ) internal returns (uint256 reward, uint256 yieldTokenReward) {
        IERC20 lpToken = _yInfo.lpToken;

        uint256 totalLPAmount = masterChef.userInfo(pid, address(this)).amount;
        (uint256 accSushiPerShare, uint256 mintedSushi) = _toSushiMasterChef(false, pid, amount, totalLPAmount);

        UserInfo storage _userInfo = userInfo[pid][msg.sender];
        uint256 userAmount = _userInfo.userAmount;
        _userInfo.userAmount = userAmount - amount;

        reward = (userAmount * accSushiPerShare) / PRECISION - _userInfo.rewardDebt;
        _userInfo.rewardDebt = ((userAmount - amount) * accSushiPerShare) / PRECISION;

        address(lpToken).safeTransfer(msg.sender, amount);
        emit Withdrawn(address(yieldToken), amount, msg.sender);

        bool isSushiMinted = mintedSushi > 0 ? true : false;
        (uint256 accXSushiPerShare, ) = _enterSushiBar(isSushiMinted, pid, totalLPAmount);
        yieldTokenReward = (userAmount * accXSushiPerShare) / PRECISION - _userInfo.xSushiRewardDebt;
        if (yieldTokenReward > 0) {
            yieldToken.mint(msg.sender, yieldTokenReward);
        }
        _userInfo.xSushiRewardDebt = ((userAmount + amount) * accXSushiPerShare) / PRECISION;
    }

    function burnYieldToken(ISushiYieldToken yieldToken, uint256 yieldTokenAmount)
        external
        override
        returns (uint256 sushiReward)
    {
        require(yieldTokenAmount > 0, "SOUSCHEF: AMOUNT_ZERO");
        sushiReward = _burnYieldToken(yieldToken, yieldTokenAmount);
        safeSushiTransfer(msg.sender, sushiReward);
    }

    function _burnYieldToken(ISushiYieldToken yieldToken, uint256 yieldTokenAmount)
        internal
        returns (uint256 sushiReward)
    {
        uint256 balanceBefore = sushi.balanceOf(address(this));
        sushiBar.leave(yieldTokenAmount);
        sushiReward = sushi.balanceOf(address(this)) - balanceBefore;

        yieldToken.burn(msg.sender, yieldTokenAmount);
        
        //multiple reward
        IMultipleRewardStrategy strategy = yTokenInfoOf[yieldToken.pid()].strategy;
        if (address(strategy) != address(0)) {
            try strategy.claimReward(msg.sender, yieldTokenAmount) {} catch {}
        }
    }

    function _claim(uint256 pid, ISushiYieldToken yieldToken) internal returns (uint256 reward) {
        uint256 totalLPAmount = masterChef.userInfo(pid, address(this)).amount;
        (uint256 accSushiPerShare, ) = _toSushiMasterChef(true, pid, 0, totalLPAmount);

        UserInfo storage _userInfo = userInfo[pid][msg.sender];
        uint256 userAmount = _userInfo.userAmount;

        reward = (userAmount * accSushiPerShare) / PRECISION - _userInfo.rewardDebt;
        _userInfo.rewardDebt = (userAmount * accSushiPerShare) / PRECISION;
        emit Claimed(address(yieldToken), msg.sender);
    }

    function claimSushiRewardWithBurningYieldToken(uint256 pid, uint256 yieldTokenAmount)
        public
        override
        returns (uint256 sushiReward)
    {
        YieldTokenInfo storage _yInfo = yTokenInfoOf[pid];
        ISushiYieldToken yieldToken = _yInfo.yieldToken;
        require(address(yieldToken) != address(0), "SOUSCHEF: NOT_REGISTERED");

        if (yieldTokenAmount > 0) {
            sushiReward = _claim(pid, yieldToken) + _burnYieldToken(yieldToken, yieldTokenAmount);
        } else {
            sushiReward = _claim(pid, yieldToken);
        }

        safeSushiTransfer(msg.sender, sushiReward);
    }

    function depositWithPermit(
        uint256 pid,
        uint256 amount,
        IUniswapV2ERC20 lpToken,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override returns (uint256 yieldTokenAmount) {
        lpToken.permit(msg.sender, address(this), amount, deadline, v, r, s);
        (, yieldTokenAmount) = deposit(pid, amount);
    }

    function withdrawWithPermit(
        uint256 pid,
        uint256 amount,
        IUniswapV2ERC20 lpToken,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override returns (uint256 yieldTokenAmount) {
        lpToken.permit(msg.sender, address(this), amount, deadline, v, r, s);
        (, yieldTokenAmount) = withdraw(pid, amount);
    }

    function claimWithPermit(
        uint256 pid,
        uint256 yieldTokenAmount,
        ISushiYieldToken yieldToken,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override returns (uint256 sushiAmount) {
        yieldToken.permit(msg.sender, address(this), yieldTokenAmount, deadline, v, r, s);
        return claimSushiRewardWithBurningYieldToken(pid, yieldTokenAmount);
    }

    function sushiRewardPerYieldToken() public view override returns (uint256 sushiReward) {
        return sushi.balanceOf(address(sushiBar)) / sushiBar.totalSupply();
    }

    function pendingSushiRewardWithYieldToken(uint256 pid, uint256 yieldTokenAmount)
        external
        view
        override
        returns (uint256 sushiReward)
    {
        if (yieldTokenAmount == type(uint256).max)
            yieldTokenAmount = yTokenInfoOf[pid].yieldToken.balanceOf(msg.sender);
        UserInfo storage _userInfo = userInfo[pid][msg.sender];
        sushiReward = _pendingSushiReward(pid, _userInfo.userAmount, _userInfo.rewardDebt);
        if (yieldTokenAmount > 0) sushiReward += yieldTokenAmount * sushiRewardPerYieldToken();
    }

    function pendingYieldToken(uint256 pid) external view override returns (uint256 yieldTokenAmount) {
        UserInfo storage _userInfo = userInfo[pid][msg.sender];
        uint256 totalLPAmount = masterChef.userInfo(pid, address(this)).amount;

        uint256 pendingAllRewards = masterChef.pendingSushi(pid, address(this));
        uint256 userReward = (pendingAllRewards * _userInfo.userAmount) / totalLPAmount;

        yieldTokenAmount =
            (userReward / sushiRewardPerYieldToken()) +
            ((_userInfo.userAmount * yTokenInfoOf[pid].accXSushiPerShare) / PRECISION - _userInfo.xSushiRewardDebt);
    }
}
