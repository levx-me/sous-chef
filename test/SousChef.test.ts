import { SousChef, SushiYieldToken, TestMasterChef, TestSushiBar, TestLPToken, TestSushiToken } from "../typechain";

import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { BigNumber, BigNumberish, BytesLike } from "ethers";
import { getBlock, mine, mineTo, autoMining } from "./utils/blockchain";

const { constants } = ethers;
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

describe("SousChef", () => {
    // beforeEach(async () => {
    //     await ethers.provider.send("hardhat_reset", []);
    // });

    it("-", async () => {
        const { deployer, alice, bob, carol, sChef, masterChef, sushiBar, sushi, lp } = await setupTest();

        // console.log((await sushiBar.totalSupply()).toString());

        // await expect(() => sushiBar.enter(10000)).to.changeTokenBalance(sushiBar, deployer, 10000);
        // await sushi.connect(deployer).transfer(sushiBar.address, 10000);
        // await expect(() => sushiBar.leave(10000)).to.changeTokenBalance(sushi, deployer, 20000);

        // console.log(await sChef.yTokenInfoOf(0));
        await sChef.createYieldTokens([0], [AddressZero]);
        // console.log(await sChef.yTokenInfoOf(0));
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

        // console.log((await sushi.balanceOf(sushiBar.address)).toString());

        await expect(() => sChef.connect(alice).burnYieldToken(ytoken.address, rpb)).to.changeTokenBalances(sushi, [alice], [rpb]); //111_ab
        expect(await ytoken.balanceOf(alice.address)).to.be.equal(rpb * 7.5);
        expect(await ytoken.balanceOf(bob.address)).to.be.equal(rpb);
        // console.log((await sushi.balanceOf(sushiBar.address)).toString());

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
        // console.log((await ytoken.balanceOf(alice.address)).toString())
        // console.log((await ytoken.balanceOf(bob.address)).toString())

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

        await ytoken.connect(alice).transfer(carol.address, 76250); //116
        await sChef.connect(carol).burnYieldToken(ytoken.address, 76250);    //117
        console.log((await sushi.balanceOf(carol.address)).toString()); //152500

        console.log((await sushi    .balanceOf(sChef.address)).toString()); //0
        console.log((await sushi.balanceOf(alice.address)).toString()); //30000
        console.log((await sushi.balanceOf(bob.address)).toString());   //0

        console.log((await sushi.balanceOf(sushiBar.address)).toString()); //52500
        console.log((await sushiBar.balanceOf(sChef.address)).toString()); //26250

        
    });
});
