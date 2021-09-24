const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");

const MonitorAddress = "0xff4dbdf4a43f5889fc24f112ea2b596d137cf1f7";
const AdminAddress = "0xa52515946DAABe072f446Cc014a4eaA93fb9Fd79";
//const feePercentageBridge = 10
//const gasAcceptTransfer = 100000;   // wei
const minGasPrice = 50000000000;    // 50 gWei
const quoteETH_BRZ = 120000000;     // 1 ETH = 12k BRZ
const minTokenAmount = 2500000;     // 250 BRZ

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

  // In constructor: gasAcceptTransfer = 100000;
  response = await bridge.getGasAcceptTransfer();
  console.log("bridge.getGasAcceptTransfer", response);

  console.log("\n addBlockchain");
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

  console.log("\n addMonitor", MonitorAddress);
  await bridge.addMonitor(MonitorAddress, {from: accounts[0]});  

  //Admin
  console.log("\n addAdmin", AdminAddress);
  await bridge.addAdmin(AdminAddress, {from: accounts[0]});

  if (network != 'rinkeby') {
    //Usually owner is NOT an admin, but it is added here only to deploy process.    
    console.log("\n addAdmin temp owner");
    await bridge.addAdmin(accounts[0], {from: accounts[0]});

    console.log("\n setMinGasPrice", minGasPrice);
    await bridge.setMinGasPrice("EthereumRinkeby", minGasPrice, {from: accounts[0]});

    console.log("\n setQuoteETH_BRZ", quoteETH_BRZ);
    await bridge.setQuoteETH_BRZ(quoteETH_BRZ, {from: accounts[0]});

    console.log("\n setMinTokenAmount", minTokenAmount);
    await bridge.setMinTokenAmount("EthereumRinkeby", minTokenAmount, {from: accounts[0]});

    await bridge.delAdmin(accounts[0], {from: accounts[0]});
  } 

  console.log("\n\n");

};
