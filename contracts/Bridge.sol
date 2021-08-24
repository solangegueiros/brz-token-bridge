// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

// Inpired on https://github.com/rsksmart/tokenbridge/blob/master/bridge/contracts/Bridge.sol

import './ozeppelin/access/AccessControl.sol';
import "./ozeppelin/security/Pausable.sol";
import "./ozeppelin/utils/math/SafeMath.sol";
import "./IBridge.sol";

contract Bridge is AccessControl, IBridge, Pausable {
  using SafeMath for uint256;

  address constant private NULL_ADDRESS = address(0);
  bytes32 constant private NULL_HASH = bytes32(0);
  bytes32 constant public MONITOR_ROLE = keccak256("MONITOR_ROLE");

  uint256 public constant decimalpercent = 10000; //100.00 = percentage accuracy (2) to 100%

  IERC20 public token;
  uint private totalFeeReceived;
  uint private feePercentageBridge; //Include 2 decimal places
  string[] public blockchain;
  mapping(bytes32 => bool) public processed;

  constructor(address _tokenAddress) {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    token = IERC20(_tokenAddress);
  }

  function version() external override pure returns (string memory) {
      return "v0";
  }

  modifier onlyOwner() {
    require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Bridge: not owner");
    _;
  }

  modifier onlyMonitor() {
    require(hasRole(MONITOR_ROLE, _msgSender()), "Bridge: not monitor");
    _;
  }


  function compareStrings(string memory a, string memory b) private pure returns (bool) {
      return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
  }

  function receiveTokens(uint amount, uint[2] memory transactionFee, string memory toBlockchain, string memory toAddress) external override returns(bool) {
    return _receiveTokens(amount, transactionFee, toBlockchain, toAddress);
  }

  /**
    * ERC-20 tokens approve and transferFrom pattern
    * See https://eips.ethereum.org/EIPS/eip-20#transferfrom
    */
  function _receiveTokens(
      uint256 amount, uint[2] memory transactionFee,
      string memory toBlockchain, string memory toAddress
  ) private whenNotPaused returns(bool) {

    // transactionFee[0] - fee in BRL
    // transactionFee[1] - fee in destiny currency - minor unit 
    
    // if(transactionFee > 0) {
    //   //token.transfer(owner(), fee);
    //   totalFeeReceived.add(fee);
    // }  

    //Transfer the tokens on IERC20, they should be already Approved for the bridge Address to use them
    uint totalAmount = amount.add(transactionFee[0]); 
    token.transferFrom(_msgSender(), address(this), totalAmount);

    uint fee = amount.mul(feePercentageBridge).div(decimalpercent);
    uint256 amountMinusFees = amount.sub(fee);

    if(fee > 0) {
      //token.transfer(owner(), fee);
      totalFeeReceived.add(fee);
    }

    //This is the message for Monitor off-chain manage the transaction and send the tokens on the other Blockchain
    emit CrossRequest(_msgSender(), amountMinusFees, transactionFee[1], toAddress, toBlockchain); 
    return true;
  }

  function acceptTransfer(
    address receiver,
    uint256 amount,
    string calldata sender,
    string calldata toBlockchain,
    bytes32[2] calldata hashes, //blockHash, transactionHash
    uint32 logIndex
  ) external override returns(bool) {
    return _acceptTransfer(receiver, amount, sender, toBlockchain, hashes, logIndex);
  }

  function _acceptTransfer(
    address receiver,
    uint256 amount,
    string memory sender,
    string memory toBlockchain,
    bytes32[2] calldata hashes, //blockHash, transactionHash
    uint32 logIndex
  ) internal onlyMonitor whenNotPaused returns(bool) {
    require(receiver != NULL_ADDRESS, "Bridge: receiver is null");
    require(amount > 0, "Bridge: amount is 0");
    require(bytes(sender).length > 0, "Bridge: no sender");
    require(bytes(toBlockchain).length > 0, "Bridge: no blockchain");
    require(hashes[0] != NULL_HASH, "Bridge: blockHash is null");
    require(hashes[1] != NULL_HASH, "Bridge: transactionHash is null");

    _processTransaction(hashes, receiver, amount, logIndex);
    _sendToken(receiver, amount);

    return true;
  }
  
  function _sendToken(address to, uint amount) internal onlyMonitor whenNotPaused returns (bool) {    
    require (token.balanceOf(address(this)) >= amount, "Bridge: no balance");
    token.transfer(to, amount);
    return true;
  }

  function getTransactionId(
    bytes32[2] calldata _hashes, //blockHash, transactionHash
    address _receiver,
    uint256 _amount,
    uint32 _logIndex
  ) public override pure returns(bytes32) {
    return keccak256(abi.encodePacked(_hashes[0], _hashes[1], _receiver, _amount, _logIndex));
  }

  function _processTransaction(
    bytes32[2] calldata _hashes, //blockHash, transactionHash
    address _receiver,
    uint256 _amount,
    uint32 _logIndex
  ) private {
    bytes32 transactionId = getTransactionId(_hashes, _receiver, _amount, _logIndex);
    require(!processed[transactionId], "Bridge: already processed");
    processed[transactionId] = true;
  }

  function addMonitor(address _monitorAddress) external onlyOwner whenNotPaused returns (bool) {
    //Can be called only by the account defined in constructor: DEFAULT_ADMIN_ROLE
    grantRole(MONITOR_ROLE, _monitorAddress);
    return true;
  }

  function delMonitor(address _monitorAddress) external onlyOwner whenNotPaused returns (bool) {
    //Can be called only by the account defined in constructor: DEFAULT_ADMIN_ROLE
    revokeRole(MONITOR_ROLE, _monitorAddress);
    return true;
  }

  function setfeePercentageBridge(uint newFee) external onlyOwner whenNotPaused returns (bool) {
    require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Bridge: not admin");
    require(newFee < (decimalpercent/10), "Bridge: bigger than 10%");
    emit feePercentageBridgeChanged(feePercentageBridge, newFee);
    feePercentageBridge = newFee;
    return true;
  }

  function getfeePercentageBridge() external override view returns(uint) {
      return feePercentageBridge;
  }

  function setToken(address _tokenAddress) external onlyOwner whenNotPaused returns (bool) {
    require(_tokenAddress != NULL_ADDRESS, "Bridge: null address");
    token = IERC20(_tokenAddress);
    emit TokenChanged(_tokenAddress);
    return true;
  }

  function gettotalFeeReceived() external override view returns(uint) {
      return totalFeeReceived;
  }

  function getTokenBalance() external override view returns (uint) {
    return token.balanceOf(address(this));
  }

  function withdrawToken(uint amount) external onlyOwner returns (bool) {
    require (amount <= token.balanceOf(address(this)), "Bridge: insuficient balance");
    token.transfer(_msgSender(), amount);
    return true;
  }

  function existsBlockchain(string memory name) public override view returns (bool) {
    for (uint8 i=0; i < blockchain.length; i++) {
      if (compareStrings(name, blockchain[i])) {
        return true;
      }
    }
    return false;
  }

  function listBlockchain() external override view returns (string[] memory) {
    return blockchain;
  }

  function addBlockchain(string memory name) external onlyOwner whenNotPaused returns (uint) {
    require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Bridge: not admin");
    require(!existsBlockchain(name), "Bridge: blockchain already exists");    
    blockchain.push(name);
    return (blockchain.length - 1);
  }

  function delBlockchain(string memory name) external onlyOwner whenNotPaused returns (bool) {
    require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Bridge: not admin");
    require(existsBlockchain(name), "Bridge: blockchain not exists");
    require(blockchain.length > 1, "Bridge: requires at least 1 blockchain");

    uint index;

    for (uint i = 0; i < blockchain.length; i++) {
      if (compareStrings(name, blockchain[i])) {
        index = i;
        break;
      }      
    }

    blockchain[index] = blockchain[blockchain.length - 1];
    blockchain.pop();
    return true;
  }

}