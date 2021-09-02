// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

// IERC20.sol :  https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.1.0/contracts/token/ERC20/IERC20.sol
import "./ozeppelin/token/ERC20/IERC20.sol";

interface IBridge {
  function version() external pure returns (string memory);

  function getFeePercentageBridge() external view returns (uint256);

  function getTotalFeeReceivedBridge() external view returns (uint256);

  function getTokenBalance() external view returns (uint256);

  function receiveTokens(
    uint256 amount,
    uint256[2] calldata transactionFee,
    string calldata toBlockchain,
    string calldata toAddress
  ) external returns (bool);

  function acceptTransfer(
    address receiver,
    uint256 amount,
    string calldata sender,
    string calldata fromBlockchain,
    bytes32[2] calldata hashes, //blockHash, transactionHash
    uint32 logIndex
  ) external returns (bool);

  function getTransactionId(
    bytes32[2] calldata hashes, //blockHash, transactionHash
    address receiver,
    uint256 amount,
    uint32 logIndex
  ) external returns (bytes32);

  function existsBlockchain(string calldata name) external view returns (bool);

  function listBlockchain() external view returns (string[] memory);

  event CrossRequest(
    address from,
    uint256 amount,
    uint256 toFee,
    string toAddress,
    string toBlockchain
  );
  event FeePercentageBridgeChanged(uint256 oldFee, uint256 newFee);
  event TokenChanged(address tokenAddress);
}
