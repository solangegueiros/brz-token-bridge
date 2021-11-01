## `IBridge`






### `version() → string` (external)





### `getMinBRZFee(string blockchainName) → uint256` (external)





### `getMinGasPrice(string blockchainName) → uint256` (external)





### `getMinTokenAmount(string blockchainName) → uint256` (external)





### `getTokenBalance() → uint256` (external)





### `receiveTokens(uint256 amount, uint256[2] transactionFee, string toBlockchain, string toAddress) → bool` (external)





### `acceptTransfer(address receiver, uint256 amount, string fromBlockchain, bytes32[2] hashes, uint32 logIndex) → bool` (external)





### `getTransactionId(bytes32[2] hashes, address receiver, uint256 amount, uint32 logIndex) → bytes32` (external)





### `existsBlockchain(string name) → bool` (external)





### `listBlockchain() → string[]` (external)






### `CrossRequest(address from, uint256 amount, uint256 toFee, string toAddress, string toBlockchain)`





### `FeePercentageBridgeChanged(uint256 oldFee, uint256 newFee)`





### `GasAcceptTransferChanged(uint256 oldValue, uint256 newValue)`





### `QuoteETH_BRZChanged(uint256 oldValue, uint256 newValue)`





### `TokenChanged(address tokenAddress)`





### `MinBRZFeeChanged(string blockchainName, uint256 oldFee, uint256 newFee)`





### `MinGasPriceChanged(string blockchainName, uint256 oldFee, uint256 newFee)`





### `MinTokenAmountChanged(string blockchainName, uint256 oldAmount, uint256 newAmount)`





