# brz-token-bridge

The token bridge provides the logic for transfer BRZ token between blockchains.

Tech process:
- An account call the function `receiveTokens` in blockchain **A** sending tokens.
- An external monitor follow the event `CrossRequest`.
- Wait `N` confirmations of a receiveTokens's transaction.
- The external monitor calls the function `acceptTransfer` to send tokens to the destination's account.

## Bridge.sol documentation

- See docs folder

## Deployed contracts

- BSC Testnet
[0x9A6672FC6C7bB799CCD925840d4338Eb82559cd6](https://testnet.bscscan.com/address/0x9A6672FC6C7bB799CCD925840d4338Eb82559cd6)

- Ethereum Rinkeby
[0x76a33970889Cd239c47c9C41c4F7413c5702602e](https://rinkeby.etherscan.io/address/0x76a33970889Cd239c47c9C41c4F7413c5702602e)

- RSK Testnet
[0x38b8bdbacd00d0640dae54d62ce141a611a78552](https://explorer.testnet.rsk.co/address/0x38b8bdbacd00d0640dae54d62ce141a611a78552)

## Using locally

```shell
npm install
```

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
4. Constructor: setGasAcceptTransfer: 100000
5. AddBlockchains
   - BinanceSmartChainTestnet
   - EthereumRinkeby
   - RSKTestnet
   - SolanaDevnet
6. Add monitor address
7. Add admin address
8. setMinGasPrice for Ethereum in other blockchains
9. setQuoteETH_BRZ for Ethereum in other blockchains
10. setMinTokenAmount for Ethereum in other blockchains

The files located in `migrations` folder do all steps described before.

### Rinkeby

BRZ Token

[0x420412E765BFa6d85aaaC94b4f7b708C89be2e2B](https://rinkeby.etherscan.io/address/0x420412E765BFa6d85aaaC94b4f7b708C89be2e2B)

```shell
truffle migrate --network rinkeby
```

Verify source code on Etherscan

```shell
truffle run verify Bridge@address --network rinkeby
```

### BSC Testnet

BRZ Token

[0x5f974f5e28a8ed3d2576c99333ca9e730edf04de](https://testnet.bscscan.com/address/0x5f974f5e28a8ed3d2576c99333ca9e730edf04de)

```shell
truffle migrate --network bscTestnet
```

Verify source code on BSCscan

```shell
truffle run verify Bridge@address --network bscTestnet
```

### RSK Testnet

BRZ Token
[0xe355c280131dfaf18bf1c3648aee3c396db6b5fd](https://explorer.testnet.rsk.co/address/0xe355c280131dfaf18bf1c3648aee3c396db6b5fd)

```shell
truffle migrate --network rskTestnet
```
