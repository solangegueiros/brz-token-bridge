// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol";

contract TokenBRZ is ERC20 {
    constructor() public ERC20("Brazilian Real", "BRZ") {
        //_mint(msg.sender, 100000);
        _mint(0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2, 100000);
    }
}


contract Bridge {

    address public owner;
    TokenBRZ public token;
    uint public balance;
    
    constructor(address tokenA) {
        owner = msg.sender;
        token = TokenBRZ(tokenA);
    }
    
    event Deposit(address indexed from, address indexed to, uint value, uint blockchain);
    
    function receiveToken(address to, uint amount, uint8 blockchain) public returns (bool) {
        token.transferFrom(msg.sender, address(this), amount);
        balance += amount;
        emit Deposit(msg.sender, to, amount, blockchain);
        return true;
    }
    
    function sendToken(address to, uint amount, uint8 blockchain) public returns (bool) {
        require (balance >= amount, "No balance");
        balance -= amount;
        token.transfer(to, amount);
        return true;
    }

    function withdraw() public returns (bool) {
        uint256 withdrawAmount = balance;
        balance = 0;
        token.transfer(owner, withdrawAmount);
        return true;
    }
    
    function getBalance() public view returns (uint) {
        return balance;
    }
    
}
