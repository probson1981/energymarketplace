const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * @title Testes do contrato SupplierCollateral
 * @author Patrício Alves
 * @notice Este arquivo contém os testes automatizados do contrato
 *         SupplierCollateral.
 *
 * @dev Esta versão inclui verificação do comportamento revisado de retirada.
 */

describe("SupplierCollateral", function () {
  let EnergyToken;
  let SupplierCollateral;

  let energyToken;
  let supplierCollateral;

  let owner;
  let governance;
  let supplier;
  let otherAccount;

  const INITIAL_MINIMUM = 1000n;
  const DEPOSIT_AMOUNT = 1500n;

  beforeEach(async function () {
    [owner, governance, supplier, otherAccount] = await ethers.getSigners();

    EnergyToken = await ethers.getContractFactory("EnergyToken");
    energyToken = await EnergyToken.deploy(owner.address);
    await energyToken.waitForDeployment();

    SupplierCollateral = await ethers.getContractFactory("SupplierCollateral");
    supplierCollateral = await SupplierCollateral.deploy(
      owner.address,
      await energyToken.getAddress(),
      INITIAL_MINIMUM
    );
    await supplierCollateral.waitForDeployment();

    await energyToken.mint(supplier.address, 5000);
  });

  it("deve definir corretamente o owner inicial", async function () {
    expect(await supplierCollateral.owner()).to.equal(owner.address);
  });

  it("deve definir corretamente o token do sistema", async function () {
    expect(await supplierCollateral.token()).to.equal(
      await energyToken.getAddress()
    );
  });

  it("deve definir corretamente o valor mínimo inicial de caução", async function () {
    expect(await supplierCollateral.minimumCollateral()).to.equal(
      INITIAL_MINIMUM
    );
  });

  it("o owner deve conseguir definir a governança", async function () {
    await supplierCollateral.setGovernance(governance.address);
    expect(await supplierCollateral.governance()).to.equal(governance.address);
  });

  it("um endereço não autorizado não deve conseguir definir a governança", async function () {
    await expect(
      supplierCollateral.connect(otherAccount).setGovernance(governance.address)
    ).to.be.reverted;
  });

  it("o owner deve conseguir atualizar o valor mínimo de caução", async function () {
    await supplierCollateral.setMinimumCollateral(2000);
    expect(await supplierCollateral.minimumCollateral()).to.equal(2000);
  });

  it("a governança autorizada deve conseguir atualizar o valor mínimo de caução", async function () {
    await supplierCollateral.setGovernance(governance.address);
    await supplierCollateral.connect(governance).setMinimumCollateral(3000);
    expect(await supplierCollateral.minimumCollateral()).to.equal(3000);
  });

  it("um endereço não autorizado não deve conseguir atualizar o valor mínimo de caução", async function () {
    await expect(
      supplierCollateral.connect(otherAccount).setMinimumCollateral(2000)
    ).to.be.revertedWith("Not authorized");
  });

  it("deve permitir depósito correto de caução", async function () {
    await energyToken
      .connect(supplier)
      .approve(await supplierCollateral.getAddress(), DEPOSIT_AMOUNT);

    await supplierCollateral.connect(supplier).depositCollateral(DEPOSIT_AMOUNT);

    expect(await supplierCollateral.collateralBalance(supplier.address)).to.equal(
      DEPOSIT_AMOUNT
    );
  });

  it("não deve permitir depósito de valor zero", async function () {
    await expect(
      supplierCollateral.connect(supplier).depositCollateral(0)
    ).to.be.revertedWith("Invalid amount");
  });

  it("deve permitir retirada parcial válida de caução", async function () {
    await energyToken
      .connect(supplier)
      .approve(await supplierCollateral.getAddress(), DEPOSIT_AMOUNT);

    await supplierCollateral.connect(supplier).depositCollateral(DEPOSIT_AMOUNT);
    await supplierCollateral.connect(supplier).withdrawCollateral(500);

    expect(await supplierCollateral.collateralBalance(supplier.address)).to.equal(
      1000
    );
  });

  it("deve permitir retirada total da caução", async function () {
    await energyToken
      .connect(supplier)
      .approve(await supplierCollateral.getAddress(), DEPOSIT_AMOUNT);

    await supplierCollateral.connect(supplier).depositCollateral(DEPOSIT_AMOUNT);
    await supplierCollateral.connect(supplier).withdrawCollateral(DEPOSIT_AMOUNT);

    expect(await supplierCollateral.collateralBalance(supplier.address)).to.equal(
      0
    );
  });

  it("não deve permitir retirada acima do saldo", async function () {
    await energyToken
      .connect(supplier)
      .approve(await supplierCollateral.getAddress(), DEPOSIT_AMOUNT);

    await supplierCollateral.connect(supplier).depositCollateral(DEPOSIT_AMOUNT);

    await expect(
      supplierCollateral.connect(supplier).withdrawCollateral(2000)
    ).to.be.revertedWith("Insufficient collateral");
  });

  it("não deve permitir retirada que deixe saldo abaixo do mínimo", async function () {
    await energyToken
      .connect(supplier)
      .approve(await supplierCollateral.getAddress(), DEPOSIT_AMOUNT);

    await supplierCollateral.connect(supplier).depositCollateral(DEPOSIT_AMOUNT);

    await expect(
      supplierCollateral.connect(supplier).withdrawCollateral(600)
    ).to.be.revertedWith("Below minimum collateral");
  });

  it("o owner deve conseguir penalizar a caução do fornecedor", async function () {
    await energyToken
      .connect(supplier)
      .approve(await supplierCollateral.getAddress(), DEPOSIT_AMOUNT);

    await supplierCollateral.connect(supplier).depositCollateral(DEPOSIT_AMOUNT);
    await supplierCollateral.slashCollateral(supplier.address, 400);

    expect(await supplierCollateral.collateralBalance(supplier.address)).to.equal(
      1100
    );
  });

  it("a governança autorizada deve conseguir penalizar a caução do fornecedor", async function () {
    await supplierCollateral.setGovernance(governance.address);

    await energyToken
      .connect(supplier)
      .approve(await supplierCollateral.getAddress(), DEPOSIT_AMOUNT);

    await supplierCollateral.connect(supplier).depositCollateral(DEPOSIT_AMOUNT);

    await supplierCollateral
      .connect(governance)
      .slashCollateral(supplier.address, 300);

    expect(await supplierCollateral.collateralBalance(supplier.address)).to.equal(
      1200
    );
  });

  it("um endereço não autorizado não deve conseguir penalizar a caução", async function () {
    await energyToken
      .connect(supplier)
      .approve(await supplierCollateral.getAddress(), DEPOSIT_AMOUNT);

    await supplierCollateral.connect(supplier).depositCollateral(DEPOSIT_AMOUNT);

    await expect(
      supplierCollateral
        .connect(otherAccount)
        .slashCollateral(supplier.address, 100)
    ).to.be.revertedWith("Not authorized");
  });

  it("não deve permitir penalizar valor acima do saldo de caução", async function () {
    await energyToken
      .connect(supplier)
      .approve(await supplierCollateral.getAddress(), DEPOSIT_AMOUNT);

    await supplierCollateral.connect(supplier).depositCollateral(DEPOSIT_AMOUNT);

    await expect(
      supplierCollateral.slashCollateral(supplier.address, 2000)
    ).to.be.revertedWith("Insufficient collateral");
  });

  it("deve retornar corretamente se o fornecedor possui a caução mínima", async function () {
    expect(
      await supplierCollateral.hasMinimumCollateral(supplier.address)
    ).to.equal(false);

    await energyToken
      .connect(supplier)
      .approve(await supplierCollateral.getAddress(), DEPOSIT_AMOUNT);

    await supplierCollateral.connect(supplier).depositCollateral(DEPOSIT_AMOUNT);

    expect(
      await supplierCollateral.hasMinimumCollateral(supplier.address)
    ).to.equal(true);

    await supplierCollateral.slashCollateral(supplier.address, 600);

    expect(
      await supplierCollateral.hasMinimumCollateral(supplier.address)
    ).to.equal(false);
  });
});