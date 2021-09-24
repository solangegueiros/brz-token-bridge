const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");
const truffleAssertions = require('truffle-assertions');

const { lp, DEFAULT_ADMIN_ROLE, ZERO_ADDRESS, ZERO_BYTES32, version, 
  DECIMALPERCENT, feePercentageBridge, gasAcceptTransfer, minGasPrice, quoteETH_BRZ, amount, minAmount } = require('../test/data');
let MONITOR_ROLE;
let ADMIN_ROLE;
let blockchainName = "blockchainName";

contract('Bridge', accounts => {

  const [owner, owner2, monitor, monitor2, admin, admin2, accountSender, accountReceiver, anyAccount] = accounts;
  console.log ("\n accounts: \n", accounts, "\n");

  before(async () => {
    brz = await BRZToken.new({ from: owner });
    console.log("brzAddress: " + brz.address);

    bridge = await Bridge.new(brz.address, {from: owner});
    console.log("bridge: " + bridge.address); 

    MONITOR_ROLE = await bridge.MONITOR_ROLE();
    console.log("MONITOR_ROLE: " + MONITOR_ROLE, "\n");

    ADMIN_ROLE = await bridge.ADMIN_ROLE();
    console.log("ADMIN_ROLE: " + ADMIN_ROLE, "\n");
  });

  describe('minBRZFee', () => {

    beforeEach(async () => {
      bridge = await Bridge.new(brz.address, {from: owner});
      await bridge.addBlockchain(blockchainName, {from: owner});
      // response = await bridge.listBlockchain({from: anyAccount});
      // console.log("Blockchains: " + response);
      await bridge.addAdmin(admin, {from: owner});      
    });

    it('minBRZFee updated after setMinGasPrice', async () => {
      //minBRZFee = gasAcceptTransfer * minGasPrice * quoteETH_BRZ / ETH_to_WEI
      await bridge.setGasAcceptTransfer(gasAcceptTransfer, {from: owner});
      await bridge.setQuoteETH_BRZ(quoteETH_BRZ, {from: admin});

      await bridge.setMinGasPrice(blockchainName, minGasPrice, {from: admin});
      minBRZFeeAfter = (await bridge.getMinBRZFee(blockchainName, {from: anyAccount})) * 1;
      console.log ("minBRZFeeAfter \t", minBRZFeeAfter);
      aux = ((await bridge.getMinGasPrice(blockchainName, {from: anyAccount})) * gasAcceptTransfer).toString();
      console.log ("auxMinGasPrice * gasAcceptTransfer \t", aux);
      minBRZFeeExpected = web3.utils.fromWei(aux, "ether") * quoteETH_BRZ;
      console.log ("minBRZFeeExpected \t", minBRZFeeExpected);

      assert.equal(minBRZFeeAfter, minBRZFeeExpected, "minBRZFee is wrong after setMinGasPrice");
    });
    
    it('minBRZFee updated after setQuoteETH_BRZ', async () => {
      //minBRZFee = gasAcceptTransfer * minGasPrice * quoteETH_BRZ / ETH_to_WEI
      await bridge.setMinGasPrice(blockchainName, minGasPrice, {from: admin});
      await bridge.setGasAcceptTransfer(gasAcceptTransfer, {from: owner});

      await bridge.setQuoteETH_BRZ(quoteETH_BRZ, {from: admin});
      minBRZFeeAfter = (await bridge.getMinBRZFee(blockchainName, {from: anyAccount})) * 1;

      aux = ((await bridge.getMinGasPrice(blockchainName, {from: anyAccount})) * gasAcceptTransfer).toString();
      minBRZFeeExpected = web3.utils.fromWei(aux, "ether") * (await bridge.getQuoteETH_BRZ({from: anyAccount}));

      assert.equal(minBRZFeeAfter, minBRZFeeExpected, "minBRZFee is wrong after setQuoteETH_BRZ");
    }); 
       
    it('minBRZFee updated after setGasAcceptTransfer', async () => {
      //minBRZFee = gasAcceptTransfer * minGasPrice * quoteETH_BRZ / ETH_to_WEI
      await bridge.setQuoteETH_BRZ(quoteETH_BRZ, {from: admin});
      await bridge.setMinGasPrice(blockchainName, minGasPrice, {from: admin});

      await bridge.setGasAcceptTransfer(gasAcceptTransfer, {from: owner});
      minBRZFeeAfter = (await bridge.getMinBRZFee(blockchainName, {from: anyAccount})) * 1;
      aux = ((await bridge.getGasAcceptTransfer({from: anyAccount})) * minGasPrice).toString();
      minBRZFeeExpected = web3.utils.fromWei(aux, "ether") * quoteETH_BRZ;

      assert.equal(minBRZFeeAfter, minBRZFeeExpected, "minBRZFee is wrong after setMinGasPrice");
    });

  });


});