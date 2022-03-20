import { ethers } from "hardhat";

async function main() {
  // deploy
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  const balance = await deployer.getBalance();
  console.log("Account balance:", ethers.utils.formatEther(balance));

  const factoryERC20 = await ethers.getContractFactory("DimaERC20");
  const contractERC20 = await factoryERC20.deploy(ethers.utils.parseUnits("10000.0", 18));
  await contractERC20.deployed();
  console.log("Contract DimaERC20 deployed to:", contractERC20.address);

  const factoryMP = await ethers.getContractFactory("DimaMarketplace");
  const contractMP = await factoryMP.deploy(contractERC20.address);
  await contractMP.deployed();
  console.log("Contract DimaMarketplace deployed to:", contractMP.address);

  const factoryNFT = await ethers.getContractFactory("DimaNFT");
  const contractNFT = await factoryNFT.deploy(contractMP.address);
  await contractNFT.deployed();
  console.log("Contract DimaNFT deployed to:", contractNFT.address);
}

// run
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
