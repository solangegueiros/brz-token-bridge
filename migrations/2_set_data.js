const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");
const Monitor = artifacts.require("Monitor");

const feePercentageBridge = 10;

module.exports = async (deployer, network, accounts)=> {

  let bridge

  console.log("network", network);

  //id 5777
  if (network == 'develop') {

    await deployer.deploy(BRZToken, {from: accounts[0]});
    brzToken = await BRZToken.deployed();
    brzTokenAddress = brzToken.address;
    console.log("brzToken.address", brzToken.address); 

    await deployer.deploy(Bridge, brzToken.address, {from: accounts[0]});
    bridge = await Bridge.deployed();
  }
  else {
    bridge = await Bridge.deployed();
  }  
  console.log("bridge.address", bridge.address);

  console.log("bridge.setfeePercentageBridge", feePercentageBridge);
  await bridge.setfeePercentageBridge(feePercentageBridge, {from: accounts[0]});
  response = await bridge.getfeePercentageBridge();
  console.log("bridge.getfeePercentageBridge", response.toString());

  if (network == 'develop') {
    await bridge.addBlockchain("BinanceSmartChainTestnet", {from: accounts[0]});
    await bridge.addBlockchain("EthereumRinkeby", {from: accounts[0]});
    await bridge.addBlockchain("RSKTestnet", {from: accounts[0]});
    await bridge.addBlockchain("Solana", {from: accounts[0]});
  }
  else if (network == 'rinkeby') {
    await bridge.addBlockchain("BinanceSmartChainTestnet", {from: accounts[0]});
    await bridge.addBlockchain("RSKTestnet", {from: accounts[0]});
    await bridge.addBlockchain("Solana", {from: accounts[0]});
  }
  else if (network == 'rskTestnet') {
    await bridge.addBlockchain("EthereumRinkeby", {from: accounts[0]});
    await bridge.addBlockchain("BinanceSmartChainTestnet", {from: accounts[0]});
    await bridge.addBlockchain("Solana", {from: accounts[0]});
  }  
  else if (network == 'bscTestnet') {
    await bridge.addBlockchain("EthereumRinkeby", {from: accounts[0]});
    await bridge.addBlockchain("RSKTestnet", {from: accounts[0]});
    await bridge.addBlockchain("Solana", {from: accounts[0]});
  } 

  blockchainList = await bridge.listBlockchain();
  console.log("blockchainList", blockchainList);

/*

*/  
};
