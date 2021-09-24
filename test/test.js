const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");
const truffleAssertions = require('truffle-assertions');

const { lp, DEFAULT_ADMIN_ROLE, ZERO_ADDRESS, ZERO_BYTES32, version, 
  DECIMALPERCENT, feePercentageBridge, gasAcceptTransfer, minGasPrice, quoteETH_BRZ, amount, minAmount } = require('./data');
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
      //minBRZFee = quoteETH_BRZ * gasAcceptTransfer * minGasPrice
      await bridge.setGasAcceptTransfer(gasAcceptTransfer, {from: owner});
      await bridge.setQuoteETH_BRZ(quoteETH_BRZ, {from: admin});

      await bridge.setMinGasPrice(blockchainName, minGasPrice, {from: admin});
      minBRZFeeAfter = (await bridge.getMinBRZFee(blockchainName, {from: anyAccount})) * 1;
      console.log ("minBRZFeeAfter \t", minBRZFeeAfter);
      let auxMinGasPrice = (await bridge.getMinGasPrice(blockchainName, {from: anyAccount})).toNumber();
      console.log ("auxMinGasPrice \t", auxMinGasPrice);
      minBRZFeeExpected = web3.utils.fromWei(
        auxMinGasPrice * gasAcceptTransfer
        , "ether").toNumber();
      console.log ("Aux minBRZFeeExpected \t", minBRZFeeExpected);
      minBRZFeeExpected = minBRZFeeExpected   * quoteETH_BRZ;
      console.log ("minBRZFeeExpected \t", minBRZFeeExpected);

      assert.equal(minBRZFeeAfter, minBRZFeeExpected, "minBRZFee is wrong after setMinGasPrice");
    });    
/*
    it('minBRZFee updated after setQuoteETH_BRZ', async () => {
      //minBRZFee = quoteETH_BRZ * gasAcceptTransfer * minGasPrice
      await bridge.setMinGasPrice(blockchainName, minGasPrice, {from: admin});
      await bridge.setGasAcceptTransfer(gasAcceptTransfer, {from: owner});

      await bridge.setQuoteETH_BRZ(quoteETH_BRZ, {from: admin});
      minBRZFeeAfter = (await bridge.getMinBRZFee(blockchainName, {from: anyAccount})) * 1;
      minBRZFeeExpected = gasAcceptTransfer * minGasPrice *  (await bridge.getQuoteETH_BRZ({from: anyAccount}));

      assert.equal(minBRZFeeAfter, minBRZFeeExpected, "minBRZFee is wrong after setQuoteETH_BRZ");
    });    
  
    it('minBRZFee updated after setGasAcceptTransfer', async () => {
      //minBRZFee = quoteETH_BRZ * gasAcceptTransfer * minGasPrice
      await bridge.setQuoteETH_BRZ(quoteETH_BRZ, {from: admin});
      await bridge.setMinGasPrice(blockchainName, minGasPrice, {from: admin});

      await bridge.setGasAcceptTransfer(gasAcceptTransfer, {from: owner});
      minBRZFeeAfter = (await bridge.getMinBRZFee(blockchainName, {from: anyAccount})) * 1;
      minBRZFeeExpected = quoteETH_BRZ * minGasPrice * (await bridge.getGasAcceptTransfer({from: anyAccount})); 

      assert.equal(minBRZFeeAfter, minBRZFeeExpected, "minBRZFee is wrong after setMinGasPrice");
    });
*/        
  });


});