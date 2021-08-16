// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "./ozeppelin/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract BRZToken is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("BRZ", "BRZ") {
    }
}
