const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");

const feePercentageBridge = 10;

contract('Bridge', accounts => {

  const [owner, monitor, monitor2, accountSender, accountReceiver] = accounts;
  console.log ("\n accounts: \n", accounts, "\n");

  beforeEach('test', async () => {
    brz = await BRZToken.new({ from: owner });
    console.log("brzAddress: " + brz.address);

    bridge = await Bridge.new(brz.address, {from: owner});
    console.log("bridge: " + bridge.address);

    tokenBridge = await bridge.token();
    console.log("token in Bridge: " + tokenBridge);

    decimalpercent = await bridge.decimalpercent();
    console.log("decimalpercent: " + decimalpercent);

    MONITOR_ROLE = await bridge.MONITOR_ROLE();
    console.log("MONITOR_ROLE: " + MONITOR_ROLE);

    version = await bridge.version();
    console.log("version: " + version);

    console.log("bridge.setfeePercentageBridge", feePercentageBridge);
    await bridge.setfeePercentageBridge(feePercentageBridge, {from: owner});
    response = await bridge.getfeePercentageBridge();
    console.log("bridge.getfeePercentageBridge", response.toString());

    //When you do it in one Blockchain, you do not add himself to the list.
    //Here I added all for test purposes
    await bridge.addBlockchain("BinanceSmartChainTestnet", {from: owner});
    await bridge.addBlockchain("EthereumRinkeby", {from: owner});
    await bridge.addBlockchain("RSKTestnet", {from: owner});
    await bridge.addBlockchain("SolanaDevnet", {from: owner});

    blockchainList = await bridge.listBlockchain();
    console.log("blockchainList", blockchainList);

    await bridge.addMonitor(monitor, {from: owner});
    response = await bridge.hasRole(MONITOR_ROLE, monitor, {from: owner});
    console.log("monitor is in bridge MONITOR_ROLE", response);

  });

  describe('Receive Tokens from ETH to RSK', () => {
    
    let amount = 2000000;
    // transactionFee[0] - fee in BRL
    // transactionFee[1] - fee in destiny currency - minor unit 
    let feeETH = 1050000000000000; // 21000 gas x 50gWei = 0.00105
    let feeBRL = 150000;  //15 BRZ, valor arbitrário para testes, não calculado
    let toBlockchain = "RSKTestnet";
    let toAddress = accountReceiver;

    it('receiveTokens', async () => {

      console.log("\n brz.mint");
      await brz.mint(accountSender, amount*2, {from: owner} );

      console.log("\n brz.approve");
      await brz.approve(bridge.address, amount*2, {from: accountSender} );

      console.log("\n bridge.receiveTokens");
      response = await bridge.receiveTokens(amount, [feeBRL, feeETH], toBlockchain, toAddress, {from: accountSender});

      // CrossRequest
      console.log("\n\n bridge.CrossRequest");
      console.log("\n bridge.receiveTokens.events: ", response.logs[0].event);
      console.log("\n bridge.receiveTokens", response.logs[0]);      
      
      eventCrossRequest = response.logs[0];
      console.log("\n eventCrossRequest\n", eventCrossRequest); 
      //console.log("\n\n response.logs[0]\n", JSON.stringify(eventCrossRequest));

      receiver = eventCrossRequest.args[3];
      console.log("\n receiver", receiver);
      amount = eventCrossRequest.args[1].toNumber();
      console.log("\n amount", amount);
      sender = eventCrossRequest.args[0];
      console.log("\n sender", sender);

      toBlockchain = eventCrossRequest.args[4];
      console.log("\n toBlockchain", toBlockchain);
      toFee = eventCrossRequest.args[2].toNumber();
      console.log("\n toFee", toFee);
      logIndex = eventCrossRequest.logIndex; // 2 ou 0?
      console.log("\n logIndex", logIndex);

      //hashes, //blockHash, transactionHash
      blockHash = eventCrossRequest.blockHash;
      console.log("\n blockHash", blockHash);
      transactionHash = eventCrossRequest.transactionHash;
      console.log("\n transactionHash", transactionHash);


      // The monitor backend listen the event CrossRequest, 
      // after n blocks he will
      // 1- check if it is already processed
      // 2- if not, call acceptTransfer

      // Suppose that now this is the other blockchain now

      console.log("\n bridge.getTransactionId");
      //bridge.getTransactionId([blockHash, transactionHash], receiver, amount, logIndex, {from: monitor});
      transactionId = await bridge.getTransactionId([blockHash, transactionHash], 
        receiver, amount, logIndex, {from: monitor});
      console.log("id: ", transactionId);

      isProcessed = await bridge.processed(transactionId);
      console.log("\n isProcessed before: ", isProcessed );

      response = await brz.balanceOf(bridge.address, {from: monitor} );
      console.log("\n brz.balanceOf Bridge before", response.toNumber());

      console.log("\n bridge.acceptTransfer");
      response = await bridge.acceptTransfer(receiver, amount, sender, toBlockchain, [blockHash, transactionHash], logIndex, {from: monitor});

      isProcessed = await bridge.processed(transactionId);
      console.log("\n isProcessed after: ", isProcessed );

      response = await brz.balanceOf(bridge.address, {from: monitor} );
      console.log("\n brz.balanceOf Bridge after", response.toNumber());


/* 


*/


    });

  });


/*
  describe('Monitor managment', () => {

    it('add monitor2', async () => {
      await bridge.addMonitor(monitor2, {from: owner});
      response = await bridge.hasRole(MONITOR_ROLE, monitor2, {from: owner});
      console.log("monitor2 is in bridge MONITOR_ROLE", response);
    });

  });
*/

});