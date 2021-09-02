const BRZToken = artifacts.require("BRZToken");
const Bridge = artifacts.require("Bridge");
const truffleAssertions = require('truffle-assertions');

const { lp, DEFAULT_ADMIN_ROLE, ZERO_ADDRESS, ZERO_BYTES32, version, DECIMALPERCENT, feePercentageBridge, feeETH, feeBRL, amount } = require('./data');
let MONITOR_ROLE

contract('Bridge', accounts => {

  const [owner, owner2, monitor, monitor2, accountSender, accountReceiver, anyAccount] = accounts;
  console.log ("\n accounts: \n", accounts, "\n");

  before(async () => {
    brz = await BRZToken.new({ from: owner });
    console.log("brzAddress: " + brz.address);

    bridge = await Bridge.new(brz.address, {from: owner});
    console.log("bridge: " + bridge.address); 

    MONITOR_ROLE = await bridge.MONITOR_ROLE();
    console.log("MONITOR_ROLE: " + MONITOR_ROLE, "\n");     
  });

  describe('Constructor', () => {

    it('owner should have role DEFAULT_ADMIN_ROLE', async () => {
      const response = await bridge.hasRole(DEFAULT_ADMIN_ROLE, owner, {from: anyAccount});
      assert.isTrue(response, "owner do NOT have role DEFAULT_ADMIN_ROLE");
    });

    it('token address should be BRZ address', async () => {
      const response = await bridge.token({from: anyAccount});
      assert.equal(response, brz.address, "token is NOT BRZ address");
    });

    it('getFeePercentageBridge should return feePercentageBridge defined', async () => {
      const response = await bridge.getFeePercentageBridge({from: anyAccount});
      assert.equal(response, feePercentageBridge, "feePercentageBridge is wrong");
    });

  });

  describe('Initial definitions', () => {

    it('DECIMALPERCENT is defined', async () => {
      const response = await bridge.DECIMALPERCENT({from: anyAccount});
      assert.equal(response, DECIMALPERCENT, "DECIMALPERCENT is wrong");
    });

    it('version is defined', async () => {
      const response = await bridge.version({from: anyAccount});
      assert.equal(response, version, "version is wrong");
    });

    it('getTotalFeeReceivedBridge is zero', async () => {
      const response = await bridge.getTotalFeeReceivedBridge({from: anyAccount});
      assert.equal(response, 0, "getTotalFeeReceivedBridge is NOT zero");
    });

  });

  describe('Blockchains', () => {

    let blockchainName = "blockchainName";

    it('no Blockchains on deploy', async () => {
      const response = await bridge.listBlockchain({from: anyAccount});
      if (lp) console.log("Blockchains: " + response);
      assert.equal(response.toString(), "", "Blockchains wrong on deploy");
    });

    it('anyAccount can not addBlockchain', async () => {
      await truffleAssertions.fails(bridge.addBlockchain(blockchainName, {from: anyAccount}), "not owner");
    });

    it('onlyOwner can addBlockchain', async () => {
      await bridge.addBlockchain(blockchainName, {from: owner});
      response = await bridge.existsBlockchain(blockchainName, {from: owner});
      assert.isTrue(response, "addBlockchain is wrong");
    });

    it('it must have at least 1 blockchain', async () => {
      truffleAssertions.fails(
        bridge.delBlockchain(blockchainName, {from: owner}),
        "Bridge: requires at least 1 blockchain"
      );      
    }); 

    it('add, remove and list Blockchains', async () => {
      response = await bridge.listBlockchain();
      if (lp) console.log("Blockchains before: " + response);

      //When you do it in one Blockchain, you do not add himself to the list.
      //Here I added all for test purposes
      await bridge.addBlockchain("BinanceSmartChainTestnet", {from: owner});
      await bridge.addBlockchain("EthereumRinkeby", {from: owner});
      await bridge.addBlockchain("RSKTestnet", {from: owner});
      await bridge.addBlockchain("SolanaDevnet", {from: owner});
      await bridge.delBlockchain(blockchainName, {from: owner});
      const blockchains = ["SolanaDevnet", "BinanceSmartChainTestnet", "EthereumRinkeby", "RSKTestnet" ];

      response = await bridge.listBlockchain({from: anyAccount});
      if (lp) console.log("Blockchains after: " + response);
      assert.equal(response.toString(), blockchains.toString(), "listBlockchain is wrong");
    });

    it('blockchainName can not be added if it already exists', async () => {
      await bridge.addBlockchain(blockchainName, {from: owner});
      truffleAssertions.fails(
        bridge.addBlockchain(blockchainName, {from: owner})
        , "Bridge: blockchain already exists");
    });    

    it('anyAccount can not delBlockchain', async () => {
      await truffleAssertions.fails(
        bridge.addBlockchain(blockchainName, {from: anyAccount})
        , "not owner");
    });

    it('onlyOwner can delBlockchain', async () => {
      await bridge.delBlockchain(blockchainName, {from: owner});
      response = await bridge.existsBlockchain(blockchainName, {from: owner});
      assert.isFalse(response, "delBlockchain is wrong");
    });

    it('blockchainName can not be deleted if it not exists', async () => {
      truffleAssertions.fails(
        bridge.delBlockchain(blockchainName, {from: owner})
        , "Bridge: blockchain not exists");
    });

  });

  describe('Monitor', () => {

    it('monitor has not role MONITOR_ROLE yet', async () => {
      response = await bridge.hasRole(MONITOR_ROLE, monitor, {from: owner});
      if (lp) console.log("monitor is in bridge MONITOR_ROLE", response);
      assert.equal(response, false, "monitor already has role MONITOR_ROLE");
    });

    it('owner can addMonitor', async () => {
      await truffleAssertions.passes(bridge.addMonitor(monitor, {from: owner}));
    });

    it('monitor has role MONITOR_ROLE', async () => {
      response = await bridge.hasRole(MONITOR_ROLE, monitor, {from: owner});
      if (lp) console.log("monitor is in bridge MONITOR_ROLE", response);
      assert.isTrue(response, "monitor has NOT role MONITOR_ROLE");
    });

    it('owner can delMonitor', async () => {
      await truffleAssertions.passes(bridge.delMonitor(monitor, {from: owner}));
    });

    it('monitor has not role MONITOR_ROLE anymore', async () => {
      response = await bridge.hasRole(MONITOR_ROLE, monitor, {from: owner});
      if (lp) console.log("monitor is in bridge MONITOR_ROLE", response);
      assert.isFalse(response, "monitor still has role MONITOR_ROLE");
    });
    
    it('anyAccount can not addMonitor', async () => {
      await truffleAssertions.fails(bridge.addMonitor(monitor, {from: anyAccount}), "not owner");
    });

    it('anyAccount can not delMonitor', async () => {
      await bridge.addMonitor(monitor, {from: owner});
      await truffleAssertions.fails(bridge.delMonitor(monitor, {from: anyAccount}), "not owner");
    });    

    it('monitor2 can not addMonitor', async () => {
      await truffleAssertions.fails(bridge.addMonitor(monitor, {from: monitor2}), "not owner");
    });

    it('monitor2 can not delMonitor', async () => {
      await bridge.addMonitor(monitor, {from: owner});
      await truffleAssertions.fails(bridge.delMonitor(monitor, {from: monitor2}), "not owner");
    });
    
    it('event AccessControl.RoleRevoked emited', async () => { 
      response = await bridge.delMonitor(monitor, {from: owner})     
      eventEmited = response.logs[0];
      if (lp) console.log("eventEmited\n", eventEmited);   
      assert.equal(eventEmited.event, "RoleRevoked", "event RoleRevoked not emited");
    });

    it('event AccessControl.RoleGranted emited', async () => { 
      response = await bridge.addMonitor(monitor, {from: owner});
      eventEmited = response.logs[0];
      if (lp) console.log("eventEmited\n", eventEmited);   
      assert.equal(eventEmited.event, "RoleGranted", "event RoleGranted not emited");
    });

    it('it is possible to have more than one monitor', async () => {
      await truffleAssertions.passes(bridge.addMonitor(monitor2, {from: owner}));
    });

  });

  describe('FeePercentageBridge', () => {

    const newFee = 20;
    beforeEach(async () => {
      bridge = await Bridge.new(brz.address, {from: owner});     
    });

    it('onlyOwner can setFeePercentageBridge', async () => {      
      await bridge.setFeePercentageBridge(newFee, {from: owner});
      response = await bridge.getFeePercentageBridge({from: anyAccount});
      assert.equal(response, newFee, "setFeePercentageBridge is wrong");
    });

    it('anyAccount can not setFeePercentageBridge', async () => {
      await truffleAssertions.fails(bridge.setFeePercentageBridge(newFee, {from: anyAccount}), "not owner");
    });

    it('event FeePercentageBridgeChanged emited', async () => {
      response = await bridge.setFeePercentageBridge(newFee, {from: owner});
      eventEmited = response.logs[0];
      if (lp) console.log("eventEmited\n", eventEmited);   
      assert.equal(eventEmited.event, "FeePercentageBridgeChanged", "event FeePercentageBridgeChanged not emited");
    });

    it('oldFee updated in event FeePercentageBridgeChanged', async () => {
      const oldFee = (await bridge.getFeePercentageBridge({from: anyAccount})).toNumber();
      response = await bridge.setFeePercentageBridge(newFee, {from: owner});
      eventEmited = response.logs[0];
      oldFeeInEvent = eventEmited.args[0];
      assert.equal(oldFee, oldFeeInEvent, "oldFee in FeePercentageBridgeChanged is wrong");
    });

    it('newFee updated in event FeePercentageBridgeChanged', async () => {
      response = await bridge.setFeePercentageBridge(newFee, {from: owner});
      eventEmited = response.logs[0];
      newFeeInEvent = eventEmited.args[1];
      assert.equal(newFee, newFeeInEvent, "newFee in FeePercentageBridgeChanged is wrong");
    });
  });

  describe('Token', () => {

    let newBrz;
    beforeEach(async () => {
      newBrz = await BRZToken.new({ from: owner });     
    });    

    it('onlyOwner can setToken', async () => {
      await bridge.setToken(newBrz.address, {from: owner});
      response = await bridge.token({from: anyAccount});
      assert.equal(response, newBrz.address, "setToken is wrong");
    });

    it('anyAccount can not setToken', async () => {
      await truffleAssertions.fails(bridge.setToken(newBrz.address, {from: anyAccount}), "not owner");
    });

    it('event TokenChanged emited', async () => {
      response = await bridge.setToken(newBrz.address, {from: owner});
      eventEmited = response.logs[0];
      if (lp) console.log("\n eventEmited\n", eventEmited);      
      assert.equal(eventEmited.event, "TokenChanged", "event TokenChanged not emited");
    });   

    it('tokenAddress updated in event TokenChanged', async () => {
      response = await bridge.setToken(newBrz.address, {from: owner});
      eventTokenChanged = response.logs[0];
      brzAddressInEvent = eventTokenChanged.args[0];
      assert.equal(newBrz.address, brzAddressInEvent, "brzAddressInEvent is wrong");
    });
  });


  describe('Roles', () => {

    it('owner should grantRole MONITOR_ROLE', async () => {
      await truffleAssertions.passes(
        bridge.grantRole(MONITOR_ROLE, monitor2, {from: owner})
      )
    });

    it('monitor should not grantRole MONITOR_ROLE', async () => {
      await truffleAssertions.fails(
        bridge.grantRole(MONITOR_ROLE, anyAccount, {from: monitor})
      )
    });

    it('anyAccount should not grantRole MONITOR_ROLE', async () => {
      await truffleAssertions.fails(
        bridge.grantRole(MONITOR_ROLE, monitor2, {from: anyAccount})
      )
    });    

    it('owner should grantRole DEFAULT_ADMIN_ROLE', async () => {
      await truffleAssertions.passes(
        bridge.grantRole(DEFAULT_ADMIN_ROLE, owner2, {from: owner})
      )
    });

    it('anyAccount should not grantRole DEFAULT_ADMIN_ROLE', async () => {
      await truffleAssertions.fails(
        bridge.grantRole(DEFAULT_ADMIN_ROLE, anyAccount, {from: anyAccount})
      )
    });

    it('monitor should not grantRole DEFAULT_ADMIN_ROLE', async () => {
      await truffleAssertions.fails(
        bridge.grantRole(DEFAULT_ADMIN_ROLE, anyAccount, {from: monitor})
      )
    });

  });

  describe('Pause', () => {

    it('Do pause', async () => {      
      await truffleAssertions.passes(    
        await bridge.pause({ from: owner })
        , 'Pausable: paused');
    });

    it('Is paused after run pause?', async () => {      
      isPaused = await bridge.paused({ from: anyAccount });      
      if (lp) console.log("bridge.paused: " + isPaused);
      assert.isTrue(isPaused, "Not paused after run pause");
    });    

    it('Is not paused after run unpause?', async () => {      
      await bridge.unpause({ from: owner });
      isPaused = await bridge.paused({ from: anyAccount });      
      if (lp) console.log("bridge.paused: " + isPaused);
      assert.isFalse(isPaused, "Not unpaused after run unpause");
    }); 
    
    it('owner should pause', async () => {
      await truffleAssertions.passes(    
        await bridge.pause({ from: owner })
      );
    });
    
    it('owner should unpause', async () => {
      await truffleAssertions.passes(    
        await bridge.unpause({ from: owner })
      );
    });    

    it('monitor should not pause', async () => {
      await truffleAssertions.fails(
        bridge.pause({ from: monitor })
        , "Bridge: not owner");
    });

    it('monitor should not unpause', async () => {
      await bridge.pause({ from: owner });
      await truffleAssertions.fails(
        bridge.unpause({ from: monitor })
        , "Bridge: not owner");
    });

    it('anyAccount should not pause', async () => {
      await truffleAssertions.fails(
        bridge.pause({ from: anyAccount })
        , "Bridge: not owner");
    });

    it('anyAccount should not unpause', async () => {
      isPaused = await bridge.paused({ from: anyAccount });
      if (!isPaused) await bridge.pause({ from: owner });

      await truffleAssertions.fails(
        bridge.unpause({ from: anyAccount })
        , "Bridge: not owner");
    });    

    it('addMonitor should fails when bridge is paused', async () => {
      await truffleAssertions.fails(    
        bridge.addMonitor(monitor2, {from: owner})
        , 'Pausable: paused');
    });

    it('delMonitor should fails when bridge is paused', async () => {      
      isPaused = await bridge.paused({ from: anyAccount });
      if (isPaused) await bridge.unpause({ from: owner });

      await bridge.addMonitor(monitor2, {from: owner});

      await bridge.pause({ from: owner });
      await truffleAssertions.fails(    
        bridge.delMonitor(monitor2, {from: owner})
        , 'Pausable: paused');
    });
        
    it('addBlockchain should fails when bridge is paused', async () => {
      blockchainName = "blockchainName";
      await truffleAssertions.fails(
        bridge.addBlockchain(blockchainName, {from: owner})
        , 'Pausable: paused');
    });

    it('delBlockchain should fails when bridge is paused', async () => {
      isPaused = await bridge.paused({ from: anyAccount });
      if (isPaused) await bridge.unpause({ from: owner });

      blockchainName = "blockchainName";
      await bridge.addBlockchain(blockchainName, {from: owner});

      await bridge.pause({ from: owner });
      await truffleAssertions.fails(
        bridge.delBlockchain(blockchainName, {from: owner})
        , 'Pausable: paused');
    });    

    it('setFeePercentageBridge should fails when bridge is paused', async () => { 
      const newFee = 20;
      await truffleAssertions.fails(    
        bridge.setFeePercentageBridge(newFee, {from: owner})
        , 'Pausable: paused');
    });

    it('setToken should fails when bridge is paused', async () => { 
      const newBrz = await BRZToken.new({ from: owner });
      await truffleAssertions.fails(    
        bridge.setToken(newBrz.address, {from: owner})
        , 'Pausable: paused');
    });

  });

});