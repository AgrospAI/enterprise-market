// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMetadataNft {
    struct Proof {
        address validatorAddress;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }
    function setMetaData(
        uint8 state,
        string calldata decryptorUrl,
        string calldata decryptorAddress,
        bytes calldata flags,
        bytes calldata data,
        bytes32 metadataHash,
        Proof[] calldata proofs
    ) external;
}

/// @notice Consent decisions and NFT metadata updates in one atomic transaction.
contract AccessRequests is ReentrancyGuard {
    uint256 public constant VERSION = 6;

    struct MetadataUpdate {
        uint8 state;
        string decryptorUrl;
        string decryptorAddress;
        bytes flags;
        bytes data;
        bytes32 metadataHash;
    }
    enum Kind {
        TrustAlgorithm,
        TrustPublisher,
        EnableNetwork,
        CreateService
    }
    enum Status {
        Pending,
        Approved,
        Rejected,
        Cancelled
    }

    struct Request {
        uint256 id;
        address requester;
        address receiver;
        address datasetNft;
        string datasetServiceId;
        Kind kind;
        address algorithmNft;
        string algorithmServiceId;
        address publisher;
        uint64 createdAt;
        uint64 expiresAt;
        uint64 decidedAt;
        Status status;
        address decidedBy;
        string message;
    }

    uint256 public constant MAX_PAGE = 50;
    uint256 public constant LIFETIME = 7 days;
    uint256 public requestCount;
    mapping(uint256 => string) public serviceTerms;
    mapping(uint256 => Request) private requests;
    mapping(address => uint256[]) private sent;
    mapping(address => uint256[]) private inbox;
    mapping(address => uint256[]) private received;
    mapping(bytes32 => uint256) public latestRequest;

    error InvalidInput();
    error InvalidNft();
    error UnknownRequest();
    error DuplicateRequest();
    error Unauthorized();
    error NotPending();
    error Expired();

    event RequestCreated(
        uint256 indexed id,
        address indexed requester,
        address datasetNft,
        address indexed receiver,
        string datasetServiceId,
        Kind kind,
        address algorithmNft,
        string algorithmServiceId,
        address publisher,
        uint64 expiresAt
    );
    event RequestApproved(uint256 indexed id, address indexed requester, address indexed datasetNft, address decidedBy);
    event RequestRejected(uint256 indexed id, address indexed requester, address indexed datasetNft, address decidedBy);
    event RequestCancelled(uint256 indexed id, address indexed requester, address indexed datasetNft);

    function owner(address nft) private view returns (address result) {
        if (nft.code.length == 0) revert InvalidNft();
        // Solidity emits STATICCALL: malicious NFTs cannot reenter a state-changing function.
        try IERC721(nft).supportsInterface(0x80ac58cd) returns (bool supported) {
            if (!supported) revert InvalidNft();
        } catch {
            revert InvalidNft();
        }
        try IERC721(nft).ownerOf(1) returns (address current) {
            if (current == address(0)) revert InvalidNft();
            result = current;
        } catch {
            revert InvalidNft();
        }
    }

    function createRequest(
        address datasetNft,
        string calldata datasetServiceId,
        Kind kind,
        address algorithmNft,
        string calldata algorithmServiceId,
        address publisher,
        address receiver,
        string calldata message
    ) external nonReentrant returns (uint256 id) {
        if (kind == Kind.CreateService) revert InvalidInput();
        return create(datasetNft, datasetServiceId, kind, algorithmNft, algorithmServiceId, publisher, receiver, bytes32(0), message);
    }

    /// @notice Immutable JSON proposal for a new service cloned from datasetServiceId.
    /// @dev The base service may have any access type. The requested type is part
    /// of terms and its duplicate-request hash; metadata activation validates it.
    function createServiceRequest(
        address datasetNft,
        string calldata datasetServiceId,
        string calldata terms,
        address receiver,
        string calldata message
    ) external nonReentrant returns (uint256 id) {
        if (bytes(terms).length == 0 || bytes(terms).length > 16384) revert InvalidInput();
        id = create(datasetNft, datasetServiceId, Kind.CreateService, address(0), "", address(0), receiver, keccak256(bytes(terms)), message);
        serviceTerms[id] = terms;
    }

    function create(
        address datasetNft,
        string memory datasetServiceId,
        Kind kind,
        address algorithmNft,
        string memory algorithmServiceId,
        address publisher,
        address receiver,
        bytes32 termsHash,
        string memory message
    ) private returns (uint256 id) {
        if (
            bytes(datasetServiceId).length == 0 || bytes(datasetServiceId).length > 128
                || bytes(algorithmServiceId).length > 128 || bytes(message).length > 2048
        ) revert InvalidInput();
        // Bind delivery to the owner reviewed by the requester. A transfer while
        // the transaction is awaiting inclusion must not silently retarget it.
        if (owner(datasetNft) != receiver || receiver == msg.sender) revert Unauthorized();
        bool hasAlgorithm = algorithmNft != address(0);
        if (hasAlgorithm != (kind == Kind.TrustAlgorithm)) revert InvalidInput();
        if (hasAlgorithm != (bytes(algorithmServiceId).length > 0)) revert InvalidInput();
        if (hasAlgorithm) owner(algorithmNft);
        if (kind == Kind.TrustPublisher) {
            if (publisher == address(0)) revert InvalidInput();
        } else if (publisher != address(0)) {
            revert InvalidInput();
        }
        bytes32 key = keccak256(
            abi.encode(
                msg.sender, datasetNft, datasetServiceId, kind, algorithmNft, algorithmServiceId, publisher, receiver
            )
        );
        if (kind == Kind.CreateService) key = keccak256(abi.encode(key, termsHash));
        uint256 previous = latestRequest[key];
        if (
            previous != 0 && requests[previous].status == Status.Pending
                && block.timestamp < requests[previous].expiresAt
        ) revert DuplicateRequest();
        id = ++requestCount;
        uint64 expiresAt = uint64(block.timestamp + LIFETIME);
        requests[id] = Request(
            id,
            msg.sender,
            receiver,
            datasetNft,
            datasetServiceId,
            kind,
            algorithmNft,
            algorithmServiceId,
            publisher,
            uint64(block.timestamp),
            expiresAt,
            0,
            Status.Pending,
            address(0),
            message
        );
        latestRequest[key] = id;
        sent[msg.sender].push(id);
        inbox[receiver].push(id);
        received[datasetNft].push(id);
        emit RequestCreated(
            id,
            msg.sender,
            datasetNft,
            receiver,
            datasetServiceId,
            kind,
            algorithmNft,
            algorithmServiceId,
            publisher,
            expiresAt
        );
    }

    function pending(uint256 id) private view returns (Request storage r) {
        r = requests[id];
        if (r.id == 0) revert UnknownRequest();
        if (r.status != Status.Pending) revert NotPending();
    }

    function decide(uint256 id, bool approval) private {
        Request storage r = pending(id);
        if (block.timestamp >= r.expiresAt) revert Expired();
        if (r.receiver != msg.sender || owner(r.datasetNft) != msg.sender || r.requester == msg.sender) {
            revert Unauthorized();
        }
        r.status = approval ? Status.Approved : Status.Rejected;
        r.decidedBy = msg.sender;
        r.decidedAt = uint64(block.timestamp);
        if (approval) emit RequestApproved(id, r.requester, r.datasetNft, msg.sender);
        else emit RequestRejected(id, r.requester, r.datasetNft, msg.sender);
    }

    /// @dev The NFT must grant this registry its metadata role once. Only the current
    /// NFT owner may supply metadata; encrypted/IPFS policies cannot be decoded on chain.
    /// A failed NFT write rolls back the decision and all events.
    function approve(uint256 id, MetadataUpdate calldata metadata) external nonReentrant {
        if (metadata.data.length == 0 || metadata.flags.length == 0 || metadata.metadataHash == bytes32(0)) {
            revert InvalidInput();
        }
        decide(id, true);
        Request storage r = requests[id];
        IMetadataNft(r.datasetNft)
            .setMetaData(
                metadata.state,
                metadata.decryptorUrl,
                metadata.decryptorAddress,
                metadata.flags,
                metadata.data,
                metadata.metadataHash,
                new IMetadataNft.Proof[](0)
            );
    }

    function reject(uint256 id) external nonReentrant {
        decide(id, false);
    }

    function cancel(uint256 id) external nonReentrant {
        Request storage r = pending(id);
        if (r.requester != msg.sender) revert Unauthorized();
        r.status = Status.Cancelled;
        r.decidedAt = uint64(block.timestamp);
        r.decidedBy = msg.sender;
        emit RequestCancelled(id, r.requester, r.datasetNft);
    }

    // A revision is derived from immutable delivery, decisions and chain time.
    // No keeper transaction is needed when a pending request expires.
    mapping(address => mapping(uint256 => uint8)) public seenActivity;
    event RequestActivitySeen(address indexed wallet, uint256 indexed id, uint8 activity);

    function activity(uint256 id, address wallet) public view returns (uint8) {
        Request storage r = requests[id];
        if (r.id == 0) revert UnknownRequest();
        if (wallet != r.receiver && wallet != r.requester) return 0;
        if (r.status == Status.Pending) {
            if (block.timestamp >= r.expiresAt) return 2;
            return wallet == r.receiver ? 1 : 0;
        }
        if (r.status == Status.Cancelled) return wallet == r.receiver ? 3 : 0;
        return wallet == r.requester ? (r.status == Status.Approved ? 4 : 5) : 0;
    }

    function markSeen(uint256 id, uint8 expectedActivity) external {
        Request storage r = requests[id];
        if (r.id == 0) revert UnknownRequest();
        if (msg.sender != r.receiver && msg.sender != r.requester) revert Unauthorized();
        if (expectedActivity == 0 || activity(id, msg.sender) != expectedActivity) revert InvalidInput();
        seenActivity[msg.sender][id] = expectedActivity;
        emit RequestActivitySeen(msg.sender, id, expectedActivity);
    }

    /// @notice Paginate both wallet inboxes; zero revisions indicate no unread activity.
    function notificationPage(address wallet, uint256 offset, uint256 limit)
        external view returns (uint256[] memory ids, uint8[] memory revisions, uint256 total)
    {
        if (limit == 0 || limit > MAX_PAGE) revert InvalidInput();
        uint256 incoming = inbox[wallet].length;
        total = incoming + sent[wallet].length;
        uint256 length = offset >= total ? 0 : total - offset;
        if (length > limit) length = limit;
        ids = new uint256[](length);
        revisions = new uint8[](length);
        for (uint256 i; i < length; ++i) {
            uint256 index = offset + i;
            uint256 id = index < incoming ? inbox[wallet][index] : sent[wallet][index - incoming];
            ids[i] = id;
            uint8 revision = activity(id, wallet);
            if (revision != seenActivity[wallet][id]) revisions[i] = revision;
        }
    }

    function getRequest(uint256 id) external view returns (Request memory) {
        if (requests[id].id == 0) revert UnknownRequest();
        return requests[id];
    }

    function requesterCount(address requester) external view returns (uint256) {
        return sent[requester].length;
    }

    function datasetCount(address datasetNft) external view returns (uint256) {
        return received[datasetNft].length;
    }

    function receiverCount(address receiver) external view returns (uint256) {
        return inbox[receiver].length;
    }

    function page(uint256[] storage ids, uint256 offset, uint256 limit) private view returns (Request[] memory result) {
        if (limit == 0 || limit > MAX_PAGE) revert InvalidInput();
        uint256 length = offset >= ids.length ? 0 : ids.length - offset;
        if (length > limit) length = limit;
        result = new Request[](length);
        for (uint256 i; i < length; ++i) {
            result[i] = requests[ids[offset + i]];
        }
    }

    function requesterPage(address requester, uint256 offset, uint256 limit) external view returns (Request[] memory) {
        return page(sent[requester], offset, limit);
    }

    function receiverPage(address receiver, uint256 offset, uint256 limit) external view returns (Request[] memory) {
        return page(inbox[receiver], offset, limit);
    }

    function datasetPage(address datasetNft, uint256 offset, uint256 limit) external view returns (Request[] memory) {
        return page(received[datasetNft], offset, limit);
    }
}
