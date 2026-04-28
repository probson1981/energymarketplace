const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const networkName = hre.network.name;

  const deploymentFile = path.join(
    __dirname,
    "..",
    "deployments",
    `${networkName}.json`
  );

  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Arquivo não encontrado: ${deploymentFile}`);
  }

  const addresses = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));

  const [account] = await ethers.getSigners();

  const energyToken = await ethers.getContractAt(
    "EnergyToken",
    addresses.EnergyToken
  );

  const supplierCollateral = await ethers.getContractAt(
    "SupplierCollateral",
    addresses.SupplierCollateral
  );

  const supplierStaking = await ethers.getContractAt(
    "SupplierStaking",
    addresses.SupplierStaking
  );

  const treasury = await ethers.getContractAt(
    "MarketplaceTreasury",
    addresses.MarketplaceTreasury
  );

  const minimumCollateral = await supplierCollateral.minimumCollateral();
  const collateralBalance = await supplierCollateral.collateralBalance(
    account.address
  );

  const stakedBalance = await supplierStaking.stakedBalance(account.address);

  const walletTokenBalance = await energyToken.balanceOf(account.address);
  const collateralContractBalance = await energyToken.balanceOf(
    addresses.SupplierCollateral
  );
  const stakingContractBalance = await energyToken.balanceOf(
    addresses.SupplierStaking
  );
  const treasuryTokenBalance = await energyToken.balanceOf(
    addresses.MarketplaceTreasury
  );

  console.log("Rede:", networkName);
  console.log("Conta:", account.address);

  console.log("\n--- Caução ---");
  console.log("Caução mínima raw:", minimumCollateral.toString());
  console.log(
    "Caução mínima formatada:",
    ethers.formatUnits(minimumCollateral, 18),
    "EnergyToken"
  );

  console.log("Caução do fornecedor raw:", collateralBalance.toString());
  console.log(
    "Caução do fornecedor formatada:",
    ethers.formatUnits(collateralBalance, 18),
    "EnergyToken"
  );

  console.log("\n--- Staking ---");
  console.log("Stake raw:", stakedBalance.toString());
  console.log(
    "Stake formatado:",
    ethers.formatUnits(stakedBalance, 18),
    "EnergyToken"
  );

  console.log("\n--- Saldos de EnergyToken ---");
  console.log(
    "Carteira:",
    ethers.formatUnits(walletTokenBalance, 18),
    "EnergyToken"
  );
  console.log(
    "Contrato SupplierCollateral:",
    ethers.formatUnits(collateralContractBalance, 18),
    "EnergyToken"
  );
  console.log(
    "Contrato SupplierStaking:",
    ethers.formatUnits(stakingContractBalance, 18),
    "EnergyToken"
  );
  console.log(
    "Contrato MarketplaceTreasury:",
    ethers.formatUnits(treasuryTokenBalance, 18),
    "EnergyToken"
  );

  console.log("\n--- Tesouraria ---");
  const tokenPerEth = await treasury.tokenPerEth();
  console.log("Token por ETH raw:", tokenPerEth.toString());
  console.log(
    "Token por ETH formatado:",
    ethers.formatUnits(tokenPerEth, 18),
    "EnergyToken por ETH"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});