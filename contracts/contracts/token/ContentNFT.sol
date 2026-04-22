// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ContentNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    mapping(uint256 => bytes32) public tokenToContentId;
    mapping(bytes32 => uint256) public contentIdToToken;

    event ContentNFTMinted(uint256 indexed tokenId, bytes32 indexed contentId, address indexed creator);

    constructor() ERC721("Copyright Content NFT", "CCNFT") Ownable(msg.sender) {}

    function mintContentNFT(
        address to,
        bytes32 contentId,
        string memory uri
    ) external returns (uint256) {
        require(contentIdToToken[contentId] == 0, "NFT already minted for this content");
        
        uint256 tokenId = _tokenIdCounter++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        tokenToContentId[tokenId] = contentId;
        contentIdToToken[contentId] = tokenId;
        
        emit ContentNFTMinted(tokenId, contentId, to);
        
        return tokenId;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
