const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");
const truffleAssertions = require('truffle-assertions');

const { lp, DEFAULT_ADMIN_ROLE, ZERO_ADDRESS, ZERO_BYTES32, version, DECIMALPERCENT, feePercentageBridge, feeETH, feeBRL, amount } = require('./data');

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
  let eventToBlockchain;
  let eventToFee;
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
    response = await bridge.receiveTokens(amount, [feeBRL, feeETH], fromBlockchain, toAddress, {from: accountSender});
    eventCrossRequest = response.logs[0];
    receiver = eventCrossRequest.args[3];

    eventSender = eventCrossRequest.args[0];
    eventAmount = eventCrossRequest.args[1].toNumber();
    eventToBlockchain = eventCrossRequest.args[4];
    eventToFee = eventCrossRequest.args[2].toNumber();
    logIndex = eventCrossRequest.logIndex;

    //hashes, //blockHash, transactionHash
    blockHash = eventCrossRequest.blockHash;
    transactionHash = eventCrossRequest.transactionHash;
  });

  // The monitor backend listen the event CrossRequest, 
  // after n blocks he will
  // 1- check if it is already processed
  // 2- if not, call acceptTransfer

  // Suppose that now this is the other blockchain now

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
      await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventToBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})

      transactionId = await bridge.getTransactionId([blockHash, transactionHash], 
        receiver, eventAmount, logIndex, {from: monitor});

      isProcessed = await bridge.processed(transactionId);
      assert.isTrue(isProcessed, "transactionId NOT isProcessed after acceptTransfer");
    });
  });

  describe('acceptTransfer', () => {
    
    it('anyAccount can not acceptTransfer', async () => {
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventToBlockchain, [blockHash, transactionHash], logIndex, {from: anyAccount}), 
        'not monitor');
    });

    it('monitor acceptTransfer', async () => {
      await truffleAssertions.passes(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventToBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})
      );
    });
    
    it('monitor can not acceptTransfer for same transaction twice', async () => {
      await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventToBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventToBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})
        , "Bridge: already processed");
    });

    it('bridge BRZ balance decreased after acceptTransfer', async () => {
      balanceBefore = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge before", balanceBefore);

      await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventToBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})

      balanceAfter = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge after", balanceAfter);

      assert.equal(balanceBefore, balanceAfter + eventAmount, "bridge balance is wrong");
    });  

    it('receiver BRZ balance increased after receiveTokens', async () => {
      balanceBefore = (await brz.balanceOf(receiver, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf receiver before", balanceBefore);

      await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventToBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})

      balanceAfter = (await brz.balanceOf(receiver, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf receiver after", balanceAfter);

      assert.equal(balanceBefore + eventAmount, balanceAfter, "receiver balance is wrong");
    });

    it('acceptTransfer should fails when bridge is paused', async () => {   
      await bridge.pause({ from: owner });
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventToBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})
        , 'Pausable: paused');

      await bridge.unpause({ from: owner });
    });

    it('acceptTransfer should fails when the bridge not have enought token balance', async () => {
      balance = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      await bridge.withdrawToken(balance, {from: owner});

      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventToBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})
        , 'Bridge: insufficient balance');
    });    

  });

  describe('acceptTransfer requires', () => {

    it('Should fail if receiver is ZERO_ADDRESS', async () => {
      await truffleAssertions.fails(
        bridge.acceptTransfer(ZERO_ADDRESS, eventAmount, eventSender, eventToBlockchain, [blockHash, transactionHash], logIndex, {from: monitor}),
        "Bridge: receiver is zero"
      );
    });

    it('Should fail if amount is zero', async () => {      
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, 0, eventSender, eventToBlockchain, [blockHash, transactionHash], logIndex, {from: monitor}),
        "Bridge: amount is 0"
      );
    });

    it('Should fail if sender is string empty', async () => {
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, "", eventToBlockchain, [blockHash, transactionHash], logIndex, {from: monitor}),
        "Bridge: no sender"
      );
    });

    it('Should fail if fromBlockchain does not exists', async () => {
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, "fromBlockchain", [blockHash, transactionHash], logIndex, {from: monitor}),
        "Bridge: fromBlockchain not exists"
      );
    });

    it('Should fail if blockHash is null hash', async () => {
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventToBlockchain, [ZERO_BYTES32, transactionHash], logIndex, {from: monitor}),
        "Bridge: blockHash is null"
      );
    });

    it('Should fail if transactionHash is null hash', async () => {
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventToBlockchain, [blockHash, ZERO_BYTES32], logIndex, {from: monitor}),
        "Bridge: transactionHash is null"
      );
    });

  });

});
