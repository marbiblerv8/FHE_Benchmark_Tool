pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract FHEBenchmarkToolFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    address public owner;
    mapping(address => bool) public providers;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;
    uint256 public cooldownSeconds = 60; // Default cooldown: 60 seconds

    bool public paused;

    struct Batch {
        uint256 id;
        bool active;
        uint256 dataCount;
        euint32 encryptedTotalTime; // Sum of encrypted execution times
    }
    uint256 public currentBatchId;
    mapping(uint256 => Batch) public batches;

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event CooldownSecondsChanged(uint256 oldCooldown, uint256 newCooldown);
    event Paused(address account);
    event Unpaused(address account);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId, uint256 dataCount);
    event DataSubmitted(address indexed provider, uint256 indexed batchId, uint256 dataCount);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 totalTime);

    error NotOwner();
    error NotProvider();
    error PausedError();
    error CooldownActive();
    error BatchNotActive();
    error InvalidBatch();
    error ReplayAttempt();
    error StateMismatch();
    error InvalidCooldown();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!providers[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert PausedError();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function addProvider(address provider) external onlyOwner {
        providers[provider] = true;
        emit ProviderAdded(provider);
    }

    function removeProvider(address provider) external onlyOwner {
        providers[provider] = false;
        emit ProviderRemoved(provider);
    }

    function setCooldownSeconds(uint256 newCooldown) external onlyOwner {
        if (newCooldown == 0) revert InvalidCooldown();
        uint256 oldCooldown = cooldownSeconds;
        cooldownSeconds = newCooldown;
        emit CooldownSecondsChanged(oldCooldown, newCooldown);
    }

    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function openBatch() external onlyOwner whenNotPaused {
        currentBatchId++;
        Batch storage batch = batches[currentBatchId];
        batch.id = currentBatchId;
        batch.active = true;
        batch.dataCount = 0;
        batch.encryptedTotalTime = FHE.asEuint32(0);
        emit BatchOpened(currentBatchId);
    }

    function closeBatch(uint256 batchId) external onlyOwner whenNotPaused {
        if (batchId == 0 || batchId > currentBatchId || !batches[batchId].active) {
            revert InvalidBatch();
        }
        Batch storage batch = batches[batchId];
        batch.active = false;
        emit BatchClosed(batchId, batch.dataCount);
    }

    function submitBenchmarkData(uint256 executionTime) external onlyProvider whenNotPaused {
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        lastSubmissionTime[msg.sender] = block.timestamp;

        if (currentBatchId == 0 || !batches[currentBatchId].active) {
            revert BatchNotActive();
        }

        Batch storage batch = batches[currentBatchId];
        euint32 encryptedTime = FHE.asEuint32(executionTime);
        batch.encryptedTotalTime = FHE.add(batch.encryptedTotalTime, encryptedTime);
        batch.dataCount++;

        emit DataSubmitted(msg.sender, currentBatchId, batch.dataCount);
    }

    function requestBenchmarkResultDecryption(uint256 batchId) external onlyOwner whenNotPaused {
        if (batchId == 0 || batchId > currentBatchId || batches[batchId].active) {
            revert InvalidBatch();
        }
        if (block.timestamp < lastDecryptionRequestTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        lastDecryptionRequestTime[msg.sender] = block.timestamp;

        Batch storage batch = batches[batchId];
        euint32 encryptedResult = batch.encryptedTotalTime;

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(encryptedResult);

        bytes32 stateHash = _hashCiphertexts(cts);
        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);

        decryptionContexts[requestId] = DecryptionContext({
            batchId: batchId,
            stateHash: stateHash,
            processed: false
        });

        emit DecryptionRequested(requestId, batchId);
    }

    function myCallback(uint256 requestId, bytes memory cleartexts, bytes memory proof) public {
        if (decryptionContexts[requestId].processed) {
            revert ReplayAttempt();
        }

        // Rebuild ciphertexts array in the exact same order as during request
        DecryptionContext storage ctx = decryptionContexts[requestId];
        Batch storage batch = batches[ctx.batchId];
        euint32 encryptedResult = batch.encryptedTotalTime;
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(encryptedResult);

        // Verify state consistency
        bytes32 currentHash = _hashCiphertexts(cts);
        if (currentHash != ctx.stateHash) {
            revert StateMismatch();
        }

        // Verify proof
        FHE.checkSignatures(requestId, cleartexts, proof);

        // Decode cleartexts
        uint256 totalTime = abi.decode(cleartexts, (uint256));

        ctx.processed = true;
        emit DecryptionCompleted(requestId, ctx.batchId, totalTime);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }
}