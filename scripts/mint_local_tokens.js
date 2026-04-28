require("dotenv").config();
const hre = require("hardhat");
const { ethers } = hre;

/**
 * @title Script para cunhar tokens locais do protocolo
 * @author Patrício Alves
 * @notice Este script cunha EnergyToken para um endereço informado.
 *
 * @dev Uso:
 *      npx hardhat run scripts/mint_local_tokens.js --network localhost --address 0x...
 *
 *      Como alternativa simples, você também pode editar diretamente
 *      o endereço no código abaixo, se preferir.
 */

async function main() {
  /**
   * @dev Conta que executa a cunhagem.
   *
   *      No modelo atual, o owner pode cunhar diretamente.
   */
  const [owner] = await ethers.getSigners();

  /**
   * @dev Endereço do token carregado do deployments local.
   */
  const deployments = require("../deployments/localhost.json");

  /**
   * @dev Alvo da cunhagem.
   *
   *      Troque este endereço pelo endereço da conta conectada no frontend.
   */
  const targetAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  /**
   * @dev Quantidade a ser cunhada.
   */
  const amount = 5000n;

  const energyToken = await ethers.getContractAt(
    "EnergyToken",
    deployments.EnergyToken
  );

  console.log("Owner executor:", owner.address);
  console.log("Target address:", targetAddress);
  console.log("Mint amount:", amount.toString());

  const tx = await energyToken.mint(targetAddress, amount);
  await tx.wait();

  const finalBalance = await energyToken.balanceOf(targetAddress);

  console.log("Mint realizado com sucesso.");
  console.log("Saldo final do alvo:", finalBalance.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});