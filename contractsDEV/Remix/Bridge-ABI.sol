// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;



abstract contract InterfaceBridge {

  address public token;
  bytes32 public MONITOR_ROLE;

  function setToken(address _tokenAddress) external virtual returns (bool);

  function addMonitor(address _monitorAddress) external virtual returns (bool);

  function hasRole(bytes32 role, address account) external virtual returns (bool);

}
