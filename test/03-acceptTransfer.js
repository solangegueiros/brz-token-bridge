const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");
const truffleAssertions = require('truffle-assertions');

const { lp, DEFAULT_ADMIN_ROLE, ZERO_ADDRESS, ZERO_BYTES32, version, DECIMALPERCENT, feePercentageBridge, feeETH, feeBRL, amount } = require('../test/data');

contract('Bridge', accounts => {

  const [owner, monitor, monitor2, accountSender, accountReceiver, anyAccount] = accounts;
  if (lp) console.log ("\n accounts: \n", accounts, "\n");

  const fromBlockchain = "RSKTestnet";
  const toAddress = accountReceiver;
  let feePercentageBridge;

  let eventCrossRequest;
  let receiver;
  let eventSender;
  let eventAmount;
  let eventBlockchain;
  let logIndex;
  let blockHash;
  let transactionHash;  

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

    // console.log("bridge.receiveTokens");
    response = await bridge.receiveTokens(amount, fromBlockchain, toAddress, {from: accountSender});
    eventCrossRequest = response.logs[0];
    receiver = eventCrossRequest.args[2];

    eventSender = eventCrossRequest.args[0];
    eventAmount = eventCrossRequest.args[1].toNumber();
    eventBlockchain = eventCrossRequest.args[3];
    logIndex = eventCrossRequest.logIndex;

    //hashes, //blockHash, transactionHash
    blockHash = eventCrossRequest.blockHash;
    transactionHash = eventCrossRequest.transactionHash;
  });

  // The monitor backend listen the event CrossRequest, 
  // after n blocks he will
  // 1- check if it is already processed
  // 2- if not, call acceptTransfer

  // Suppose that this is the other blockchain now


  describe('transactionId', () => {

    it('getTransactionId', async () => {
      transactionId = await bridge.getTransactionId([blockHash, transactionHash], 
        receiver, eventAmount, logIndex, {from: monitor});
      if (lp) console.log("id: ", transactionId);
    });

    it('transactionId not isProcessed before acceptTransfer', async () => {
      transactionId = await bridge.getTransactionId([blockHash, transactionHash], 
        receiver, eventAmount, logIndex, {from: monitor});

      isProcessed = await bridge.processed(transactionId);
      assert.isFalse(isProcessed, "transactionId isProcessed before wrong");        
    });

    it('transactionId isProcessed after acceptTransfer', async () => {
      await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})

      transactionId = await bridge.getTransactionId([blockHash, transactionHash], 
        receiver, eventAmount, logIndex, {from: monitor});

      isProcessed = await bridge.processed(transactionId);
      assert.isTrue(isProcessed, "transactionId NOT isProcessed after acceptTransfer");
    });
  });

  describe('acceptTransfer requires', () => {

    it('Should fail if receiver is ZERO_ADDRESS', async () => {
      await truffleAssertions.fails(
        bridge.acceptTransfer(ZERO_ADDRESS, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor}),
        "Bridge: receiver is zero"
      );
    });

    it('Should fail if amount is zero', async () => {      
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, 0, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor}),
        "Bridge: amount is 0"
      );
    });

    it('Should fail if sender is string empty', async () => {
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, "", eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor}),
        "Bridge: no sender"
      );
    });

    it('Should fail if fromBlockchain does not exists', async () => {
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, "NoBlockchain", [blockHash, transactionHash], logIndex, {from: monitor}),
        "Bridge: fromBlockchain not exists"
      );
    });

    it('Should fail if blockHash is null hash', async () => {
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [ZERO_BYTES32, transactionHash], logIndex, {from: monitor}),
        "Bridge: blockHash is null"
      );
    });

    it('Should fail if transactionHash is null hash', async () => {
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, ZERO_BYTES32], logIndex, {from: monitor}),
        "Bridge: transactionHash is null"
      );
    });

  });

  describe('acceptTransfer', () => {

    it('anyAccount can not acceptTransfer', async () => {
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: anyAccount}), 
        'not monitor');
    });

    it('monitor acceptTransfer', async () => {
      await truffleAssertions.passes(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})
      );
    });
    
    it('monitor can not acceptTransfer for same transaction twice', async () => {
      await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})
        , "Bridge: already processed");
    });

    it('bridge BRZ balance do not change after acceptTransfer', async () => {
      balanceBefore = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge before", balanceBefore);

      await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})

      balanceAfter = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge after", balanceAfter);

      assert.equal(balanceBefore, balanceAfter, "bridge balance is wrong");
    });

    it('totalToClaim increased after acceptTransfer', async () => {
      before = (await bridge.getTotalToClaim({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.totalToClaim before", balanceBefore);

      await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})

      after = (await bridge.getTotalToClaim({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.totalToClaim after", balanceAfter);

      assert.equal(before + eventAmount, after, "totalToClaim is wrong");
    });

    it('acceptTransfer should fails when the bridge not have enought token balance', async () => {
      balanceBefore = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.getTokenBalance before", balanceBefore);
      totalToClaim = (await bridge.getTotalToClaim({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.totalToClaim", totalToClaim);
      amountToWithdraw = balanceBefore - totalToClaim;
      await bridge.withdrawToken(amountToWithdraw, {from: owner});
      balanceAfter = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.getTokenBalance after", balanceAfter);

      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})
        , 'Bridge: insufficient balance');
    });

    it('receiver getBalanceToClaim increased after receiveTokens', async () => {
      balanceBefore = (await bridge.getBalanceToClaim(receiver, {from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.getBalanceToClaim receiver before", balanceBefore);

      await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})

      balanceAfter = (await bridge.getBalanceToClaim(receiver, {from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.getBalanceToClaim receiver after", balanceAfter);

      assert.equal(balanceBefore + eventAmount, balanceAfter, "receiver getBalanceToClaim is wrong");
    });

    it('acceptTransfer should fails when bridge is paused', async () => {   
      await bridge.pause({ from: owner });
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})
        , 'Pausable: paused');

      await bridge.unpause({ from: owner });
    });

  });

  describe('event CrossAccepted', () => {
    let transaction;
    let eventCrossAccepted;

    beforeEach('test', async () => {
      transaction = await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor});
      eventCrossAccepted = transaction.logs[0];
    });

    it('should emit event CrossAccepted when receiveTokens', async () => {
      truffleAssertions.eventEmitted(transaction, 'CrossAccepted');
    });

    it('event CrossAccepted - receiver', async () => {
      truffleAssertions.eventEmitted(transaction, 'CrossAccepted', ev => ev.receiver === receiver);
    });

    it('event CrossAccepted - amount', async () => {
      //response = eventCrossRequest.args[1].toNumber();
      //assert.equal(response, eventAmount, "response is diferent from eventAmount");
      truffleAssertions.eventEmitted(transaction, 'CrossAccepted', ev => ev.amount.toNumber() === eventAmount);
    });

    it('event CrossAccepted - sender', async () => {
      truffleAssertions.eventEmitted(transaction, 'CrossAccepted', ev => ev.sender === eventSender);
    });

    it('event CrossAccepted - fromBlockchain', async () => {
      truffleAssertions.eventEmitted(transaction, 'CrossAccepted', ev => ev.fromBlockchain === eventBlockchain);
    });

    it('event CrossAccepted - blockHash', async () => {
      truffleAssertions.eventEmitted(transaction, 'CrossAccepted', ev => ev.hashes[0] === blockHash);
    });

    it('event CrossAccepted - transactionHash', async () => {
      truffleAssertions.eventEmitted(transaction, 'CrossAccepted', ev => ev.hashes[1] === transactionHash);
    });

    it('event CrossAccepted - logIndex', async () => {
      truffleAssertions.eventEmitted(transaction, 'CrossAccepted', ev => ev.logIndex.toNumber() === logIndex);
    });

  });

});
