import { expect } from "chai";
import { ethers } from "hardhat";
import { network } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Marketplace", function () {

  let erc20: Contract;
  let nft: Contract;
  let marketplace: Contract;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let ownerNFT: SignerWithAddress;
  let buyer1: SignerWithAddress;
  let buyer2: SignerWithAddress;
  let buyer3: SignerWithAddress;

  const TOKEN_URI_2 = "https://ipfs.io/ipfs/QmP2aNgzCpt5Rz8zTifc7X2BB2E39ZTTzo3HwbghaxiWbK/5.json";
  const TOKEN_ID_2 = 1;

  before(async function () {
    [owner, creator, ownerNFT, buyer1, buyer2, buyer3] = await ethers.getSigners();

    //create erc20
    const factoryERC20 = await ethers.getContractFactory("DimaERC20");
    erc20 = await factoryERC20.deploy(ethers.utils.parseUnits("300.0", 18));
    await erc20.deployed();
    //send ERC20 to buyers
    await erc20.transfer(buyer1.address, ethers.utils.parseUnits("100.0", 18));
    await erc20.transfer(buyer2.address, ethers.utils.parseUnits("100.0", 18));
    await erc20.transfer(buyer3.address, ethers.utils.parseUnits("100.0", 18));

    //create marketplace
    const factoryMarketplace = await ethers.getContractFactory("DimaMarketplace");
    marketplace = await factoryMarketplace.deploy(erc20.address);
    await marketplace.deployed();

    //create NFT
    const factoryNFT = await ethers.getContractFactory("DimaNFT");
    nft = await factoryNFT.deploy(marketplace.address);
    await nft.deployed();

    //set NFT for Marketplace
    await marketplace.setNft(nft.address);
  });


  describe("Auction", function () {
    it("Create Item", async function () {
      await expect(marketplace.connect(creator).createItem(TOKEN_URI_2, ownerNFT.address))
        .to.emit(marketplace, "ItemCreated")
        .withArgs(TOKEN_URI_2, ownerNFT.address, TOKEN_ID_2);  //event ItemCreated(string tokenURI, address owner, uint256 tokenId);
      expect(await nft.ownerOf(TOKEN_ID_2)).to.equal(ownerNFT.address);
    });

    it("List on auction with 0 minPrice", async function () {
      //approve
      await nft.connect(ownerNFT).approve(marketplace.address, TOKEN_ID_2);
      await expect(marketplace.connect(ownerNFT).listItemOnAuction(TOKEN_ID_2, ethers.utils.parseUnits("0.0", 18))).to.be.revertedWith("Min price should be > 0.");
    });

    it("List item on auction", async function () {
      //approve
      await nft.connect(ownerNFT).approve(marketplace.address, TOKEN_ID_2);

      await expect(marketplace.connect(ownerNFT).listItemOnAuction(TOKEN_ID_2, ethers.utils.parseUnits("15.0", 18)))
        .to.emit(marketplace, "ListItemOnAuction")
        .withArgs(TOKEN_ID_2, ownerNFT.address, ethers.utils.parseUnits("15.0", 18));  //event ListItemOnAuction(uint256 tokenId, address seller, uint256 minPrice);
      expect(await nft.ownerOf(TOKEN_ID_2)).to.equal(marketplace.address);
    });


    it("Cancel auction", async function () {
      await expect(marketplace.connect(ownerNFT).cancelAuction(TOKEN_ID_2))
        .to.emit(marketplace, "CancelAuction")
        .withArgs(TOKEN_ID_2, ownerNFT.address);  //event ListingCanceled(uint256 tokenId, address seller);
      expect(await nft.ownerOf(TOKEN_ID_2)).to.equal(ownerNFT.address);
    });

    it("Make bid error", async function () {
      await expect(marketplace.connect(buyer1).makeBid(TOKEN_ID_2, ethers.utils.parseUnits("20.0", 18)))
        .to.be.revertedWith("There is no auction.");
    });


    ///// listing 2
    it("List2", async function () {
      //approve 
      await nft.connect(ownerNFT).approve(marketplace.address, TOKEN_ID_2);

      //ownerNFT starts auction for min 20 
      await expect(marketplace.connect(ownerNFT).listItemOnAuction(TOKEN_ID_2, ethers.utils.parseUnits("20.0", 18)))
        .to.emit(marketplace, "ListItemOnAuction")
        .withArgs(TOKEN_ID_2, ownerNFT.address, ethers.utils.parseUnits("20.0", 18));  //event ListItemOnAuction(uint256 tokenId, address seller, uint256 minPrice);
      expect(await nft.ownerOf(TOKEN_ID_2)).to.equal(marketplace.address);
    });

    //buyer1 makes bid with 10 - too small
    it("buyer1 makes bid with 10 - too small", async function () {
      await expect(marketplace.connect(buyer1).makeBid(TOKEN_ID_2, ethers.utils.parseUnits("10.0", 18)))
        .to.be.revertedWith("Prise should be > min price.");
    });

    //buyer1 makes bid with 30
    it("Make bid 2.1  check balance before (marketplace nft)", async function () {
      expect(await nft.ownerOf(TOKEN_ID_2)).to.equal(marketplace.address);
    });
    it("Make bid 2.1  check balance before (buyer1 erc20)", async function () {
      expect(await erc20.balanceOf(buyer1.address)).to.equal(ethers.utils.parseUnits("100.0", 18));
    });
    it("Make bid 2.1  check balance before (marketplace erc20)", async function () {
      expect(await erc20.balanceOf(marketplace.address)).to.equal(ethers.utils.parseUnits("0.0", 18));
    });

    it("Make bid 2.1 approve erc20", async function () {
      //approve erc20 to marketplace
      await expect(erc20.connect(buyer1).approve(marketplace.address, ethers.utils.parseUnits("30.0", 18)))
        .to.emit(erc20, "Approval")
        .withArgs(buyer1.address, marketplace.address, ethers.utils.parseUnits("30.0", 18)); //Approval(address owner, address approved, uint256 tokenId)
    });

    it("Make bid 2.1", async function () {
      await expect(marketplace.connect(buyer1).makeBid(TOKEN_ID_2, ethers.utils.parseUnits("30.0", 18)))
        .to.emit(marketplace, "MakeBid")
        .withArgs(TOKEN_ID_2, ethers.utils.parseUnits("30.0", 18), buyer1.address); //event MakeBid(uint256 tokenId, uint256 price, address bidder);
    });

    it("Make bid 2.1  check balance after (marketplace nft)", async function () {
      expect(await nft.ownerOf(TOKEN_ID_2)).to.equal(marketplace.address);
    });
    it("Make bid 2.1  check balance after (buyer1 erc20)", async function () {
      expect(await erc20.balanceOf(buyer1.address)).to.equal(ethers.utils.parseUnits("70.0", 18));
    });
    it("Make bid 2.1  check balance after (marketplace erc20)", async function () {
      expect(await erc20.balanceOf(marketplace.address)).to.equal(ethers.utils.parseUnits("30.0", 18));
    });


    //buyer2 makes bid with 40
    it("Make bid 2.2 approve erc20", async function () {
      //approve erc20 to marketplace
      await expect(erc20.connect(buyer2).approve(marketplace.address, ethers.utils.parseUnits("40.0", 18)))
        .to.emit(erc20, "Approval")
        .withArgs(buyer2.address, marketplace.address, ethers.utils.parseUnits("40.0", 18)); //Approval(address owner, address approved, uint256 tokenId)
    });

    it("Make bid 2.2", async function () {
      await expect(marketplace.connect(buyer2).makeBid(TOKEN_ID_2, ethers.utils.parseUnits("40.0", 18)))
        .to.emit(marketplace, "MakeBid")
        .withArgs(TOKEN_ID_2, ethers.utils.parseUnits("40.0", 18), buyer2.address); //event MakeBid(uint256 tokenId, uint256 price, address bidder);
    });

    it("Make bid 2.2  check balance after (marketplace nft)", async function () {
      expect(await nft.ownerOf(TOKEN_ID_2)).to.equal(marketplace.address);
    });
    it("Make bid 2.2  check balance after (buyer1 erc20)", async function () {
      expect(await erc20.balanceOf(buyer1.address)).to.equal(ethers.utils.parseUnits("100.0", 18));
    });
    it("Make bid 2.2  check balance after (marketplace erc20)", async function () {
      expect(await erc20.balanceOf(marketplace.address)).to.equal(ethers.utils.parseUnits("40.0", 18));
    });
    it("Make bid 2.2  check balance after (buyer2 erc20)", async function () {
      expect(await erc20.balanceOf(buyer2.address)).to.equal(ethers.utils.parseUnits("60.0", 18));
    });

    it("Finish auction too early", async function () {
      await expect(marketplace.connect(ownerNFT).finishAuction(TOKEN_ID_2)).to.be.revertedWith("Wait 3 days.");
    });

    it("Wait 3 days", async function () {
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 3]);
    });

    //buyer1 makes bid with 40 - too small
    it("buyer1 makes bid with 40 - too small", async function () {
      await expect(marketplace.connect(buyer1).makeBid(TOKEN_ID_2, ethers.utils.parseUnits("40.0", 18)))
        .to.be.revertedWith("Prise should be > current price.");
    });

    //cancel not seller
    it("cancel not seller", async function () {
      await expect(marketplace.connect(buyer1).cancelAuction(TOKEN_ID_2))
        .to.be.revertedWith("You are not the seller.");
    });

    //buyer3 makes bid with 45
    it("Make bid 2.3 approve erc20", async function () {
      //approve erc20 to marketplace
      await expect(erc20.connect(buyer3).approve(marketplace.address, ethers.utils.parseUnits("45.0", 18)))
        .to.emit(erc20, "Approval")
        .withArgs(buyer3.address, marketplace.address, ethers.utils.parseUnits("45.0", 18)); //Approval(address owner, address approved, uint256 tokenId)
    });

    it("Make bid 2.3", async function () {
      await expect(marketplace.connect(buyer3).makeBid(TOKEN_ID_2, ethers.utils.parseUnits("45.0", 18)))
        .to.emit(marketplace, "MakeBid")
        .withArgs(TOKEN_ID_2, ethers.utils.parseUnits("45.0", 18), buyer3.address); //event MakeBid(uint256 tokenId, uint256 price, address bidder);
    });

    it("Make bid 2.3  check balance after (marketplace nft)", async function () {
      expect(await nft.ownerOf(TOKEN_ID_2)).to.equal(marketplace.address);
    });
    it("Make bid 2.3  check balance after (buyer2 erc20)", async function () {
      expect(await erc20.balanceOf(buyer2.address)).to.equal(ethers.utils.parseUnits("100.0", 18));
    });
    it("Make bid 2.3  check balance after (marketplace erc20)", async function () {
      expect(await erc20.balanceOf(marketplace.address)).to.equal(ethers.utils.parseUnits("45.0", 18));
    });
    it("Make bid 2.3  check balance after (buyer3 erc20)", async function () {
      expect(await erc20.balanceOf(buyer3.address)).to.equal(ethers.utils.parseUnits("55.0", 18));
    });

    //Finish auction - success
    it("Finish auction - success", async function () {
      await expect(marketplace.connect(buyer3).finishAuction(TOKEN_ID_2))
        .to.emit(marketplace, "FinishAuction")
        .withArgs(TOKEN_ID_2, true); //event FinishAuction(uint256 tokenId, bool success);
    });

    it("Finish auction  check balance after (buyer3 nft)", async function () {
      expect(await nft.ownerOf(TOKEN_ID_2)).to.equal(buyer3.address);
    });
    it("Finish auction  check balance after (buyer2 erc20)", async function () {
      expect(await erc20.balanceOf(buyer2.address)).to.equal(ethers.utils.parseUnits("100.0", 18));
    });
    it("Finish auction  check balance after (marketplace erc20)", async function () {
      expect(await erc20.balanceOf(marketplace.address)).to.equal(ethers.utils.parseUnits("0.0", 18));
    });
    it("Finish auction  check balance after (buyer3 erc20)", async function () {
      expect(await erc20.balanceOf(buyer3.address)).to.equal(ethers.utils.parseUnits("55.0", 18));
    });
    it("Finish auction  check balance after (ownerNFT erc20)", async function () {
      expect(await erc20.balanceOf(ownerNFT.address)).to.equal(ethers.utils.parseUnits("45.0", 18));
    });


    //Finish auction twice
    it("Finish auction twice", async function () {
      await expect(marketplace.connect(buyer3).finishAuction(TOKEN_ID_2))
        .to.be.revertedWith("There is no auction.");
    });

    it("cancel not active", async function () {
      await expect(marketplace.connect(ownerNFT).cancelAuction(TOKEN_ID_2))
        .to.be.revertedWith("There is no auction.");
    });
  });



  ///// listing 3 - test low bids
  describe("Auction 2 bids", function () {
    it("List3", async function () {
      //approve 
      await nft.connect(buyer3).approve(marketplace.address, TOKEN_ID_2);

      //buyer3 starts auction for min 20
      await expect(marketplace.connect(buyer3).listItemOnAuction(TOKEN_ID_2, ethers.utils.parseUnits("20.0", 18)))
        .to.emit(marketplace, "ListItemOnAuction")
        .withArgs(TOKEN_ID_2, buyer3.address, ethers.utils.parseUnits("20.0", 18));  //event ListItemOnAuction(uint256 tokenId, address seller, uint256 minPrice);
      expect(await nft.ownerOf(TOKEN_ID_2)).to.equal(marketplace.address);
    });

    //buyer1 makes bid with 30
    it("Make bid 3.1 approve erc20", async function () {
      //approve erc20 to marketplace
      await expect(erc20.connect(buyer1).approve(marketplace.address, ethers.utils.parseUnits("30.0", 18)))
        .to.emit(erc20, "Approval")
        .withArgs(buyer1.address, marketplace.address, ethers.utils.parseUnits("30.0", 18)); //Approval(address owner, address approved, uint256 tokenId)
    });
    it("Make bid 3.1", async function () {
      await expect(marketplace.connect(buyer1).makeBid(TOKEN_ID_2, ethers.utils.parseUnits("30.0", 18)))
        .to.emit(marketplace, "MakeBid")
        .withArgs(TOKEN_ID_2, ethers.utils.parseUnits("30.0", 18), buyer1.address); //event MakeBid(uint256 tokenId, uint256 price, address bidder);
    });

    //buyer2 makes bid with 40
    it("Make bid 3.2 approve erc20", async function () {
      //approve erc20 to marketplace
      await expect(erc20.connect(buyer2).approve(marketplace.address, ethers.utils.parseUnits("40.0", 18)))
        .to.emit(erc20, "Approval")
        .withArgs(buyer2.address, marketplace.address, ethers.utils.parseUnits("40.0", 18)); //Approval(address owner, address approved, uint256 tokenId)
    });
    it("Make bid 3.2", async function () {
      await expect(marketplace.connect(buyer2).makeBid(TOKEN_ID_2, ethers.utils.parseUnits("40.0", 18)))
        .to.emit(marketplace, "MakeBid")
        .withArgs(TOKEN_ID_2, ethers.utils.parseUnits("40.0", 18), buyer2.address); //event MakeBid(uint256 tokenId, uint256 price, address bidder);
    });
    it("Wait 3 days", async function () {
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 3]);
    });


    //Finish auction - NOT success
    it("Finish auction - NOT success", async function () {
      await expect(marketplace.finishAuction(TOKEN_ID_2))
        .to.emit(marketplace, "FinishAuction")
        .withArgs(TOKEN_ID_2, false); //event FinishAuction(uint256 tokenId, bool success);
    });

    it("Finish auction  check balance after (buyer3 nft)", async function () {
      expect(await nft.ownerOf(TOKEN_ID_2)).to.equal(buyer3.address);
    });
    it("Finish auction  check balance after (buyer1 erc20)", async function () {
      expect(await erc20.balanceOf(buyer1.address)).to.equal(ethers.utils.parseUnits("100.0", 18));
    });
    it("Finish auction  check balance after (buyer2 erc20)", async function () {
      expect(await erc20.balanceOf(buyer2.address)).to.equal(ethers.utils.parseUnits("100.0", 18));
    });
    it("Finish auction  check balance after (marketplace erc20)", async function () {
      expect(await erc20.balanceOf(marketplace.address)).to.equal(ethers.utils.parseUnits("0.0", 18));
    });
    it("Finish auction  check balance after (buyer3 erc20)", async function () {
      expect(await erc20.balanceOf(buyer3.address)).to.equal(ethers.utils.parseUnits("55.0", 18));
    });



  });

});