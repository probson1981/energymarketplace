require("dotenv").config();
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

/**
 * @title Script para criação de wallets locais de teste
 * @author Patrício Alves
 * @notice Este script cria 10 wallets para ambiente local e
 *         já as abastece com ETH e EnergyToken para testes.
 *
 * @dev Fluxo executado:
 *      1. conecta ao signer owner da rede localhost
 *      2. carrega o endereço do EnergyToken a partir do deployments local
 *      3. gera 10 wallets novas e aleatórias
 *      4. envia ETH local para cada wallet
 *      5. cunha EnergyToken para cada wallet
 *      6. salva os dados em arquivo JSON
 *
 *      Finalidade:
 *      - testes de frontend
 *      - testes com múltiplos fornecedores
 *      - testes com múltiplos consumidores
 *
 *      Importante:
 *      - usar apenas em ambiente local de desenvolvimento
 *      - não usar essas private keys em ambiente real
 */

async function main() {
  /**
   * @dev Obtém o owner da rede local.
   *
   *      Este owner será usado para:
   *      - pagar ETH local às contas geradas
   *      - cunhar EnergyToken para as contas geradas
   */
  const [owner] = await ethers.getSigners();

  /**
   * @dev Carrega os deployments locais.
   */
  const deploymentFile = path.join(
    __dirname,
    "..",
    "deployments",
    "localhost.json"
  );

  if (!fs.existsSync(deploymentFile)) {
    throw new Error(
      `Arquivo de deployment não encontrado: ${deploymentFile}`
    );
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));

  /**
   * @dev Conecta ao contrato EnergyToken já implantado.
   */
  const energyToken = await ethers.getContractAt(
    "EnergyToken",
    deployments.EnergyToken
  );

  /**
   * @dev Provider da rede local.
   */
  const provider = ethers.provider;

  /**
   * @dev Quantidade de wallets a criar.
   */
  const walletCount = 10;

  /**
   * @dev Quantidade de ETH local enviada para cada wallet.
   *
   *      Aqui usamos 100 ETH locais para cada uma,
   *      o que é abundante para testes.
   */
  const ethAmountPerWallet = ethers.parseEther("100");

  /**
   * @dev Quantidade de EnergyToken para cada wallet.
   */
  const tokenAmountPerWallet = 5000n;

  /**
   * @dev Vetor onde serão guardadas as wallets geradas.
   */
  const generatedWallets = [];

  console.log("Owner executor:", owner.address);
  console.log("Criando wallets locais de teste...\n");

  for (let i = 0; i < walletCount; i++) {
    /**
     * @dev Cria uma wallet aleatória e conecta ao provider local.
     */
    const wallet = ethers.Wallet.createRandom().connect(provider);

    console.log(`Wallet ${i + 1}`);
    console.log("Address:", wallet.address);

    /**
     * @dev Envia ETH local para a wallet poder pagar gás.
     */
    const ethTx = await owner.sendTransaction({
      to: wallet.address,
      value: ethAmountPerWallet,
    });
    await ethTx.wait();

    /**
     * @dev Cunha EnergyToken para a wallet.
     */
    const mintTx = await energyToken.mint(wallet.address, tokenAmountPerWallet);
    await mintTx.wait();

    /**
     * @dev Lê os saldos finais para conferência.
     */
    const ethBalance = await provider.getBalance(wallet.address);
    const tokenBalance = await energyToken.balanceOf(wallet.address);

    /**
     * @dev Salva os dados da wallet.
     */
    generatedWallets.push({
      index: i + 1,
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic ? wallet.mnemonic.phrase : null,
      ethBalance: ethBalance.toString(),
      tokenBalance: tokenBalance.toString(),
    });

    console.log("ETH balance:", ethBalance.toString());
    console.log("Token balance:", tokenBalance.toString());
    console.log("----------------------------------------");
  }

  /**
   * @dev Cria a pasta de saída, se necessário.
   */
  const outputDir = path.join(__dirname, "..", "generated");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  /**
   * @dev Salva as wallets geradas em arquivo JSON.
   */
  const outputFile = path.join(outputDir, "local_wallets.json");
  fs.writeFileSync(JSON.stringify ? outputFile : outputFile, JSON.stringify({
    network: "localhost",
    generatedAt: new Date().toISOString(),
    owner: owner.address,
    walletCount,
    ethAmountPerWallet: ethAmountPerWallet.toString(),
    tokenAmountPerWallet: tokenAmountPerWallet.toString(),
    wallets: generatedWallets,
  }, null, 2));

  console.log("\nWallets criadas com sucesso.");
  console.log(`Arquivo salvo em: ${outputFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});