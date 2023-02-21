const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { devChains, networkConfig } = require("../../helper.hardhat.config");

devChains.includes(network.name)
  ? describe.skip
  : describe("Lottery Test", async function () {
      let lottery, entranceFee, deployer;

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        lottery = await ethers.getContract("Lottery", deployer);
        entranceFee = await lottery.getEntranceFee();
      });

      describe("fulfillRandomWords", function () {
        it("works with Chainlink Keeper and VRF and we get a random winner", async function () {
          const startingTimestamp = lottery.getLatestTimestamp();
          const accounts = await ethers.getSigners();
          await new Promise(async (resolve, reject) => {
            lottery.once("LotteryRequestedWinner", async () => {
              try {
                const winner = lottery.getRecentWinner();
                const state = lottery.getLotteryState();
                const winnerEndingBalance = await accounts[0].getBalance();
                const endingTimestamp = lottery.getLatestTimestamp();

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
          await lottery.enterLottery({ value: entranceFee });
          const winnerStartingBalance = await accounts[0].getBalance();
        });
      });
    });
