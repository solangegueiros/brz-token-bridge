const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");
const truffleAssertions = require('truffle-assertions');

const { lp, DEFAULT_ADMIN_ROLE, ZERO_ADDRESS, ZERO_BYTES32, version, DECIMALPERCENT, feePercentageBridge, feeETH, feeBRL, amount } = require('../test/data');

contract('Bridge', accounts => {

  const [owner, monitor, monitor2, accountSender, accountReceiver, anyAccount] = accounts;
  if (lp) console.log ("\n accounts: \n", accounts, "\n");

  const toBlockchain = "RSKTestnet";
  const toAddress = accountReceiver;
  let feePercentageBridge;

  before(async () => {
    brz = await BRZToken.new({ from: owner });
    if (lp) console.log("brz.Address: " + brz.address);

    bridge = await Bridge.new(brz.address, {from: owner});
    if (lp) console.log("bridge: " + bridge.address);

    feePercentageBridge = (await bridge.getFeePercentageBridge({from: anyAccount})).toNumber();
    if (lp) console.log("feePercentageBridge: " + feePercentageBridge);

    //Blockchains
    await bridge.addBlockchain("BinanceSmartChainTestnet", {from: owner});
    await bridge.addBlockchain("EthereumRinkeby", {from: owner});
    await bridge.addBlockchain("RSKTestnet", {from: owner});
    await bridge.addBlockchain("SolanaDevnet", {from: owner});    
    response = await bridge.listBlockchain({from: anyAccount});
    if (lp) console.log("Blockchain list: " + response);
  });

  beforeEach('test', async () => {
    // In order to sendo tokens to the bridge, the accountSender must:
    // 1- Have BRZs
    // 2- Approve the bridge to use the accountSender's BRZs
    await brz.mint(accountSender, amount*2, {from: owner} );
    await brz.approve(bridge.address, amount*2, {from: accountSender} );
  });

  console.log("\n\n");
 
  describe('Simulation: receive Tokens from ETH to RSK', () => {

    it('receiveTokens', async () => {
      truffleAssertions.passes(bridge.receiveTokens(amount, toBlockchain, toAddress, {from: accountSender}));
    });

    it('Should fail if amount is zero', async () => {      
      truffleAssertions.fails(
        bridge.receiveTokens(0, toBlockchain, toAddress, {from: accountSender}),
        "Bridge: amount is 0"
      );
    });

    it('Should fail to an unlisted blockchain', async () => {      
      truffleAssertions.fails(
        bridge.receiveTokens(amount, "unlistedBlockchain", toAddress, {from: accountSender}),
        "Bridge: toBlockchain not exists"
      );
    });

    it('Should fail if toAddress is empty', async () => {      
      truffleAssertions.fails(
        bridge.receiveTokens(amount, toBlockchain, "", {from: accountSender}),
        "Bridge: toAddress is null"
      );
    });

    it('Should passes if toAddress is zero address because we do not know the pattern in toBlockchain', async () => {      
      truffleAssertions.passes(
        bridge.receiveTokens(amount, toBlockchain, ZERO_ADDRESS, {from: accountSender})
      );
    });

    it('accountSender BRZ balance decreased after receiveTokens', async () => {
      balanceBefore = (await brz.balanceOf(accountSender, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf accountSender before", balanceBefore);

      await bridge.receiveTokens(amount, toBlockchain, toAddress, {from: accountSender})

      balanceAfter = (await brz.balanceOf(accountSender, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf accountSender after", balanceAfter);

      assert.equal(balanceBefore, balanceAfter + amount, "accountSender balance is wrong");
    });

    it('bridge BRZ balance increased after receiveTokens', async () => {
      balanceBefore = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge before", balanceBefore);

      await bridge.receiveTokens(amount, toBlockchain, toAddress, {from: accountSender})

      balanceAfter = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge after", balanceAfter);

      assert.equal(balanceBefore + amount, balanceAfter, "bridge balance is wrong");
    });

    it('getTokenBalance increased after receiveTokens', async () => {
      balanceBefore = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.getTokenBalance Bridge before", balanceBefore);

      await bridge.receiveTokens(amount, toBlockchain, toAddress, {from: accountSender})

      balanceAfter = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.getTokenBalance after", balanceAfter);

      assert.equal(balanceBefore + amount, balanceAfter, "getTokenBalance is wrong");
    });    

    it('totalFeeReceivedBridge in BRZ increased by feePercentageBridge after receiveTokens', async () => {
      balanceBefore = (await bridge.getTotalFeeReceivedBridge({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.totalFeeReceivedBridge before", balanceBefore);

      response = await bridge.receiveTokens(amount, toBlockchain, toAddress, {from: accountSender})
      eventCrossRequest = response.logs[0];
      if (lp) console.log("\n eventCrossRequest\n", eventCrossRequest); 

      bridgeFee = amount * feePercentageBridge / DECIMALPERCENT;      
      if (lp) console.log("\n bridgeFee", bridgeFee);

      balanceAfter = (await bridge.getTotalFeeReceivedBridge({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.totalFeeReceivedBridge after", balanceAfter);

      assert.equal(balanceBefore + bridgeFee, balanceAfter, "bridge balance is wrong");
    });

    it('amount in CrossRequest event was disconted from bridgeFee', async () => {
      response = await bridge.receiveTokens(amount, toBlockchain, toAddress, {from: accountSender})
      eventCrossRequest = response.logs[0];
      eventAmount = eventCrossRequest.args[1].toNumber();
      bridgeFee = amount * feePercentageBridge / DECIMALPERCENT;

      assert.equal(amount - bridgeFee, eventAmount, "bridge balance is wrong");
    });    

    it('receiveTokens should fails when bridge is paused', async () => {
      await bridge.pause({ from: owner });
      await truffleAssertions.fails(
        bridge.receiveTokens(amount, toBlockchain, toAddress, {from: accountSender})
        , 'Pausable: paused');
      
      await bridge.unpause({ from: owner });
    });        

  });

  describe('event CrossRequest', () => {
    let transaction;
    let eventCrossRequest;

    beforeEach('test', async () => {
      transaction = await bridge.receiveTokens(amount, toBlockchain, toAddress, {from: accountSender});
      eventCrossRequest = transaction.logs[0];
    });

    it('should emit event CrossRequest when receiveTokens', async () => {
      truffleAssertions.eventEmitted(transaction, 'CrossRequest');
    });

    it('event CrossRequest - receiver', async () => {
      // eventReceiver = eventCrossRequest.args[2];
      // if (lp) console.log("receiver", eventReceiver);
      // assert.equal(toAddress, eventReceiver, "eventReceiver is diferent from toAddress");
      truffleAssertions.eventEmitted(transaction, 'CrossRequest', ev => ev.toAddress === toAddress);
    });

    it('event CrossRequest - sender', async () => {
      eventSender = eventCrossRequest.args[0];
      if (lp) console.log("sender", eventSender);
      assert.equal(accountSender, eventSender, "accountSender is diferent from eventSender");
    });

    it('event CrossRequest - amount', async () => {
      amountExpected = amount * (1- feePercentageBridge/DECIMALPERCENT);
      if (lp) console.log("amountExpected", amountExpected);
      eventAmount = eventCrossRequest.args[1].toNumber();
      if (lp) console.log("eventAmount", eventAmount);
      assert.equal(amountExpected, eventAmount, "amountExpected is diferent from eventAmount");
    });

    it('event CrossRequest - toBlockchain', async () => {
      eventToBlockchain = eventCrossRequest.args[3];
      if (lp) console.log("toBlockchain", eventToBlockchain);
      assert.equal(toBlockchain, eventToBlockchain, "toBlockchain is diferent from eventToBlockchain");
    });

    it('event CrossRequest - logIndex', async () => {
      logIndex = eventCrossRequest.logIndex;
      if (lp) console.log("logIndex", logIndex);
    });

    it('event CrossRequest - hashes', async () => {
      //hashes = blockHash, transactionHash
      blockHash = eventCrossRequest.blockHash;
      if (lp) console.log("blockHash", blockHash);
      transactionHash = eventCrossRequest.transactionHash;
      if (lp) console.log("transactionHash", transactionHash);
    });
  });

});
