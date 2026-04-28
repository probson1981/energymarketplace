require("dotenv").config();
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

/**
 * @title Script de demonstração do onboarding do fornecedor
 * @author Patrício Alves
 * @notice Este script demonstra o fluxo inicial de entrada de um fornecedor
 *         no protocolo.
 *
 * @dev O fluxo executado é:
 *      1. identificar a rede atual
 *      2. ler os endereços implantados daquela rede
 *      3. conectar aos contratos necessários
 *      4. verificar se o fornecedor já está registrado
 *      5. cunhar tokens para o fornecedor, se necessário
 *      6. verificar saldo antes da aprovação
 *      7. aprovar o collateral
 *      8. verificar saldo antes do depósito
 *      9. depositar a caução
 *      10. mostrar os estados finais no terminal
 */

async function main() {
  const [owner, supplier] = await ethers.getSigners();
  const networkName = hre.network.name;

  console.log("Rede:", networkName);
  console.log("Owner:", owner.address);
  console.log("Supplier:", supplier.address);

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

  const supplierRegistry = await ethers.getContractAt(
    "SupplierRegistry",
    addresses.SupplierRegistry
  );

  const supplierCollateral = await ethers.getContractAt(
    "SupplierCollateral",
    addresses.SupplierCollateral
  );

  const mintAmount = 5000n;
  const collateralAmount = 1500n;

  console.log("\n1. Verificando cadastro atual do fornecedor...");

  const existingSupplierData = await supplierRegistry.getSupplier(supplier.address);

  if (!existingSupplierData.registered) {
    console.log("Fornecedor ainda não registrado. Executando cadastro...");

    const txRegister = await supplierRegistry
      .connect(supplier)
      .registerSupplier("Fornecedor Demo", "CNPJ-DEMO-001");

    await txRegister.wait();
    console.log("Fornecedor registrado com sucesso.");
  } else {
    console.log("Fornecedor já estava registrado. Cadastro não será repetido.");
  }

  const supplierData = await supplierRegistry.getSupplier(supplier.address);

  console.log("Dados cadastrais do fornecedor:");
  console.log({
    name: supplierData.name,
    documentId: supplierData.documentId,
    registered: supplierData.registered,
    active: supplierData.active,
    registeredAt: supplierData.registeredAt.toString(),
  });

  console.log("\n2. Verificando saldo de tokens do fornecedor...");

  let supplierTokenBalance = await energyToken.balanceOf(supplier.address);

  console.log("Saldo atual do fornecedor:", supplierTokenBalance.toString());

  if (supplierTokenBalance < collateralAmount) {
    console.log("Saldo insuficiente para a caução. Cunhando tokens...");

    const txMint = await energyToken.mint(supplier.address, mintAmount);
    await txMint.wait();

    console.log("Tokens cunhados com sucesso.");
  } else {
    console.log("Fornecedor já possui saldo suficiente para a caução.");
  }

  supplierTokenBalance = await energyToken.balanceOf(supplier.address);

  console.log(
    "Saldo do fornecedor antes da aprovação:",
    supplierTokenBalance.toString()
  );

  if (supplierTokenBalance < collateralAmount) {
    console.log("\nFluxo bloqueado: saldo insuficiente mesmo após tentativa de mint.");
    console.log({
      requiredCollateral: collateralAmount.toString(),
      availableTokenBalance: supplierTokenBalance.toString(),
    });
    return;
  }

  console.log("\n3. Aprovando a caução...");
  const txApprove = await energyToken
    .connect(supplier)
    .approve(addresses.SupplierCollateral, collateralAmount);

  await txApprove.wait();
  console.log("Aprovação realizada com sucesso.");

  const allowance = await energyToken.allowance(
    supplier.address,
    addresses.SupplierCollateral
  );

  console.log("Allowance do fornecedor para o collateral:", allowance.toString());

  if (allowance < collateralAmount) {
    console.log("\nFluxo bloqueado: allowance insuficiente para o depósito.");
    console.log({
      requiredCollateral: collateralAmount.toString(),
      currentAllowance: allowance.toString(),
    });
    return;
  }

  const collateralContractTokenBalanceBefore = await energyToken.balanceOf(
    addresses.SupplierCollateral
  );

  console.log(
    "Saldo do contrato de collateral antes do depósito:",
    collateralContractTokenBalanceBefore.toString()
  );

  console.log("\n4. Depositando a caução...");

  const txDeposit = await supplierCollateral
    .connect(supplier)
    .depositCollateral(collateralAmount);

  await txDeposit.wait();
  console.log("Caução depositada com sucesso.");

  const finalCollateralBalance = await supplierCollateral.collateralBalance(
    supplier.address
  );

  const hasMinimumCollateral = await supplierCollateral.hasMinimumCollateral(
    supplier.address
  );

  const finalTokenBalance = await energyToken.balanceOf(supplier.address);

  const collateralContractTokenBalanceAfter = await energyToken.balanceOf(
    addresses.SupplierCollateral
  );

  console.log("\nResumo final do onboarding:");
  console.log({
    supplierAddress: supplier.address,
    tokenBalanceAfterOnboarding: finalTokenBalance.toString(),
    collateralBalance: finalCollateralBalance.toString(),
    hasMinimumCollateral,
    collateralContractTokenBalanceAfter:
      collateralContractTokenBalanceAfter.toString(),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});