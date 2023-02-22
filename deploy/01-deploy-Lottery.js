const { network, ethers } = require("hardhat");
const { devChains, networkConfig } = require("../helper.hardhat.config");
const { verify } = require("../utils/verify");

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deployer } = await getNamedAccounts(); //how to solve this sintax error?
  const { deploy, log } = deployments;
  const chainId = network.config.chainId;
  let vrfCoordinatorAddress, subscriptionId;
  let SUBSCRIPTION_FUND_AMOUNT = ethers.utils.parseEther("0.2");

  if (chainId == 31337) {
    vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    vrfCoordinatorAddress = vrfCoordinatorV2Mock.address;
    const txRes = await vrfCoordinatorV2Mock.createSubscription();
    const txReceipt = await txRes.wait(1);

    subscriptionId = txReceipt.events[0].args.subId;

    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, SUBSCRIPTION_FUND_AMOUNT);
  } else {
    vrfCoordinatorAddress = networkConfig[chainId]["vrfCoordinatorV2Address"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }
  const entranceFee = networkConfig[chainId]["entranceFee"];

  const gasLane = networkConfig[chainId]["gasLane"];
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
  const interval = networkConfig[chainId]["interval"];

  const arguments = [
    vrfCoordinatorAddress,
    entranceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    interval,
  ];

  const lottery = await deploy("Lottery", {
    from: deployer,
    args: arguments,
    log: true,
    waitConfirmations: 1,
  });

  if (chainId != 31337 && process.env.ETHSCAN_API_KEY) {
    log("Verifying..");
    await verify(lottery.address, arguments);
  }
};

module.exports.tags = ["all", "lottery"];
