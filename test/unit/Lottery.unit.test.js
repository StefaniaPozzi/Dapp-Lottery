const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { devChains, networkConfig } = require("../../helper.hardhat.config");

!devChains.includes(network.name)
  ? describe.skip
  : describe("Lottery Test", async function () {
      let lottery, vrfCoordinatorV2Mock, entranceFee, deployer, interval, state;
      const chainId = network.config.chainId;

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture("all");
        lottery = await ethers.getContract("Lottery", deployer);
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
        entranceFee = await lottery.getEntranceFee();
        interval = await lottery.getInterval();
        state = await lottery.getLotteryState();
      });

      describe("constructor", async function () {
        it("Initialising the lottery with all the params", async function () {
          assert(state.toString(), 0);
          assert(interval.toString(), networkConfig[chainId]["interval"]);
        });
      });

      describe("enterLottery", function () {
        it("revert if when the user does not pay enough for the ticket", async function () {
          await expect(lottery.enterLottery()).to.be.revertedWith(
            "Lottery__NotEnoughETHToBuyATicket"
          );
        });
        it("records players when they enter", async function () {
          await lottery.enterLottery({ value: entranceFee });
          const playerFromContract = await lottery.getPlayers(0);
          assert.equal(playerFromContract, deployer);
        });
        it("emits event on enter", async function () {
          await expect(lottery.enterLottery({ value: entranceFee })).to.emit(
            lottery,
            "LotteryEnter"
          );
        });
        it("does not allow entrance when lottery is processing", async function () {
          await lottery.enterLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.send("evm_mine", []);
          await lottery.performUpkeep([]); // CALCULATING STATE
          await expect(lottery.enterLottery({ value: entranceFee })).to.be.revertedWith(
            "Lottery__StateIsNotOpen"
          );
        });
      });
      describe("upkeep", function () {
        it("returns false if users sent no ether", async function () {
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });
        it("returns false if the raffle is not open", async function () {
          await lottery.enterLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.send("evm_mine", []);
          await lottery.performUpkeep([]); //or "0x"
          const lotteryCurrentState = await lottery.getLotteryState();
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
          assert(lotteryCurrentState.toString(), "1");
          assert(!upkeepNeeded);
        });
        /**
         * add 1. false if has no players, 2. time is not passed
         * 3. true if all the above are verified
         */
      });
      describe("performUpkeep", function () {
        it("run only if upkeep is true", async function () {
          await lottery.enterLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.send("evm_mine", []);
          const tx = await lottery.performUpkeep("0x");
          assert(tx);
        });
        it("revert when checkupkeep is false", async function () {
          await expect(lottery.performUpkeep([])).to.be.revertedWith(
            "Lottery__PerformUpkeepNotNeeded"
          );
        });
        it("updates the raffle state, calls the vrf coordinator, emits an event", async function () {
          await lottery.enterLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.send("evm_mine", []);
          const txResponse = await lottery.performUpkeep([]);
          const txReceipt = await txResponse.wait(1);
          const lotteryState = await lottery.getLotteryState();
          const requestId = txReceipt.events[1].args.requestId;
          assert(requestId.toNumber() > 0);
          assert(lotteryState.toNumber() == 1);
        });
      });
      describe("fulfillRandomWords", function () {
        beforeEach(async function () {
          await lottery.enterLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.send("evm_mine", []);
        });
        //test params
        it("called after performUpkeep: we need a requestId", async function () {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)
          ).to.be.revertedWith("nonexistent request");
        });
        it("picks a winner, resets the lottery, send money", async function () {
          const additionalPlayers = 3;
          const startIndex = 1;
          const accounts = await ethers.getSigners();
          for (let i = startIndex; i < startIndex + additionalPlayers; i++) {
            accountConnectedLottery = lottery.connect(accounts[i]);
            await accountConnectedLottery.enterLottery({ value: entranceFee });
          }
          const startTimestamp = await lottery.getLatestTimestamp();

          await new Promise(async (resolve, reject) => {
            lottery.once("LotteryRequestedWinner", async () => {
              console.log("Event found");
              try {
                const winner = lottery.getRecentWinner();
                const state = lottery.getLotteryState();
                const endingTimestamp = lottery.getLatestTimestamp();
                const numPlayers = lottery.getNumberOfPlayers();
                assert(numPlayers.toString(), 0);
                assert(state.toString(), 0);
                assert(endingTimestamp > startTimestamp);
              } catch (e) {
                reject(e);
              }
              resolve();
            });
            //Mocking Chainlink keepers
            const txRes = lottery.performUpkeep([]);
            const txRec = txRes.wait(1);
            //Mocking Chainlink VRF
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txRec.events[1].args.requestId,
              lottery.address
            );
          });
        });
      });
    });
