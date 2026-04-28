const fs = require("fs");
const path = require("path");

/**
 * @title Script de sincronização dos deployments para o frontend
 * @author Patrício Alves
 * @notice Este script copia o arquivo de endereços gerado no backend
 *         para a pasta de configuração do frontend.
 *
 * @dev O objetivo é evitar copiar endereços manualmente após cada deploy.
 *
 *      Uso:
 *      node scripts/sync_frontend_deployments.js localhost
 *      node scripts/sync_frontend_deployments.js hardhat
 *      node scripts/sync_frontend_deployments.js sepolia
 */

function readAddress(raw, contractName) {
  /**
   * Formato direto:
   * {
   *   "EnergyGovernance": "0x..."
   * }
   */
  if (raw[contractName]) {
    if (typeof raw[contractName] === "string") {
      return raw[contractName];
    }

    if (raw[contractName].address) {
      return raw[contractName].address;
    }
  }

  /**
   * Formato aninhado:
   * {
   *   "contracts": {
   *     "EnergyGovernance": {
   *       "address": "0x..."
   *     }
   *   }
   * }
   */
  if (raw.contracts && raw.contracts[contractName]) {
    if (typeof raw.contracts[contractName] === "string") {
      return raw.contracts[contractName];
    }

    if (raw.contracts[contractName].address) {
      return raw.contracts[contractName].address;
    }
  }

  return null;
}

function main() {
  /**
   * ------------------------------------------------------------------
   * 1. Leitura da rede informada no terminal
   * ------------------------------------------------------------------
   */
  const networkName = process.argv[2];

  if (!networkName) {
    throw new Error(
      "Informe o nome da rede. Exemplo: localhost, hardhat ou sepolia"
    );
  }

  const chainIds = {
    hardhat: 31337,
    localhost: 31337,
    sepolia: 11155111,
  };

  /**
   * ------------------------------------------------------------------
   * 2. Caminhos de origem e destino
   * ------------------------------------------------------------------
   */
  const sourceFile = path.join(
    __dirname,
    "..",
    "deployments",
    `${networkName}.json`
  );

  const targetDir = path.join(
    __dirname,
    "..",
    "frontend",
    "src",
    "config"
  );

  const targetFile = path.join(targetDir, "deployments.json");

  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Arquivo de origem não encontrado: ${sourceFile}`);
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  /**
   * ------------------------------------------------------------------
   * 3. Leitura do arquivo de deployments
   * ------------------------------------------------------------------
   */
  const raw = JSON.parse(fs.readFileSync(sourceFile, "utf8"));

  /**
   * ------------------------------------------------------------------
   * 4. Contratos esperados pelo frontend
   * ------------------------------------------------------------------
   */
  const contractNames = [
    "EnergyToken",
    "SupplyAgreementNFT",
    "SupplierRegistry",
    "ConsumerRegistry",
    "SupplierCollateral",
    "MockPriceFeed",
    "ExternalPriceFeed",
    "OracleAdapter",
    "SupplierStaking",
    "EnergyMarketplace",
    "EnergyGovernance",
    "MarketplaceTreasury",
  ];

  const normalizedAddresses = {};

  for (const contractName of contractNames) {
    normalizedAddresses[contractName] = readAddress(raw, contractName);
  }

  /**
   * ------------------------------------------------------------------
   * 5. Validação dos contratos obrigatórios
   * ------------------------------------------------------------------
   */
  const requiredContracts = [
    "EnergyToken",
    "SupplyAgreementNFT",
    "SupplierRegistry",
    "ConsumerRegistry",
    "SupplierCollateral",
    "OracleAdapter",
    "SupplierStaking",
    "EnergyMarketplace",
    "EnergyGovernance",
    "MarketplaceTreasury",
  ];

  const missingContracts = requiredContracts.filter(
    (contractName) => !normalizedAddresses[contractName]
  );

  if (missingContracts.length > 0) {
    throw new Error(
      `Contratos obrigatórios ausentes no deployment: ${missingContracts.join(
        ", "
      )}`
    );
  }

  /**
   * ------------------------------------------------------------------
   * 6. Montagem do arquivo final usado pelo frontend
   * ------------------------------------------------------------------
   *
   * O frontend atual usa acesso direto, por exemplo:
   *
   * deployments.EnergyGovernance
   *
   * Por isso mantemos os endereços no nível superior do JSON.
   */
  const output = {
    ...raw,

    network: networkName,
    chainId: chainIds[networkName] || raw.chainId || null,

    EnergyToken: normalizedAddresses.EnergyToken,
    SupplyAgreementNFT: normalizedAddresses.SupplyAgreementNFT,
    SupplierRegistry: normalizedAddresses.SupplierRegistry,
    ConsumerRegistry: normalizedAddresses.ConsumerRegistry,
    SupplierCollateral: normalizedAddresses.SupplierCollateral,
    MockPriceFeed: normalizedAddresses.MockPriceFeed,
    ExternalPriceFeed: normalizedAddresses.ExternalPriceFeed,
    OracleAdapter: normalizedAddresses.OracleAdapter,
    SupplierStaking: normalizedAddresses.SupplierStaking,
    EnergyMarketplace: normalizedAddresses.EnergyMarketplace,
    EnergyGovernance: normalizedAddresses.EnergyGovernance,
    MarketplaceTreasury: normalizedAddresses.MarketplaceTreasury,

    syncedAt: new Date().toISOString(),
  };

  fs.writeFileSync(targetFile, JSON.stringify(output, null, 2));

  /**
   * ------------------------------------------------------------------
   * 7. Resumo no terminal
   * ------------------------------------------------------------------
   */
  console.log("Deployments sincronizados com sucesso.");
  console.log(`Rede: ${networkName}`);
  console.log(`Chain ID: ${output.chainId}`);
  console.log(`Origem: ${sourceFile}`);
  console.log(`Destino: ${targetFile}`);

  console.log("\nEndereços sincronizados:");
  console.log({
    EnergyToken: output.EnergyToken,
    SupplyAgreementNFT: output.SupplyAgreementNFT,
    SupplierRegistry: output.SupplierRegistry,
    ConsumerRegistry: output.ConsumerRegistry,
    SupplierCollateral: output.SupplierCollateral,
    OracleAdapter: output.OracleAdapter,
    SupplierStaking: output.SupplierStaking,
    EnergyMarketplace: output.EnergyMarketplace,
    EnergyGovernance: output.EnergyGovernance,
    MarketplaceTreasury: output.MarketplaceTreasury,
  });
}

try {
  main();
} catch (error) {
  console.error("\nErro ao sincronizar deployments:");
  console.error(error.message);
  process.exit(1);
}