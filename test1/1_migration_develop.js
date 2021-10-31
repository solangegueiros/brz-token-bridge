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
  console.log("brzTokenAddress", brzTokenAddress);

  // Bridge
  await deployer.deploy(Bridge, brzTokenAddress, {from: accounts[0]});
  bridge = await Bridge.deployed();
  console.log("bridge.address", bridge.address);

  console.log("\n addMonitor", MonitorAddress);
  await bridge.addMonitor(MonitorAddress, {from: accounts[0]});  

  //Admin
  console.log("\n addAdmin", AdminAddress);
  await bridge.addAdmin(AdminAddress, {from: accounts[0]});


  //Usually owner is NOT an admin, but it is added here only to deploy process.    
  console.log("\n addAdmin temp accounts[1]");
  await bridge.addAdmin(accounts[1], {from: accounts[0]});

  console.log("\n setQuoteETH_BRZ", quoteETH_BRZ);
  await bridge.setQuoteETH_BRZ(quoteETH_BRZ, {from: accounts[1]});

  // await bridge.delAdmin(accounts[1], {from: accounts[0]});


  console.log("\n addBlockchain");
  if (network == 'develop' || network == 'development') {
    await bridge.addBlockchain("BinanceSmartChainTestnet", 0, 0, {from: accounts[0]});
    await bridge.addBlockchain("EthereumRinkeby", minGasPrice, minTokenAmount, {from: accounts[0]});
    await bridge.addBlockchain("RSKTestnet", 0, 0, {from: accounts[0]});
    await bridge.addBlockchain("SolanaDevnet", 0, 0, {from: accounts[0]});
  }
  
  console.log("\n listBlockchain");
  blockchainList = await bridge.listBlockchain();
  console.log("blockchainList", blockchainList);

  blockchainName = "BinanceSmartChainTestnet";

  // response = await bridge.blockchainIndex(blockchainName, {from: accounts[1]});
  // console.log("\n blockchainIndex:" + response);

  // response = await bridge.blockchainInfo(response-1, {from: accounts[1]});
  // console.log("\n blockchainInfo:" + JSON.stringify(response));

  // response = await bridge.getMinGasPrice(blockchainName, {from: accounts[1]});
  // console.log("\n MinGasPrice before: \t" + response);
  // await bridge.setMinGasPrice(blockchainName, minGasPrice*2, {from: accounts[1]});
  // response = await bridge.getMinGasPrice(blockchainName, {from: accounts[1]});
  // console.log("getMinGasPrice after: \t" + response);

  console.log("\n\n");

};
