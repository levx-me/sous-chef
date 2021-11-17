import { SousChef, SushiYieldToken, TestMasterChef, TestSushiBar, TestLPToken, TestSushiToken, RewardBucket, RewardFountain, TestRewardToken } from "../typechain";

import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, BigNumberish, BytesLike } from "ethers";
import { getBlock, mine, mineTo, autoMining } from "./utils/blockchain";

const { constants, utils } = ethers;
const { AddressZero, HashZero } = constants;

const rpb = 10000;
const setupTest = async () => {
    const signers = await ethers.getSigners();
    const [deployer, alice, bob, carol] = signers;

    const TestSushiToken = await ethers.getContractFactory("TestSushiToken");
    const sushi = (await TestSushiToken.deploy()) as TestSushiToken;

    const TestSushiBar = await ethers.getContractFactory("TestSushiBar");
    const sushiBar = (await TestSushiBar.deploy(sushi.address)) as TestSushiBar;

    const TestMasterChef = await ethers.getContractFactory("TestMasterChef");
    const masterChef = (await TestMasterChef.deploy(sushi.address, deployer.address, rpb, 100, 0)) as TestMasterChef;

    const TestLPToken = await ethers.getContractFactory("TestLPToken");
    const lp = (await TestLPToken.deploy()) as TestLPToken;

    {
        await lp.mint(alice.address, 10000);
        await lp.mint(bob.address, 10000);

        await sushi.mint(deployer.address, 100000000);
        await sushi.transferOwnership(masterChef.address);
        await sushi.approve(sushiBar.address, 10000000000);
    }

    const SousChef = await ethers.getContractFactory("SousChef");
    const sChef = (await SousChef.deploy(masterChef.address, sushi.address, sushiBar.address)) as SousChef;
    {
        await lp.connect(alice).approve(sChef.address, 100000);
        await lp.connect(bob).approve(sChef.address, 100000);
    }

    await masterChef.add(100, lp.address, true);

    return {
        deployer,
        alice,
        bob,
        carol,
        sChef,
        masterChef,
        sushiBar,
        sushi,
        lp,
    };
};

async function getYieldToken(sChef: SousChef, pid: number): Promise<SushiYieldToken> {
    const address = await sChef.getYieldTokenAddress(pid);
    const SushiYieldTokenFactory = await ethers.getContractFactory("SushiYieldToken");
    return (await SushiYieldTokenFactory.attach(address)) as SushiYieldToken;
}

describe("SousChef", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    it("should be that getYieldTokenAddress function works corretly", async () => {
        const { sChef, masterChef } = await setupTest();

        const TestLPToken = await ethers.getContractFactory("TestLPToken");

        const lp1 = (await TestLPToken.deploy()) as TestLPToken;
        const lp2 = (await TestLPToken.deploy()) as TestLPToken;
        const lp3 = (await TestLPToken.deploy()) as TestLPToken;

        await masterChef.add(1, lp1.address, false);
        await masterChef.add(2, lp2.address, false);
        await masterChef.add(3, lp3.address, false);

        const y0 = (await getYieldToken(sChef, 0)).address;
        const y1 = (await getYieldToken(sChef, 1)).address;
        const y2 = (await getYieldToken(sChef, 2)).address;
        const y3 = (await getYieldToken(sChef, 3)).address;

        await expect(sChef.createYieldTokens([2], [AddressZero]))
            .to.emit(sChef, "YieldTokenCreated")
            .withArgs(2, lp2.address, y2, AddressZero);

        await expect(sChef.createYieldTokens([1], [AddressZero]))
            .to.emit(sChef, "YieldTokenCreated")
            .withArgs(1, lp1.address, y1, AddressZero);

        expect((await sChef.yTokenInfoOf(0)).yieldToken).to.be.equal(AddressZero);
        expect((await sChef.yTokenInfoOf(3)).yieldToken).to.be.equal(AddressZero);
        expect((await sChef.yTokenInfoOf(1)).yieldToken).to.be.equal(y1);
        expect((await sChef.yTokenInfoOf(2)).yieldToken).to.be.equal(y2);

        await sChef.createYieldTokens([3, 0], [AddressZero, AddressZero]);
        expect((await sChef.yTokenInfoOf(3)).yieldToken).to.be.equal(y3);
        expect((await sChef.yTokenInfoOf(0)).yieldToken).to.be.equal(y0);
    });

    it("should be that createYieldTokens function works properly", async () => {
        const { alice, sChef, masterChef, lp } = await setupTest();

        const TestLPToken = await ethers.getContractFactory("TestLPToken");

        const lp1 = (await TestLPToken.deploy()) as TestLPToken;
        const lp2 = (await TestLPToken.deploy()) as TestLPToken;
        const lp3 = (await TestLPToken.deploy()) as TestLPToken;

        await masterChef.add(1, lp1.address, false);
        await masterChef.add(2, lp2.address, false);
        await masterChef.add(3, lp3.address, false);

        await expect(sChef.connect(alice).createYieldTokens([0, 1], [AddressZero, AddressZero])).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        await expect(sChef.createYieldTokens([0, 4], [AddressZero, AddressZero])).to.be.reverted;

        await sChef.createYieldTokens([0, 1], [AddressZero, AddressZero]);

        await expect(sChef.createYieldTokens([0], [AddressZero])).to.be.revertedWith("SOUSCHEF: YIELD_TOKEN_EXISTS");
        await expect(sChef.createYieldTokens([0, 1], [AddressZero, AddressZero])).to.be.revertedWith(
            "SOUSCHEF: YIELD_TOKEN_EXISTS"
        );

        const yt0 = await getYieldToken(sChef, 0);
        const yt1 = await getYieldToken(sChef, 1);

        expect(await yt0.pid()).to.be.equal(0);
        expect(await yt1.pid()).to.be.equal(1);

        expect(await yt0.lpToken()).to.be.equal(lp.address);
        expect(await yt1.lpToken()).to.be.equal(lp1.address);
        expect(await yt0.lpToken()).to.be.equal((await masterChef.poolInfo(0)).lpToken);
        expect(await yt1.lpToken()).to.be.equal((await masterChef.poolInfo(1)).lpToken);

        await masterChef.add(4, lp.address, false);
        expect((await masterChef.poolInfo(0)).lpToken).to.be.equal((await masterChef.poolInfo(4)).lpToken);

        await sChef.createYieldTokens([4], [AddressZero]);
        const yt4 = await getYieldToken(sChef, 4);
        expect(await yt0.lpToken()).to.be.equal(await yt4.lpToken());
    });

    it("should be that starategy can be updated", async () => {
        const { alice, sChef, masterChef, lp } = await setupTest();

        const TestLPToken = await ethers.getContractFactory("TestLPToken");

        const lp1 = (await TestLPToken.deploy()) as TestLPToken;

        await masterChef.add(1, lp1.address, false);

        const TestRewardToken = await ethers.getContractFactory("TestRewardToken");
        const rewardToken0 = (await TestRewardToken.deploy()) as TestRewardToken;
        const rewardToken1 = (await TestRewardToken.deploy()) as TestRewardToken;

        const RewardBucket = await ethers.getContractFactory("RewardBucket");
        const rBucket = (await RewardBucket.deploy(sChef.address, [rewardToken0.address], [10])) as RewardBucket;
    
        const RewardFountain = await ethers.getContractFactory("RewardFountain");
        const rFountain = (await RewardFountain.deploy(sChef.address, [rewardToken0.address, rewardToken1.address], [1, 2])) as RewardFountain;

        await sChef.createYieldTokens([0, 1], [AddressZero, rBucket.address]);

        expect((await sChef.yTokenInfoOf(0)).strategy).to.be.equal(AddressZero);
        expect((await sChef.yTokenInfoOf(1)).strategy).to.be.equal(rBucket.address);

        await expect(sChef.updateStrategy(2, AddressZero)).to.be.revertedWith("SOUSCHEF: YIELD_TOKEN_NOT_EXISTS");
        await expect(sChef.connect(alice).updateStrategy(0, AddressZero)).to.be.revertedWith("Ownable: caller is not the owner");

        await sChef.updateStrategy(0, rFountain.address);
        await sChef.updateStrategy(1, rFountain.address);
        expect((await sChef.yTokenInfoOf(0)).strategy).to.be.equal(rFountain.address);
        expect((await sChef.yTokenInfoOf(1)).strategy).to.be.equal(rFountain.address);
    });

    it("overall test-1", async () => {
        const { deployer, alice, bob, carol, sChef, masterChef, sushiBar, sushi, lp } = await setupTest();

        expect(await sushiBar.totalSupply()).to.be.equal(0);

        await sChef.createYieldTokens([0], [AddressZero]);
        const ytoken = (await ethers.getContractAt(
            "SushiYieldToken",
            (
                await sChef.yTokenInfoOf(0)
            ).yieldToken
        )) as SushiYieldToken;

        await expect(() => sChef.connect(alice).deposit(0, 100)).to.changeTokenBalance(sushiBar, alice, 0);

        await mineTo(101);
        await expect(() => sChef.connect(alice).deposit(0, 100)).to.changeTokenBalance(ytoken, alice, rpb); //101
        expect(await ytoken.balanceOf(alice.address)).to.be.equal(rpb);

        await expect(() => sChef.connect(alice).deposit(0, 0)).to.changeTokenBalance(ytoken, alice, rpb); //102
        expect(await ytoken.balanceOf(alice.address)).to.be.equal(rpb * 2);

        await expect(() => sChef.connect(alice).deposit(0, 0)).to.changeTokenBalance(ytoken, alice, rpb); //103
        expect(await ytoken.balanceOf(alice.address)).to.be.equal(rpb * 3);

        await mine(2); //104,5
        await expect(() => sChef.connect(alice).deposit(0, 0)).to.changeTokenBalance(ytoken, alice, rpb * 3); //106_a
        expect(await ytoken.balanceOf(alice.address)).to.be.equal(rpb * 6);

        await expect(() => sChef.connect(bob).deposit(0, 200)).to.changeTokenBalances(
            ytoken,
            [sChef, alice, bob],
            [0, 0, 0]
        ); //107_a->ab
        expect(await ytoken.balanceOf(alice.address)).to.be.equal(rpb * 6);

        await expect(() => sChef.connect(bob).deposit(0, 0)).to.changeTokenBalances(
            ytoken,
            [sChef, alice, bob],
            [0, 0, rpb / 2]
        ); //108_ab
        expect(await ytoken.balanceOf(alice.address)).to.be.equal(rpb * 6);
        expect(await ytoken.balanceOf(bob.address)).to.be.equal(rpb / 2);

        await expect(() => sChef.connect(bob).deposit(0, 0)).to.changeTokenBalances(
            ytoken,
            [sChef, alice, bob],
            [0, 0, rpb / 2]
        ); //109_ab
        expect(await ytoken.balanceOf(alice.address)).to.be.equal(rpb * 6);
        expect(await ytoken.balanceOf(bob.address)).to.be.equal(rpb);

        await expect(() => sChef.connect(alice).deposit(0, 0)).to.changeTokenBalances(
            ytoken,
            [sChef, alice, bob],
            [0, rpb + (rpb * 3) / 2, 0]
        ); //110_ab
        expect(await ytoken.balanceOf(alice.address)).to.be.equal(rpb * 8.5);
        expect(await ytoken.balanceOf(bob.address)).to.be.equal(rpb);

        await expect(() => sChef.connect(alice).burnYieldToken(ytoken.address, rpb)).to.changeTokenBalances(
            sushi,
            [alice],
            [rpb]
        ); //111_ab
        expect(await ytoken.balanceOf(alice.address)).to.be.equal(rpb * 7.5);
        expect(await ytoken.balanceOf(bob.address)).to.be.equal(rpb);

        expect(await sChef.sushiRewardPerYieldToken()).to.be.equal(1);
        expect(await sushi.balanceOf(sushiBar.address)).to.be.equal(rpb * 9);
        await sushi.transfer(sushiBar.address, rpb * 9); //112_ab
        expect(await sushi.balanceOf(sushiBar.address)).to.be.equal(rpb * 18);
        expect(await sChef.sushiRewardPerYieldToken()).to.be.equal(2);

        await expect(() => sChef.connect(alice).burnYieldToken(ytoken.address, rpb)).to.changeTokenBalances(
            sushi,
            [alice],
            [rpb * 2]
        ); //113_ab
        expect(await ytoken.balanceOf(alice.address)).to.be.equal(rpb * 6.5);
        expect(await ytoken.balanceOf(bob.address)).to.be.equal(rpb);

        await masterChef.add(100, alice.address, true); //114

        await autoMining(false);
        await sChef.connect(alice).deposit(0, 0);
        await sChef.connect(bob).deposit(0, 0);
        await expect(() => mine()).to.changeTokenBalances(ytoken, [sChef, alice, bob], [0, 11250, 16250]); //115
        await autoMining(true);

        console.log((await ytoken.balanceOf(alice.address)).toString());
        console.log((await ytoken.balanceOf(bob.address)).toString());

        // {
        //     await sChef.connect(alice).burnYieldToken(ytoken.address, 76250);    //116
        //     await sChef.connect(bob).burnYieldToken(ytoken.address, 26250);      //117
        //     console.log((await sushi.balanceOf(sChef.address)).toString())   //0
        //     console.log((await sushi.balanceOf(alice.address)).toString())   //182500
        //     console.log((await sushi.balanceOf(bob.address)).toString())   //52500
        // }

        // {
        //     await sChef.connect(alice).burnYieldToken(ytoken.address, 76250); //116
        //     await sChef.connect(bob).claimSushiRewardWithBurningYieldToken(0, 26250); //117
        //     console.log((await sushi.balanceOf(sChef.address)).toString()); //0
        //     console.log((await sushi.balanceOf(alice.address)).toString()); //182500
        //     console.log((await sushi.balanceOf(bob.address)).toString()); //57500
        // }

        // {
        //     await ytoken.connect(alice).transfer(carol.address, 76250); //116
        //     await sChef.connect(carol).burnYieldToken(ytoken.address, 76250); //117
        //     console.log((await sushi.balanceOf(carol.address)).toString()); //152500

        //     console.log((await sushi.balanceOf(sChef.address)).toString()); //0
        //     console.log((await sushi.balanceOf(alice.address)).toString()); //30000
        //     console.log((await sushi.balanceOf(bob.address)).toString()); //0

        //     console.log((await sushi.balanceOf(sushiBar.address)).toString()); //52500
        //     console.log((await sushiBar.balanceOf(sChef.address)).toString()); //26250
        // }
    });
});
