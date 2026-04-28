require("dotenv").config();
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

/**
 * @title Script de demonstração do fluxo de governança
 * @author Patrício Alves
 * @notice Este script demonstra o fluxo de governança do protocolo:
 *         distribuição de poder de voto, criação de proposta,
 *         votação, encerramento do prazo e execução.
 *
 * @dev O fluxo executado é:
 *      1. identificar a rede atual
 *      2. ler os endereços implantados daquela rede
 *      3. conectar aos contratos necessários
 *      4. garantir saldo de token para os votantes
 *      5. criar uma proposta de governança
 *      6. registrar votos favoráveis e contrários
 *      7. avançar o tempo local, quando aplicável
 *      8. executar a proposta aprovada
 *      9. mostrar os estados finais no terminal
 *
 *      Nesta demonstração, a proposta altera o valor mínimo de caução
 *      no contrato SupplierCollateral.
 *
 *      Observação:
 *      - em localhost, o script avança artificialmente o tempo
 *      - em rede pública, esse avanço não é feito
 */

async function main() {
  /**
   * @dev Obtém contas da rede atual.
   *
   *      Neste fluxo:
   *      - owner atua como administrador e minter do token
   *      - voter1 cria a proposta e vota
   *      - voter2 vota
   */
  const [owner, voter1, voter2] = await ethers.getSigners();

  /**
   * @dev Descobre a rede atual.
   */
  const networkName = hre.network.name;

  console.log("Rede:", networkName);
  console.log("Owner:", owner.address);
  console.log("Voter1:", voter1.address);
  console.log("Voter2:", voter2.address);

  /**
   * @dev Lê o arquivo de deployment da rede atual.
   */
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

  /**
   * ------------------------------------------------------------------
   * Conexão com os contratos necessários
   * ------------------------------------------------------------------
   */
  const energyToken = await ethers.getContractAt(
    "EnergyToken",
    addresses.EnergyToken
  );

  const supplierCollateral = await ethers.getContractAt(
    "SupplierCollateral",
    addresses.SupplierCollateral
  );

  const energyGovernance = await ethers.getContractAt(
    "EnergyGovernance",
    addresses.EnergyGovernance
  );

  /**
   * @dev Parâmetros da demonstração.
   *
   * tokenAmountVoter1:
   * saldo de voto desejado para voter1
   *
   * tokenAmountVoter2:
   * saldo de voto desejado para voter2
   *
   * proposalType:
   * 0 = UpdateMinimumCollateral
   *
   * newMinimumCollateral:
   * novo valor proposto para a caução mínima
   */
  const tokenAmountVoter1 = 2000n;
  const tokenAmountVoter2 = 1000n;
  const proposalType = 0;
  const newMinimumCollateral = 2500n;
  const proposalDescription = "Atualizar caução mínima para 2500";

  /**
   * ------------------------------------------------------------------
   * 1. Garantir saldo de tokens para os votantes
   * ------------------------------------------------------------------
   *
   * A governança exige saldo positivo do token para criar proposta e votar.
   */
  console.log("\n1. Verificando saldos de governança...");

  let voter1Balance = await energyToken.balanceOf(voter1.address);
  let voter2Balance = await energyToken.balanceOf(voter2.address);

  console.log("Saldo atual de voter1:", voter1Balance.toString());
  console.log("Saldo atual de voter2:", voter2Balance.toString());

  if (voter1Balance < tokenAmountVoter1) {
    const missing = tokenAmountVoter1 - voter1Balance;
    console.log(`Cunhando ${missing.toString()} tokens para voter1...`);
    const txMint1 = await energyToken.mint(voter1.address, missing);
    await txMint1.wait();
  }

  if (voter2Balance < tokenAmountVoter2) {
    const missing = tokenAmountVoter2 - voter2Balance;
    console.log(`Cunhando ${missing.toString()} tokens para voter2...`);
    const txMint2 = await energyToken.mint(voter2.address, missing);
    await txMint2.wait();
  }

  voter1Balance = await energyToken.balanceOf(voter1.address);
  voter2Balance = await energyToken.balanceOf(voter2.address);

  console.log("Saldo final de voter1:", voter1Balance.toString());
  console.log("Saldo final de voter2:", voter2Balance.toString());

  if (voter1Balance === 0n || voter2Balance === 0n) {
    console.log("\nFluxo bloqueado: um dos votantes ficou sem poder de voto.");
    return;
  }

  /**
   * ------------------------------------------------------------------
   * 2. Criar proposta
   * ------------------------------------------------------------------
   */
  console.log("\n2. Criando proposta de governança...");

  const createProposalTx = await energyGovernance
    .connect(voter1)
    .createProposal(proposalType, newMinimumCollateral, proposalDescription);

  await createProposalTx.wait();
  console.log("Proposta criada com sucesso.");

  const proposalId = await energyGovernance.nextProposalId();
  console.log("Proposal ID criada:", proposalId.toString());

  let proposalData = await energyGovernance.getProposal(proposalId);

  console.log("Dados iniciais da proposta:");
  console.log({
    id: proposalData.id.toString(),
    proposalType: proposalData.proposalType.toString(),
    newValue: proposalData.newValue.toString(),
    description: proposalData.description,
    deadline: proposalData.deadline.toString(),
    votesFor: proposalData.votesFor.toString(),
    votesAgainst: proposalData.votesAgainst.toString(),
    executed: proposalData.executed,
  });

  /**
   * ------------------------------------------------------------------
   * 3. Verificações preventivas antes da votação
   * ------------------------------------------------------------------
   */
  console.log("\n3. Verificando se a proposta está apta para votação...");

  const latestBlock = await ethers.provider.getBlock("latest");
  const votingStillOpen = BigInt(latestBlock.timestamp) <= BigInt(proposalData.deadline);

  if (!votingStillOpen) {
    console.log("Fluxo bloqueado: prazo de votação já encerrado.");
    return;
  }

  const voter1AlreadyVoted = await energyGovernance.hasVoted(proposalId, voter1.address);
  const voter2AlreadyVoted = await energyGovernance.hasVoted(proposalId, voter2.address);

  if (voter1AlreadyVoted || voter2AlreadyVoted) {
    console.log("Fluxo bloqueado: um dos votantes já votou anteriormente.");
    console.log({
      voter1AlreadyVoted,
      voter2AlreadyVoted,
    });
    return;
  }

  /**
   * ------------------------------------------------------------------
   * 4. Registrar votos
   * ------------------------------------------------------------------
   *
   * Nesta demonstração:
   * - voter1 vota a favor
   * - voter2 vota contra
   *
   * Como voter1 terá mais tokens, a proposta deverá ser aprovada.
   */
  console.log("\n4. Registrando votos...");

  const voteTx1 = await energyGovernance.connect(voter1).vote(proposalId, true);
  await voteTx1.wait();
  console.log("Voto favorável de voter1 registrado.");

  const voteTx2 = await energyGovernance.connect(voter2).vote(proposalId, false);
  await voteTx2.wait();
  console.log("Voto contrário de voter2 registrado.");

  proposalData = await energyGovernance.getProposal(proposalId);

  console.log("Situação da proposta após votação:");
  console.log({
    votesFor: proposalData.votesFor.toString(),
    votesAgainst: proposalData.votesAgainst.toString(),
  });

  /**
   * ------------------------------------------------------------------
   * 5. Avançar o tempo, se estiver em localhost
   * ------------------------------------------------------------------
   */
  if (networkName === "localhost") {
    console.log("\n5. Avançando o tempo local além do prazo de votação...");
    const nowBlock = await ethers.provider.getBlock("latest");
    const secondsToAdvance =
      Number(BigInt(proposalData.deadline) - BigInt(nowBlock.timestamp) + 1n);

    if (secondsToAdvance > 0) {
      await ethers.provider.send("evm_increaseTime", [secondsToAdvance]);
      await ethers.provider.send("evm_mine", []);
    }

    console.log("Tempo avançado com sucesso.");
  } else {
    console.log(
      "\n5. Rede pública detectada. Nenhum avanço artificial de tempo será feito."
    );
  }

  /**
   * ------------------------------------------------------------------
   * 6. Verificações preventivas antes da execução
   * ------------------------------------------------------------------
   */
  console.log("\n6. Verificando se a proposta está apta para execução...");

  const currentBlock = await ethers.provider.getBlock("latest");
  const votingClosed = BigInt(currentBlock.timestamp) > BigInt(proposalData.deadline);
  const approved = BigInt(proposalData.votesFor) > BigInt(proposalData.votesAgainst);

  if (!votingClosed) {
    console.log("Fluxo bloqueado: votação ainda está aberta.");
    return;
  }

  if (!approved) {
    console.log("Fluxo bloqueado: proposta não foi aprovada.");
    console.log({
      votesFor: proposalData.votesFor.toString(),
      votesAgainst: proposalData.votesAgainst.toString(),
    });
    return;
  }

  if (proposalData.executed) {
    console.log("Fluxo bloqueado: proposta já foi executada.");
    return;
  }

  /**
   * ------------------------------------------------------------------
   * 7. Executar a proposta
   * ------------------------------------------------------------------
   */
  console.log("\n7. Executando proposta...");

  const oldMinimumCollateral = await supplierCollateral.minimumCollateral();

  const executeTx = await energyGovernance.executeProposal(proposalId);
  await executeTx.wait();

  console.log("Proposta executada com sucesso.");

  const newMinimumCollateralOnChain =
    await supplierCollateral.minimumCollateral();

  proposalData = await energyGovernance.getProposal(proposalId);

  /**
   * ------------------------------------------------------------------
   * 8. Resumo final
   * ------------------------------------------------------------------
   */
  console.log("\nResumo final do fluxo de governança:");
  console.log({
    proposalId: proposalId.toString(),
    proposalType: proposalData.proposalType.toString(),
    oldMinimumCollateral: oldMinimumCollateral.toString(),
    newMinimumCollateral: newMinimumCollateralOnChain.toString(),
    votesFor: proposalData.votesFor.toString(),
    votesAgainst: proposalData.votesAgainst.toString(),
    executed: proposalData.executed,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});