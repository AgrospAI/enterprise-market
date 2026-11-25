// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;
import {IMetadataNft, AccessRequests} from "../src/AccessRequests.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert() external;
}

contract MockNft {
    address public holder;
    address public writer;
    bytes32 public metadataHash;
    bool public failWrite;

    function authorize(address next) external {
        writer = next;
    }

    function failMetadata(bool value) external {
        failWrite = value;
    }

    function setMetaData(
        uint8,
        string calldata,
        string calldata,
        bytes calldata,
        bytes calldata,
        bytes32 hash,
        IMetadataNft.Proof[] calldata
    ) external {
        require(msg.sender == writer && !failWrite, "Metadata write denied");
        metadataHash = hash;
    }

    constructor(address holder_) {
        holder = holder_;
    }

    function transfer(address next) external {
        holder = next;
    }

    function ownerOf(uint256 token) external view returns (address) {
        require(token == 1);
        return holder;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x80ac58cd;
    }
}

contract RevertingNft {
    function supportsInterface(bytes4) external pure returns (bool) {
        revert();
    }
}

contract MaliciousNft {
    AccessRequests public registry;

    constructor(AccessRequests registry_) {
        registry = registry_;
    }

    function supportsInterface(bytes4) external pure returns (bool) {
        return true;
    }

    function ownerOf(uint256) external returns (address) {
        registry.createRequest(
            address(this), "s", AccessRequests.Kind.TrustAlgorithm, address(this), "a", address(0), address(0x11)
        , "");
        return address(0x11);
    }
}

contract AccessRequestsTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    AccessRequests r;
    MockNft dataset;
    MockNft algorithm;
    address constant OWNER = address(0x11);
    address constant REQUESTER = address(0x22);
    address constant PUBLISHER = address(0x33);


    function testMessagesPersistInAllInboxesAndAfterDecision() public {
        string memory message = unicode"Please grant access.\nGràcies!";
        vm.prank(REQUESTER);
        uint256 id = r.createServiceRequest(address(dataset), "source", "{}", OWNER, message);
        require(keccak256(bytes(r.getRequest(id).message)) == keccak256(bytes(message)));
        require(keccak256(bytes(r.requesterPage(REQUESTER, 0, 50)[0].message)) == keccak256(bytes(message)));
        require(keccak256(bytes(r.receiverPage(OWNER, 0, 50)[0].message)) == keccak256(bytes(message)));
        require(keccak256(bytes(r.datasetPage(address(dataset), 0, 50)[0].message)) == keccak256(bytes(message)));
        vm.prank(OWNER);
        r.reject(id);
        require(keccak256(bytes(r.getRequest(id).message)) == keccak256(bytes(message)));
    }

    function testMessageByteLimitAndEmptyMessage() public {
        vm.prank(REQUESTER);
        uint256 id = r.createServiceRequest(address(dataset), "source", "{}", OWNER, "");
        require(bytes(r.getRequest(id).message).length == 0);
        vm.prank(REQUESTER);
        r.cancel(id);
        vm.prank(REQUESTER);
        r.createServiceRequest(address(dataset), "source", "{}", OWNER, string(new bytes(2048)));
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createServiceRequest(address(dataset), "other", "{}", OWNER, string(new bytes(2049)));
    }

    function testServiceRequestStoresTermsAndCreatesIndependentProposals() public {
        vm.prank(REQUESTER);
        uint256 first = r.createServiceRequest(address(dataset), "source", '{"name":"Custom","price":"2"}', OWNER, "");
        require(r.getRequest(first).kind == AccessRequests.Kind.CreateService);
        require(keccak256(bytes(r.serviceTerms(first))) == keccak256(bytes('{"name":"Custom","price":"2"}')));
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createServiceRequest(address(dataset), "source", '{"name":"Custom","price":"2"}', OWNER, "");
        vm.prank(REQUESTER);
        uint256 second = r.createServiceRequest(address(dataset), "source", '{"name":"Custom","price":"3"}', OWNER, "");
        require(second == first + 1);
        require(r.receiverCount(OWNER) == 2 && r.requesterCount(REQUESTER) == 2);
    }

    function testServiceAccessTypeAndBaseAreIndependentProposalChoices() public {
        string memory compute = '{"name":"Custom","type":"compute"}';
        string memory download = '{"name":"Custom","type":"access"}';
        vm.prank(REQUESTER);
        uint256 first = r.createServiceRequest(address(dataset), "base", compute, OWNER, "");
        vm.prank(REQUESTER);
        uint256 second = r.createServiceRequest(address(dataset), "base", download, OWNER, "");
        vm.prank(REQUESTER);
        uint256 third = r.createServiceRequest(address(dataset), "other-base", compute, OWNER, "");
        require(second == first + 1 && third == second + 1);
        require(keccak256(bytes(r.serviceTerms(first))) == keccak256(bytes(compute)));
        require(keccak256(bytes(r.serviceTerms(second))) == keccak256(bytes(download)));
        require(keccak256(bytes(r.getRequest(third).datasetServiceId)) == keccak256(bytes("other-base")));
    }

    function testServiceRequestRequiresTermsAndReviewedOwner() public {
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createServiceRequest(address(dataset), "source", "", OWNER, "");
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createServiceRequest(address(dataset), "source", "{}", PUBLISHER, "");
        vm.prank(OWNER);
        vm.expectRevert();
        r.createServiceRequest(address(dataset), "source", "{}", OWNER, "");
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createRequest(address(dataset), "source", AccessRequests.Kind.CreateService, address(0), "", address(0), OWNER, "");
    }

    function testNotificationLifecycleAndExpiry() public {
        uint256 id = create();
        require(r.activity(id, OWNER) == 1 && r.activity(id, REQUESTER) == 0);
        vm.prank(OWNER);
        r.markSeen(id, 1);
        (, uint8[] memory revisions, uint256 total) = r.notificationPage(OWNER, 0, 50);
        require(total == 1 && revisions[0] == 0);
        vm.warp(r.getRequest(id).expiresAt);
        require(r.activity(id, OWNER) == 2 && r.activity(id, REQUESTER) == 2);
        vm.prank(OWNER);
        vm.expectRevert();
        r.markSeen(id, 1);
        vm.prank(OWNER);
        r.markSeen(id, 2);
        (, revisions,) = r.notificationPage(OWNER, 0, 50);
        require(revisions[0] == 0);
        (, revisions,) = r.notificationPage(REQUESTER, 0, 50);
        require(revisions[0] == 2);
    }

    function testNotificationDecisionsAndAuthorization() public {
        uint256 id = create();
        vm.prank(PUBLISHER);
        vm.expectRevert();
        r.markSeen(id, 1);
        vm.prank(OWNER);
        r.reject(id);
        require(r.activity(id, REQUESTER) == 5 && r.activity(id, OWNER) == 0);
        vm.prank(REQUESTER);
        r.markSeen(id, 5);
        (, uint8[] memory revisions,) = r.notificationPage(REQUESTER, 0, 50);
        require(revisions[0] == 0);
        id = create();
        vm.prank(REQUESTER);
        r.cancel(id);
        require(r.activity(id, OWNER) == 3 && r.activity(id, REQUESTER) == 0);
        id = create();
        vm.prank(OWNER);
        r.approve(id, metadata());
        require(r.activity(id, REQUESTER) == 4 && r.activity(id, OWNER) == 0);
    }

    function setUp() public {
        r = new AccessRequests();
        dataset = new MockNft(OWNER);
        algorithm = new MockNft(PUBLISHER);
        dataset.authorize(address(r));
    }

    function metadata() internal pure returns (AccessRequests.MetadataUpdate memory) {
        return AccessRequests.MetadataUpdate(0, "https://node.example", "", hex"02", hex"1234", keccak256("metadata"));
    }

    function testApprovalWritesMetadataAtomically() public {
        uint256 id = create();
        vm.prank(OWNER);
        r.approve(id, metadata());
        require(dataset.metadataHash() == keccak256("metadata"));
        require(r.getRequest(id).status == AccessRequests.Status.Approved);
    }

    function testAllKindsUpdateMetadata() public {
        for (uint8 kind; kind < 3; ++kind) {
            vm.prank(REQUESTER);
            uint256 id = r.createRequest(
                address(dataset),
                "s",
                AccessRequests.Kind(kind),
                kind == 0 ? address(algorithm) : address(0),
                kind == 0 ? "a" : "",
                kind == 1 ? PUBLISHER : address(0),
                OWNER
            , "");
            vm.prank(OWNER);
            r.approve(id, metadata());
            require(r.getRequest(id).status == AccessRequests.Status.Approved);
            require(dataset.metadataHash() == keccak256("metadata"));
        }
    }

    function testIndependentPublisherAndNetworkRequests() public {
        require(r.VERSION() == 6);
        for (uint8 kind = 1; kind < 3; ++kind) {
            vm.prank(REQUESTER);
            uint256 id = r.createRequest(
                address(dataset),
                "s",
                AccessRequests.Kind(kind),
                address(0),
                "",
                kind == 1 ? PUBLISHER : address(0),
                OWNER
            , "");
            vm.prank(OWNER);
            r.approve(id, metadata());
            require(r.getRequest(id).status == AccessRequests.Status.Approved);
        }
    }

    function testIndependentRequestValidation() public {
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createRequest(address(dataset), "s", AccessRequests.Kind.TrustAlgorithm, address(0), "", address(0), OWNER, "");
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createRequest(address(dataset), "s", AccessRequests.Kind.TrustPublisher, address(0), "", address(0), OWNER, "");
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createRequest(address(dataset), "s", AccessRequests.Kind.EnableNetwork, address(0), "a", address(0), OWNER, "");
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createRequest(address(dataset), "s", AccessRequests.Kind.EnableNetwork, address(0), "", PUBLISHER, OWNER, "");
    }

    function testEmptyMetadataCannotApprove() public {
        uint256 id = create();
        AccessRequests.MetadataUpdate memory update = metadata();
        update.data = hex"";
        vm.prank(OWNER);
        vm.expectRevert();
        r.approve(id, update);
        require(r.getRequest(id).status == AccessRequests.Status.Pending);
    }

    function testMetadataFailureRollsBackDecision() public {
        uint256 id = create();
        dataset.failMetadata(true);
        vm.prank(OWNER);
        vm.expectRevert();
        r.approve(id, metadata());
        AccessRequests.Request memory request = r.getRequest(id);
        require(request.status == AccessRequests.Status.Pending);
        require(request.decidedBy == address(0) && request.decidedAt == 0);
        require(dataset.metadataHash() == bytes32(0));
        dataset.failMetadata(false);
        vm.prank(OWNER);
        r.approve(id, metadata());
        require(r.getRequest(id).status == AccessRequests.Status.Approved);
    }

    function testMissingMetadataRoleRollsBackDecision() public {
        uint256 id = create();
        dataset.authorize(address(0));
        vm.prank(OWNER);
        vm.expectRevert();
        r.approve(id, metadata());
        require(r.getRequest(id).status == AccessRequests.Status.Pending);
    }

    function testRejectDoesNotChangeMetadata() public {
        uint256 id = create();
        vm.prank(OWNER);
        r.reject(id);
        require(dataset.metadataHash() == bytes32(0));
        require(r.getRequest(id).status == AccessRequests.Status.Rejected);
    }

    function create() internal returns (uint256) {
        vm.prank(REQUESTER);
        return r.createRequest(
            address(dataset),
            "dataset-service",
            AccessRequests.Kind.TrustAlgorithm,
            address(algorithm),
            "algo-service",
            address(0),
            OWNER
        , "");
    }

    function testCreation() public {
        uint256 id = create();
        AccessRequests.Request memory request = r.getRequest(id);
        require(
            id == 1 && request.requester == REQUESTER && request.receiver == OWNER
                && request.expiresAt == block.timestamp + 7 days
        );
        require(request.decidedAt == 0 && request.decidedBy == address(0));
        require(
            r.requesterCount(REQUESTER) == 1 && r.datasetCount(address(dataset)) == 1 && r.receiverCount(OWNER) == 1
        );
    }

    function testUnauthorizedAndTransfer() public {
        uint256 id = create();
        vm.expectRevert();
        r.approve(id, metadata());
        dataset.transfer(PUBLISHER);
        vm.prank(OWNER);
        vm.expectRevert();
        r.reject(id);
        vm.prank(PUBLISHER);
        vm.expectRevert();
        r.approve(id, metadata());
        require(r.getRequest(id).receiver == OWNER);
        require(r.receiverCount(OWNER) == 1 && r.receiverCount(PUBLISHER) == 0);
    }

    function testOwnershipRaceCannotRetargetRequest() public {
        dataset.transfer(PUBLISHER);
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createRequest(address(dataset), "s", AccessRequests.Kind.EnableNetwork, address(0), "", address(0), OWNER, "");
        require(r.requestCount() == 0 && r.receiverCount(OWNER) == 0 && r.receiverCount(PUBLISHER) == 0);
    }

    function testNewOwnerHasIndependentInboxAndDuplicateScope() public {
        uint256 first = create();
        dataset.transfer(PUBLISHER);
        vm.prank(REQUESTER);
        uint256 second = r.createRequest(
            address(dataset),
            "dataset-service",
            AccessRequests.Kind.TrustAlgorithm,
            address(algorithm),
            "algo-service",
            address(0),
            PUBLISHER
        , "");
        require(r.receiverPage(OWNER, 0, 50)[0].id == first);
        require(r.receiverPage(PUBLISHER, 0, 50)[0].id == second);
        vm.prank(PUBLISHER);
        vm.expectRevert();
        r.reject(first);
        vm.prank(PUBLISHER);
        r.approve(second, metadata());
        vm.prank(REQUESTER);
        r.cancel(first);
        require(r.receiverPage(OWNER, 0, 50)[0].status == AccessRequests.Status.Cancelled);
        require(r.receiverPage(PUBLISHER, 0, 50)[0].status == AccessRequests.Status.Approved);
    }

    function testInboxSurvivesMetadataApprovalAndReject() public {
        uint256 first = create();
        vm.prank(OWNER);
        r.approve(first, metadata());
        uint256 second = create();
        vm.prank(OWNER);
        r.reject(second);
        AccessRequests.Request[] memory rows = r.receiverPage(OWNER, 0, 50);
        require(
            rows.length == 2 && rows[0].status == AccessRequests.Status.Approved
                && rows[1].status == AccessRequests.Status.Rejected
        );
        require(dataset.holder() == OWNER);
    }

    function testSelfRequestAndApproval() public {
        vm.prank(OWNER);
        vm.expectRevert();
        r.createRequest(address(dataset), "s", AccessRequests.Kind.EnableNetwork, address(0), "", address(0), OWNER, "");
        uint256 id = create();
        dataset.transfer(REQUESTER);
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.approve(id, metadata());
    }

    function testExpiryBoundaryAndCancel() public {
        uint256 id = create();
        vm.warp(r.getRequest(id).expiresAt);
        vm.prank(OWNER);
        vm.expectRevert();
        r.approve(id, metadata());
        vm.prank(REQUESTER);
        r.cancel(id);
        require(r.getRequest(id).status == AccessRequests.Status.Cancelled);
    }

    function testBeforeExpiry() public {
        uint256 id = create();
        vm.warp(r.getRequest(id).expiresAt - 1);
        vm.prank(OWNER);
        r.approve(id, metadata());
    }

    function testDuplicatesAndRerequests() public {
        uint256 id = create();
        vm.expectRevert();
        create();
        vm.warp(r.getRequest(id).expiresAt);
        require(create() == 2);
        vm.prank(REQUESTER);
        r.cancel(2);
        require(create() == 3);
        vm.prank(OWNER);
        r.reject(3);
        require(create() == 4);
    }

    function testTerminalImmutable() public {
        uint256 id = create();
        vm.prank(OWNER);
        r.approve(id, metadata());
        vm.prank(OWNER);
        vm.expectRevert();
        r.reject(id);
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.cancel(id);
        vm.prank(OWNER);
        vm.expectRevert();
        r.approve(id, metadata());
    }

    function testCancellationAuthorization() public {
        uint256 id = create();
        vm.prank(OWNER);
        vm.expectRevert();
        r.cancel(id);
        vm.prank(REQUESTER);
        r.cancel(id);
        require(r.getRequest(id).decidedBy == REQUESTER);
    }

    function testPublisherTrustIsIndependentOfAlgorithms() public {
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createRequest(
            address(dataset), "s", AccessRequests.Kind.TrustPublisher, address(algorithm), "a", PUBLISHER, OWNER
        , "");
        vm.prank(REQUESTER);
        uint256 id = r.createRequest(
            address(dataset), "s", AccessRequests.Kind.TrustPublisher, address(0), "", PUBLISHER, OWNER
        , "");
        algorithm.transfer(REQUESTER);
        vm.prank(OWNER);
        r.approve(id, metadata());
        require(r.getRequest(id).status == AccessRequests.Status.Approved);
    }

    function testInvalidInput() public {
        vm.expectRevert();
        r.getRequest(0);
        vm.expectRevert();
        r.cancel(99);
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createRequest(address(dataset), "", AccessRequests.Kind.EnableNetwork, address(0), "", address(0), OWNER, "");
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createRequest(
            address(dataset),
            string(new bytes(129)),
            AccessRequests.Kind.EnableNetwork,
            address(algorithm),
            "a",
            address(0),
            OWNER
        , "");
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createRequest(
            address(dataset), "s", AccessRequests.Kind.TrustAlgorithm, address(algorithm), "a", PUBLISHER, OWNER
        , "");
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createRequest(address(0), "s", AccessRequests.Kind.EnableNetwork, address(0), "", address(0), OWNER, "");
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createRequest(address(dataset), "s", AccessRequests.Kind.EnableNetwork, address(0), "a", address(0), OWNER, "");
    }

    function testUnknownKind() public {
        vm.prank(REQUESTER);
        (bool ok,) = address(r)
            .call(
                abi.encodeWithSelector(
                    r.createRequest.selector,
                    address(dataset),
                    "s",
                    uint8(3),
                    address(algorithm),
                    "a",
                    address(0),
                    OWNER
                )
            );
        require(!ok);
    }

    function testAdversarialNfts() public {
        RevertingNft bad = new RevertingNft();
        MaliciousNft malicious = new MaliciousNft(r);
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createRequest(address(bad), "s", AccessRequests.Kind.EnableNetwork, address(0), "", address(0), OWNER, "");
        vm.prank(REQUESTER);
        vm.expectRevert();
        r.createRequest(address(malicious), "s", AccessRequests.Kind.EnableNetwork, address(0), "", address(0), OWNER, "");
        require(r.requestCount() == 0);
    }

    function testPagination() public {
        for (uint256 i; i < 52; ++i) {
            vm.prank(address(uint160(100 + i)));
            r.createRequest(address(dataset), "s", AccessRequests.Kind.EnableNetwork, address(0), "", address(0), OWNER, "");
        }
        AccessRequests.Request[] memory first = r.datasetPage(address(dataset), 0, 50);
        require(first.length == 50 && first[0].id == 1 && first[49].id == 50);
        require(r.datasetPage(address(dataset), 50, 50).length == 2);
        AccessRequests.Request[] memory inbox = r.receiverPage(OWNER, 0, 50);
        require(inbox.length == 50 && inbox[0].id == 1 && inbox[49].id == 50);
        require(r.receiverPage(OWNER, 50, 50).length == 2);
        require(r.receiverPage(OWNER, type(uint256).max, 50).length == 0);
        require(r.receiverPage(PUBLISHER, 0, 50).length == 0);
        vm.expectRevert();
        r.receiverPage(OWNER, 0, 0);
        vm.expectRevert();
        r.receiverPage(OWNER, 0, 51);
        require(r.datasetPage(address(dataset), type(uint256).max, 50).length == 0);
        require(r.requesterPage(address(100), 0, 50)[0].id == 1);
        vm.expectRevert();
        r.datasetPage(address(dataset), 0, 51);
        vm.expectRevert();
        r.requesterPage(REQUESTER, 0, 0);
    }

    function testFuzzExpiry(uint32 elapsed) public {
        uint256 id = create();
        vm.warp(block.timestamp + elapsed);
        vm.prank(OWNER);
        if (elapsed >= 7 days) {
            vm.expectRevert();
            r.approve(id, metadata());
            return;
        }
        r.approve(id, metadata());
        require(r.getRequest(id).status == AccessRequests.Status.Approved);
    }
}
