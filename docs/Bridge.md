## `Bridge`



BRZ token Bridge

Author: Solange Gueiros

Smart contract to cross the BRZ token between EVM compatible blockchains.

The tokens are crossed by TransferoSwiss, the company that controls the issuance of BRZs.

It uses [Open Zeppelin Contracts]
(https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.1.0/)


### `onlyOwner()`



Modifier which verifies if the caller is an owner,
it means he has the role `DEFAULT_ADMIN_ROLE`.

The role `DEFAULT_ADMIN_ROLE` is defined by Open Zeppelin's AccessControl smart contract.

By default (setted in the constructor) the account which deployed this smart contract is in this role.

This owner can add / remove other owners.

### `onlyMonitor()`



Modifier which verifies if the caller is a monitor,
it means he has the role `MONITOR_ROLE`.

Role MONITOR are referred to its `bytes32` identifier,
defined in the `public constant` called MONITOR_ROLE.
It should be exposed in the external API and be unique.

Role MONITOR is used to manage the permissions of monitor's addresses.


### `constructor(address tokenAddress)` (public)



Function called only when the smart contract is deployed.

Parameters:
- address tokenAddress - address of BRZ token used in this blockchain network

Actions:
- the transaction's sender will be added in the DEFAULT_ADMIN_ROLE.
- the token will be defined by the parameter tokenAddress
- the feePercentageBridge default value is be setted in 10, which means 0.1%

### `version() → string` (external)



Function which returns the bridge's version.

This is a fixed value define in source code.

Parameters: none

Returns: string

### `receiveTokens(uint256 amount, string toBlockchain, string toAddress) → bool` (external)



This function starts the process of crossing tokens in the Bridge.

> Any account / person can call it!

Can not be called if the Bridge is paused.

Parameters:
- amount - gross amount of tokens to be crossed.
- toBlockchain - the amount will be sent to this blockchain.
- toAddress - the amount will be sent to this address. It can be diferent from caller's address.
This is a string because some blockchain could not have the same pattern from Etherem / RSK / BSC.

Returns: bool - true if it is sucessful.

Bridge Fee: it is deducted from the requested amount.
It is a percentage of the requested amount.

> Before call this function, the caller MUST have called function `approve` in BRZ token,
> allowing the bridge's smart contract address to use the BRZ tokens,
> calling the function `transferFrom`.

References:

ERC-20 tokens approve and transferFrom pattern:
[eip-20#transferfrom](https://eips.ethereum.org/EIPS/eip-20#transferfrom)

Requirements:
- toBlockchain exists.
- toAddress is not an empty string.
- amount greater than zero.

Actions:
- calculate bridge's fee using the original amount to be sent.
- discount bridge's fee from the original amount, in amountMinusFees.
- add bridge's fee to `totalFeeReceivedBridge`, a variable to store all the fees received by the bridge.
- BRZ transfer amount from the caller's address to bridge address.
- emit `CrossRequest` event, with the parameters:
  - from - address of the caller's function.
  - amount - the net amount to be transfered in the destination blockchain.
  - toAddress - string representing the address which will receive the tokens.
  - toBlockchain - the destination blockchain.

> The `CrossRequest` event is very important because it must be listened by the monitor,
an external program which will
send the transaction on the destination blockchain.


### `getTransactionId(bytes32[2] hashes, address receiver, uint256 amount, uint32 logIndex) → bytes32` (public)



This function calculate a transaction id hash.

Any person can call it.

Parameters:
- hashes - from transaction in the origin blockchain:
  - blockHash - hash of the block where was the transaction `receiveTokens`
  - transactionHash - hash of the transaction `receiveTokens` with the event `CrossRequest`.
- receiver - the address which will receive the tokens.
- amount - the net amount to be transfered.
- logIndex - the index of the event `CrossRequest` in the logs of transaction.

Returns: a bytes32 hash of all the information sent.

Notes:
It did not use origin blockchain and sender address
because the possibility of having the same origin transaction from different blockchain source is minimal.

It is a point to be evaluated in an audit.


### `acceptTransfer(address receiver, uint256 amount, string sender, string fromBlockchain, bytes32[2] hashes, uint32 logIndex) → bool` (external)



This function accept the cross of token,
which means it is called in the destination blockchain,
who will send the tokens accepted to be crossed
to the internal balance of the destination address.

After this the balance will be available for the destination address claims it.

In this way, an address can send tokens many times, calling the fucntion receiveTokens,
but can receive the total amount in one single transaction, saving gas fees.

> Only monitor can call it!

Can not be called if the Bridge is paused.

Parameters:
- receiver - the address which will receive the tokens.
- amount - the net amount to be transfered.
- sender - string representing the address of the token's sender.
- fromBlockchain - the origin blockchain.
- hashes - from transaction in the origin blockchain:
  - blockHash - hash of the block where was the transaction `receiveTokens`.
  - transactionHash - hash of the transaction `receiveTokens` with the event `CrossRequest`.
- logIndex - the index of the event `CrossRequest` in the transaction logs.

Returns: bool - true if it is sucessful

Requirements:
- receiver is not a zero address.
- amount greater than zero.
- sender is not an empty string.
- fromBlockchain exists.
- blockHash is not null hash.
- transactionHash is not hash.

Actions:
- processTransaction:
  - getTransactionId
  - verify if the transactionId was already processed
  - update the status processed for transactionId
- sendToken:
  - check if the bridge has in his balance at least the amount required to do the transfer
  - transfer the amount tokens to destination address


### `claim() → uint256 receivedAmount` (external)



This function transfer tokens from bridge to destination address,
who must be the address who called the function.

When the monitor accept a transfer, it will call the function acceptTransfer,
which will internaly transfer the tokens crossed to the destination address,
updating the internal destination's balance.

After this, the balance will be available for the destination address claims it,
using the function `claim()`.

> Any account / person can call it!

It must have the internal destination's balance greather then zero.

Can be called even if the Bridge is paused,
because can happens a problem and it is necessary to withdraw tokens,
maybe to create a new version of bridge, for example.


### `getTotalFeeReceivedBridge() → uint256` (external)



Returns total of fees received by bridge.

Parameters: none

Returns: integer


### `getBalanceToClaim(address account) → uint256` (external)



Returns the token's amount available to claim by an account.

Parameters: address of an account.

Returns: integer amount of tokens available to claim in bridge.


### `getTokenBalance() → uint256` (external)



Returns token balance in bridge.

Parameters: none

Returns: integer amount of tokens in bridge


### `getTotalToClaim() → uint256` (external)



Returns the token balance locked in the bridge.
The bridge's token balance can never be less than the totalToClaim.

Parameters: none.

Returns: integer amount of tokens locked.


### `withdrawToken(uint256 amount) → bool` (external)



Withdraw tokens from bridge

Only owner can call it.

Can be called even if the Bridge is paused,
because can happens a problem and it is necessary to withdraw tokens,
maybe to create a new version of bridge, for example.

The tokens only can be sent to the caller's function.

Parameters: integer amount of tokens

Returns: true if it is successful

Requirements:
- The amount of unclaimed tokens must be in the bridge.
- amount to withdraw <= bridge's balance minus total to claim.


### `addMonitor(address monitorAddress) → bool` (external)



This function add an address in the `MONITOR_ROLE`.

Only owner can call it.

Can not be called if the Bridge is paused.

Parameters: address of monitor to be added

Returns: bool - true if it is sucessful


### `delMonitor(address monitorAddress) → bool` (external)



This function excludes an address in the `MONITOR_ROLE`.

Only owner can call it.

Can not be called if the Bridge is paused.

Parameters: address of monitor to be excluded

Returns: bool - true if it is sucessful


### `setFeePercentageBridge(uint256 newFee) → bool` (external)



This function update the fee percentage bridge.

Only owner can call it.

Can not be called if the Bridge is paused.

Parameters: integer, the new fee

Returns: bool - true if it is sucessful

Requirements:
- The new fee must be lower than 10% .

Emit the event `FeePercentageBridgeChanged(oldFee, newFee)`.


### `getFeePercentageBridge() → uint256` (external)



Returns the fee percentage bridge.

For each amount received in the bridge, a fee percentage is discounted.
This function returns this fee percentage bridge.

Parameters: none

Returns: integer


### `setToken(address tokenAddress) → bool` (external)



This function update the BRZ token.

Only owner can call it.

Can not be called if the Bridge is paused.

Parameters: address of new BRZ token

Returns: bool - true if it is sucessful

Requirements:
- The token address must not be a zero address.

Emit the event `TokenChanged(tokenAddress)`.


### `existsBlockchain(string name) → bool` (public)



Returns if a blockchain is in the list of allowed blockchains to cross tokens using the bridge.

Parameters: string name of blockchain

Returns: boolean true if it is in the list


### `listBlockchain() → string[]` (external)



List of blockchains allowed to cross tokens using the bridge.

Parameters: none

Returns: an array of strings containing the blockchain list


### `addBlockchain(string name) → uint256` (external)



This function include a new blockchain in the list of allowed blockchains used in the bridge.

Only owner can call it.

Can not be called if the Bridge is paused.

Parameters: string name of blockchain to be added

Returns: index of blockchain in the array

Requirements:
- blockchain not exists.


### `delBlockchain(string name) → bool` (external)



This function exclude a blockchain in the list of allowed blockchains used in the bridge.

Only owner can call it.

Can not be called if the Bridge is paused.

Parameters: string name of blockchain to be excluded

Returns: bool - true if it is sucessful

Requirements:
- blockchain exists.
- there must be at least one blockchain left.


### `pause()` (external)



This function pauses the bridge.

Only owner can call it.

Parameters: none

Returns: none

Requirements:

- The contract must not be paused.


### `unpause()` (external)



This function unpauses the bridge.

Only owner can call it.

Parameters: none

Returns: none

Requirements:

- The contract must be paused.


