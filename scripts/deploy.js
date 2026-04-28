require("dotenv").config();
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;
const networkConfig = require("../config/networks");

/**
 * @title Script de deploy do protocolo
 * @notice Esta versão inclui:
 *         - EnergyToken
 *         - SupplyAgreementNFT
 *         - SupplierRegistry
 *         - ConsumerRegistry
 *         - SupplierCollateral
 *         - OracleAdapter
 *         - SupplierStaking
 *         - EnergyMarketplace
 *         - EnergyGovernance
 *         - MarketplaceTreasury
 *
 * @dev Compatível com:
 *      1. hardhat
 *      2. localhost
 *      3. sepolia
 */

function getResolvedConfig(networkName) {
  const defaultLocalConfig = {
    useMockPriceFeed: true,
    mockPrice: 200000000000n,
    mockDecimals: 8,
    initialMinimumCollateral: "1000",
    initialVotingPeriod: 60,
    priceFeedAddress: null,
  };

  const config =
    networkConfig[networkName] ||
    (networkName === "hardhat" || networkName === "localhost"
      ? defaultLocalConfig
      : null);

  if (!config) {
    throw new Error(`Rede não configurada: ${networkName}`);
  }

  return config;
}

function resolveVotingPeriod(config) {
  /**
   * Prioridade:
   * 1. variável global VOTING_PERIOD_SECONDS no .env
   * 2. config.initialVotingPeriod em config/networks.js
   * 3. fallback de 60 segundos
   */

  const value = process.env.VOTING_PERIOD_SECONDS || config.initialVotingPeriod || 60;
  const votingPeriod = Number(value);

  if (!Number.isInteger(votingPeriod) || votingPeriod <= 0) {
    throw new Error("Período de votação inválido. Use um inteiro positivo.");
  }

  return votingPeriod;
}

function validateAddress(label, address) {
  if (!address || !ethers.isAddress(address)) {
    throw new Error(`Endereço inválido para ${label}: ${address}`);
  }
}

function validatePositiveStringNumber(label, value) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Valor ausente para ${label}.`);
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Valor inválido para ${label}: ${value}`);
  }
}

function getExplorerAddressUrl(networkName, address) {
  if (networkName === "sepolia") {
    return `https://sepolia.etherscan.io/address/${address}`;
  }

  return null;
}

async function main() {
  const [deployer] = await ethers.getSigners();

  const networkName = hre.network.name;
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  const config = getResolvedConfig(networkName);
  const initialVotingPeriod = resolveVotingPeriod(config);

  validatePositiveStringNumber(
    "initialMinimumCollateral",
    config.initialMinimumCollateral
  );

  console.log("====================================================");
  console.log("Deploy do protocolo Web3 de energia");
  console.log("Rede:", networkName);
  console.log("Chain ID:", chainId);
  console.log("Deploy sendo executado por:", deployer.address);
  console.log(
    "Saldo da conta:",
    (await ethers.provider.getBalance(deployer.address)).toString()
  );
  console.log(
    "Período de votação da governança:",
    initialVotingPeriod,
    "segundos"
  );
  console.log("====================================================");

  /**
   * ------------------------------------------------------------------
   * 1. Deploy do token do sistema
   * ------------------------------------------------------------------
   */
  console.log("\n1. Implantando EnergyToken...");

  const EnergyToken = await ethers.getContractFactory("EnergyToken");
  const energyToken = await EnergyToken.deploy(deployer.address);
  await energyToken.waitForDeployment();

  const energyTokenAddress = await energyToken.getAddress();
  console.log("EnergyToken:", energyTokenAddress);

  /**
   * ------------------------------------------------------------------
   * 2. Deploy do NFT de adesão
   * ------------------------------------------------------------------
   */
  console.log("\n2. Implantando SupplyAgreementNFT...");

  const SupplyAgreementNFT = await ethers.getContractFactory(
    "SupplyAgreementNFT"
  );

  const supplyAgreementNFT = await SupplyAgreementNFT.deploy(deployer.address);
  await supplyAgreementNFT.waitForDeployment();

  const supplyAgreementNFTAddress = await supplyAgreementNFT.getAddress();
  console.log("SupplyAgreementNFT:", supplyAgreementNFTAddress);

  /**
   * ------------------------------------------------------------------
   * 3. Deploy dos registros de fornecedor e consumidor
   * ------------------------------------------------------------------
   */
  console.log("\n3. Implantando SupplierRegistry e ConsumerRegistry...");

  const SupplierRegistry = await ethers.getContractFactory("SupplierRegistry");
  const supplierRegistry = await SupplierRegistry.deploy(deployer.address);
  await supplierRegistry.waitForDeployment();

  const supplierRegistryAddress = await supplierRegistry.getAddress();
  console.log("SupplierRegistry:", supplierRegistryAddress);

  const ConsumerRegistry = await ethers.getContractFactory("ConsumerRegistry");
  const consumerRegistry = await ConsumerRegistry.deploy(deployer.address);
  await consumerRegistry.waitForDeployment();

  const consumerRegistryAddress = await consumerRegistry.getAddress();
  console.log("ConsumerRegistry:", consumerRegistryAddress);

  /**
   * ------------------------------------------------------------------
   * 4. Deploy do contrato de caução
   * ------------------------------------------------------------------
   */
  console.log("\n4. Implantando SupplierCollateral...");

  const initialMinimumCollateral = ethers.parseUnits(
    String(config.initialMinimumCollateral),
    18
  );

  const SupplierCollateral = await ethers.getContractFactory(
    "SupplierCollateral"
  );

  const supplierCollateral = await SupplierCollateral.deploy(
    deployer.address,
    energyTokenAddress,
    initialMinimumCollateral
  );

  await supplierCollateral.waitForDeployment();

  const supplierCollateralAddress = await supplierCollateral.getAddress();
  console.log("SupplierCollateral:", supplierCollateralAddress);

  /**
   * ------------------------------------------------------------------
   * 5. Definição do feed de preço
   * ------------------------------------------------------------------
   */
  console.log("\n5. Configurando feed de preço...");

  let mockPriceFeedAddress = null;
  let externalPriceFeedAddress = null;
  let priceFeedAddress;

  if (config.useMockPriceFeed) {
    console.log("Usando MockPriceFeed.");

    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");

    const mockPriceFeed = await MockPriceFeed.deploy(
      config.mockPrice,
      config.mockDecimals
    );

    await mockPriceFeed.waitForDeployment();

    mockPriceFeedAddress = await mockPriceFeed.getAddress();
    priceFeedAddress = mockPriceFeedAddress;

    console.log("MockPriceFeed:", mockPriceFeedAddress);
  } else {
    console.log("Usando price feed externo.");

    if (!config.priceFeedAddress) {
      throw new Error(
        `Price feed não configurado para a rede ${networkName}. Configure SEPOLIA_PRICE_FEED no .env ou use mock.`
      );
    }

    validateAddress("PriceFeed externo", config.priceFeedAddress);

    externalPriceFeedAddress = config.priceFeedAddress;
    priceFeedAddress = externalPriceFeedAddress;

    console.log("ExternalPriceFeed:", externalPriceFeedAddress);
  }

  /**
   * ------------------------------------------------------------------
   * 6. Deploy do adaptador de oráculo
   * ------------------------------------------------------------------
   */
  console.log("\n6. Implantando OracleAdapter...");

  const OracleAdapter = await ethers.getContractFactory("OracleAdapter");

  const oracleAdapter = await OracleAdapter.deploy(
    deployer.address,
    priceFeedAddress
  );

  await oracleAdapter.waitForDeployment();

  const oracleAdapterAddress = await oracleAdapter.getAddress();
  console.log("OracleAdapter:", oracleAdapterAddress);

  /**
   * ------------------------------------------------------------------
   * 7. Deploy do staking
   * ------------------------------------------------------------------
   */
  console.log("\n7. Implantando SupplierStaking...");

  const SupplierStaking = await ethers.getContractFactory("SupplierStaking");

  const supplierStaking = await SupplierStaking.deploy(
    deployer.address,
    energyTokenAddress,
    oracleAdapterAddress
  );

  await supplierStaking.waitForDeployment();

  const supplierStakingAddress = await supplierStaking.getAddress();
  console.log("SupplierStaking:", supplierStakingAddress);

  /**
   * ------------------------------------------------------------------
   * 8. Deploy do marketplace
   * ------------------------------------------------------------------
   */
  console.log("\n8. Implantando EnergyMarketplace...");

  const EnergyMarketplace = await ethers.getContractFactory(
    "EnergyMarketplace"
  );

  const energyMarketplace = await EnergyMarketplace.deploy(
    deployer.address,
    supplierRegistryAddress,
    supplierCollateralAddress,
    supplyAgreementNFTAddress,
    consumerRegistryAddress
  );

  await energyMarketplace.waitForDeployment();

  const energyMarketplaceAddress = await energyMarketplace.getAddress();
  console.log("EnergyMarketplace:", energyMarketplaceAddress);

  /**
   * ------------------------------------------------------------------
   * 9. Deploy da governança
   * ------------------------------------------------------------------
   */
  console.log("\n9. Implantando EnergyGovernance...");

  const EnergyGovernance = await ethers.getContractFactory("EnergyGovernance");

  const energyGovernance = await EnergyGovernance.deploy(
    deployer.address,
    energyTokenAddress,
    supplierCollateralAddress,
    supplierStakingAddress,
    initialVotingPeriod
  );

  await energyGovernance.waitForDeployment();

  const energyGovernanceAddress = await energyGovernance.getAddress();
  console.log("EnergyGovernance:", energyGovernanceAddress);

  /**
   * ------------------------------------------------------------------
   * 10. Deploy da tesouraria do marketplace
   * ------------------------------------------------------------------
   */
  console.log("\n10. Implantando MarketplaceTreasury...");

  const initialTokenPerEth =
    networkName === "sepolia"
      ? ethers.parseUnits("10000", 18)
      : ethers.parseUnits("1000", 18);

  const MarketplaceTreasury = await ethers.getContractFactory(
    "MarketplaceTreasury"
  );

  const marketplaceTreasury = await MarketplaceTreasury.deploy(
    deployer.address,
    energyTokenAddress,
    initialTokenPerEth
  );

  await marketplaceTreasury.waitForDeployment();

  const marketplaceTreasuryAddress = await marketplaceTreasury.getAddress();
  console.log("MarketplaceTreasury:", marketplaceTreasuryAddress);

  /**
   * ------------------------------------------------------------------
   * 11. Abastecimento inicial da tesouraria
   * ------------------------------------------------------------------
   */
  console.log("\n11. Abastecendo tesouraria com EnergyToken...");

  const initialTreasuryReserve = ethers.parseUnits("1000000", 18);

  const mintTreasuryTx = await energyToken.mint(
    marketplaceTreasuryAddress,
    initialTreasuryReserve
  );

  await mintTreasuryTx.wait();

  console.log(
    "Reserva inicial da tesouraria:",
    initialTreasuryReserve.toString()
  );

  /**
   * ------------------------------------------------------------------
   * 12. Consolidação dos endereços implantados
   * ------------------------------------------------------------------
   */
  console.log("\n12. Salvando endereços implantados...");

  const deployedAddresses = {
    network: networkName,
    chainId,
    deployer: deployer.address,

    EnergyToken: energyTokenAddress,
    SupplyAgreementNFT: supplyAgreementNFTAddress,
    SupplierRegistry: supplierRegistryAddress,
    ConsumerRegistry: consumerRegistryAddress,
    SupplierCollateral: supplierCollateralAddress,

    MockPriceFeed: mockPriceFeedAddress,
    ExternalPriceFeed: externalPriceFeedAddress,
    OracleAdapter: oracleAdapterAddress,

    SupplierStaking: supplierStakingAddress,
    EnergyMarketplace: energyMarketplaceAddress,
    EnergyGovernance: energyGovernanceAddress,
    MarketplaceTreasury: marketplaceTreasuryAddress,

    parameters: {
      initialMinimumCollateral: initialMinimumCollateral.toString(),
      initialVotingPeriod: initialVotingPeriod.toString(),
      tokenPerEth: initialTokenPerEth.toString(),
      initialTreasuryReserve: initialTreasuryReserve.toString(),
      useMockPriceFeed: Boolean(config.useMockPriceFeed),
      mockPrice: config.useMockPriceFeed ? String(config.mockPrice) : null,
      mockDecimals: config.useMockPriceFeed
        ? String(config.mockDecimals)
        : null,
    },

    explorer: {
      EnergyToken: getExplorerAddressUrl(networkName, energyTokenAddress),
      SupplyAgreementNFT: getExplorerAddressUrl(
        networkName,
        supplyAgreementNFTAddress
      ),
      SupplierRegistry: getExplorerAddressUrl(
        networkName,
        supplierRegistryAddress
      ),
      ConsumerRegistry: getExplorerAddressUrl(
        networkName,
        consumerRegistryAddress
      ),
      SupplierCollateral: getExplorerAddressUrl(
        networkName,
        supplierCollateralAddress
      ),
      MockPriceFeed: mockPriceFeedAddress
        ? getExplorerAddressUrl(networkName, mockPriceFeedAddress)
        : null,
      ExternalPriceFeed: externalPriceFeedAddress
        ? getExplorerAddressUrl(networkName, externalPriceFeedAddress)
        : null,
      OracleAdapter: getExplorerAddressUrl(networkName, oracleAdapterAddress),
      SupplierStaking: getExplorerAddressUrl(
        networkName,
        supplierStakingAddress
      ),
      EnergyMarketplace: getExplorerAddressUrl(
        networkName,
        energyMarketplaceAddress
      ),
      EnergyGovernance: getExplorerAddressUrl(
        networkName,
        energyGovernanceAddress
      ),
      MarketplaceTreasury: getExplorerAddressUrl(
        networkName,
        marketplaceTreasuryAddress
      ),
    },

    updatedAt: new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");

  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const outputFile = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(deployedAddresses, null, 2));

  console.log("\n====================================================");
  console.log("Resumo dos endereços:");
  console.log(deployedAddresses);

  console.log("\nResumo da governança:");
  console.log({
    votingPeriodSeconds: initialVotingPeriod,
    EnergyGovernance: energyGovernanceAddress,
  });

  console.log("\nResumo da tesouraria:");
  console.log({
    tokenPerEth: initialTokenPerEth.toString(),
    initialTreasuryReserve: initialTreasuryReserve.toString(),
  });

  console.log(`\nEndereços salvos em: ${outputFile}`);

  if (networkName === "sepolia") {
    console.log("\nLinks no Sepolia Etherscan:");
    console.log("EnergyToken:", deployedAddresses.explorer.EnergyToken);
    console.log(
      "SupplyAgreementNFT:",
      deployedAddresses.explorer.SupplyAgreementNFT
    );
    console.log(
      "SupplierRegistry:",
      deployedAddresses.explorer.SupplierRegistry
    );
    console.log(
      "ConsumerRegistry:",
      deployedAddresses.explorer.ConsumerRegistry
    );
    console.log(
      "SupplierCollateral:",
      deployedAddresses.explorer.SupplierCollateral
    );
    console.log("OracleAdapter:", deployedAddresses.explorer.OracleAdapter);
    console.log(
      "SupplierStaking:",
      deployedAddresses.explorer.SupplierStaking
    );
    console.log(
      "EnergyMarketplace:",
      deployedAddresses.explorer.EnergyMarketplace
    );
    console.log(
      "EnergyGovernance:",
      deployedAddresses.explorer.EnergyGovernance
    );
    console.log(
      "MarketplaceTreasury:",
      deployedAddresses.explorer.MarketplaceTreasury
    );
  }

  console.log("\nPróximos comandos recomendados:");
  console.log(`npx hardhat run scripts/setup.js --network ${networkName}`);
  console.log(`node scripts/sync_frontend_deployments.js ${networkName}`);

  console.log("====================================================");
  console.log("Deploy concluído com sucesso.");
}

main().catch((error) => {
  console.error("\nErro durante o deploy:");
  console.error(error);
  process.exitCode = 1;
});