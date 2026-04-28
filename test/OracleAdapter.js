const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * @title Testes do contrato OracleAdapter
 * @author Patrício Alves
 * @notice Este arquivo contém os testes automatizados do contrato OracleAdapter.
 *
 * @dev O objetivo destes testes é validar o comportamento do adaptador
 *      de oráculo do protocolo.
 *
 *      Os testes verificam, principalmente:
 *      1. definição correta do owner inicial
 *      2. definição correta do feed inicial
 *      3. atualização do endereço do feed pelo owner
 *      4. bloqueio de atualização por endereço não autorizado
 *      5. leitura correta do preço e das casas decimais
 */

describe("OracleAdapter", function () {
  // Fábricas de contratos
  let MockPriceFeed;
  let OracleAdapter;

  // Instâncias dos contratos
  let mockPriceFeed;
  let secondMockPriceFeed;
  let oracleAdapter;

  // Contas de teste
  let owner;
  let otherAccount;

  /**
   * @notice Executado antes de cada teste.
   *
   * @dev Cada caso começa com contratos recém-implantados e contas limpas.
   */
  beforeEach(async function () {
    [owner, otherAccount] = await ethers.getSigners();

    // Fábrica do mock de feed
    MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");

    // Cria um feed inicial com valor 2000 * 10^8 e 8 casas decimais
    mockPriceFeed = await MockPriceFeed.deploy(200000000000n, 8);
    await mockPriceFeed.waitForDeployment();

    // Cria um segundo feed para testar troca de endereço
    secondMockPriceFeed = await MockPriceFeed.deploy(350000000000n, 8);
    await secondMockPriceFeed.waitForDeployment();

    // Fábrica do OracleAdapter
    OracleAdapter = await ethers.getContractFactory("OracleAdapter");

    // Deploy do OracleAdapter com owner inicial e feed inicial
    oracleAdapter = await OracleAdapter.deploy(
      owner.address,
      await mockPriceFeed.getAddress()
    );
    await oracleAdapter.waitForDeployment();
  });

  /**
   * @notice Verifica se o owner inicial foi definido corretamente.
   */
  it("deve definir corretamente o owner inicial", async function () {
    expect(await oracleAdapter.owner()).to.equal(owner.address);
  });

  /**
   * @notice Verifica se o feed inicial foi definido corretamente.
   */
  it("deve definir corretamente o feed inicial", async function () {
    expect(await oracleAdapter.priceFeed()).to.equal(
      await mockPriceFeed.getAddress()
    );
  });

  /**
   * @notice Verifica se o owner consegue atualizar o feed de preço.
   */
  it("o owner deve conseguir atualizar o feed de preço", async function () {
    await oracleAdapter.setPriceFeed(await secondMockPriceFeed.getAddress());

    expect(await oracleAdapter.priceFeed()).to.equal(
      await secondMockPriceFeed.getAddress()
    );
  });

  /**
   * @notice Verifica se um endereço não autorizado não consegue atualizar
   *         o feed de preço.
   */
  it("um endereço não autorizado não deve conseguir atualizar o feed de preço", async function () {
    await expect(
      oracleAdapter
        .connect(otherAccount)
        .setPriceFeed(await secondMockPriceFeed.getAddress())
    ).to.be.reverted;
  });

  /**
   * @notice Verifica se o adaptador retorna corretamente o preço e os decimais.
   */
  it("deve retornar corretamente o preço e os decimais do feed", async function () {
    const result = await oracleAdapter.getLatestPrice();

    expect(result.price).to.equal(200000000000n);
    expect(result.feedDecimals).to.equal(8);
  });

  /**
   * @notice Verifica se, após trocar o feed, o adaptador passa a retornar
   *         os dados do novo feed.
   */
  it("deve retornar os dados do novo feed após atualização", async function () {
    await oracleAdapter.setPriceFeed(await secondMockPriceFeed.getAddress());

    const result = await oracleAdapter.getLatestPrice();

    expect(result.price).to.equal(350000000000n);
    expect(result.feedDecimals).to.equal(8);
  });
});