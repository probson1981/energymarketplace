const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * @title Testes do contrato ConsumerRegistry
 * @author Patrício Alves
 * @notice Este arquivo contém os testes automatizados do cadastro
 *         de consumidores.
 *
 * @dev Os testes cobrem:
 *      1. owner inicial
 *      2. definição de governança
 *      3. registro de consumidor
 *      4. bloqueio de registro duplicado
 *      5. atualização de status por owner
 *      6. atualização de status por governança
 *      7. bloqueio de atualização por endereço não autorizado
 *      8. consulta correta do status ativo
 */

describe("ConsumerRegistry", function () {
  let ConsumerRegistry;
  let consumerRegistry;
  let owner;
  let governance;
  let consumer;
  let otherAccount;

  beforeEach(async function () {
    [owner, governance, consumer, otherAccount] = await ethers.getSigners();

    ConsumerRegistry = await ethers.getContractFactory("ConsumerRegistry");
    consumerRegistry = await ConsumerRegistry.deploy(owner.address);
    await consumerRegistry.waitForDeployment();
  });

  it("deve definir corretamente o owner inicial", async function () {
    expect(await consumerRegistry.owner()).to.equal(owner.address);
  });

  it("o owner deve conseguir definir a governança", async function () {
    await consumerRegistry.setGovernance(governance.address);
    expect(await consumerRegistry.governance()).to.equal(governance.address);
  });

  it("um endereço não autorizado não deve conseguir definir a governança", async function () {
    await expect(
      consumerRegistry.connect(otherAccount).setGovernance(governance.address)
    ).to.be.reverted;
  });

  it("deve registrar corretamente um consumidor", async function () {
    await consumerRegistry
      .connect(consumer)
      .registerConsumer("Consumidor Demo", "CPF-DEMO-001");

    const data = await consumerRegistry.getConsumer(consumer.address);

    expect(data.name).to.equal("Consumidor Demo");
    expect(data.documentId).to.equal("CPF-DEMO-001");
    expect(data.registered).to.equal(true);
    expect(data.active).to.equal(true);
    expect(data.registeredAt).to.be.gt(0);
  });

  it("não deve permitir registro duplicado do mesmo consumidor", async function () {
    await consumerRegistry
      .connect(consumer)
      .registerConsumer("Consumidor Demo", "CPF-DEMO-001");

    await expect(
      consumerRegistry
        .connect(consumer)
        .registerConsumer("Consumidor Demo 2", "CPF-DEMO-002")
    ).to.be.revertedWith("Already registered");
  });

  it("não deve permitir registro com nome vazio", async function () {
    await expect(
      consumerRegistry.connect(consumer).registerConsumer("", "CPF-DEMO-001")
    ).to.be.revertedWith("Invalid name");
  });

  it("não deve permitir registro com documento vazio", async function () {
    await expect(
      consumerRegistry.connect(consumer).registerConsumer("Consumidor Demo", "")
    ).to.be.revertedWith("Invalid document");
  });

  it("o owner deve conseguir atualizar o status ativo do consumidor", async function () {
    await consumerRegistry
      .connect(consumer)
      .registerConsumer("Consumidor Demo", "CPF-DEMO-001");

    await consumerRegistry.setConsumerActive(consumer.address, false);

    const data = await consumerRegistry.getConsumer(consumer.address);
    expect(data.active).to.equal(false);
  });

  it("a governança autorizada deve conseguir atualizar o status ativo do consumidor", async function () {
    await consumerRegistry.setGovernance(governance.address);

    await consumerRegistry
      .connect(consumer)
      .registerConsumer("Consumidor Demo", "CPF-DEMO-001");

    await consumerRegistry
      .connect(governance)
      .setConsumerActive(consumer.address, false);

    const data = await consumerRegistry.getConsumer(consumer.address);
    expect(data.active).to.equal(false);
  });

  it("um endereço não autorizado não deve conseguir atualizar o status do consumidor", async function () {
    await consumerRegistry
      .connect(consumer)
      .registerConsumer("Consumidor Demo", "CPF-DEMO-001");

    await expect(
      consumerRegistry
        .connect(otherAccount)
        .setConsumerActive(consumer.address, false)
    ).to.be.revertedWith("Not authorized");
  });

  it("não deve permitir alterar status de consumidor não registrado", async function () {
    await expect(
      consumerRegistry.setConsumerActive(consumer.address, false)
    ).to.be.revertedWith("Consumer not registered");
  });

  it("deve retornar corretamente se o consumidor está ativo", async function () {
    expect(
      await consumerRegistry.isConsumerActive(consumer.address)
    ).to.equal(false);

    await consumerRegistry
      .connect(consumer)
      .registerConsumer("Consumidor Demo", "CPF-DEMO-001");

    expect(
      await consumerRegistry.isConsumerActive(consumer.address)
    ).to.equal(true);

    await consumerRegistry.setConsumerActive(consumer.address, false);

    expect(
      await consumerRegistry.isConsumerActive(consumer.address)
    ).to.equal(false);
  });
});