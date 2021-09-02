const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");

module.exports = async (deployer, network, accounts)=> {

  let brzTokenAddress;

  console.log("network", network);

  if (network == 'develop' || network == 'development') {
    //id 5777
    await deployer.deploy(BRZToken, {from: accounts[0]});
    brzToken = await BRZToken.deployed();
    brzTokenAddress = brzToken.address;
  }
  else if (network == 'rinkeby') {
    brzTokenAddress = "0x420412E765BFa6d85aaaC94b4f7b708C89be2e2B";

  }
  else if (network == 'rskTestnet') {
    brzTokenAddress = "0xe355c280131dfaf18bf1c3648aee3c396db6b5fd";
    brzTokenAddress = brzTokenAddress.toLowerCase();
  }
  else if (network == 'bscTestnet') {
    brzTokenAddress = "0x5f974f5e28a8ed3d2576c99333ca9e730edf04de";
    brzTokenAddress = brzTokenAddress.toLowerCase();
  }  
  console.log("brzTokenAddress", brzTokenAddress);
  

  // Bridge
  await deployer.deploy(Bridge, brzTokenAddress, {from: accounts[0]});
  bridge = await Bridge.deployed();
  console.log("bridge.address", bridge.address);


  // In constructor: feePercentageBridge = 10;  
  // console.log("bridge.setFeePercentageBridge", feePercentageBridge);
  // await bridge.setFeePercentageBridge(feePercentageBridge, {from: accounts[0]});
  response = await bridge.getFeePercentageBridge();
  console.log("bridge.getFeePercentageBridge", response.toString());


  if (network == 'develop' || network == 'development') {
    await bridge.addBlockchain("BinanceSmartChainTestnet", {from: accounts[0]});
    await bridge.addBlockchain("EthereumRinkeby", {from: accounts[0]});
    await bridge.addBlockchain("RSKTestnet", {from: accounts[0]});
    await bridge.addBlockchain("SolanaDevnet", {from: accounts[0]});
  }
  else if (network == 'rinkeby') {
    await bridge.addBlockchain("BinanceSmartChainTestnet", {from: accounts[0]});
    await bridge.addBlockchain("RSKTestnet", {from: accounts[0]});
    await bridge.addBlockchain("SolanaDevnet", {from: accounts[0]});
  }
  else if (network == 'rskTestnet') {
    await bridge.addBlockchain("EthereumRinkeby", {from: accounts[0]});
    await bridge.addBlockchain("BinanceSmartChainTestnet", {from: accounts[0]});
    await bridge.addBlockchain("SolanaDevnet", {from: accounts[0]});
  }  
  else if (network == 'bscTestnet') {
    await bridge.addBlockchain("EthereumRinkeby", {from: accounts[0]});
    await bridge.addBlockchain("RSKTestnet", {from: accounts[0]});
    await bridge.addBlockchain("SolanaDevnet", {from: accounts[0]});
  }
  
  blockchainList = await bridge.listBlockchain();
  console.log("blockchainList", blockchainList);

};
