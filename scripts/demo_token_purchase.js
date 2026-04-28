require("dotenv").config();
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

/**
 * @title Demonstração de compra on-chain de EnergyToken
 * @author Patrício Alves
 * @notice Este script demonstra o fluxo:
 *         1. leitura dos contratos implantados
 *         2. consulta do saldo do comprador antes da compra
 *         3. compra de EnergyToken com ETH na tesouraria
 *         4. consulta do saldo depois da compra
 *
 * @dev Este script usa:
 *      - Account #0 como owner
 *      - Account #1 como buyer
 */

async function main() {
  const [owner, buyer] = await ethers.getSigners();
  const networkName = hre.network.name;

  const deploymentFile = path.join(
    __dirname,
    "..",
    "deployments",
    `${networkName}.json`
  );

  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Arquivo de deployment não encontrado: ${deploymentFile}`);
  }

  const addresses = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));

  const energyToken = await ethers.getContractAt(
    "EnergyToken",
    addresses.EnergyToken
  );

  const treasury = await ethers.getContractAt(
    "MarketplaceTreasury",
    addresses.MarketplaceTreasury
  );

  console.log("Owner:", owner.address);
  console.log("Buyer:", buyer.address);

  const buyerEthBefore = await ethers.provider.getBalance(buyer.address);
  const buyerTokenBefore = await energyToken.balanceOf(buyer.address);
  const treasuryTokenBefore = await energyToken.balanceOf(
    addresses.MarketplaceTreasury
  );

  console.log("\nAntes da compra:");
  console.log({
    buyerEthBefore: buyerEthBefore.toString(),
    buyerTokenBefore: buyerTokenBefore.toString(),
    treasuryTokenBefore: treasuryTokenBefore.toString(),
  });

  /**
   * @dev O buyer compra tokens enviando 1 ETH.
   *
   * Com a taxa atual de 1000 tokens por ETH,
   * o buyer deve receber 1000 EnergyToken.
   */
  const tx = await treasury.connect(buyer).buyTokens({
    value: ethers.parseEther("1"),
  });
  await tx.wait();

  const buyerEthAfter = await ethers.provider.getBalance(buyer.address);
  const buyerTokenAfter = await energyToken.balanceOf(buyer.address);
  const treasuryTokenAfter = await energyToken.balanceOf(
    addresses.MarketplaceTreasury
  );

  console.log("\nDepois da compra:");
  console.log({
    buyerEthAfter: buyerEthAfter.toString(),
    buyerTokenAfter: buyerTokenAfter.toString(),
    treasuryTokenAfter: treasuryTokenAfter.toString(),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});