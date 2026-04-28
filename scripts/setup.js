require("dotenv").config();
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

/**
 * @title Script de configuração inicial do protocolo
 * @author Patrício Alves
 * @notice Este script configura os vínculos iniciais entre os contratos
 *         após o deploy.
 *
 * @dev O objetivo deste script é completar a integração entre os módulos
 *      já implantados.
 *
 *      Nesta versão, ele executa:
 *      1. SupplyAgreementNFT.setMarketplace(...)
 *      2. SupplierCollateral.setGovernance(...)
 *      3. SupplierStaking.setGovernance(...)
 *
 *      Também verifica se a configuração já foi aplicada, evitando
 *      transações desnecessárias.
 */

function readAddress(addresses, contractName) {
  /**
   * Compatibilidade com dois formatos possíveis:
   *
   * Formato direto:
   * {
   *   "EnergyGovernance": "0x..."
   * }
   *
   * Formato com contracts:
   * {
   *   "contracts": {
   *     "EnergyGovernance": {
   *       "address": "0x..."
   *     }
   *   }
   * }
   */

  if (addresses[contractName]) {
    if (typeof addresses[contractName] === "string") {
      return addresses[contractName];
    }

    if (addresses[contractName].address) {
      return addresses[contractName].address;
    }
  }

  if (addresses.contracts && addresses.contracts[contractName]) {
    if (typeof addresses.contracts[contractName] === "string") {
      return addresses.contracts[contractName];
    }

    if (addresses.contracts[contractName].address) {
      return addresses.contracts[contractName].address;
    }
  }

  throw new Error(`Endereço não encontrado para o contrato ${contractName}.`);
}

function validateAddress(label, address) {
  if (!address || !ethers.isAddress(address)) {
    throw new Error(`Endereço inválido para ${label}: ${address}`);
  }
}

function sameAddress(addressA, addressB) {
  if (!addressA || !addressB) return false;
  return addressA.toLowerCase() === addressB.toLowerCase();
}

async function main() {
  /**
   * ------------------------------------------------------------------
   * 1. Conta e rede
   * ------------------------------------------------------------------
   */
  const [deployer] = await ethers.getSigners();
  const networkName = hre.network.name;

  console.log("====================================================");
  console.log("Setup inicial do protocolo");
  console.log("Rede:", networkName);
  console.log("Setup sendo executado por:", deployer.address);
  console.log(
    "Saldo da conta:",
    (await ethers.provider.getBalance(deployer.address)).toString()
  );
  console.log("====================================================");

  /**
   * ------------------------------------------------------------------
   * 2. Leitura do arquivo de deployment
   * ------------------------------------------------------------------
   */
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

  const supplyAgreementNFTAddress = readAddress(
    addresses,
    "SupplyAgreementNFT"
  );

  const supplierCollateralAddress = readAddress(
    addresses,
    "SupplierCollateral"
  );

  const supplierStakingAddress = readAddress(
    addresses,
    "SupplierStaking"
  );

  const energyMarketplaceAddress = readAddress(
    addresses,
    "EnergyMarketplace"
  );

  const energyGovernanceAddress = readAddress(
    addresses,
    "EnergyGovernance"
  );

  validateAddress("SupplyAgreementNFT", supplyAgreementNFTAddress);
  validateAddress("SupplierCollateral", supplierCollateralAddress);
  validateAddress("SupplierStaking", supplierStakingAddress);
  validateAddress("EnergyMarketplace", energyMarketplaceAddress);
  validateAddress("EnergyGovernance", energyGovernanceAddress);

  console.log("\nEndereços carregados:");
  console.log({
    SupplyAgreementNFT: supplyAgreementNFTAddress,
    SupplierCollateral: supplierCollateralAddress,
    SupplierStaking: supplierStakingAddress,
    EnergyMarketplace: energyMarketplaceAddress,
    EnergyGovernance: energyGovernanceAddress,
  });

  /**
   * ------------------------------------------------------------------
   * 3. Conexão com os contratos já implantados
   * ------------------------------------------------------------------
   */
  const supplyAgreementNFT = await ethers.getContractAt(
    "SupplyAgreementNFT",
    supplyAgreementNFTAddress
  );

  const supplierCollateral = await ethers.getContractAt(
    "SupplierCollateral",
    supplierCollateralAddress
  );

  const supplierStaking = await ethers.getContractAt(
    "SupplierStaking",
    supplierStakingAddress
  );

  /**
   * ------------------------------------------------------------------
   * 4. Configurar marketplace autorizado no NFT
   * ------------------------------------------------------------------
   *
   * Isso permite que apenas o contrato EnergyMarketplace cunhe NFTs
   * de adesão ou acordos de fornecimento.
   */
  console.log("\n1. Verificando SupplyAgreementNFT.marketplace()...");

  const currentMarketplace = await supplyAgreementNFT.marketplace();

  if (sameAddress(currentMarketplace, energyMarketplaceAddress)) {
    console.log("Marketplace já estava configurado corretamente no NFT.");
  } else {
    console.log("Configurando SupplyAgreementNFT.setMarketplace(...)");

    const tx1 = await supplyAgreementNFT.setMarketplace(
      energyMarketplaceAddress
    );

    await tx1.wait();

    console.log("Marketplace configurado no NFT com sucesso.");
  }

  /**
   * ------------------------------------------------------------------
   * 5. Configurar governança no SupplierCollateral
   * ------------------------------------------------------------------
   *
   * Isso permite que a governança altere a caução mínima.
   */
  console.log("\n2. Verificando SupplierCollateral.governance()...");

  const currentCollateralGovernance = await supplierCollateral.governance();

  if (sameAddress(currentCollateralGovernance, energyGovernanceAddress)) {
    console.log(
      "Governança já estava configurada corretamente no SupplierCollateral."
    );
  } else {
    console.log("Configurando SupplierCollateral.setGovernance(...)");

    const tx2 = await supplierCollateral.setGovernance(
      energyGovernanceAddress
    );

    await tx2.wait();

    console.log("Governança configurada no SupplierCollateral com sucesso.");
  }

  /**
   * ------------------------------------------------------------------
   * 6. Configurar governança no SupplierStaking
   * ------------------------------------------------------------------
   *
   * Isso permite que a governança altere a taxa base de recompensa.
   */
  console.log("\n3. Verificando SupplierStaking.governance()...");

  const currentStakingGovernance = await supplierStaking.governance();

  if (sameAddress(currentStakingGovernance, energyGovernanceAddress)) {
    console.log(
      "Governança já estava configurada corretamente no SupplierStaking."
    );
  } else {
    console.log("Configurando SupplierStaking.setGovernance(...)");

    const tx3 = await supplierStaking.setGovernance(
      energyGovernanceAddress
    );

    await tx3.wait();

    console.log("Governança configurada no SupplierStaking com sucesso.");
  }

  /**
   * ------------------------------------------------------------------
   * 7. Leituras finais de confirmação
   * ------------------------------------------------------------------
   */
  const configuredMarketplace = await supplyAgreementNFT.marketplace();
  const configuredCollateralGovernance = await supplierCollateral.governance();
  const configuredStakingGovernance = await supplierStaking.governance();

  const setupSummary = {
    NFT_marketplace: configuredMarketplace,
    Collateral_governance: configuredCollateralGovernance,
    Staking_governance: configuredStakingGovernance,
    setupBy: deployer.address,
    setupAt: new Date().toISOString(),
  };

  console.log("\nResumo da configuração aplicada:");
  console.log(setupSummary);

  /**
   * ------------------------------------------------------------------
   * 8. Atualização opcional do arquivo de deployments
   * ------------------------------------------------------------------
   */
  addresses.setup = setupSummary;
  fs.writeFileSync(deploymentFile, JSON.stringify(addresses, null, 2));

  console.log(`\nArquivo de deployment atualizado: ${deploymentFile}`);

  console.log("\n====================================================");
  console.log("Setup concluído com sucesso.");
  console.log("====================================================");

  if (networkName === "sepolia") {
    console.log("\nLinks úteis:");
    console.log(
      "EnergyMarketplace:",
      `https://sepolia.etherscan.io/address/${energyMarketplaceAddress}`
    );
    console.log(
      "EnergyGovernance:",
      `https://sepolia.etherscan.io/address/${energyGovernanceAddress}`
    );
    console.log(
      "SupplyAgreementNFT:",
      `https://sepolia.etherscan.io/address/${supplyAgreementNFTAddress}`
    );
    console.log(
      "SupplierCollateral:",
      `https://sepolia.etherscan.io/address/${supplierCollateralAddress}`
    );
    console.log(
      "SupplierStaking:",
      `https://sepolia.etherscan.io/address/${supplierStakingAddress}`
    );
  }
}

main().catch((error) => {
  console.error("\nErro durante o setup:");
  console.error(error);
  process.exitCode = 1;
});