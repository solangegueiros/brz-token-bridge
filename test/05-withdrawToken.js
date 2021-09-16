const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");
const truffleAssertions = require('truffle-assertions');

const { lp, DEFAULT_ADMIN_ROLE, ZERO_ADDRESS, ZERO_BYTES32, version, DECIMALPERCENT, feePercentageBridge, feeETH, feeBRL, amount } = require('./data');

contract('Bridge', accounts => {

  const [owner, monitor, monitor2, accountSender, accountReceiver, anyAccount] = accounts;
  if (lp) console.log ("\n accounts: \n", accounts, "\n");

  const fromBlockchain = "RSKTestnet";
  let feePercentageBridge;  

  let eventCrossRequest;
  let receiver;
  let eventSender;
  let eventAmount;
  let eventBlockchain;
  let logIndex;
  let blockHash;
  let transactionHash;   
  let maxWithdrawAmount;

  before(async () => {
    brz = await BRZToken.new({ from: owner });
    if (lp) console.log("brz.Address: " + brz.address);

    bridge = await Bridge.new(brz.address, {from: owner});
    if (lp) console.log("bridge: " + bridge.address);

    feePercentageBridge = await bridge.getFeePercentageBridge({from: anyAccount});
    if (lp) console.log("feePercentageBridge: " + feePercentageBridge);

    //Blockchains
    await bridge.addBlockchain("BinanceSmartChainTestnet", {from: owner});
    await bridge.addBlockchain("EthereumRinkeby", {from: owner});
    await bridge.addBlockchain("RSKTestnet", {from: owner});
    await bridge.addBlockchain("SolanaDevnet", {from: owner});    
    response = await bridge.listBlockchain({from: anyAccount});
    if (lp) console.log("Blockchain list: " + response);

    //Monitor
    await bridge.addMonitor(monitor, {from: owner});
  });

  beforeEach('test', async () => {
    // In order to sendo tokens to the bridge, the accountSender must:
    // 1- Have BRZs
    // 2- Approve the bridge to use the accountSender's BRZs
    await brz.mint(accountSender, amount*2, {from: owner} );
    await brz.approve(bridge.address, amount*2, {from: accountSender} );

    //Add extra funds to bridge
    await brz.mint(bridge.address, amount*2, {from: owner} );

    response = await bridge.receiveTokens(amount, fromBlockchain, accountReceiver, {from: accountSender});
    eventCrossRequest = response.logs[0];
    receiver = eventCrossRequest.args[2];

    eventSender = eventCrossRequest.args[0];
    eventAmount = eventCrossRequest.args[1].toNumber();
    eventBlockchain = eventCrossRequest.args[3];
    logIndex = eventCrossRequest.logIndex;

    //hashes, //blockHash, transactionHash
    blockHash = eventCrossRequest.blockHash;
    transactionHash = eventCrossRequest.transactionHash;

    // The monitor backend listen the event CrossRequest, 
    // after n blocks he will
    // 1- check if it is already processed
    // 2- if not, call acceptTransfer

    // Suppose that this is the other blockchain now
    await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})
    
    totalToClaim = (await bridge.getTotalToClaim({from: anyAccount})).toNumber();    
    tokenBalance = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
    maxWithdrawAmount = tokenBalance - totalToClaim;
  });

  console.log("\n\n");
  
  describe('withdrawToken', () => {

    it('owner can withdrawToken', async () => {
      truffleAssertions.passes(bridge.withdrawToken(maxWithdrawAmount, {from: owner}));
    });

    it('monitor can not withdrawToken', async () => {
      truffleAssertions.fails(bridge.withdrawToken(maxWithdrawAmount, {from: monitor}), "not owner");
    });

    it('anyAccount can not withdrawToken', async () => {
      truffleAssertions.fails(bridge.withdrawToken(maxWithdrawAmount, {from: anyAccount}), "not owner");
    });

    it('max withdrawToken amount = tokenBalance - totalToClaim', async () => {
      truffleAssertions.passes(bridge.withdrawToken(maxWithdrawAmount, {from: owner}));
    });

    it('should fail if try to withdraw all tokenBalance on bridge', async () => {
      tokenBalance = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      truffleAssertions.fails(bridge.withdrawToken(tokenBalance, {from: owner}), "Bridge: insufficient balance");
    });

    it('should fail if withdrawToken amount > (tokenBalance - totalToClaim)', async () => {
      withdrawAmount = maxWithdrawAmount+1;
      truffleAssertions.fails(bridge.withdrawToken(withdrawAmount, {from: owner}), "Bridge: insufficient balance");
    });

    it('ownerBalance increased after withdrawToken', async () => {
      balanceBefore = (await brz.balanceOf(owner, {from: anyAccount})).toNumber();
      if (lp) console.log("\n ownerBalance before", balanceBefore);

      await bridge.withdrawToken(maxWithdrawAmount, {from: owner})

      balanceAfter = (await brz.balanceOf(owner, {from: anyAccount})).toNumber();
      if (lp) console.log("\n ownerBalance after", balanceAfter);

      assert.equal(balanceBefore + maxWithdrawAmount, balanceAfter, "ownerBalance after withdrawToken is wrong");
    });

    it('bridge BRZ balance decreased after withdrawToken', async () => {
      balanceBefore = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge before", balanceBefore);

      await bridge.withdrawToken(maxWithdrawAmount, {from: owner})

      balanceAfter = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge after", balanceAfter);

      assert.equal(balanceBefore - maxWithdrawAmount, balanceAfter, "bridge BRZ balance is wrong");
    });

    it('bridge tokenBalance decreased after withdrawToken', async () => {
      balanceBefore = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      if (lp) console.log("\n ownerBalance before", balanceBefore);

      await bridge.withdrawToken(maxWithdrawAmount, {from: owner})

      balanceAfter = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      if (lp) console.log("\n ownerBalance after", balanceAfter);

      assert.equal(balanceBefore - maxWithdrawAmount, balanceAfter, "bridge getTokenBalance is wrong");
    });    

    it('withdrawToken should pass even if bridge is paused', async () => {
      await bridge.pause({ from: owner });

      truffleAssertions.passes(bridge.withdrawToken(maxWithdrawAmount, {from: owner}));

      await bridge.unpause({ from: owner });
    });

  });

});
