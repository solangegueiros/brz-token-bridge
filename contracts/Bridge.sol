// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/// @title BRZ token Bridge
/// @author Solange Gueiros

// Inpired on https://github.com/rsksmart/tokenbridge/blob/master/bridge/contracts/Bridge.sol

// AccessControl.sol :  https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.1.0/contracts/access/AccessControl.sol
// Pausable.sol :       https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.1.0/contracts/security/Pausable.sol
// SafeMath.sol :       https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.1.0/contracts/utils/math/SafeMath.sol
import "./ozeppelin/access/AccessControl.sol";
import "./ozeppelin/security/Pausable.sol";
import "./ozeppelin/utils/math/SafeMath.sol";
import "./IBridge.sol";

/**
 * @dev BRZ token Bridge
 *
 * Author: Solange Gueiros
 *
 * Smart contract to cross the BRZ token between EVM compatible blockchains.
 *
 * The tokens are crossed by TransferoSwiss, the company that controls the issuance of BRZs.
 *
 * It uses [Open Zeppelin Contracts]
 * (https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.1.0/)
 *
 */
contract Bridge is AccessControl, IBridge, Pausable {
  using SafeMath for uint256;

  address private constant ZERO_ADDRESS = address(0);
  bytes32 private constant NULL_HASH = bytes32(0);
  bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");

  /**
   * @dev DECIMALPERCENT is the representation of 100% using (2) decimal places
   * 100.00 = percentage accuracy (2) to 100%
   */
  uint256 public constant DECIMALPERCENT = 10000;

  IERC20 public token;
  uint256 private totalFeeReceivedBridge; //fee received per Bridge, not for transaction in other blockchain
  uint256 private feePercentageBridge; //Include 2 decimal places
  string[] public blockchain;
  mapping(bytes32 => bool) public processed;

  /**
   * @dev Function called only when the smart contract is deployed.
   *
   * Parameters:
   * - address tokenAddress - address of BRZ token used in this blockchain network
   *
   * Actions:
   * - the transaction's sender will be added in the DEFAULT_ADMIN_ROLE.
   * - the token will be defined by the parameter tokenAddress
   * - the feePercentageBridge default value is be setted in 10, which means 0.1%
   */
  constructor(address tokenAddress) {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    token = IERC20(tokenAddress);
    feePercentageBridge = 10; //0.1%
  }

  /**
   * @dev Modifier which verifies if the caller is an owner,
   * it means he has the role `DEFAULT_ADMIN_ROLE`.
   *
   * The role `DEFAULT_ADMIN_ROLE` is defined by Open Zeppelin's AccessControl smart contract.
   *
   * By default (setted in the constructor) the account which deployed this smart contract is in this role.
   *
   * This owner can add / remove other owners.
   */
  modifier onlyOwner() {
    require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Bridge: not owner");
    _;
  }

  /**
   * @dev Modifier which verifies if the caller is a monitor,
   * it means he has the role `MONITOR_ROLE`.
   *
   * Role MONITOR are referred to its `bytes32` identifier,
   * defined in the `public constant` called MONITOR_ROLE.
   * It should be exposed in the external API and be unique.
   *
   * Role MONITOR is used to manage the permissions of monitor's addresses.
   */
  modifier onlyMonitor() {
    require(hasRole(MONITOR_ROLE, _msgSender()), "Bridge: not monitor");
    _;
  }

  /**
   * @dev Function which returns the bridge's version.
   *
   * This is a fixed value define in source code.
   *
   * Parameters: none
   *
   * Returns: string
   */
  function version() external pure override returns (string memory) {
    return "v0";
  }

  /**
   * @dev Private function to compare two strings
   * and returns `true` if the strings are equal,
   * otherwise it returns false.
   *
   * Parameters: stringA, stringB
   *
   * Returns: bool
   */
  function compareStrings(string memory a, string memory b)
    private
    pure
    returns (bool)
  {
    return (keccak256(abi.encodePacked((a))) ==
      keccak256(abi.encodePacked((b))));
  }

  /**
   * @dev This function starts the process of crossing tokens in the Bridge.
   *
   * > Any account / person can call it!
   *
   * Can not be called if the Bridge is paused.
   *
   * Parameters:
   * - amount - gross amount of tokens to be crossed.
   * - The Bridge fee will be deducted from this amount.
   * - transactionFee - array with the fees:
   *   - transactionFee[0] - fee in BRL - this fee will be added to amount transfered from caller's account.
   *   - transactionFee[1] - fee in destiny currency(minor unit) - this information will be
   * used in the destination Blockchain,
   * by the monitor who will create the transaction and send using this fee defined here.
   * - toBlockchain - the amount will be sent to this blockchain.
   * - toAddress - the amount will be sent to this address. It can be diferent from caller's address.
   * This is a string because some blockchain could not have the same pattern from Etherem / RSK / BSC.
   *
   * Returns: bool - true if it is sucessful.
   *
   * #### More info about fees
   *
   * - Blockchain / transaction fee in BRL - it will be transfered from user's account,
   * along with the amount he would like to receive in the account.
   * This will be spent in `toBlockchain`.
   * Does not depend of amount, but of destination blockchain.
   *
   * - Bridge Fee - it is deducted from the requested amount.
   * It is a percentage of the requested amount.
   * Cannot include the transaction fee in order to be calculated.
   *
   * > Before call this function, the caller MUST have called function `approve` in BRZ token,
   * > allowing the bridge's smart contract address to use the BRZ tokens,
   * > calling the function `transferFrom`.
   *
   * References:
   *
   * ERC-20 tokens approve and transferFrom pattern:
   * [eip-20#transferfrom](https://eips.ethereum.org/EIPS/eip-20#transferfrom)
   *
   * Requirements:
   * - toBlockchain exists.
   * - toAddress is not an empty string.
   * - amount greater than zero.
   *
   * Actions:
   * - add the blockchain fee in BRZ to amount in BRZ, in totalAmount.
   * - calculate bridge's fee using the original amount to be sent.
   * - discount bridge's fee from the original amount, in amountMinusFees.
   * - add bridge's fee to `totalFeeReceivedBridge`, a variable to store all the fees received by the bridge.
   * - BRZ transfer totalAmount from the caller's address to bridge address.
   * - emit `CrossRequest` event, with the parameters:
   *   - from - address of the caller's function.
   *   - amount - the net amount to be transfered in the destination blockchain.
   *   - toFee - the fee which must be used to send the transfer transaction in the destination blockchain.
   *   - toAddress - string representing the address which will receive the tokens.
   *   - toBlockchain - the destination blockchain.
   *
   * > The `CrossRequest` event is very important because it must be listened by the monitor,
   * an external program which will
   * send the transaction on the destination blockchain.
   *
   */
  function receiveTokens(
    uint256 amount,
    uint256[2] memory transactionFee,
    string memory toBlockchain,
    string memory toAddress
  ) external override whenNotPaused returns (bool) {
    require(existsBlockchain(toBlockchain), "Bridge: toBlockchain not exists");
    require(!compareStrings(toAddress, ""), "Bridge: toAddress is null");
    require(amount > 0, "Bridge: amount is 0");

    //The total amount is the amount desired plus the blockchain fee to destination, in the token unit
    uint256 totalAmount = amount.add(transactionFee[0]);

    //Bridge Fee
    uint256 bridgeFee = amount.mul(feePercentageBridge).div(DECIMALPERCENT);
    uint256 amountMinusFees = amount.sub(bridgeFee);
    totalFeeReceivedBridge = totalFeeReceivedBridge.add(bridgeFee);

    //This is the message for Monitor off-chain manage the transaction and send the tokens on the other Blockchain
    emit CrossRequest(
      _msgSender(),
      amountMinusFees,
      transactionFee[1],
      toAddress,
      toBlockchain
    );

    //Transfer the tokens on IERC20, they should be already approved for the bridge Address to use them
    token.transferFrom(_msgSender(), address(this), totalAmount);
    return true;
  }

  /**
   * @dev This function calculate a transaction id hash.
   *
   * Any person can call it.
   *
   * Parameters:
   * - hashes - from transaction in the origin blockchain:
   *   - blockHash - hash of the block where was the transaction `receiveTokens`
   *   - transactionHash - hash of the transaction `receiveTokens` with the event `CrossRequest`.
   * - receiver - the address which will receive the tokens.
   * - amount - the net amount to be transfered.
   * - logIndex - the index of the event `CrossRequest` in the logs of transaction.
   *
   * Returns: a bytes32 hash of all the information sent.
   *
   * Notes:
   * It did not use origin blockchain and sender address
   * because the possibility of having the same origin transaction from different blockchain source is minimal.
   *
   * It is a point to be evaluated in an audit.
   *
   */
  function getTransactionId(
    bytes32[2] calldata hashes, //blockHash, transactionHash
    address receiver,
    uint256 amount,
    uint32 logIndex
  ) public pure override returns (bytes32) {
    return
      keccak256(
        abi.encodePacked(hashes[0], hashes[1], receiver, amount, logIndex)
      );
  }

  /**
   * @dev This function update the variable processed for a transaction
   *
   * > Only monitor can call it!
   *
   * This variable is a public mapping.
   *
   * Each bytes32 which represents a Transaction Id has his boolen value stored.
   *
   */
  function _processTransaction(
    bytes32[2] calldata hashes, //blockHash, transactionHash
    address receiver,
    uint256 amount,
    uint32 logIndex
  ) private onlyMonitor whenNotPaused {
    bytes32 transactionId = getTransactionId(
      hashes,
      receiver,
      amount,
      logIndex
    );
    require(!processed[transactionId], "Bridge: already processed");
    processed[transactionId] = true;
  }

  /**
   * @dev This function transfer token from bridge to destionation address
   *
   * > Only monitor can call it!
   *
   */
  function _sendToken(address to, uint256 amount)
    private
    onlyMonitor
    whenNotPaused
    returns (bool)
  {
    require(
      token.balanceOf(address(this)) >= amount,
      "Bridge: insufficient balance"
    );
    token.transfer(to, amount);
    return true;
  }

  /**
   * @dev This function accept the cross of token,
   * which means it is called in the destination blockchain, who will send the tokens accepted to be crossed.
   *
   * > Only monitor can call it!
   *
   * Can not be called if the Bridge is paused.
   *
   * Parameters:
   * - receiver - the address which will receive the tokens.
   * - amount - the net amount to be transfered.
   * - sender - string representing the address of the token's sender.
   * - fromBlockchain - the origin blockchain.
   * - hashes - from transaction in the origin blockchain:
   *   - blockHash - hash of the block where was the transaction `receiveTokens`.
   *   - transactionHash - hash of the transaction `receiveTokens` with the event `CrossRequest`.
   * - logIndex - the index of the event `CrossRequest` in the transaction logs.
   *
   * Returns: bool - true if it is sucessful
   *
   * Requirements:
   * - receiver is not a zero address.
   * - amount greater than zero.
   * - sender is not an empty string.
   * - fromBlockchain exists.
   * - blockHash is not null hash.
   * - transactionHash is not hash.
   *
   * Actions:
   * - processTransaction:
   *   - getTransactionId
   *   - verify if the transactionId was already processed
   *   - update the status processed for transactionId
   * - sendToken:
   *   - check if the bridge has in his balance at least the amount required to do the transfer
   *   - transfer the amount tokens to destination address
   *
   */
  function acceptTransfer(
    address receiver,
    uint256 amount,
    string calldata sender,
    string calldata fromBlockchain,
    bytes32[2] calldata hashes, //blockHash, transactionHash
    uint32 logIndex
  ) external override onlyMonitor whenNotPaused returns (bool) {
    require(receiver != ZERO_ADDRESS, "Bridge: receiver is zero");
    require(amount > 0, "Bridge: amount is 0");
    require(bytes(sender).length > 0, "Bridge: no sender");
    require(
      existsBlockchain(fromBlockchain),
      "Bridge: fromBlockchain not exists"
    );
    require(hashes[0] != NULL_HASH, "Bridge: blockHash is null");
    require(hashes[1] != NULL_HASH, "Bridge: transactionHash is null");

    _processTransaction(hashes, receiver, amount, logIndex);
    _sendToken(receiver, amount);
    return true;
  }

  /**
   * @dev This function add an address in the `MONITOR_ROLE`.
   *
   * Only owner can call it.
   *
   * Can not be called if the Bridge is paused.
   *
   * Parameters: address of monitor to be added
   *
   * Returns: bool - true if it is sucessful
   *
   */
  function addMonitor(address monitorAddress)
    external
    onlyOwner
    whenNotPaused
    returns (bool)
  {
    grantRole(MONITOR_ROLE, monitorAddress);
    return true;
  }

  /**
   * @dev This function excludes an address in the `MONITOR_ROLE`.
   *
   * Only owner can call it.
   *
   * Can not be called if the Bridge is paused.
   *
   * Parameters: address of monitor to be excluded
   *
   * Returns: bool - true if it is sucessful
   *
   */
  function delMonitor(address monitorAddress)
    external
    onlyOwner
    whenNotPaused
    returns (bool)
  {
    //Can be called only by the account defined in constructor: DEFAULT_ADMIN_ROLE
    revokeRole(MONITOR_ROLE, monitorAddress);
    return true;
  }

  /**
   * @dev This function update the fee percentage bridge.
   *
   * Only owner can call it.
   *
   * Can not be called if the Bridge is paused.
   *
   * Parameters: integer, the new fee
   *
   * Returns: bool - true if it is sucessful
   *
   * Requirements:
   * - The new fee must be lower than 10% .
   *
   * Emit the event `FeePercentageBridgeChanged(oldFee, newFee)`.
   *
   */
  function setFeePercentageBridge(uint256 newFee)
    external
    onlyOwner
    whenNotPaused
    returns (bool)
  {
    require(newFee < (DECIMALPERCENT / 10), "Bridge: bigger than 10%");
    emit FeePercentageBridgeChanged(feePercentageBridge, newFee);
    feePercentageBridge = newFee;
    return true;
  }

  /**
   * @dev Returns the fee percentage bridge.
   *
   * For each amount received in the bridge, a fee percentage is discounted.
   * This function returns this fee percentage bridge.
   *
   * Parameters: none
   *
   * Returns: integer
   *
   */
  function getFeePercentageBridge() external view override returns (uint256) {
    return feePercentageBridge;
  }

  /**
   * @dev This function update the BRZ token.
   *
   * Only owner can call it.
   *
   * Can not be called if the Bridge is paused.
   *
   * Parameters: address of new BRZ token
   *
   * Returns: bool - true if it is sucessful
   *
   * Requirements:
   * - The token address must not be a zero address.
   *
   * Emit the event `TokenChanged(tokenAddress)`.
   *
   */
  function setToken(address tokenAddress)
    external
    onlyOwner
    whenNotPaused
    returns (bool)
  {
    require(tokenAddress != ZERO_ADDRESS, "Bridge: zero address");
    emit TokenChanged(tokenAddress);
    token = IERC20(tokenAddress);
    return true;
  }

  /**
   * @dev Returns total of fees received by bridge.
   *
   * Parameters: none
   *
   * Returns: integer
   *
   */
  function getTotalFeeReceivedBridge()
    external
    view
    override
    returns (uint256)
  {
    return totalFeeReceivedBridge;
  }

  /**
   * @dev Returns token balance in bridge.
   *
   * Parameters: none
   *
   * Returns: integer amount of tokens in bridge
   *
   */
  function getTokenBalance() external view override returns (uint256) {
    return token.balanceOf(address(this));
  }

  /**
   * @dev Withdraw tokens from bridge
   *
   * Only owner can call it.
   *
   * Can be called even if the Bridge is paused,
   * because can happens a problem and it is necessary to withdraw tokens,
   * maybe to create a new version of bridge, for example.
   *
   * The tokens only can be sent to the caller's function.
   *
   * Parameters: integer amount of tokens
   *
   * Returns: true if it is successful
   *
   * Requirements:
   * - amount less or equal balance of tokens in bridge.
   *
   */
  function withdrawToken(uint256 amount) external onlyOwner returns (bool) {
    require(
      amount <= token.balanceOf(address(this)),
      "Bridge: insuficient balance"
    );
    token.transfer(_msgSender(), amount);
    return true;
  }

  /**
   * @dev Returns if a blockchain is in the list of allowed blockchains to cross tokens using the bridge.
   *
   * Parameters: string name of blockchain
   *
   * Returns: boolean true if it is in the list
   *
   */
  function existsBlockchain(string memory name)
    public
    view
    override
    returns (bool)
  {
    for (uint8 i = 0; i < blockchain.length; i++) {
      if (compareStrings(name, blockchain[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * @dev List of blockchains allowed to cross tokens using the bridge.
   *
   * Parameters: none
   *
   * Returns: an array of strings containing the blockchain list
   *
   */
  function listBlockchain() external view override returns (string[] memory) {
    return blockchain;
  }

  /**
   * @dev This function include a new blockchain in the list of allowed blockchains used in the bridge.
   *
   * Only owner can call it.
   *
   * Can not be called if the Bridge is paused.
   *
   * Parameters: string name of blockchain to be added
   *
   * Returns: index of blockchain in the array
   *
   * Requirements:
   * - blockchain not exists.
   *
   */
  function addBlockchain(string memory name)
    external
    onlyOwner
    whenNotPaused
    returns (uint256)
  {
    require(!existsBlockchain(name), "Bridge: blockchain already exists");
    blockchain.push(name);
    return (blockchain.length - 1);
  }

  /**
   * @dev This function exclude a blockchain in the list of allowed blockchains used in the bridge.
   *
   * Only owner can call it.
   *
   * Can not be called if the Bridge is paused.
   *
   * Parameters: string name of blockchain to be excluded
   *
   * Returns: bool - true if it is sucessful
   *
   * Requirements:
   * - blockchain exists.
   * - there must be at least one blockchain left.
   *
   */
  function delBlockchain(string memory name)
    external
    onlyOwner
    whenNotPaused
    returns (bool)
  {
    require(existsBlockchain(name), "Bridge: blockchain not exists");
    require(blockchain.length > 1, "Bridge: requires at least 1 blockchain");

    uint256 index;
    for (uint256 i = 0; i < blockchain.length; i++) {
      if (compareStrings(name, blockchain[i])) {
        index = i;
        break;
      }
    }
    blockchain[index] = blockchain[blockchain.length - 1];
    blockchain.pop();
    return true;
  }

  /**
   * @dev This function pauses the bridge.
   *
   * Only owner can call it.
   *
   * Parameters: none
   *
   * Returns: none
   *
   * Requirements:
   *
   * - The contract must not be paused.
   *
   */
  function pause() external onlyOwner {
    /**
     * @dev See {Pausable-_pause}.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    _pause();
  }

  /**
  * @dev This function unpauses the bridge.
  *
  * Only owner can call it.
  * 
  * Parameters: none
  *
  * Returns: none
  *
  * Requirements:
  *
  * - The contract must be paused.
  &  
  */
  function unpause() external onlyOwner {
    /**
     * @dev See {Pausable-_unpause}.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    _unpause();
  }
}
