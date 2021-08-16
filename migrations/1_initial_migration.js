const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");
const Monitor = artifacts.require("Monitor");


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
  console.log("brzTokenAddress", brzTokenAddress);
  

  // Bridge
  await deployer.deploy(Bridge, brzTokenAddress, {from: accounts[0]});
  bridge = await Bridge.deployed();
  console.log("bridge.address", bridge.address);

  // Monitor
  monitor = await deployer.deploy(Monitor, [accounts[0]], 1, {from: accounts[0]});  
  console.log("monitor.address", monitor.address);

  console.log("monitor.setBridge: ", bridge.address);
  await monitor.setBridge(bridge.address, {from: accounts[0]});
/*

*/  
};
