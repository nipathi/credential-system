// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// This contract will store and verify the digital fingerprints (hashes) of certificates.
contract CertiChain {

    // The 'owner' is the account that deploys the contract.
    address public owner;

    // A mapping is like a giant, permanent public database.
    // It maps a hash (bytes32) to a boolean (true or false).
    mapping(bytes32 => bool) public certificateHashes;

    // This is a special function that runs only once, when the contract is first deployed.
    constructor() {
        // 'msg.sender' is the address of the account that is deploying the contract.
        owner = msg.sender;
    }

    /**
     * @dev Issues a new certificate by storing its hash on the blockchain.
     * Only the owner of the contract can call this function.
     * @param _hash The unique 32-byte hash of the certificate data.
     */
    function issueCertificate(bytes32 _hash) public {
        // This line ensures that only the owner can issue certificates.
        require(msg.sender == owner, "Only the owner can call this function.");
        // This line adds the hash to our public database.
        certificateHashes[_hash] = true;
    }

    // --- NEW FUNCTION ADDED HERE ---
    /**
     * @dev Burns (revokes) a certificate by setting its hash to false.
     * Only the owner of the contract can call this function.
     * @param _hash The 32-byte hash of the certificate to burn.
     */
    function burnCertificate(bytes32 _hash) public {
        // This security check ensures only the owner can burn certificates.
        require(msg.sender == owner, "Only the owner can call this function.");
        // This line "deletes" the certificate from our record by setting its value to false.
        certificateHashes[_hash] = false;
    }
    // --- END OF NEW FUNCTION ---

    /**
     * @dev Verifies if a certificate hash exists on the blockchain.
     * Anyone can call this function for free.
     * @param _hash The 32-byte hash to check.
     * @return A boolean value: 'true' if the certificate is valid, 'false' otherwise.
     */
    function verifyCertificate(bytes32 _hash) public view returns (bool) {
        // This line simply returns the value from our mapping.
        return certificateHashes[_hash];
    }
}