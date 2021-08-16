// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

// Inspired on https://github.com/rsksmart/tokenbridge/blob/master/bridge/contracts/Federation.sol

import './ozeppelin/access/AccessControlEnumerable.sol';

import "./IBridge.sol";

// Process transactions from Bridge with event CrossRequest

contract Monitor is AccessControlEnumerable {

  address constant private NULL_ADDRESS = address(0);
  uint constant public MAX_MEMBER_COUNT = 50;
  bytes32 constant public MONITOR_ROLE = keccak256("MONITOR_ROLE");

  IBridge public bridge;
  uint public required;

  mapping (bytes32 => mapping (address => bool)) public votes;
  mapping (bytes32 => uint) public countVotes;
  mapping(bytes32 => bool) public processed;

  event Voted(address indexed member, bytes32 indexed transactionId, address sender, uint256 amount, string receiver, string blockchain, bytes32 blockHash, bytes32 indexed transactionHash, uint32 logIndex);
  event Executed(bytes32 indexed transactionId);
  event MemberAdded(address indexed member);
  event MemberDeleted(address indexed member);
  event RequirementChanged(uint oldRequired, uint newRequired);
  event BridgeChanged(address bridge);

  modifier onlyOwner() {
    require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Monitor: not owner");
    _;
  }

  modifier onlyMember() {
    require(hasRole(MONITOR_ROLE, _msgSender()), "Monitor: not member");
    _;
  }

  modifier validRequirement(uint _membersCount, uint _required) {
    require(_required <= _membersCount && _required != 0 && _membersCount != 0, "Monitor: invalid requirements");
    _;
  }

  constructor(address[] memory _members, uint _required) validRequirement(_members.length, _required) {
    require(_members.length <= MAX_MEMBER_COUNT, "Monitor: members larger than max allowed");
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

    for (uint i = 0; i < _members.length; i++) {
      require(!hasRole(MONITOR_ROLE, _members[i]), "Monitor: invalid member");
      require(_members[i] != NULL_ADDRESS, "Monitor: null member");
      _setupRole(MONITOR_ROLE, _members[i]);
      emit MemberAdded(_members[i]);
    }
    required = _required;
    emit RequirementChanged(0, required);
  }

  function setBridge(address _bridge) public onlyOwner {
    require(_bridge != NULL_ADDRESS, "Monitor: bridge null address");
    bridge = IBridge(_bridge);
    emit BridgeChanged(_bridge);
  }

  function voteTransaction(
    address sender,
    uint256 amount,
    string[2] calldata receiver, // receiverAddress, blockchain
    bytes32[2] calldata hashes, //blockHash, transactionHash
    uint32 logIndex)
  external returns(bool) {
    return _voteTransaction(sender, amount, receiver, hashes, logIndex);
  }

  function _voteTransaction(
    address sender,
    uint256 amount,
    string[2] calldata receiver, // receiverAddress, blockchain
    bytes32[2] calldata hashes, //blockHash, transactionHash
    uint32 logIndex
  ) internal onlyMember returns(bool) {
    bytes32 transactionId = getTransactionId(sender, amount, receiver, hashes, logIndex);
    if (processed[transactionId])
      return true;

    if (votes[transactionId][_msgSender()])
      return true;

    votes[transactionId][_msgSender()] = true;
    countVotes[transactionId] = countVotes[transactionId] ++;
    emit Voted(_msgSender(), transactionId, sender, amount, receiver[0], receiver[1], hashes[0], hashes[1], logIndex);

    uint transactionCount = countVotes[transactionId];
    if (transactionCount >= required && transactionCount >= getMemberCount() / 2 + 1) {
      processed[transactionId] = true;
      address receiverAddress = stringToAddress(receiver[0]);
      string memory senderString = addressToAsciiString(sender);
      bool acceptTransfer = bridge.acceptTransfer(
        receiverAddress,
        amount,
        senderString,
        receiver[1],
        hashes,
        logIndex
      );
      require(acceptTransfer, "Monitor: bridge acceptTransfer error");
      emit Executed(transactionId);
      return true;
    }

    return true;
  }

  function getTransactionCount(bytes32 transactionId) public view returns(uint) {
    return countVotes[transactionId];
  }

  function hasVoted(bytes32 transactionId) external view returns(bool) {
    return votes[transactionId][_msgSender()];
  }

  function transactionProcessed(bytes32 transactionId) external view returns(bool) {
    return processed[transactionId];
  }

  function getTransactionId(
    address sender,
    uint256 amount,
    string[2] calldata receiver, // receiverAddress, blockchain
    bytes32[2] calldata hashes, //blockHash, transactionHash
    uint32 logIndex)
  public pure returns(bytes32) {
    return keccak256(abi.encodePacked(sender, amount, receiver[0], receiver[1], hashes[0], hashes[1], logIndex));
  }

  function addMember(address _memberAddress) public returns (bool) {
    //Can be called only by the account defined in constructor: DEFAULT_ADMIN_ROLE
    grantRole(MONITOR_ROLE, _memberAddress);
    return true;
  }

  function delMember(address _memberAddress) public returns (bool) {
    //Can be called only by the account defined in constructor: DEFAULT_ADMIN_ROLE
    revokeRole(MONITOR_ROLE, _memberAddress);
    return true;
  }

  function getMemberCount() public view returns (uint) {
    return getRoleMemberCount(MONITOR_ROLE);
  }

  function getMemberAt(uint index) public view returns (address) {
    return getRoleMember(MONITOR_ROLE, index);
  }

  function changeRequirement(uint _required) public onlyOwner validRequirement(getMemberCount(), _required) {
    require(_required >= 1, "Monitor: requires at least 1");
    emit RequirementChanged(required, _required);
    required = _required;    
  }

  // From: https://github.com/provable-things/ethereum-api/blob/master/oraclizeAPI_0.5.sol
  function stringToAddress(string memory _a) internal pure returns (address _parsedAddress) {
      bytes memory tmp = bytes(_a);
      uint160 iaddr = 0;
      uint160 b1;
      uint160 b2;
      for (uint i = 2; i < 2 + 2 * 20; i += 2) {
          iaddr *= 256;
          b1 = uint160(uint8(tmp[i]));
          b2 = uint160(uint8(tmp[i + 1]));
          if ((b1 >= 97) && (b1 <= 102)) {
              b1 -= 87;
          } else if ((b1 >= 65) && (b1 <= 70)) {
              b1 -= 55;
          } else if ((b1 >= 48) && (b1 <= 57)) {
              b1 -= 48;
          }
          if ((b2 >= 97) && (b2 <= 102)) {
              b2 -= 87;
          } else if ((b2 >= 65) && (b2 <= 70)) {
              b2 -= 55;
          } else if ((b2 >= 48) && (b2 <= 57)) {
              b2 -= 48;
          }
          iaddr += (b1 * 16 + b2);
      }
      return address(iaddr);
  }

  // From https://ethereum.stackexchange.com/questions/8346/convert-address-to-string
  function addressToAsciiString(address x) internal pure returns (string memory) {
      bytes memory s = new bytes(40);
      for (uint i = 0; i < 20; i++) {
          bytes1 b = bytes1(uint8(uint(uint160(x)) / (2**(8*(19 - i)))));
          bytes1 hi = bytes1(uint8(b) / 16);
          bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
          s[2*i] = char(hi);
          s[2*i+1] = char(lo);            
      }
      return string(s);
  }

  function char(bytes1 b) internal pure returns (bytes1 c) {
      if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
      else return bytes1(uint8(b) + 0x57);
  }


}