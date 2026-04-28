const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * @title Testes do contrato SupplierRegistry
 * @author Patrício Alves
 * @notice Este arquivo contém os testes automatizados do contrato
 *         SupplierRegistry.
 *
 * @dev O objetivo destes testes é validar o comportamento do módulo de
 *      cadastro dos fornecedores do protocolo.
 *
 *      Os testes verificam, principalmente:
 *      1. definição correta do owner inicial
 *      2. atualização do endereço do marketplace
 *      3. registro de fornecedor
 *      4. bloqueio de registro duplicado
 *      5. atualização do status ativo por owner
 *      6. atualização do status ativo por marketplace autorizado
 *      7. bloqueio de atualização por endereço não autorizado
 *      8. consulta correta do status ativo
 */

describe("SupplierRegistry", function () {
  // Variáveis reutilizadas ao longo dos testes
  let SupplierRegistry;
  let supplierRegistry;
  let owner;
  let marketplace;
  let supplier;
  let otherAccount;

  /**
   * @notice Executado antes de cada teste.
   *
   * @dev Cada caso começa com contrato recém-implantado e contas limpas,
   *      evitando interferência entre os testes.
   */
  beforeEach(async function () {
    // Obtém contas de teste fornecidas pelo Hardhat
    [owner, marketplace, supplier, otherAccount] = await ethers.getSigners();

    // Obtém a fábrica do contrato
    SupplierRegistry = await ethers.getContractFactory("SupplierRegistry");

    // Faz o deploy do contrato com owner inicial
    supplierRegistry = await SupplierRegistry.deploy(owner.address);

    // Aguarda a conclusão do deploy
    await supplierRegistry.waitForDeployment();
  });

  /**
   * @notice Verifica se o owner inicial foi definido corretamente.
   */
  it("deve definir corretamente o owner inicial", async function () {
    expect(await supplierRegistry.owner()).to.equal(owner.address);
  });

  /**
   * @notice Verifica se o owner consegue definir o marketplace autorizado.
   */
  it("o owner deve conseguir definir o marketplace", async function () {
    await supplierRegistry.setMarketplace(marketplace.address);

    expect(await supplierRegistry.marketplace()).to.equal(marketplace.address);
  });

  /**
   * @notice Verifica se um endereço não autorizado não consegue definir
   *         o marketplace.
   */
  it("um endereço não autorizado não deve conseguir definir o marketplace", async function () {
    await expect(
      supplierRegistry
        .connect(otherAccount)
        .setMarketplace(marketplace.address)
    ).to.be.reverted;
  });

  /**
   * @notice Verifica se um fornecedor consegue se registrar corretamente.
   *
   * @dev O teste valida:
   *      1. nome cadastrado
   *      2. identificador cadastral
   *      3. status de registrado
   *      4. status inicial ativo
   *      5. timestamp de cadastro
   */
  it("deve registrar corretamente um fornecedor", async function () {
    await supplierRegistry
      .connect(supplier)
      .registerSupplier("Fornecedor A", "CNPJ-001");

    const data = await supplierRegistry.getSupplier(supplier.address);

    expect(data.name).to.equal("Fornecedor A");
    expect(data.documentId).to.equal("CNPJ-001");
    expect(data.registered).to.equal(true);
    expect(data.active).to.equal(true);
    expect(data.registeredAt).to.be.gt(0);
  });

  /**
   * @notice Verifica se o mesmo endereço não pode se registrar duas vezes.
   */
  it("não deve permitir registro duplicado do mesmo fornecedor", async function () {
    await supplierRegistry
      .connect(supplier)
      .registerSupplier("Fornecedor A", "CNPJ-001");

    await expect(
      supplierRegistry
        .connect(supplier)
        .registerSupplier("Fornecedor A", "CNPJ-001")
    ).to.be.revertedWith("Already registered");
  });

  /**
   * @notice Verifica se o owner consegue desativar um fornecedor registrado.
   */
  it("o owner deve conseguir atualizar o status ativo do fornecedor", async function () {
    await supplierRegistry
      .connect(supplier)
      .registerSupplier("Fornecedor A", "CNPJ-001");

    await supplierRegistry.setSupplierActive(supplier.address, false);

    const data = await supplierRegistry.getSupplier(supplier.address);
    expect(data.active).to.equal(false);
  });

  /**
   * @notice Verifica se o marketplace autorizado também consegue atualizar
   *         o status ativo do fornecedor.
   */
  it("o marketplace autorizado deve conseguir atualizar o status ativo do fornecedor", async function () {
    await supplierRegistry
      .connect(supplier)
      .registerSupplier("Fornecedor A", "CNPJ-001");

    await supplierRegistry.setMarketplace(marketplace.address);

    await supplierRegistry
      .connect(marketplace)
      .setSupplierActive(supplier.address, false);

    const data = await supplierRegistry.getSupplier(supplier.address);
    expect(data.active).to.equal(false);
  });

  /**
   * @notice Verifica se um endereço não autorizado não consegue alterar
   *         o status do fornecedor.
   */
  it("um endereço não autorizado não deve conseguir alterar o status do fornecedor", async function () {
    await supplierRegistry
      .connect(supplier)
      .registerSupplier("Fornecedor A", "CNPJ-001");

    await expect(
      supplierRegistry
        .connect(otherAccount)
        .setSupplierActive(supplier.address, false)
    ).to.be.revertedWith("Not authorized");
  });

  /**
   * @notice Verifica se não é possível alterar status de fornecedor que
   *         ainda não foi registrado.
   */
  it("não deve permitir alterar status de fornecedor não registrado", async function () {
    await expect(
      supplierRegistry.setSupplierActive(supplier.address, false)
    ).to.be.revertedWith("Supplier not registered");
  });

  /**
   * @notice Verifica o retorno da função isSupplierActive em diferentes estados.
   */
  it("deve retornar corretamente se o fornecedor está ativo", async function () {
    // Antes do cadastro, deve retornar falso
    expect(await supplierRegistry.isSupplierActive(supplier.address)).to.equal(
      false
    );

    // Após cadastro, deve retornar verdadeiro
    await supplierRegistry
      .connect(supplier)
      .registerSupplier("Fornecedor A", "CNPJ-001");

    expect(await supplierRegistry.isSupplierActive(supplier.address)).to.equal(
      true
    );

    // Após desativação, deve retornar falso novamente
    await supplierRegistry.setSupplierActive(supplier.address, false);

    expect(await supplierRegistry.isSupplierActive(supplier.address)).to.equal(
      false
    );
  });
});