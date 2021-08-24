const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");

module.exports = async (deployer, network, accounts)=> {

  let brzTokenAddress;

  console.log("network", network);

  //id 5777
  if (network == 'develop') {
    await deployer.deploy(BRZToken, {from: accounts[0]});
    brzToken = await BRZToken.deployed();
    brzTokenAddress = brzToken.address;
  }
  else if (network == 'rinkeby') {
    brzTokenAddress = "0xaE598dE8d90A691D62d727a21D8B563ABb8Df35E";

  }
  else if (network == 'testnet') {
    brzTokenAddress = "0x06d164E8d6829E1dA028A4F745d330Eb764Dd3aC";
    brzTokenAddress = brzTokenAddress.toLowerCase();
  }
  else if (network == 'bsc-testnet') {
    brzTokenAddress = "0x5f974f5e28a8ed3d2576c99333ca9e730edf04de";
    brzTokenAddress = brzTokenAddress.toLowerCase();
  }  
  console.log("brzTokenAddress", brzTokenAddress);
  

  // Bridge
  await deployer.deploy(Bridge, brzTokenAddress, {from: accounts[0]});
  bridge = await Bridge.deployed();
  console.log("bridge.address", bridge.address);


  const feePercentageBridge = 10;  
  console.log("bridge.setfeePercentageBridge", feePercentageBridge);
  await bridge.setfeePercentageBridge(feePercentageBridge, {from: accounts[0]});
  response = await bridge.getfeePercentageBridge();
  console.log("bridge.getfeePercentageBridge", response.toString());


  if (network == 'develop') {
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

/*

*/

};
