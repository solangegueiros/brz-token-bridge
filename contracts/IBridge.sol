// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "./ozeppelin/token/ERC20/IERC20.sol";

interface IBridge {

  function version() external pure returns (string memory);

  function getfeePercentageBridge() external view returns(uint);
  function gettotalFeeReceived() external view returns (uint);
  function getTokenBalance() external view returns (uint);

  function receiveTokens(uint amount, uint[2] calldata transactionFee, string calldata toBlockchain, string calldata toAddress) external returns(bool);

  function acceptTransfer(
    address receiver,
    uint256 amount,
    string calldata sender,
    string calldata toBlockchain,
    bytes32[2] calldata hashes, //blockHash, transactionHash
    uint32 logIndex) external returns(bool);

  function getTransactionId(    
    bytes32[2] calldata hashes, //blockHash, transactionHash
    address _receiver,
    uint256 _amount,
    uint32 _logIndex) external returns(bytes32);

  function existsBlockchain(string calldata name) external view returns (bool);
  function listBlockchain() external view returns (string[] memory);

  event CrossRequest(address _from, uint256 _amount, uint256 _toFee, string _toAddress, string _toBlockchain);
  event feePercentageBridgeChanged(uint _oldFee, uint _newFee);
  event TokenChanged(address _tokenAddress);

}
