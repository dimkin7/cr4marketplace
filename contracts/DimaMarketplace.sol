//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

//import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IERC721ForMarketplace is IERC721 {
    function mint(string memory tokenURI, address to)
        external
        returns (uint256);
}

contract DimaMarketplace is Ownable {
    IERC721ForMarketplace private mNFT;
    IERC20 private mERC20;

    struct Order {
        address seller;
        uint256 price;
        bool statusOnSale;
    }

    struct Auction {
        address seller;
        address bidder;
        bool statusOnSale;
        uint256 minPrice;
        uint256 curPrice;
        uint256 startTime;
        uint256 bidCount;
    }

    //tokenId => Order
    mapping(uint256 => Order) public listing;
    mapping(uint256 => Auction) public listingAuction;

    //NFT, ERC20 for marketplace
    constructor(address erc20Addr) {
        mERC20 = IERC20(erc20Addr);
    }

    function setNft(address nftAddr) public onlyOwner {
        mNFT = IERC721ForMarketplace(nftAddr);
    }

    //event create new item
    event ItemCreated(string tokenURI, address owner, uint256 tokenId);

    //create new item
    function createItem(string memory tokenURI, address owner) public {
        uint256 tokenId = mNFT.mint(tokenURI, owner);
        //event
        emit ItemCreated(tokenURI, owner, tokenId);
    }

    event ItemListed(uint256 tokenId, address seller, uint256 price);

    //Selling the item
    function listItem(uint256 tokenId, uint256 price) public {
        require(price > 0, "Price should be > 0.");

        _getNftToMarketplace(tokenId);

        //get order if exist
        Order memory order = listing[tokenId];
        order.seller = msg.sender;
        order.price = price;
        order.statusOnSale = true;
        listing[tokenId] = order;
        //event
        emit ItemListed(tokenId, order.seller, order.price);
    }

    function _getNftToMarketplace(uint256 tokenId) private {
        //check the owner
        require(msg.sender == mNFT.ownerOf(tokenId), "You are not the owner.");

        //TODO тут наверное не нужно проверять на апрув, ведь вызывает владелец
        // //check approval
        // require(
        //     address(this) == mNFT.getApproved(tokenId),
        //     "Approve the token for the Marketplace."
        // );

        //during the listing the NFT transfers to marketplace
        //address from, address to, uint256 tokenId
        mNFT.transferFrom(msg.sender, address(this), tokenId); //TODO safeTransferFrom
    }

    event ListingCanceled(uint256 tokenId, address seller);

    //sales cancellation
    function cancel(uint256 tokenId) public {
        Order memory order = listing[tokenId];
        //check the seller
        require(msg.sender == order.seller, "You are not the seller.");
        //check status
        require(true == order.statusOnSale, "Token isn't on sale.");
        //give back
        mNFT.transferFrom(address(this), order.seller, tokenId);
        //not on sale
        order.statusOnSale = false;
        listing[tokenId] = order;
        //event
        emit ListingCanceled(tokenId, order.seller);
    }

    event BuyItem(uint256 tokenId);

    function buyItem(uint256 tokenId) public {
        Order memory order = listing[tokenId];
        //check status
        require(true == order.statusOnSale, "Token isn't on sale.");

        //withdraw price
        //console.log("withdraw price:", order.seller, order.price);
        //console.log("mERC20 amount:", mERC20.balanceOf(msg.sender));
        bool res = mERC20.transferFrom(msg.sender, order.seller, order.price);
        //console.log("res:", res);
        require(true == res, "ERC20 transfer fails.");

        //send to buyer
        mNFT.transferFrom(address(this), msg.sender, tokenId);
        //TODO - нужно ли проверять результат и как? Ловить событие? Если ошибка перевод ERC20 откатится? - если ошибка в require то откатится

        //not on sale
        order.statusOnSale = false;
        listing[tokenId] = order;
        //TODO - почитать и спросить - Possible reentrancy vulnerabilities. Avoid state changes after transfer. [reentrancy]
        //https://medium.com/coinmonks/protect-your-solidity-smart-contracts-from-reentrancy-attacks-9972c3af7c21

        //event
        emit BuyItem(tokenId);
    }

    event ListItemOnAuction(uint256 tokenId, address seller, uint256 minPrice);

    function listItemOnAuction(uint256 tokenId, uint256 minPrice) public {
        require(minPrice > 0, "Min price should be > 0.");

        _getNftToMarketplace(tokenId);

        //get auction if exist
        Auction memory auction = listingAuction[tokenId];
        require(
            false == auction.statusOnSale,
            "The auction is already working." //It's impossible because NFT goes to Marketplace
        );
        delete auction; //clear fields
        auction.seller = msg.sender;
        auction.minPrice = minPrice;
        auction.statusOnSale = true;
        auction.startTime = block.timestamp;
        listingAuction[tokenId] = auction;

        //event
        emit ListItemOnAuction(tokenId, auction.seller, auction.minPrice);
    }

    event MakeBid(uint256 tokenId, uint256 price, address bidder);

    function makeBid(uint256 tokenId, uint256 price) public {
        bool res;
        Auction memory auction = listingAuction[tokenId];
        require(true == auction.statusOnSale, "There is no auction.");
        require(price > auction.minPrice, "Prise should be > min price.");
        require(price > auction.curPrice, "Prise should be > current price.");

        //return tokens
        if (auction.bidder != address(0)) {
            res = mERC20.transfer(auction.bidder, auction.curPrice);
            require(true == res, "ERC20 return fails.");
        }

        //get tokens
        res = mERC20.transferFrom(msg.sender, address(this), price);
        require(true == res, "Geting ERC20 fails.");

        //update auction order
        auction.curPrice = price;
        auction.bidder = msg.sender;
        auction.bidCount++;
        listingAuction[tokenId] = auction;

        //event
        emit MakeBid(tokenId, price, msg.sender);
    }

    event FinishAuction(uint256 tokenId, bool success);

    //finish and send NFT to the winner
    function finishAuction(uint256 tokenId) public {
        bool res;
        bool success;
        Auction memory auction = listingAuction[tokenId];
        require(true == auction.statusOnSale, "There is no auction.");

        //the auction lasts 3 days
        require(auction.startTime + 3 days <= block.timestamp, "Wait 3 days.");

        //auction was successful
        if (auction.bidCount > 2) {
            mNFT.transferFrom(address(this), auction.bidder, tokenId);
            res = mERC20.transfer(auction.seller, auction.curPrice);
            require(true == res, "ERC20 transfer fails.");
            success = true;
        } else {
            //cancel auction
            _returnNftAndTokens(auction, tokenId);
        }

        console.log("success:", success);

        //update status
        auction.statusOnSale = false;
        listingAuction[tokenId] = auction;
        //event
        emit FinishAuction(tokenId, success);
    }

    event CancelAuction(uint256 tokenId, address seller);

    //seller can cancel
    function cancelAuction(uint256 tokenId) public {
        Auction memory auction = listingAuction[tokenId];
        require(true == auction.statusOnSale, "There is no auction.");
        //check the seller
        require(msg.sender == auction.seller, "You are not the seller.");

        //cancel auction
        _returnNftAndTokens(auction, tokenId);

        //update status
        auction.statusOnSale = false;
        listingAuction[tokenId] = auction;

        //event
        emit CancelAuction(tokenId, auction.seller);
    }

    function _returnNftAndTokens(Auction memory auction, uint256 tokenId)
        private
    {
        bool res;
        //return tokens
        if (auction.bidder != address(0)) {
            res = mERC20.transfer(auction.bidder, auction.curPrice);
            require(true == res, "ERC20 return fails.");
        }
        //return NFT to seller
        mNFT.transferFrom(address(this), auction.seller, tokenId);
    }

    //for IERC721Receiver
    // function onERC721Received(
    //     address operator,
    //     address from,
    //     uint256 tokenId,
    //     bytes calldata data
    // ) external override returns (bytes4) {
    //     return 0x00000000; //TODO - что это?
    // }
}
