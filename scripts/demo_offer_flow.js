require("dotenv").config();
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

/**
 * @title Script de demonstração do fluxo de oferta no marketplace
 * @notice Esta versão integra o ConsumerRegistry ao fluxo.
 */

async function main() {
  const [owner, supplier, consumer] = await ethers.getSigners();
  const networkName = hre.network.name;

  console.log("Rede:", networkName);
  console.log("Owner:", owner.address);
  console.log("Supplier:", supplier.address);
  console.log("Consumer:", consumer.address);

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

  const consumerRegistry = await ethers.getContractAt(
    "ConsumerRegistry",
    addresses.ConsumerRegistry
  );

  const supplierCollateral = await ethers.getContractAt(
    "SupplierCollateral",
    addresses.SupplierCollateral
  );

  const energyMarketplace = await ethers.getContractAt(
    "EnergyMarketplace",
    addresses.EnergyMarketplace
  );

  const supplyAgreementNFT = await ethers.getContractAt(
    "SupplyAgreementNFT",
    addresses.SupplyAgreementNFT
  );

  console.log("\n1. Verificando fornecedor...");

  const supplierActive = await supplierRegistry.isSupplierActive(supplier.address);

  if (!supplierActive) {
    console.log("Fornecedor não ativo. Registrando...");
    await (
      await supplierRegistry
        .connect(supplier)
        .registerSupplier("Fornecedor Flow", "CNPJ-FLOW-001")
    ).wait();
    console.log("Fornecedor registrado.");
  } else {
    console.log("Fornecedor já ativo.");
  }

  console.log("\n2. Garantindo caução mínima do fornecedor...");

  const hasMinimumCollateral = await supplierCollateral.hasMinimumCollateral(
    supplier.address
  );

  if (!hasMinimumCollateral) {
    const mintAmount = 5000n;
    const collateralAmount = 1500n;

    const tokenBalance = await energyToken.balanceOf(supplier.address);

    if (tokenBalance < collateralAmount) {
      await (await energyToken.mint(supplier.address, mintAmount)).wait();
      console.log("Tokens cunhados para fornecedor.");
    }

    await (
      await energyToken
        .connect(supplier)
        .approve(addresses.SupplierCollateral, collateralAmount)
    ).wait();

    await (
      await supplierCollateral
        .connect(supplier)
        .depositCollateral(collateralAmount)
    ).wait();

    console.log("Caução depositada.");
  } else {
    console.log("Fornecedor já possui caução mínima.");
  }

  console.log("\n3. Verificando consumidor...");

  const consumerActive = await consumerRegistry.isConsumerActive(consumer.address);

  if (!consumerActive) {
    console.log("Consumidor não ativo. Registrando...");
    await (
      await consumerRegistry
        .connect(consumer)
        .registerConsumer("Consumidor Flow", "CPF-FLOW-001")
    ).wait();
    console.log("Consumidor registrado.");
  } else {
    console.log("Consumidor já ativo.");
  }

  console.log("\n4. Criando oferta no marketplace...");

  const latestBlock = await ethers.provider.getBlock("latest");
  const validUntil = BigInt(latestBlock.timestamp + 3600);

  await (
    await energyMarketplace.connect(supplier).createOffer(
      62,
      8,
      "Cashback em token e bônus por pagamento antecipado",
      validUntil,
      10
    )
  ).wait();

  const offerId = await energyMarketplace.nextOfferId();
  console.log("Offer ID criada:", offerId.toString());

  console.log("\n5. Consumidor aceitando a oferta...");

  const metadataURI = `ipfs://agreement-offer-${offerId.toString()}-consumer`;

  await (
    await energyMarketplace
      .connect(consumer)
      .acceptOffer(offerId, metadataURI)
  ).wait();

  console.log("Oferta aceita com sucesso.");

  const updatedOfferData = await energyMarketplace.getOffer(offerId);
  const accepted = await energyMarketplace.hasAcceptedOffer(
    offerId,
    consumer.address
  );

  const tokenId = await supplyAgreementNFT.nextTokenId();
  const nftOwner = await supplyAgreementNFT.ownerOf(tokenId);
  const tokenURI = await supplyAgreementNFT.tokenURI(tokenId);

  console.log("\nResumo final do fluxo da oferta:");
  console.log({
    offerId: offerId.toString(),
    acceptedCount: updatedOfferData.acceptedCount.toString(),
    consumerAcceptedOffer: accepted,
    emittedTokenId: tokenId.toString(),
    nftOwner,
    tokenURI,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});