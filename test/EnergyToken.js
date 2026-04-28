const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * @title Testes do contrato EnergyToken
 * @author Patrício Alves
 * @notice Este arquivo contém os testes automatizados do contrato EnergyToken.
 *
 * @dev O objetivo destes testes é verificar se o contrato ERC-20 básico do
 *      protocolo está funcionando corretamente antes do avanço para os demais
 *      módulos do sistema.
 *
 *      Os testes verificam, principalmente:
 *      1. nome e símbolo do token
 *      2. definição correta do owner inicial
 *      3. autorização de endereços minters
 *      4. cunhagem por minter autorizado
 *      5. bloqueio de cunhagem por endereço não autorizado
 *      6. cunhagem direta pelo owner
 */

describe("EnergyToken", function () {
  // Variáveis que serão reutilizadas nos testes
  let EnergyToken;
  let energyToken;
  let owner;
  let addr1;
  let addr2;

  /**
   * @notice Executado antes de cada teste.
   *
   * @dev Este bloco faz um "reset lógico" do cenário antes de cada caso de teste.
   *      Assim, cada teste começa com um contrato recém-implantado, evitando
   *      interferência de um teste sobre o outro.
   */
  beforeEach(async function () {
    // Obtém contas de teste fornecidas automaticamente pelo Hardhat
    [owner, addr1, addr2] = await ethers.getSigners();

    // Obtém a fábrica do contrato EnergyToken
    EnergyToken = await ethers.getContractFactory("EnergyToken");

    // Faz o deploy do contrato, definindo o owner inicial
    energyToken = await EnergyToken.deploy(owner.address);

    // Aguarda a conclusão da implantação
    await energyToken.waitForDeployment();
  });

  /**
   * @notice Verifica se o nome e o símbolo do token foram definidos corretamente.
   */
  it("deve ter o nome e símbolo corretos", async function () {
    expect(await energyToken.name()).to.equal("Energy Token");
    expect(await energyToken.symbol()).to.equal("ENG");
  });

  /**
   * @notice Verifica se o endereço informado no deploy foi realmente definido
   *         como proprietário do contrato.
   */
  it("deve definir corretamente o owner inicial", async function () {
    expect(await energyToken.owner()).to.equal(owner.address);
  });

  /**
   * @notice Verifica se o owner consegue autorizar um endereço como minter.
   *
   * @dev Após a chamada da função setMinter, o endereço deve passar a constar
   *      como autorizado no mapeamento minters.
   */
  it("o owner deve conseguir autorizar um minter", async function () {
    await energyToken.setMinter(addr1.address, true);
    expect(await energyToken.minters(addr1.address)).to.equal(true);
  });

  /**
   * @notice Verifica se um minter autorizado consegue cunhar tokens.
   *
   * @dev Neste teste:
   *      1. o owner autoriza addr1 como minter
   *      2. addr1 cunha tokens para addr2
   *      3. o saldo final de addr2 deve refletir a cunhagem
   */
  it("um minter autorizado deve conseguir cunhar tokens", async function () {
    // Owner autoriza addr1 como minter
    await energyToken.setMinter(addr1.address, true);

    // addr1 cunha 1000 tokens para addr2
    await energyToken.connect(addr1).mint(addr2.address, 1000);

    // Verifica se addr2 recebeu corretamente os tokens
    expect(await energyToken.balanceOf(addr2.address)).to.equal(1000);
  });

  /**
   * @notice Verifica se um endereço não autorizado é impedido de cunhar tokens.
   *
   * @dev O comportamento esperado é a reversão da transação com a mensagem
   *      "Not authorized".
   */
  it("um endereço não autorizado não deve conseguir cunhar tokens", async function () {
    await expect(
      energyToken.connect(addr1).mint(addr2.address, 1000)
    ).to.be.revertedWith("Not authorized");
  });

  /**
   * @notice Verifica se o próprio owner também pode cunhar tokens diretamente.
   *
   * @dev Isso é permitido pela lógica do contrato, mesmo que o owner não esteja
   *      explicitamente marcado no mapeamento minters.
   */
  it("o owner também deve conseguir cunhar tokens diretamente", async function () {
    await energyToken.mint(addr1.address, 500);

    expect(await energyToken.balanceOf(addr1.address)).to.equal(500);
  });
});