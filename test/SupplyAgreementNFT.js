const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * @title Testes do contrato SupplyAgreementNFT
 * @author Patrício Alves
 * @notice Este arquivo contém os testes automatizados do contrato
 *         SupplyAgreementNFT.
 *
 * @dev O objetivo destes testes é validar o comportamento do NFT que
 *      representa a adesão do consumidor a uma oferta do marketplace.
 *
 *      Os testes verificam, principalmente:
 *      1. nome e símbolo do NFT
 *      2. definição correta do owner inicial
 *      3. atualização do endereço do marketplace
 *      4. bloqueio de mint por endereço não autorizado
 *      5. mint correto pelo marketplace autorizado
 *      6. armazenamento correto dos dados da adesão
 *      7. retorno correto do tokenURI
 */
describe("SupplyAgreementNFT", function () {
  let SupplyAgreementNFT;
  let supplyAgreementNFT;
  let owner;
  let marketplace;
  let consumer;
  let supplier;
  let otherAccount;

  /**
   * @notice Executado antes de cada teste.
   *
   * @dev Cada teste começa com um contrato recém-implantado e contas
   *      de teste novas, evitando interferência entre os casos.
   */
  beforeEach(async function () {
    [owner, marketplace, consumer, supplier, otherAccount] =
      await ethers.getSigners();

    SupplyAgreementNFT = await ethers.getContractFactory("SupplyAgreementNFT");

    supplyAgreementNFT = await SupplyAgreementNFT.deploy(owner.address);

    await supplyAgreementNFT.waitForDeployment();
  });

  /**
   * @notice Verifica se nome e símbolo do NFT foram definidos corretamente.
   */
  it("deve ter o nome e símbolo corretos", async function () {
    expect(await supplyAgreementNFT.name()).to.equal("Supply Agreement NFT");
    expect(await supplyAgreementNFT.symbol()).to.equal("SAG");
  });

  /**
   * @notice Verifica se o owner inicial foi definido corretamente.
   */
  it("deve definir corretamente o owner inicial", async function () {
    expect(await supplyAgreementNFT.owner()).to.equal(owner.address);
  });

  /**
   * @notice Verifica se o owner consegue definir o marketplace autorizado.
   */
  it("o owner deve conseguir definir o marketplace", async function () {
    await supplyAgreementNFT.setMarketplace(marketplace.address);

    expect(await supplyAgreementNFT.marketplace()).to.equal(
      marketplace.address
    );
  });

  /**
   * @notice Verifica se um endereço que não é owner não consegue definir
   *         o marketplace.
   */
  it("um endereço não autorizado não deve conseguir definir o marketplace", async function () {
    await expect(
      supplyAgreementNFT
        .connect(otherAccount)
        .setMarketplace(marketplace.address)
    ).to.be.reverted;
  });

  /**
   * @notice Verifica se o mint falha quando o marketplace ainda não foi configurado.
   *
   * @dev Neste caso, a falha esperada é "Marketplace not set".
   */
  it("não deve permitir mint se o marketplace ainda não estiver configurado", async function () {
    await expect(
      supplyAgreementNFT
        .connect(otherAccount)
        .mintAgreement(
          consumer.address,
          supplier.address,
          1,
          "ipfs://metadata"
        )
    ).to.be.revertedWith("Marketplace not set");
  });

  /**
   * @notice Verifica se apenas o marketplace autorizado consegue cunhar NFTs.
   *
   * @dev Primeiro o marketplace é configurado. Depois, um endereço diferente
   *      tenta executar o mint e deve falhar com "Only marketplace".
   */
  it("um endereço não autorizado não deve conseguir cunhar NFTs", async function () {
    await supplyAgreementNFT
      .connect(owner)
      .setMarketplace(marketplace.address);

    await expect(
      supplyAgreementNFT
        .connect(otherAccount)
        .mintAgreement(
          consumer.address,
          supplier.address,
          1,
          "ipfs://metadata"
        )
    ).to.be.revertedWith("Only marketplace");
  });

  /**
   * @notice Verifica se o marketplace autorizado consegue cunhar corretamente
   *         um NFT de adesão.
   *
   * @dev O teste valida:
   *      1. propriedade do NFT
   *      2. incremento do tokenId
   *      3. armazenamento da tokenURI
   */
  it("o marketplace autorizado deve conseguir cunhar um NFT", async function () {
    await supplyAgreementNFT.setMarketplace(marketplace.address);

    await supplyAgreementNFT
      .connect(marketplace)
      .mintAgreement(
        consumer.address,
        supplier.address,
        1,
        "ipfs://metadata-1"
      );

    expect(await supplyAgreementNFT.ownerOf(1)).to.equal(consumer.address);

    expect(await supplyAgreementNFT.tokenURI(1)).to.equal("ipfs://metadata-1");
  });

  /**
   * @notice Verifica se os dados da adesão foram armazenados corretamente.
   */
  it("deve armazenar corretamente os dados da adesão", async function () {
    await supplyAgreementNFT.setMarketplace(marketplace.address);

    await supplyAgreementNFT
      .connect(marketplace)
      .mintAgreement(
        consumer.address,
        supplier.address,
        42,
        "ipfs://agreement-42"
      );

    const agreementData = await supplyAgreementNFT.getAgreementData(1);

    expect(agreementData.offerId).to.equal(42);
    expect(agreementData.supplier).to.equal(supplier.address);
    expect(agreementData.consumer).to.equal(consumer.address);
    expect(agreementData.metadataURI).to.equal("ipfs://agreement-42");

    expect(agreementData.acceptedAt).to.be.gt(0);
  });

  /**
   * @notice Verifica se o contador de tokenId evolui corretamente em múltiplos mints.
   */
  it("deve incrementar corretamente os tokenIds", async function () {
    await supplyAgreementNFT.setMarketplace(marketplace.address);

    await supplyAgreementNFT
      .connect(marketplace)
      .mintAgreement(
        consumer.address,
        supplier.address,
        1,
        "ipfs://metadata-1"
      );

    await supplyAgreementNFT
      .connect(marketplace)
      .mintAgreement(
        consumer.address,
        supplier.address,
        2,
        "ipfs://metadata-2"
      );

    expect(await supplyAgreementNFT.nextTokenId()).to.equal(2);
    expect(await supplyAgreementNFT.ownerOf(1)).to.equal(consumer.address);
    expect(await supplyAgreementNFT.ownerOf(2)).to.equal(consumer.address);
  });
});