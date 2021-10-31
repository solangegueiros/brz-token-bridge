// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/// @title BRZ token Bridge
/// @author Solange Gueiros

// Inpired on
// https://github.com/rsksmart/tokenbridge/blob/master/bridge/contracts/Bridge.sol
// https://github.com/DistributedCollective/Bridge-SC/blob/master/sovryn-token-bridge/bridge/contracts/Bridge_v3.sol

// AccessControl.sol :  https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.1.0/contracts/access/AccessControl.sol
// Pausable.sol :       https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.1.0/contracts/security/Pausable.sol
import "./ozeppelin/access/AccessControl.sol";
import "./ozeppelin/security/Pausable.sol";
import "./IBridge.sol";

struct BlockchainStruct {
  uint256 minTokenAmount;
  uint256 minBRZFee;      // quoteETH_BRZ * gasAcceptTransfer * minGasPrice
  uint256 minGasPrice;    // in Wei
  bool checkAddress;         // to verify is an address is EVM compatible is this blockchain
}

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
  address private constant ZERO_ADDRESS = address(0);
  bytes32 private constant NULL_HASH = bytes32(0);
  bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");
  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

  /**
   * @dev DECIMALPERCENT is the representation of 100% using (2) decimal places
   * 100.00 = percentage accuracy (2) to 100%
   */
  uint256 public constant DECIMALPERCENT = 10000;

  IERC20 public token;
  uint256 public totalFeeReceivedBridge; // fee received per Bridge, not for transaction in other blockchain

  /**
   * @dev Fee percentage bridge.
   *
   * For each amount received in the bridge, a fee percentage is discounted.
   * This function returns this fee percentage bridge.
   * Include 2 decimal places.
   */
  uint256 public feePercentageBridge;

  /**
   * Estimative for function acceptTransfer: 100000 wei, it can change in EVM cost updates
   *
   * It is used to calculate minBRZFee in destination,
   * which can not accept a BRZ fee less than minBRZFee (per blockchain).
   */
  uint256 public gasAcceptTransfer; 

  /**
   * @dev the quote of pair ETH / BRZ.
   *
   * (1 ETH = the amount of BRZ returned)
   *
   * in BRZ in minor unit (4 decimal places).
   *
   * It is used to calculate minBRZFee in destination
   * which can not accept a BRZ fee less than minBRZFee (per blockchain).
   *
   */ 
  uint256 public quoteETH_BRZ;

  mapping(bytes32 => bool) public processed;
  mapping(string => uint256) private blockchainIndex;
  BlockchainStruct[] private blockchainInfo;
  string[] public blockchain;

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
    gasAcceptTransfer = 100000; //Estimative function acceptTransfer: 100000 wei
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
    require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "not owner");
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
    require(hasRole(MONITOR_ROLE, _msgSender()), "not monitor");
    _;
  }

  /**
   * @dev Modifier which verifies if the caller is a monitor,
   * it means he has the role `ADMIN_ROLE`.
   *
   * Role ADMIN are referred to its `bytes32` identifier,
   * defined in the `public constant` called ADMIN_ROLE.
   * It should be exposed in the external API and be unique.
   *
   * Role ADMIN is used to manage the permissions for update minimum fee per blockchain.
   */
  modifier onlyAdmin() {
    require(hasRole(ADMIN_ROLE, _msgSender()), "not admin");
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
   *   - The Bridge fee will be deducted from this amount.
   * - transactionFee - array with the fees:
   *   - transactionFee[0] - fee in BRL - this fee will be added to amount transfered from caller's account.
   *   - transactionFee[1] - gas price for fee in destiny currency(minor unit) - this information will be
   *      used in the destination Blockchain,
   *      by the monitor who will create the transaction and send using this fee defined here.
   * - toBlockchain - the amount will be sent to this blockchain.
   * - toAddress - the amount will be sent to this address. It can be diferent from caller's address.
   * This is a string because some blockchain could not have the same pattern from Ethereum / RSK / BSC.
   *
   * Returns: bool - true if it is sucessful.
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
   * - fee in BRZ (transactionFee[0]) must be at least (BRZFactorFee[blockchainName] * minGasPrice[toBlockchain]).
   * - gasPrice (transactionFee[1]) in destiny blockchain (minor unit) greater than minGasPrice in toBlockchain.
   * - toBlockchain exists.
   * - toAddress is not an empty string.
   * - amount must be greater than minTokenAmount in toBlockchain.
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
   *   - toFee - the gas price fee, which must be used to send the transfer transaction in the destination blockchain.
   *   - toAddress - string representing the address which will receive the tokens.
   *   - toBlockchain - the destination blockchain.
   *
   * > The `CrossRequest` event is very important because it must be listened by the monitor,
   * an external program which will
   * send the transaction on the destination blockchain.
   *
   * #### More info about fees
   *
   * - Blockchain / transaction fee in BRL (transactionFee[0])
   * It will be transfered from user's account,
   * along with the amount he would like to receive in the account.
   *
   * This will be spent in `toBlockchain`.
   * Does not depend of amount, but of destination blockchain.
   *
   * It must be at least the minBRZFee per blockchain.
   *
   * It is used in the function acceptTransfer,
   * which can not accept a BRZ fee less than minBRZFee (per blockchain).
   *
   * - gas price (transactionFee[1])
   * It must be at least the minGasPrice per blockchain.
   *
   * - Bridge Fee - it is deducted from the requested amount.
   * It is a percentage of the requested amount.
   * Cannot include the transaction fee in order to be calculated.
   *
   */
  function receiveTokens(
    uint256 amount,
    uint256[2] memory transactionFee,
    string memory toBlockchain,
    string memory toAddress
  ) external override whenNotPaused returns (bool) {
    require(existsBlockchain(toBlockchain), "toBlockchain not exists");
    require(!compareStrings(toAddress, ""), "toAddress is null");

    uint256 index = blockchainIndex[toBlockchain]-1;
    require(
      transactionFee[0] >= blockchainInfo[index].minBRZFee,
      "feeBRZ is less than minimum"
    );
    require(
      transactionFee[1] >= blockchainInfo[index].minGasPrice,
      "gasPrice is less than minimum"
    );
    require(amount > 0, "amount is 0");
    require(
      amount >= blockchainInfo[index].minTokenAmount,
      "amount is less than minimum"
    );
    if (blockchainInfo[index].checkAddress) {
      require(
        bytes(toAddress).length == 42,
        "invalid destination address"
      );     
    }

    //The total amount is the amount desired plus the blockchain fee to destination, in the token unit
    uint256 totalAmount = amount + transactionFee[0];

    //Bridge fee or service fee
    uint256 bridgeFee = (amount * feePercentageBridge) / DECIMALPERCENT;
    uint256 amountMinusFees = amount - bridgeFee;
    totalFeeReceivedBridge += bridgeFee;

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
   * - sender - address who sent the transaction `receiveTokens`, it is a string to be compatible with any blockchain.
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
  ) private {
    bytes32 transactionId = getTransactionId(
      hashes,
      receiver,
      amount,
      logIndex
    );
    require(!processed[transactionId], "processed");
    processed[transactionId] = true;
  }

  /**
   * @dev This function transfer tokens from the the internal balance of bridge smart contract
   * to the internal balance of the destination address.
   *
   * The token.balanceOf(bridgeAddress) must always be greather than or equal the total amount to be claimed by users,
   * as there may be tokens not yet claimed.
   *
   * Can not be called if the Bridge is paused.
   *
   * > Only monitor can call it!
   *
   */
  function _sendToken(address to, uint256 amount)
    private
    returns (bool)
  {
    require(
      token.balanceOf(address(this)) >= amount,
      "insufficient balance"
    );
    token.transfer(to, amount);
    return true;
  }

  /**
   * @dev This function accept the cross of token,
   * which means it is called in the destination blockchain,
   * who will send the tokens accepted to be crossed.
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
    string calldata fromBlockchain,
    bytes32[2] calldata hashes, //blockHash, transactionHash
    uint32 logIndex
  ) external override onlyMonitor whenNotPaused returns (bool) {
    require(receiver != ZERO_ADDRESS, "receiver is zero");
    require(amount > 0, "amount is 0");
    require(
      existsBlockchain(fromBlockchain),
      "fromBlockchain not exists"
    );
    require(hashes[0] != NULL_HASH, "blockHash is null");
    require(hashes[1] != NULL_HASH, "transactionHash is null");

    _processTransaction(hashes, receiver, amount, logIndex);
    _sendToken(receiver, amount);
    return true;
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
      "insuficient balance"
    );
    token.transfer(_msgSender(), amount);
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
  function addMonitor(address account)
    external
    onlyOwner
    whenNotPaused
    returns (bool)
  {
    require(!hasRole(ADMIN_ROLE, account), "is admin");
    grantRole(MONITOR_ROLE, account);
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
  function delMonitor(address account)
    external
    onlyOwner
    whenNotPaused
    returns (bool)
  {
    //Can be called only by the account defined in constructor: DEFAULT_ADMIN_ROLE
    revokeRole(MONITOR_ROLE, account);
    return true;
  }

  /**
   * @dev This function add an address in the `ADMIN_ROLE`.
   *
   * Only owner can call it.
   *
   * Can not be called if the Bridge is paused.
   *
   * Parameters: address of admin to be added
   *
   * Returns: bool - true if it is sucessful
   *
   */
  function addAdmin(address account)
    external
    onlyOwner
    whenNotPaused
    returns (bool)
  {
    require(!hasRole(MONITOR_ROLE, account), "is monitor");
    grantRole(ADMIN_ROLE, account);
    return true;
  }

  /**
   * @dev This function excludes an address in the `ADMIN_ROLE`.
   *
   * Only owner can call it.
   *
   * Can not be called if the Bridge is paused.
   *
   * Parameters: address of admin to be excluded
   *
   * Returns: bool - true if it is sucessful
   *
   */
  function delAdmin(address account)
    external
    onlyOwner
    whenNotPaused
    returns (bool)
  {
    //Can be called only by the account defined in constructor: DEFAULT_ADMIN_ROLE
    revokeRole(ADMIN_ROLE, account);
    return true;
  }

  /**
   * @dev This function allows a user to renounce a role
   *
   * Parameters: bytes32 role, address account
   *
   * Returns: none
   *
   * Requirements:
   *
   * - An owner can not renounce the role DEFAULT_ADMIN_ROLE.
   * - Can only renounce roles for your own account.
   *
   */
  function renounceRole(bytes32 role, address account) public virtual override {
    require(role != DEFAULT_ADMIN_ROLE, "can not renounce role owner");
    require(
      account == _msgSender(),
      "can only renounce roles for self"
    );
    super.renounceRole(role, account);
  }

  /**
   * @dev This function allows to revoke a role
   *
   * Parameters: bytes32 role, address account
   *
   * Returns: none
   *
   * Requirements:
   *
   * - An owner can not revoke yourself in the role DEFAULT_ADMIN_ROLE.
   *
   */
  function revokeRole(bytes32 role, address account)
    public
    virtual
    override
    onlyRole(getRoleAdmin(role))
  {
    if (role == DEFAULT_ADMIN_ROLE) {
      require(
        account != _msgSender(),
        "can not revoke yourself in role owner"
      );
    }
    super.revokeRole(role, account);
  }

  /**
   * @dev This function update the minimum blockchain fee - gas price - in the minor unit.
   *
   * It is an internal function, called when quoteETH_BRZ, gasAcceptTransfer
   *
   * Returns: bool - true if it is sucessful
   *
   * Emit the event `MinBRZFeeChanged(blockchain, oldFee, newFee)`.
   *
   */
  function _updateMinBRZFee()
    internal
    returns (bool)
  {
    for (uint8 i = 0; i < blockchainInfo.length; i++) {
      if (blockchainInfo[i].minGasPrice > 0) {
        uint256 newFee = (gasAcceptTransfer *
          blockchainInfo[i].minGasPrice *
          quoteETH_BRZ) / (1 ether);
        emit MinBRZFeeChanged(
          blockchain[i],
          blockchainInfo[i].minBRZFee,
          newFee
        );
        blockchainInfo[i].minBRZFee = newFee;
      }
    }
    return true;
  }

  /**
   * @dev This function update quote of pair ETH / BRZ.
   *
   * (1 ETH = the amount of BRZ defined)
   *
   * Only admin can call it.
   *
   * Each time quoteETH_BRZ is updated, the MinBRZFee is updated too.
   *
   * Parameters: integer, the new quote
   *
   * Returns: bool - true if it is sucessful
   *
   * Emit the event `QuoteETH_BRZChanged(oldValue, newValue)`.
   *
   */
  function setQuoteETH_BRZ(uint256 newValue) public onlyAdmin returns (bool) {
    emit QuoteETH_BRZChanged(quoteETH_BRZ, newValue);
    quoteETH_BRZ = newValue;
    require(_updateMinBRZFee(), "updateMinBRZFee error");
    return true;
  }

  /**
   * @dev Returns the minimum gas price to cross tokens.
   *
   * The function acceptTransfer can not accept less than the minimum gas price per blockchain.
   *
   * Parameters: string, blockchain name
   *
   * Returns: integer
   *
   */
  function getMinGasPrice(string memory blockchainName)
    external
    view
    override
    returns (uint256)
  {
    return blockchainInfo[blockchainIndex[blockchainName]-1].minGasPrice;
  }

  /**
   * @dev This function update the minimum blockchain fee - gas price - in the minor unit.
   *
   * Each time setMinGasPrice is updated, the MinBRZFee is updated too.
   *
   * Only admin can call it.
   *
   * Can not be called if the Bridge is paused.
   *
   * Parameters: integer, the new fee
   *
   * Returns: bool - true if it is sucessful
   *
   * Requirements:
   * - blockchain must exists.
   *
   * Emit the event `MinGasPriceChanged(blockchain, oldFee, newFee)`.
   *
   */
  function setMinGasPrice(string memory blockchainName, uint256 newFee)
    public
    onlyAdmin
    whenNotPaused
    returns (bool)
  {
    require(existsBlockchain(blockchainName), "blockchain not exists");
    uint256 index = blockchainIndex[blockchainName]-1;
    emit MinGasPriceChanged(
      blockchainName,
      blockchainInfo[index].minGasPrice,
      newFee
    );
    blockchainInfo[index].minGasPrice = newFee;
    blockchainInfo[index].minBRZFee = (gasAcceptTransfer * newFee * quoteETH_BRZ) / (1 ether);
    return true;
  }

  /**
   * @dev Returns the minimum destination blockchain fee in BRZ,
   * in minor unit (4 decimal places)
   *
   * It is updated when one of these itens be updated:
   *  - gasAcceptTransfer
   *  - quoteETH_BRZ
   *  - minGasPrice per Blockchain
   *
   * It is used in the function acceptTransfer,
   * which can not accept a BRZ fee less than minBRZFee (per blockchain).
   *
   * Parameters: string, blockchain name
   *
   * Returns: integer
   *
   */
  function getMinBRZFee(string memory blockchainName)
    external
    view
    override
    returns (uint256)
  {
    return blockchainInfo[blockchainIndex[blockchainName]-1].minBRZFee;
  }

  /**
   * @dev This function update the estimative of the gas amount used in function AcceptTransfer.
   *
   * It will only change if happen some EVM cost update.
   *
   * Only owner can call it.
   *
   * Each time gasAcceptTransfer is updated, the MinBRZFee is updated too.
   *
   * Parameters: integer, the new gas amount
   *
   * Returns: bool - true if it is sucessful
   *
   * Emit the event `GasAcceptTransferChanged(oldValue, newValue)`.
   *
   */
  function setGasAcceptTransfer(uint256 newValue)
    public
    onlyOwner
    returns (bool)
  {
    emit GasAcceptTransferChanged(gasAcceptTransfer, newValue);
    gasAcceptTransfer = newValue;
    require(_updateMinBRZFee(), "updateMinBRZFee error");
    return true;
  }

  /**
   * @dev Returns the minimum token amount to cross.
   *
   * The function acceptTransfer can not accpept less than the minimum per blockchain.
   *
   * Parameters: string, blockchain name
   *
   * Returns: integer
   *
   */
  function getMinTokenAmount(string memory blockchainName)
    external
    view
    override
    returns (uint256)
  {    
    return blockchainInfo[blockchainIndex[blockchainName]-1].minTokenAmount;
  }

  /**
   * @dev This function update the minimum token's amount to be crossed.
   *
   * Only admin can call it.
   *
   * Can not be called if the Bridge is paused.
   *
   * Parameters: integer, the new amount
   *
   * Returns: bool - true if it is sucessful
   *
   * Requirements:
   * - blockchain must exists.
   *
   * Emit the event `MinTokenAmountChanged(blockchain, oldMinimumAmount, newMinimumAmount)`.
   *
   */
  function setMinTokenAmount(string memory blockchainName, uint256 newAmount)
    public
    onlyAdmin
    whenNotPaused
    returns (bool)
  {
    require(existsBlockchain(blockchainName), "blockchain not exists");
    uint256 index = blockchainIndex[blockchainName]-1;    
    emit MinTokenAmountChanged(
      blockchainName,
      blockchainInfo[index].minTokenAmount,
      newAmount
    );
    blockchainInfo[index].minTokenAmount = newAmount;
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
    require(newFee < (DECIMALPERCENT / 10), "bigger than 10%");
    emit FeePercentageBridgeChanged(feePercentageBridge, newFee);
    feePercentageBridge = newFee;
    return true;
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
    require(tokenAddress != ZERO_ADDRESS, "zero address");
    emit TokenChanged(tokenAddress);
    token = IERC20(tokenAddress);
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
    if (blockchainIndex[name] == 0)
        return false;
    else
        return true;
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
   * Parameters: 
   * - string name of blockchain to be added
   * - minGasPrice
   * - minTokenAmount
   * - check address EVM compatible
   *
   * Returns: index of blockchain.
   *
   * Important: 
   * - index start in 1, not 0.
   * - index 0 means that the blockchain does no exist.
   * - index 1 means that it is the position 0 in the array.
   *
   * Requirements:
   * - blockchain not exists.
   * - onlyOwner
   * - whenNotPaused
   */
  function addBlockchain(string memory name, uint256 minGasPrice, uint256 minTokenAmount, bool checkAddress)
    external
    onlyOwner
    whenNotPaused
    returns (uint256)
  {
    require(!existsBlockchain(name), "blockchain exists");

    BlockchainStruct memory b;
    b.minGasPrice = minGasPrice;
    b.minTokenAmount = minTokenAmount;
    b.minBRZFee = (gasAcceptTransfer * minGasPrice * quoteETH_BRZ) / (1 ether);
    b.checkAddress = checkAddress;
    blockchainInfo.push(b);
    blockchain.push(name);
    uint256 index = blockchainInfo.length;
    blockchainIndex[name] = index;
    return (index);
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
    require(existsBlockchain(name), "blockchain not exists");
    require(blockchainInfo.length > 1, "requires at least 1 blockchain");

    uint256 indexToDelete = blockchainIndex[name]-1;
    uint256 indexToMove = blockchainInfo.length-1;
    //string memory keyToMove = blockchainInfo[indexToMove].name;
    string memory keyToMove = blockchain[indexToMove];

    blockchainInfo[indexToDelete] = blockchainInfo[indexToMove];
    blockchain[indexToDelete] = blockchain[indexToMove];
    blockchainIndex[keyToMove] = indexToDelete+1;

    delete blockchainIndex[name];
    blockchainInfo.pop();
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
