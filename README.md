# brz-token-bridge

```shell
npm install
```

## Bridge.sol documentation

- See docs folder

## Running tests

Execute on terminal 1:

```shell
ganache-cli -i 5777 -e 10000
```

Execute on terminal 2:

```shell
truffle test
```

## .ENV

Check .env.example

## Deploy process

1. Deploy Bridge.sol
2. tokenAddress: BRZ token address
3. Constructor setFeePercentageBridge: 10
4. AddBlockchains
   - BinanceSmartChainTestnet
   - EthereumRinkeby
   - RSKTestnet
   - SolanaDevnet
5. Add monitor address

The files located in `migrations` folder do all steps described before.

### Rinkeby

BRZ Token

[0x420412E765BFa6d85aaaC94b4f7b708C89be2e2B](https://rinkeby.etherscan.io/address/0x420412E765BFa6d85aaaC94b4f7b708C89be2e2B)

```shell
truffle migrate --network rinkeby
```

Verify source code on Etherscan

```shell
truffle run verify Bridge@0xF0B3ED1Feaa633AD78e86f54097B5F9bfCBE55E1 --network rinkeby
```

### BSC Testnet

BRZ Token

[0x5f974f5e28a8ed3d2576c99333ca9e730edf04de](https://testnet.bscscan.com/address/0x5f974f5e28a8ed3d2576c99333ca9e730edf04de)

```shell
truffle migrate --network bscTestnet
```

Verify source code on BSCscan

```shell
truffle run verify Bridge@0x8b453482d2bf0368Ba90E3209b763FCd7210272F --network bscTestnet
```

### RSK Testnet

BRZ Token
[0xe355c280131dfaf18bf1c3648aee3c396db6b5fd](https://explorer.testnet.rsk.co/address/0xe355c280131dfaf18bf1c3648aee3c396db6b5fd)

```shell
truffle migrate --network rskTestnet
```
