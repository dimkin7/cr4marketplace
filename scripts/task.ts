import { HardhatUserConfig, task } from "hardhat/config";

const contractAddr = '0x1efdf440B4568F5Da1A2c1137D32CE41107d620c';
const erc1155 = '0x6f0d6753F26E865A78Ce1B240647a53B9EFf4726';

const DimaERC20 = '0x535193506f0Ffc52a185E7918249DF65969F8038';
const DimaMarketplace = '0xfb3948EEaB8660a446a364CeBB5b9B185EAde344';
const DimaNFT = '0xb52F76d755a4A49a29134000637fFaB92a7Efb3a';


//set NFT for Marketplace
//marketplace.setNft(nft.address);
//npx hardhat setnft --network rinkeby --key KEY 
task("setnft", "set NFT for Marketplace")
  .addParam("key", "Your private key")
  .setAction(async (taskArgs, hre) => {
    const abi = [
      "function setNft(address nftAddr) public"
    ];
    const provider = new hre.ethers.providers.AlchemyProvider("rinkeby");
    const signer = new hre.ethers.Wallet(taskArgs.key, provider);
    const marketplace = new hre.ethers.Contract(DimaMarketplace, abi, signer);

    let success = await marketplace.setNft(DimaNFT);
    console.log('setNft: ', success);
  });


// function createItem(string memory tokenURI, address owner)
//npx hardhat createitem --network rinkeby --key KEY --tokenuri "https://ipfs.io/ipfs/QmP2aNgzCpt5Rz8zTifc7X2BB2E39ZTTzo3HwbghaxiWbK/4.json" --owner 0x7EA751f8B46E08F7397904A39b3e08901B5D1659
task("createitem", "createitem")
  .addParam("key", "Your private key")
  .addParam("tokenuri", "tokenURI")
  .addParam("owner", "owner")
  .setAction(async (taskArgs, hre) => {
    const abi = [
      "function createItem(string memory tokenURI, address owner)"
    ];

    const provider = new hre.ethers.providers.AlchemyProvider("rinkeby");
    const signer = new hre.ethers.Wallet(taskArgs.key, provider);
    const marketplace = new hre.ethers.Contract(DimaMarketplace, abi, signer);

    let success = await marketplace.createItem(taskArgs.tokenuri, taskArgs.owner);
    console.log('setNft: ', success);
  });

