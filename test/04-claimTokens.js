const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");
const truffleAssertions = require('truffle-assertions');

const { lp, DEFAULT_ADMIN_ROLE, ZERO_ADDRESS, ZERO_BYTES32, version, DECIMALPERCENT, feePercentageBridge, feeETH, feeBRL, amount } = require('../test/data');

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
  });




  describe('claim', () => {

    it('accountReceiver can claim', async () => {
      await truffleAssertions.passes(
        bridge.claim( {from: accountReceiver})
      );
    });

    it('Should fail if getBalanceToClaim is zero', async () => {
      //try to claim from an account which has no balance
      await truffleAssertions.fails(
        bridge.claim( {from: anyAccount}),
        "Bridge: no balance to claim"
      );
    });

    it('getBalanceToClaim is zero after claim', async () => {
      await bridge.claim({from: accountReceiver});

      balanceAfter = (await bridge.getBalanceToClaim(accountReceiver, {from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.totalToClaim after", balanceAfter);

      assert.equal(balanceAfter, 0, "getBalanceToClaim is not zero after claim");
    });
    
    it('totalToClaim decreased after claim', async () => {
      amountToClaim = (await bridge.getBalanceToClaim(accountReceiver, {from: anyAccount})).toNumber();
      balanceBefore = (await bridge.getTotalToClaim({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.totalToClaim before", balanceBefore);

      await bridge.claim({from: accountReceiver});

      balanceAfter = (await bridge.getTotalToClaim({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.totalToClaim after", balanceAfter);

      assert.equal(balanceBefore - amountToClaim, balanceAfter, "totalToClaim is wrong");
    });

    it('bridge BRZ balance decreased after claim', async () => {
      amountToClaim = (await bridge.getBalanceToClaim(accountReceiver, {from: anyAccount})).toNumber();
      balanceBefore = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge before", balanceBefore);

      await bridge.claim({from: accountReceiver});

      balanceAfter = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge after", balanceAfter);

      assert.equal(balanceBefore - amountToClaim, balanceAfter, "bridge balance is wrong");
    });

    it('accountReceiver BRZ balance increased after claim', async () => {
      amountToClaim = (await bridge.getBalanceToClaim(accountReceiver, {from: anyAccount})).toNumber();
      balanceBefore = (await brz.balanceOf(accountReceiver, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf accountReceiver before", balanceBefore);

      await bridge.claim({from: accountReceiver});

      balanceAfter = (await brz.balanceOf(accountReceiver, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf accountReceiver after", balanceAfter);

      assert.equal(balanceBefore + amountToClaim, balanceAfter, "accountReceiver balance is wrong");
    });

    it('if accountReceiver receive more than one transfer, getBalanceToClaim will be the total amount', async () => {
      //balanceBefore is amount because it was executed the first receiveTokens / acceptTransfer on BeforeEach
      balanceBefore = (await bridge.getBalanceToClaim(accountReceiver, {from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.totalToClaim before", balanceBefore);

      //second receiveTokens
      response = await bridge.receiveTokens(amount, fromBlockchain, accountReceiver, {from: accountSender});
      eventCrossRequest2 = response.logs[0];  
      logIndex2 = eventCrossRequest2.logIndex;  
      //hashes, //blockHash, transactionHash
      blockHash2 = eventCrossRequest2.blockHash;
      transactionHash2 = eventCrossRequest2.transactionHash;

      //second acceptTransfer
      await bridge.acceptTransfer(receiver, eventAmount, eventSender, eventBlockchain, [blockHash2, transactionHash2], logIndex2, {from: monitor})

      // balanceAfter = eventAmount + eventAmount (2 operations using same amount)
      balanceAfter = (await bridge.getBalanceToClaim(accountReceiver, {from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.totalToClaim after", balanceAfter);

      assert.equal(balanceBefore + eventAmount, balanceAfter, "getBalanceToClaim is wrong");
    });

    it('claim should pass even if bridge is paused', async () => {   
      await bridge.pause({ from: owner });

      await truffleAssertions.passes(
        bridge.claim( {from: accountReceiver})
      );

      await bridge.unpause({ from: owner });
    });

  });


});
