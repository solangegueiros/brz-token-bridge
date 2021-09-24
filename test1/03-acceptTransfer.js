const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");
const truffleAssertions = require('truffle-assertions');

const { lp, DEFAULT_ADMIN_ROLE, ZERO_ADDRESS, ZERO_BYTES32, version, 
  DECIMALPERCENT, feePercentageBridge, minGasPrice, feeETH, feeBRL, amount, minAmount } = require('../test/data');
let MONITOR_ROLE;
let ADMIN_ROLE;

contract('Bridge', accounts => {

  const [owner, monitor, admin, accountSender, accountReceiver, anyAccount] = accounts;
  if (lp) console.log ("\n accounts: \n", accounts, "\n");

  const toBlockchain = "EthereumRinkeby";  
  const toAddress = accountReceiver;
  let feePercentageBridge;
  let gasPrice = minGasPrice;

  let eventCrossRequest;
  let receiver;
  let eventSender;
  let eventAmount;
  let eventBlockchain;
  let eventToFee;
  let logIndex;
  let blockHash;
  let transactionHash; 
  let transactionId; 

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
    //Admin
    await bridge.addAdmin(admin, {from: owner});
    //Because the Ethereum blockchain has high fees, it will be used here.
    await bridge.setMinGasPrice("EthereumRinkeby", minGasPrice, {from: admin});
    await bridge.setMinTokenAmount("EthereumRinkeby", minAmount, {from: admin});
  });

  beforeEach('test', async () => {
    // In order to sendo tokens to the bridge, the accountSender must:
    // 1- Have BRZs
    // 2- Approve the bridge to use the accountSender's BRZs
    await brz.mint(accountSender, amount*2, {from: owner} );
    await brz.approve(bridge.address, amount*2, {from: accountSender} );

    // console.log("bridge.receiveTokens");
    response = await bridge.receiveTokens(amount, [feeBRL, gasPrice], toBlockchain, toAddress, {from: accountSender});
    eventCrossRequest = response.logs[0];

    receiver = eventCrossRequest.args[3];
    eventSender = eventCrossRequest.args[0];
    eventAmount = eventCrossRequest.args[1].toNumber();
    eventBlockchain = eventCrossRequest.args[4];
    eventToFee = eventCrossRequest.args[2].toNumber();
    logIndex = eventCrossRequest.logIndex;
    //hashes, //blockHash, transactionHash
    blockHash = eventCrossRequest.blockHash;
    transactionHash = eventCrossRequest.transactionHash;
    if (lp) console.log("receiver: \t\t" + receiver);
    if (lp) console.log("eventSender: \t\t" + eventSender);
    if (lp) console.log("eventAmount: \t\t" + eventAmount);
    if (lp) console.log("eventBlockchain: \t" + eventBlockchain);
    if (lp) console.log("eventToFee: \t\t" + eventToFee);
    if (lp) console.log("blockHash: \t\t\t" + blockHash);
    if (lp) console.log("transactionHash: \t\t" + transactionHash);
    if (lp) console.log("logIndex: \t\t" + logIndex);

    transactionId = await bridge.getTransactionId([blockHash, transactionHash], 
      receiver, eventAmount, logIndex, {from: monitor});
    if (lp) console.log("transactionId: \t\t" + transactionId);

  });

  // The monitor backend listen the event CrossRequest, 
  // after n blocks he will
  // 1- check if it is already processed
  // 2- if not, call acceptTransfer

  // Suppose that this is the other blockchain now

  describe('transactionId', () => {

    it('getTransactionId', async () => {
      if (lp) console.log("id: ", transactionId);
      truffleAssertions.passes(
        bridge.getTransactionId([blockHash, transactionHash], receiver, eventAmount, logIndex, {from: monitor})
      );
    });

    it('transactionId not isProcessed before acceptTransfer', async () => {
      isProcessed = await bridge.processed(transactionId);
      assert.isFalse(isProcessed, "transactionId isProcessed before wrong");        
    });

    it('transactionId isProcessed after acceptTransfer', async () => {
      isProcessed = await bridge.processed(transactionId);
      if (lp) console.log("isProcessed before: " + isProcessed);

      if (eventToFee > 0) {        
        await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor, gasPrice: eventToFee})
      }
      else {
        await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})
      }

      isProcessed = await bridge.processed(transactionId);
      if (lp) console.log("isProcessed after: " + isProcessed);

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

    it('bridge BRZ balance decreased after acceptTransfer', async () => {
      balanceBefore = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge before", balanceBefore);

      await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})

      balanceAfter = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge after", balanceAfter);

      assert.equal(balanceBefore, balanceAfter + eventAmount, "bridge balance is wrong");
    });

    it('receiver BRZ balance increased after acceptTransfer', async () => {
      balanceBefore = (await brz.balanceOf(receiver, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf receiver before", balanceBefore);

      await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})

      balanceAfter = (await brz.balanceOf(receiver, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf receiver after", balanceAfter);

      assert.equal(balanceBefore + eventAmount, balanceAfter, "receiver balance is wrong");
    });

    it('acceptTransfer should fails when the bridge not have enought token balance', async () => {
      balance = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      await bridge.withdrawToken(balance, {from: owner});
      //Now the bridge's balance is zero

      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})
        , 'Bridge: insufficient balance');
    }); 

    it('acceptTransfer should fails when bridge is paused', async () => {   
      await bridge.pause({ from: owner });
      await truffleAssertions.fails(
        bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash, transactionHash], logIndex, {from: monitor})
        , 'Pausable: paused');

      await bridge.unpause({ from: owner });
    });

  });

});
