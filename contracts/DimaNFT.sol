//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract DimaNFT is ERC721, AccessControl {
    using Counters for Counters.Counter;
    using Strings for uint256;

    Counters.Counter private nftCounter;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    //mapping for tokenID to tokenURI  _KeyType => _ValueType
    mapping(uint256 => string) private mTokenURI;
    mapping(string => uint256) private mCheckURI;

    constructor(address minter) ERC721("DimaNFT", "DIMANFT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, minter);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        return mTokenURI[tokenId];
    }

    //event for Mint
    event Mint(address indexed _to, uint256 _tokenId);

    //Mint new token
    function mint(string memory iTokenURI, address to)
        public
        onlyRole(MINTER_ROLE)
        returns (uint256)
    {
        require(0 == mCheckURI[iTokenURI], "iTokenURI already exists");

        nftCounter.increment();

        uint256 newItemId = nftCounter.current();
        _safeMint(to, newItemId);

        mTokenURI[newItemId] = iTokenURI;
        mCheckURI[iTokenURI] = newItemId; //save URI to check uniqueness

        //event
        emit Mint(to, newItemId);
        return newItemId;
    }

    //to fix error: Derived contract must override function "supportsInterface".
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
