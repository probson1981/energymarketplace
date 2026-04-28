const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * @title Testes do contrato MarketplaceTreasury
 * @author Patrício Alves
 * @notice Este arquivo contém os testes automatizados da tesouraria do marketplace.
 *
 * @dev Os testes cobrem:
 *      1. owner inicial
 *      2. token configurado corretamente
 *      3. preço inicial
 *      4. atualização do preço pelo owner
 *      5. bloqueio de atualização por não autorizado
 *      6. cotação de token por ETH
 *      7. compra de tokens com ETH
 *      8. bloqueio de compra sem ETH
 *      9. bloqueio de compra sem reserva de tokens
 *      10. saque de ETH arrecadado
 */

describe("MarketplaceTreasury", function () {
  let owner;
  let buyer;
  let otherAccount;

  let energyToken;
  let treasury;

  /**
   * @dev Quantidade de tokens por 1 ETH.
   *
   *      Aqui usamos 1000 tokens por ETH, considerando 18 casas decimais.
   */
  const TOKEN_PER_ETH = ethers.parseUnits("1000", 18);

  beforeEach(async function () {
    [owner, buyer, otherAccount] = await ethers.getSigners();

    const EnergyToken = await ethers.getContractFactory("EnergyToken");
    energyToken = await EnergyToken.deploy(owner.address);
    await energyToken.waitForDeployment();

    const MarketplaceTreasury = await ethers.getContractFactory("MarketplaceTreasury");
    treasury = await MarketplaceTreasury.deploy(
      owner.address,
      await energyToken.getAddress(),
      TOKEN_PER_ETH
    );
    await treasury.waitForDeployment();

    /**
     * @dev Abastece a tesouraria com 1.000.000 de tokens.
     */
    await energyToken.mint(
      await treasury.getAddress(),
      ethers.parseUnits("1000000", 18)
    );
  });

  it("deve definir corretamente o owner inicial", async function () {
    expect(await treasury.owner()).to.equal(owner.address);
  });

  it("deve definir corretamente o token do sistema", async function () {
    expect(await treasury.token()).to.equal(await energyToken.getAddress());
  });

  it("deve definir corretamente o preço inicial", async function () {
    expect(await treasury.tokenPerEth()).to.equal(TOKEN_PER_ETH);
  });

  it("o owner deve conseguir atualizar o preço", async function () {
    const newRate = ethers.parseUnits("500", 18);

    await treasury.setTokenPerEth(newRate);

    expect(await treasury.tokenPerEth()).to.equal(newRate);
  });

  it("um endereço não autorizado não deve conseguir atualizar o preço", async function () {
    await expect(
      treasury.connect(otherAccount).setTokenPerEth(ethers.parseUnits("500", 18))
    ).to.be.reverted;
  });

  it("deve cotar corretamente a quantidade de tokens", async function () {
    const quote = await treasury.quoteTokenAmount(ethers.parseEther("2"));

    expect(quote).to.equal(ethers.parseUnits("2000", 18));
  });

  it("deve permitir compra de tokens com ETH", async function () {
    const ethSent = ethers.parseEther("1");
    const buyerBalanceBefore = await energyToken.balanceOf(buyer.address);

    await treasury.connect(buyer).buyTokens({ value: ethSent });

    const buyerBalanceAfter = await energyToken.balanceOf(buyer.address);

    expect(buyerBalanceAfter - buyerBalanceBefore).to.equal(
      ethers.parseUnits("1000", 18)
    );
  });

  it("não deve permitir compra sem enviar ETH", async function () {
    await expect(
      treasury.connect(buyer).buyTokens({ value: 0 })
    ).to.be.revertedWith("No ETH sent");
  });

  it("não deve permitir compra quando a reserva de tokens for insuficiente", async function () {
    const MarketplaceTreasury = await ethers.getContractFactory("MarketplaceTreasury");

    const emptyTreasury = await MarketplaceTreasury.deploy(
      owner.address,
      await energyToken.getAddress(),
      TOKEN_PER_ETH
    );
    await emptyTreasury.waitForDeployment();

    await expect(
      emptyTreasury.connect(buyer).buyTokens({ value: ethers.parseEther("1") })
    ).to.be.revertedWith("Insufficient token reserve");
  });

  it("o owner deve conseguir sacar ETH arrecadado", async function () {
    await treasury.connect(buyer).buyTokens({ value: ethers.parseEther("1") });

    const treasuryEthBalance = await ethers.provider.getBalance(
      await treasury.getAddress()
    );

    expect(treasuryEthBalance).to.equal(ethers.parseEther("1"));

    await treasury.withdrawEth(owner.address, ethers.parseEther("1"));

    const treasuryEthBalanceAfter = await ethers.provider.getBalance(
      await treasury.getAddress()
    );

    expect(treasuryEthBalanceAfter).to.equal(0);
  });
});