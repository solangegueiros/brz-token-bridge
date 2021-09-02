## `IBridge`






### `version() → string` (external)





### `getFeePercentageBridge() → uint256` (external)





### `getTotalFeeReceivedBridge() → uint256` (external)





### `getTokenBalance() → uint256` (external)





### `receiveTokens(uint256 amount, uint256[2] transactionFee, string toBlockchain, string toAddress) → bool` (external)





### `acceptTransfer(address receiver, uint256 amount, string sender, string fromBlockchain, bytes32[2] hashes, uint32 logIndex) → bool` (external)





### `getTransactionId(bytes32[2] hashes, address receiver, uint256 amount, uint32 logIndex) → bytes32` (external)





### `existsBlockchain(string name) → bool` (external)





### `listBlockchain() → string[]` (external)






### `CrossRequest(address from, uint256 amount, uint256 toFee, string toAddress, string toBlockchain)`





### `FeePercentageBridgeChanged(uint256 oldFee, uint256 newFee)`





### `TokenChanged(address tokenAddress)`




