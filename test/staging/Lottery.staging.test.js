const { assert, expect } = require("chai");
const { getNamedAccounts, ethers, network } = require("hardhat");
const { devChains, networkConfig } = require("../../helper.hardhat.config");

devChains.includes(network.name)
  ? describe.skip
  : describe("Lottery Test", async function () {
      let deployer, lottery, entranceFee;

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        lottery = await ethers.getContract("Lottery", deployer);
        entranceFee = await lottery.getEntranceFee();
      });

      describe("fulfillRandomWords", function () {
        it("works with Chainlink Keeper and VRF and we get a random winner", async function () {
          const startingTimestamp = lottery.getLatestTimestamp();
          const accounts = await ethers.getSigners();
          console.log(`Signers: ${accounts[0].address}`);
          await new Promise(async (resolve, reject) => {
            lottery.once("LotteryWinnerPicked", async () => {
              try {
                const winner = await lottery.getRecentWinner();
                const state = await lottery.getLotteryState();
                const winnerEndingBalance = await accounts[0].getBalance();
                const endingTimestamp = await lottery.getLatestTimestamp();
                console.log(`3. Winner ending balance is ${winnerEndingBalance}`);
                await expect(lottery.getPlayers(0)).to.be.reverted;
                assert.equal(winner.toString(), account[0].address);
                assert.equal(state, 0);
                assert.equal(
                  winnerEndingBalance,
                  winnerStartingBalance.add(entranceFee.toString())
                );
                assert(endingTimestamp > startingTimestamp);
                resolve();
              } catch (e) {
                console.log(e);
                reject();
              }
            });
          });
          console.log(`1. Entering the lottery..`);
          const tx = await lottery.enterLottery({ value: entranceFee });
          await tx.wait(1);
          const winnerStartingBalance = await accounts[0].getBalance();
          console.log(`2. Starting balance is ${winnerStartingBalance}`);
        });
      });
    });
