const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");
const truffleAssertions = require('truffle-assertions');

const { lp, DEFAULT_ADMIN_ROLE, ZERO_ADDRESS, ZERO_BYTES32, version, 
  DECIMALPERCENT, feePercentageBridge, gasAcceptTransfer, minGasPrice, quoteETH_BRZ, amount, minAmount } = require('./data');
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

    feePercentageBridge = (await bridge.feePercentageBridge({from: anyAccount})).toNumber();
    if (lp) console.log("feePercentageBridge: " + feePercentageBridge);
    await bridge.setGasAcceptTransfer(gasAcceptTransfer, {from: owner});

    //Blockchains
    await bridge.addBlockchain("BinanceSmartChainTestnet", 0, 0, {from: owner});
    await bridge.addBlockchain("EthereumRinkeby", minGasPrice, minAmount, {from: owner});
    await bridge.addBlockchain("RSKTestnet", 0, 0, {from: owner});
    await bridge.addBlockchain("SolanaDevnet", 0, 0, {from: owner});    
    response = await bridge.listBlockchain({from: anyAccount});
    if (lp) console.log("Blockchain list: " + response);

    await bridge.addAdmin(admin, {from: owner});
    //Because the Ethereum blockchain has high fees, it will be used here.
    await bridge.setQuoteETH_BRZ(quoteETH_BRZ, {from: admin});    
    minBRZFee =  (await bridge.getMinBRZFee("EthereumRinkeby", {from: anyAccount})) * 1;
  });

  beforeEach('test', async () => {
    // In order to send tokens to the bridge, the accountSender must:
    // 1- Have BRZs
    // 2- Approve the bridge to use the accountSender's BRZs
    await brz.mint(accountSender, amount*2, {from: owner} );
    await brz.approve(bridge.address, amount*2, {from: accountSender} );
  });

  console.log("\n\n");
 
  describe('receiveTokens requirements from RSK to ETH', () => {
    // transactionFee[0] - fee in BRL
    // transactionFee[1] - gasFee in destiny currency - minor unit

    it('receiveTokens', async () => {
      truffleAssertions.passes(bridge.receiveTokens(amount, [minBRZFee, gasPrice], toBlockchain, toAddress, {from: accountSender}));
    });

    it('Should fail if toBlockchain is empty', async () => {      
      truffleAssertions.fails(
        bridge.receiveTokens(amount, [minBRZFee, gasPrice], "", toAddress, {from: accountSender}),
        "toBlockchain not exists"
      );
    });

    it('Should fail to an unlisted blockchain', async () => { 
      truffleAssertions.fails(
        bridge.receiveTokens(amount, [minBRZFee, gasPrice], "unlistedBlockchain", toAddress, {from: accountSender}),
        "toBlockchain not exists"
      );
    });

    it('Should fail if toAddress is empty', async () => {      
      truffleAssertions.fails(
        bridge.receiveTokens(amount, [minBRZFee, gasPrice], toBlockchain, "", {from: accountSender}),
        "toAddress is null"
      );
    });

    it('Should fail if gasPrice is less than minGasPrice', async () => {      
      truffleAssertions.fails(
        bridge.receiveTokens(amount, [minBRZFee, gasPrice-1], toBlockchain, toAddress, {from: accountSender}),
        "gasPrice is less than minimum"
      );
    });

    it('Should fail if BRZFee is less than minBRZFee', async () => {      
      truffleAssertions.fails(
        bridge.receiveTokens(amount, [minBRZFee-1, gasPrice], toBlockchain, toAddress, {from: accountSender}),
        "feeBRZ is less than minimum"
      );
    });

    it('Should fail if amount is zero even if minAmount is zero too', async () => {
      // minAmount in RSKTestnet is 0
      truffleAssertions.fails(
        bridge.receiveTokens(0, [minBRZFee, gasPrice], "RSKTestnet", toAddress, {from: accountSender}),
        "amount is 0"
      );
    });

    it('Should fail if amount is zero when minAmount is greater than zero', async () => {
      truffleAssertions.fails(
        bridge.receiveTokens(0, [minBRZFee, gasPrice], toBlockchain, toAddress, {from: accountSender}),
        "amount is 0"
      );
    });

    it('Should fail if amount is less than minAmount', async () => {
      truffleAssertions.fails(
        bridge.receiveTokens((minAmount-1), [minBRZFee, gasPrice], toBlockchain, toAddress, {from: accountSender}),
        "amount is less than minimum"
      );
    });

    it('Should passes if toAddress is zero address because we do not know the pattern in toBlockchain', async () => {      
      truffleAssertions.passes(
        bridge.receiveTokens(amount, [minBRZFee, gasPrice], toBlockchain, ZERO_ADDRESS, {from: accountSender})
      );
    });

  });
 
  describe('Simulation: receive Tokens from RSK to ETH', () => {

    it('accountSender BRZ balance decreased after receiveTokens', async () => {
      balanceBefore = (await brz.balanceOf(accountSender, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf accountSender before", balanceBefore);

      await bridge.receiveTokens(amount, [minBRZFee, gasPrice], toBlockchain, toAddress, {from: accountSender})
      //The total amount is the amount desired plus the blockchain fee to destination, in BRZ
      totalAmount = amount + minBRZFee;

      balanceAfter = (await brz.balanceOf(accountSender, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf accountSender after", balanceAfter);

      assert.equal(balanceBefore, balanceAfter + totalAmount, "accountSender balance is wrong");
    });

    it('bridge BRZ balance increased after receiveTokens', async () => {
      balanceBefore = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge before", balanceBefore);

      await bridge.receiveTokens(amount, [minBRZFee, gasPrice], toBlockchain, toAddress, {from: accountSender})
      //The total amount is the amount desired plus the blockchain fee to destination, in BRZ
      totalAmount = amount + minBRZFee;

      balanceAfter = (await brz.balanceOf(bridge.address, {from: anyAccount})).toNumber();
      if (lp) console.log("\n brz.balanceOf Bridge after", balanceAfter);

      assert.equal(balanceBefore + totalAmount, balanceAfter, "bridge balance is wrong");
    });

    it('getTokenBalance increased after receiveTokens', async () => {
      balanceBefore = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.getTokenBalance Bridge before", balanceBefore);

      await bridge.receiveTokens(amount, [minBRZFee, gasPrice], toBlockchain, toAddress, {from: accountSender})
      //The total amount is the amount desired plus the blockchain fee to destination, in BRZ
      totalAmount = amount + minBRZFee;

      balanceAfter = (await bridge.getTokenBalance({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.getTokenBalance after", balanceAfter);

      assert.equal(balanceBefore + totalAmount, balanceAfter, "getTokenBalance is wrong");
    });    

    it('totalFeeReceivedBridge in BRZ increased by feePercentageBridge after receiveTokens', async () => {
      balanceBefore = (await bridge.totalFeeReceivedBridge({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.totalFeeReceivedBridge before", balanceBefore);

      response = await bridge.receiveTokens(amount, [minBRZFee, gasPrice], toBlockchain, toAddress, {from: accountSender})
      eventCrossRequest = response.logs[0];
      if (lp) console.log("\n eventCrossRequest\n", eventCrossRequest); 

      bridgeFee = amount * feePercentageBridge / DECIMALPERCENT;      
      if (lp) console.log("\n bridgeFee", bridgeFee);

      balanceAfter = (await bridge.totalFeeReceivedBridge({from: anyAccount})).toNumber();
      if (lp) console.log("\n bridge.totalFeeReceivedBridge after", balanceAfter);

      assert.equal(balanceBefore + bridgeFee, balanceAfter, "bridge balance is wrong");
    });

    it('amount in CrossRequest event was disconted from bridgeFee', async () => {
      response = await bridge.receiveTokens(amount, [minBRZFee, gasPrice], toBlockchain, toAddress, {from: accountSender})
      eventCrossRequest = response.logs[0];
      eventAmount = eventCrossRequest.args[1].toNumber();
      bridgeFee = amount * feePercentageBridge / DECIMALPERCENT;

      assert.equal(amount - bridgeFee, eventAmount, "bridge balance is wrong");
    });    

    it('receiveTokens should fails when bridge is paused', async () => {
      await bridge.pause({ from: owner });
      await truffleAssertions.fails(
        bridge.receiveTokens(amount, [minBRZFee, gasPrice], toBlockchain, toAddress, {from: accountSender})
        , 'Pausable: paused');
      
      await bridge.unpause({ from: owner });
    });        

  });


  describe('event CrossRequest', () => {
    let transaction;
    let eventCrossRequest;

    beforeEach('test', async () => {
      transaction = await bridge.receiveTokens(amount, [minBRZFee, gasPrice], toBlockchain, toAddress, {from: accountSender});
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
      eventToBlockchain = eventCrossRequest.args[4];
      if (lp) console.log("toBlockchain", eventToBlockchain);
      assert.equal(toBlockchain, eventToBlockchain, "toBlockchain is diferent from eventToBlockchain");
    });

    it('event CrossRequest - toFee', async () => {
      // toFee for Ethereum = gasPrice
      eventToFee = eventCrossRequest.args[2].toNumber();
      if (lp) console.log("eventToFee", eventToFee);
      assert.equal(gasPrice, eventToFee, "feeETH is diferent from eventToFee");
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
