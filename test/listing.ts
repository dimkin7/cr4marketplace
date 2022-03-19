import { expect } from "chai";
import { ethers } from "hardhat";
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

  const TOKEN_URI_1 = "https://ipfs.io/ipfs/QmP2aNgzCpt5Rz8zTifc7X2BB2E39ZTTzo3HwbghaxiWbK/4.json";
  const TOKEN_ID_1 = 1;

  before(async function () {
    console.log("before");

    [owner, creator, ownerNFT, buyer1] = await ethers.getSigners();

    //create erc20
    const factoryERC20 = await ethers.getContractFactory("DimaERC20");
    erc20 = await factoryERC20.deploy(ethers.utils.parseUnits("300.0", 18));
    await erc20.deployed();
    //send ERC20 to buyers
    await erc20.transfer(buyer1.address, ethers.utils.parseUnits("100.0", 18));

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

  describe("Listing", function () {

    it("Create Item", async function () {
      await expect(marketplace.connect(creator).createItem(TOKEN_URI_1, ownerNFT.address))
        .to.emit(marketplace, "ItemCreated")
        .withArgs(TOKEN_URI_1, ownerNFT.address, TOKEN_ID_1);  //event ItemCreated(string tokenURI, address owner, uint256 tokenId);

      expect(await nft.ownerOf(TOKEN_ID_1)).to.equal(ownerNFT.address);
    });


    it("Mint no-marketplace", async function () {
      await expect(nft.mint(TOKEN_URI_1, ownerNFT.address)).to.be.reverted;
    });


    it("List item", async function () {
      //approve
      await nft.connect(ownerNFT).approve(marketplace.address, TOKEN_ID_1);

      await expect(marketplace.connect(ownerNFT).listItem(TOKEN_ID_1, ethers.utils.parseUnits("5.0", 18)))
        .to.emit(marketplace, "ItemListed")
        .withArgs(TOKEN_ID_1, ownerNFT.address, ethers.utils.parseUnits("5.0", 18));  //event ItemListed(uint256 tokenId, address seller, uint256 price);
      expect(await nft.ownerOf(TOKEN_ID_1)).to.equal(marketplace.address);
    });

    it("Cancel listing", async function () {
      await expect(marketplace.connect(ownerNFT).cancel(TOKEN_ID_1))
        .to.emit(marketplace, "ListingCanceled")
        .withArgs(TOKEN_ID_1, ownerNFT.address);  //event ListingCanceled(uint256 tokenId, address seller);
      expect(await nft.ownerOf(TOKEN_ID_1)).to.equal(ownerNFT.address);
    });

    it("Buy non listed", async function () {
      await expect(marketplace.connect(buyer1).buyItem(TOKEN_ID_1)).to.be.revertedWith("Token isn't on sale.");
    });

    it("List item 2", async function () {
      //approve
      await nft.connect(ownerNFT).approve(marketplace.address, TOKEN_ID_1);

      await expect(marketplace.connect(ownerNFT).listItem(TOKEN_ID_1, ethers.utils.parseUnits("10.0", 18)))
        .to.emit(marketplace, "ItemListed")
        .withArgs(TOKEN_ID_1, ownerNFT.address, ethers.utils.parseUnits("10.0", 18));  //event ItemListed(uint256 tokenId, address seller, uint256 price);
    });

    //////// > Buy2
    it("Buy 2  check balance before (1)", async function () {
      expect(await nft.ownerOf(TOKEN_ID_1)).to.equal(marketplace.address);
    });
    it("Buy 2  check balance before (2)", async function () {
      expect(await erc20.balanceOf(buyer1.address)).to.equal(ethers.utils.parseUnits("100.0", 18));
    });
    it("Buy 2  check balance before (3)", async function () {
      expect(await erc20.balanceOf(ownerNFT.address)).to.equal(ethers.utils.parseUnits("0.0", 18));
    });

    it("Buy 2 approve erc20", async function () {
      //approve erc20 to marketplace
      await expect(erc20.connect(buyer1).approve(marketplace.address, ethers.utils.parseUnits("10.0", 18)))
        .to.emit(erc20, "Approval")
        .withArgs(buyer1.address, marketplace.address, ethers.utils.parseUnits("10.0", 18)); //Approval(address owner, address approved, uint256 tokenId)
    });

    it("Buy 2", async function () {
      await expect(marketplace.connect(buyer1).buyItem(TOKEN_ID_1))
        .to.emit(marketplace, "BuyItem")
        .withArgs(TOKEN_ID_1); //event BuyItem(uint256 tokenId);

    });

    it("Buy 2  check balance after (1)", async function () {
      expect(await nft.ownerOf(TOKEN_ID_1)).to.equal(buyer1.address);
    });
    it("Buy 2  check balance after (2)", async function () {
      expect(await erc20.balanceOf(buyer1.address)).to.equal(ethers.utils.parseUnits("90.0", 18));
    });
    it("Buy 2  check balance after (3)", async function () {
      expect(await erc20.balanceOf(ownerNFT.address)).to.equal(ethers.utils.parseUnits("10.0", 18));
    });
    //////// < Buy2

    it("Buy 2 error", async function () {
      await expect(marketplace.connect(buyer1).buyItem(TOKEN_ID_1)).to.be.revertedWith("Token isn't on sale.");
    });

  });

});