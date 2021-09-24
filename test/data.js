module.exports = { 
  //lp: true,  //LogPrint
  lp: false,  //LogPrint

  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  ZERO_BYTES32: '0x0000000000000000000000000000000000000000000000000000000000000000',  
  DEFAULT_ADMIN_ROLE: '0x0000000000000000000000000000000000000000000000000000000000000000',

  version: 'v0',
  DECIMALPERCENT: 10000, //100.00: percentage accuracy (2) to 100%
  feePercentageBridge: 10,    // 0.1%
  gasAcceptTransfer: 100000,  // 100000 wei 
  minGasPrice: 50000000000,   // 50 gWei
  quoteETH_BRZ: 120000000,    // 1 ETH = 12k BRZ
  //feeETH: 1050000000000000,   // 21000 gas x 50gWei: 0.00105
  //feeBRL: 150000,     //15 BRZ, valor arbitrário para testes, não calculado
  
  //minBRZFee = gasAcceptTransfer (wei) * minGasPrice (wei) * quoteETH_BRZ (eth) / 1 ETH
  amount: 2000000,    //200 BRZ
  minAmount: 1000000, //100 BRZ

};
