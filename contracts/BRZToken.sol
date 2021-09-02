// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

// Used only for test purposes, this is NOT the BRZ token alredy published

// ERC20PresetMinterPauser.sol :  https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.1.0/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol
import "./ozeppelin/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract BRZToken is ERC20PresetMinterPauser {
  constructor() ERC20PresetMinterPauser("BRZ", "BRZ") {}
}
