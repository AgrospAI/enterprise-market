// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;
import {AccessRequests} from "../src/AccessRequests.sol";

interface VmDeploy {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    VmDeploy constant vm = VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (AccessRequests registry) {
        require(block.chainid == 11155420 || block.chainid == 31337, "Unsupported chain");
        vm.startBroadcast();
        registry = new AccessRequests();
        vm.stopBroadcast();
    }
}
