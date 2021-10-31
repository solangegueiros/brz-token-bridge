require('dotenv').config();
const fs = require('fs');
const path = require("path");
const HDWalletProvider = require('@truffle/hdwallet-provider');

const mnemonic = process.env.MNEMONIC
const infuraKey = process.env.INFURA_KEY
const etherscanKey = process.env.ETHERSCAN_KEY
const bscscanKey = process.env.BSCSCAN_KEY

//Update gas price Testnet
/* Run this first, to use the result in truffle-config:
  curl https://public-node.testnet.rsk.co/ -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}' \
    > .minimum-gas-price-testnet.json
*/
const gasPriceTestnetRaw = fs.readFileSync(".minimum-gas-price-testnet.json").toString().trim();
const minimumGasPriceTestnet = parseInt(JSON.parse(gasPriceTestnetRaw).result.minimumGasPrice, 16);
if (typeof minimumGasPriceTestnet !== 'number' || isNaN(minimumGasPriceTestnet)) {
  throw new Error('unable to retrieve network gas price from .gas-price-testnet.json');
}
console.log("Minimum gas price Testnet: " + minimumGasPriceTestnet);

//Update gas price Mainnet
/* Run this first, to use the result in truffle-config:
  curl https://public-node.rsk.co/ -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}' \
    > .minimum-gas-price-mainnet.json
*/
const gasPriceMainnetRaw = fs.readFileSync(".minimum-gas-price-mainnet.json").toString().trim();
const minimumGasPriceMainnet = parseInt(JSON.parse(gasPriceMainnetRaw).result.minimumGasPrice, 16);
if (typeof minimumGasPriceMainnet !== 'number' || isNaN(minimumGasPriceMainnet)) {
  throw new Error('unable to retrieve network gas price from .gas-price-mainnet.json');
}
console.log("Minimum gas price Mainnet: " + minimumGasPriceMainnet);


module.exports = {

  networks: {
    develop: {
      host: "127.0.0.1",
      port: 8545,
      //gas: 6500000,
    },    
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
      //gas: 8000000,
    },
    bscTestnet: {
      provider: () => new HDWalletProvider(mnemonic, `https://data-seed-prebsc-1-s1.binance.org:8545`, 0, 10),
      network_id: 97,
      confirmations: 2,
      timeoutBlocks: 200,
      networkCheckTimeout: 1e6, //1h = 36e5
      skipDryRun: true,
      production: true    // Treats this network as if it was a public net. (default: false)
    },
    goerli: {
      provider: () => new HDWalletProvider(mnemonic, 'https://rpc.goerli.mudit.blog/', 0, 10),      
      network_id: 5,
      networkCheckTimeout: 1e6, //1h = 36e5,
      skipDryRun: true
    },        
    rinkeby: {
      provider: () => new HDWalletProvider({
        mnemonic: { phrase: mnemonic },
        providerOrUrl: `https://rinkeby.infura.io/v3/` + infuraKey,
        numberOfAddresses: 10,
        pollingInterval: 15e3
      }),
      network_id: 4,
      confirmations: 2,    // # of confs to wait between deployments. (default: 0)
      networkCheckTimeout: 1e6, //1h = 36e5
      deploymentPollingInterval: 15e3,  //15s = 15e3, default is 4e3
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    },
    rskTestnet: { //Testnet RSK with dPathEthereum = metamask addresses
      //https://www.npmjs.com/package/@truffle/hdwallet-provider
      //provider: () => new HDWalletProvider(mnemonic, 'https://public-node.testnet.rsk.co', 0, 10),
      provider: () => new HDWalletProvider({
        mnemonic: { phrase: mnemonic },
        providerOrUrl: 'https://public-node.testnet.rsk.co',
        numberOfAddresses: 10,
        pollingInterval: 25e3 
      }),
      network_id: 31,
      gasPrice: Math.floor(minimumGasPriceTestnet * 1.3),
      networkCheckTimeout: 1e6, //1h = 36e5
      //Source: https://dappsdev.org/blog/2021-02-24-how-to-configure-truffle-to-connect-to-rsk/
      // Higher polling interval to check for blocks less frequently
      // during deployment
      deploymentPollingInterval: 25e3,  //15s = 15e3, default is 4e3
      timeoutBlocks: 200,
      skipDryRun: true
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    reporter: 'eth-gas-reporter',
    //enableTimeouts: false,
    //before_timeout: 600000, // <--- units in ms
    timeout: 600000,         //1s = 1000, 1min = 60000, 10min = 600000, 30min = 1800000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.4",
      optimizer: {
        enabled: false
      },      
    }
  },

  plugins: [
    'truffle-plugin-verify',
    'truffle-contract-size'
  ],

  api_keys: {
    bscscan: bscscanKey,
    etherscan: etherscanKey
  }

};
