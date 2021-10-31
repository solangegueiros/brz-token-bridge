const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");
const truffleAssertions = require('truffle-assertions');

const { lp, DEFAULT_ADMIN_ROLE, ZERO_ADDRESS, ZERO_BYTES32, version, 
  DECIMALPERCENT, feePercentageBridge, gasAcceptTransfer, minGasPrice, quoteETH_BRZ, amount, minAmount } = require('../test/data');
let MONITOR_ROLE;
let ADMIN_ROLE;

contract('Bridge', accounts => {

  const [owner, monitor, admin, accountSender, accountReceiver, anyAccount] = accounts;
  if (lp) console.log ("\n accounts: \n", accounts, "\n");

  const toBlockchain = "EthereumRinkeby";  
  const toAddress = accountReceiver;
  let feePercentageBridge;
  let gasPrice = minGasPrice;
  let minBRZFee;
  //let feeBRZ = web3.utils.fromWei((gasAcceptTransfer * minGasPrice).toString(), "ether") * quoteETH_BRZ ;

  before(async () => {
    brz = await BRZToken.new({ from: owner });
    if (lp) console.log("brz.Address: " + brz.address);

    bridge = await Bridge.new(brz.address, {from: owner});
    if (lp) console.log("bridge: " + bridge.address);

    feePercentageBridge = await bridge.feePercentageBridge({from: anyAccount});
    if (lp) console.log("feePercentageBridge: " + feePercentageBridge);
    await bridge.setGasAcceptTransfer(gasAcceptTransfer, {from: owner});

    //Blockchains
    await bridge.addBlockchain("BinanceSmartChainTestnet", 0, 0, {from: owner});
    await bridge.addBlockchain("EthereumRinkeby", minGasPrice, minAmount, {from: owner});
    await bridge.addBlockchain("RSKTestnet", 0, 0, {from: owner});
    await bridge.addBlockchain("SolanaDevnet", 0, 0, {from: owner});    
    response = await bridge.listBlockchain({from: anyAccount});
    if (lp) console.log("Blockchain list: " + response);

    //Monitor
    await bridge.addMonitor(monitor, {from: owner});
    //Admin
    await bridge.addAdmin(admin, {from: owner});
    //Because the Ethereum blockchain has high fees, it will be used here.
    await bridge.setQuoteETH_BRZ(quoteETH_BRZ, {from: admin});    
    minBRZFee =  (await bridge.getMinBRZFee("EthereumRinkeby", {from: anyAccount})) * 1;
  });

  beforeEach('test', async () => {
    // In order to sendo tokens to the bridge, the accountSender must:
    // 1- Have BRZs
    // 2- Approve the bridge to use the accountSender's BRZs
    await brz.mint(accountSender, amount*2, {from: owner} );
    await brz.approve(bridge.address, amount*2, {from: accountSender} );

    //Add extra funds to bridge
    await brz.mint(bridge.address, amount*2, {from: owner} );

    response = await bridge.receiveTokens(amount, [minBRZFee, gasPrice], toBlockchain, accountReceiver, {from: accountSender});
  });

  console.log("\n\n");
  
  describe('withdrawToken', () => {

    it('owner can withdrawToken', async () => {
      balance = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      truffleAssertions.passes(bridge.withdrawToken(balance, {from: owner}));
    });

    it('monitor can not withdrawToken', async () => {
      balance = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      truffleAssertions.fails(bridge.withdrawToken(balance, {from: monitor}), "not owner");
    });

    it('anyAccount can not withdrawToken', async () => {
      balance = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      truffleAssertions.fails(bridge.withdrawToken(balance, {from: anyAccount}), "not owner");
    });

    it('withdrawToken amount = tokenBalance', async () => {
      balance = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.getTokenBalance Bridge", balance);

      truffleAssertions.passes(bridge.withdrawToken(balance, {from: owner}));
    });

    it('withdrawToken amount = brz.balanceOf', async () => {
      balance = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge", balance);

      truffleAssertions.passes(bridge.withdrawToken(balance, {from: owner}));
    });

    it('should fail if withdrawToken amount > tokenBalance', async () => {
      balance = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      balance = balance + 1;
      if (lp) console.log("\n bridge.getTokenBalance Bridge", balance);

      truffleAssertions.fails(bridge.withdrawToken(balance, {from: owner}), "insuficient balance");
    });

    it('ownerBalance increased after withdrawToken', async () => {
      balanceBefore = (await brz.balanceOf(owner, {from: anyAccount})).toNumber();
      if (lp) console.log("\n ownerBalance before", balanceBefore);

      balanceInBridge = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      await bridge.withdrawToken(balanceInBridge, {from: owner})

      balanceAfter = (await brz.balanceOf(owner, {from: anyAccount})).toNumber();
      if (lp) console.log("\n ownerBalance after", balanceAfter);

      assert.equal(balanceBefore + balanceInBridge, balanceAfter, "ownerBalance after withdrawToken is wrong");
    });

    it('bridge BRZ balance decreased after withdrawToken', async () => {
      balanceBefore = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge before", balanceBefore);

      amountToWithdraw = balanceBefore / 2;
      await bridge.withdrawToken(amountToWithdraw, {from: owner})

      balanceAfter = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge after", balanceAfter);

      assert.equal(balanceBefore - amountToWithdraw, balanceAfter, "bridge BRZ balance is wrong");
    });

    it('bridge tokenBalance decreased after withdrawToken', async () => {
      balanceBefore = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      if (lp) console.log("\n ownerBalance before", balanceBefore);

      amountToWithdraw = balanceBefore / 2;
      await bridge.withdrawToken(amountToWithdraw, {from: owner})

      balanceAfter = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      if (lp) console.log("\n ownerBalance after", balanceAfter);

      assert.equal(balanceBefore - amountToWithdraw, balanceAfter, "bridge getTokenBalance is wrong");
    });    

    it('withdrawToken should pass even if bridge is paused', async () => {
      await bridge.pause({ from: owner });
      
      amountToWithdraw = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      truffleAssertions.passes(bridge.withdrawToken(amountToWithdraw, {from: owner}));

      await bridge.unpause({ from: owner });
    });

  });

});
