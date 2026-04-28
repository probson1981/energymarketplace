const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EnergyMarketplace", function () {
  let owner;
  let supplier;
  let consumer;
  let otherAccount;

  let energyToken;
  let supplyAgreementNFT;
  let supplierRegistry;
  let consumerRegistry;
  let supplierCollateral;
  let energyMarketplace;

  beforeEach(async function () {
    [owner, supplier, consumer, otherAccount] = await ethers.getSigners();

    const EnergyToken = await ethers.getContractFactory("EnergyToken");
    energyToken = await EnergyToken.deploy(owner.address);
    await energyToken.waitForDeployment();

    const SupplyAgreementNFT = await ethers.getContractFactory("SupplyAgreementNFT");
    supplyAgreementNFT = await SupplyAgreementNFT.deploy(owner.address);
    await supplyAgreementNFT.waitForDeployment();

    const SupplierRegistry = await ethers.getContractFactory("SupplierRegistry");
    supplierRegistry = await SupplierRegistry.deploy(owner.address);
    await supplierRegistry.waitForDeployment();

    const ConsumerRegistry = await ethers.getContractFactory("ConsumerRegistry");
    consumerRegistry = await ConsumerRegistry.deploy(owner.address);
    await consumerRegistry.waitForDeployment();

    const SupplierCollateral = await ethers.getContractFactory("SupplierCollateral");
    supplierCollateral = await SupplierCollateral.deploy(
      owner.address,
      await energyToken.getAddress(),
      1000
    );
    await supplierCollateral.waitForDeployment();

    const EnergyMarketplace = await ethers.getContractFactory("EnergyMarketplace");
    energyMarketplace = await EnergyMarketplace.deploy(
      owner.address,
      await supplierRegistry.getAddress(),
      await supplierCollateral.getAddress(),
      await supplyAgreementNFT.getAddress(),
      await consumerRegistry.getAddress()
    );
    await energyMarketplace.waitForDeployment();

    await supplyAgreementNFT.setMarketplace(await energyMarketplace.getAddress());

    await supplierRegistry
      .connect(supplier)
      .registerSupplier("Fornecedor Teste", "CNPJ-001");

    await energyToken.mint(supplier.address, 5000);
    await energyToken
      .connect(supplier)
      .approve(await supplierCollateral.getAddress(), 1500);

    await supplierCollateral
      .connect(supplier)
      .depositCollateral(1500);
  });

  it("deve permitir que fornecedor ativo e com caução crie oferta", async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    const validUntil = BigInt(latestBlock.timestamp + 3600);

    await energyMarketplace.connect(supplier).createOffer(
      62,
      8,
      "Benefício teste",
      validUntil,
      10
    );

    const offerId = await energyMarketplace.nextOfferId();
    const offer = await energyMarketplace.getOffer(offerId);

    expect(offer.supplier).to.equal(supplier.address);
    expect(offer.active).to.equal(true);
  });

  it("não deve permitir que consumidor não cadastrado aceite oferta", async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    const validUntil = BigInt(latestBlock.timestamp + 3600);

    await energyMarketplace.connect(supplier).createOffer(
      62,
      8,
      "Benefício teste",
      validUntil,
      10
    );

    await expect(
      energyMarketplace
        .connect(consumer)
        .acceptOffer(1, "ipfs://teste")
    ).to.be.revertedWith("Consumer not active");
  });

  it("deve permitir que consumidor ativo aceite oferta", async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    const validUntil = BigInt(latestBlock.timestamp + 3600);

    await consumerRegistry
      .connect(consumer)
      .registerConsumer("Consumidor Teste", "CPF-001");

    await energyMarketplace.connect(supplier).createOffer(
      62,
      8,
      "Benefício teste",
      validUntil,
      10
    );

    await energyMarketplace
      .connect(consumer)
      .acceptOffer(1, "ipfs://teste");

    const accepted = await energyMarketplace.hasAcceptedOffer(1, consumer.address);
    const offer = await energyMarketplace.getOffer(1);

    expect(accepted).to.equal(true);
    expect(offer.acceptedCount).to.equal(1);
  });

  it("não deve permitir que consumidor inativo aceite oferta", async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    const validUntil = BigInt(latestBlock.timestamp + 3600);

    await consumerRegistry
      .connect(consumer)
      .registerConsumer("Consumidor Teste", "CPF-001");

    await consumerRegistry.setConsumerActive(consumer.address, false);

    await energyMarketplace.connect(supplier).createOffer(
      62,
      8,
      "Benefício teste",
      validUntil,
      10
    );

    await expect(
      energyMarketplace
        .connect(consumer)
        .acceptOffer(1, "ipfs://teste")
    ).to.be.revertedWith("Consumer not active");
  });
});