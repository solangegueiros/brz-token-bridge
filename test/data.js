module.exports = { 
  //lp: true,  //LogPrint
  lp: false,  //LogPrint

  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  ZERO_BYTES32: '0x0000000000000000000000000000000000000000000000000000000000000000',  
  DEFAULT_ADMIN_ROLE: '0x0000000000000000000000000000000000000000000000000000000000000000',

  version: 'v0',
  DECIMALPERCENT: 10000, //100.00: percentage accuracy (2) to 100%
  feePercentageBridge: 10,
  minGasPrice: 50000000000,    // 50gWei: 0.00105
  feeETH: 1050000000000000, // 21000 gas x 50gWei: 0.00105
  feeBRL: 150000,     //15 BRZ, valor arbitrário para testes, não calculado
  amount: 2000000,    //200 BRZ
  minAmount: 1000000, //100 BRZ

};
