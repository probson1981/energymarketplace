require("dotenv").config();
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

/**
 * @title Script de demonstração do fluxo de staking
 * @author Patrício Alves
 * @notice Este script demonstra o fluxo de staking do protocolo.
 *
 * @dev Esta versão inclui:
 *      - funding prévio do contrato de staking
 *      - checagem preventiva de saldo antes do claim
 *      - logs claros no terminal
 */

async function main() {
  const [owner, supplier] = await ethers.getSigners();
  const networkName = hre.network.name;

  console.log("Rede:", networkName);
  console.log("Owner:", owner.address);
  console.log("Supplier:", supplier.address);

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

  const supplierStaking = await ethers.getContractAt(
    "SupplierStaking",
    addresses.SupplierStaking
  );

  const mintAmount = 10000n;
  const stakeAmount = 2000n;
  const stakingFundingAmount = 50000n;

  console.log(
    "\n0. Abastecendo o contrato de staking com tokens para recompensas..."
  );

  const ownerBalanceBeforeFunding = await energyToken.balanceOf(owner.address);

  if (ownerBalanceBeforeFunding < stakingFundingAmount) {
    const txMintOwner = await energyToken.mint(
      owner.address,
      stakingFundingAmount
    );
    await txMintOwner.wait();
    console.log("Tokens cunhados para o owner abastecer o staking.");
  } else {
    console.log("Owner já possui saldo suficiente para abastecer o staking.");
  }

  const txFundStaking = await energyToken.transfer(
    addresses.SupplierStaking,
    stakingFundingAmount
  );
  await txFundStaking.wait();

  console.log("Contrato de staking abastecido com sucesso.");

  const stakingContractTokenBalance = await energyToken.balanceOf(
    addresses.SupplierStaking
  );
  console.log(
    "Saldo do contrato de staking após funding:",
    stakingContractTokenBalance.toString()
  );

  let supplierInitialTokenBalance = await energyToken.balanceOf(supplier.address);

  console.log(
    "\nSaldo inicial de tokens do fornecedor:",
    supplierInitialTokenBalance.toString()
  );

  if (supplierInitialTokenBalance < stakeAmount) {
    console.log("\nFornecedor sem saldo suficiente. Cunhando tokens...");
    const txMint = await energyToken.mint(supplier.address, mintAmount);
    await txMint.wait();
    console.log("Tokens cunhados com sucesso.");
  } else {
    console.log("\nFornecedor já possui saldo suficiente para o staking.");
  }

  supplierInitialTokenBalance = await energyToken.balanceOf(supplier.address);
  console.log(
    "Saldo do fornecedor antes do stake:",
    supplierInitialTokenBalance.toString()
  );

  console.log("\n2. Aprovando o contrato de staking...");
  const txApprove = await energyToken
    .connect(supplier)
    .approve(addresses.SupplierStaking, stakeAmount);

  await txApprove.wait();
  console.log("Approve realizado com sucesso.");

  const allowance = await energyToken.allowance(
    supplier.address,
    addresses.SupplierStaking
  );

  console.log("Allowance para staking:", allowance.toString());

  console.log("\n3. Depositando stake...");
  const txStake = await supplierStaking.connect(supplier).stake(stakeAmount);
  await txStake.wait();
  console.log("Stake realizado com sucesso.");

  const stakedBalanceAfterStake = await supplierStaking.stakedBalance(
    supplier.address
  );
  const tokenBalanceAfterStake = await energyToken.balanceOf(supplier.address);

  console.log(
    "Saldo em staking após depósito:",
    stakedBalanceAfterStake.toString()
  );
  console.log("Saldo de tokens após stake:", tokenBalanceAfterStake.toString());

  if (networkName === "localhost") {
    console.log("\n4. Avançando o tempo local da blockchain em 300 segundos...");
    await ethers.provider.send("evm_increaseTime", [300]);
    await ethers.provider.send("evm_mine", []);
    console.log("Tempo avançado com sucesso.");
  } else {
    console.log(
      "\n4. Rede pública detectada. Nenhum avanço artificial de tempo será feito."
    );
  }

  const pendingReward = await supplierStaking.pendingReward(supplier.address);

  console.log(
    "\n5. Recompensa pendente do fornecedor:",
    pendingReward.toString()
  );

  const availableReserveBeforeClaim = await energyToken.balanceOf(
    addresses.SupplierStaking
  );

  console.log(
    "Saldo disponível no contrato de staking antes do claim:",
    availableReserveBeforeClaim.toString()
  );

  if (pendingReward > 0n) {
    if (availableReserveBeforeClaim < pendingReward) {
      console.log("\n6. Claim bloqueado por prevenção no script.");
      console.log({
        reason: "Insufficient reward reserve",
        pendingReward: pendingReward.toString(),
        availableReserveBeforeClaim: availableReserveBeforeClaim.toString(),
      });
    } else {
      console.log("\n6. Sacando recompensa...");
      const txClaim = await supplierStaking.connect(supplier).claimReward();
      await txClaim.wait();
      console.log("Recompensa sacada com sucesso.");
    }
  } else {
    console.log("\n6. Nenhuma recompensa disponível para saque neste momento.");
  }

  const finalTokenBalance = await energyToken.balanceOf(supplier.address);
  const finalStakedBalance = await supplierStaking.stakedBalance(
    supplier.address
  );
  const finalPendingReward = await supplierStaking.pendingReward(
    supplier.address
  );
  const finalStakingContractBalance = await energyToken.balanceOf(
    addresses.SupplierStaking
  );

  console.log("\nResumo final do fluxo de staking:");
  console.log({
    supplierAddress: supplier.address,
    finalTokenBalance: finalTokenBalance.toString(),
    finalStakedBalance: finalStakedBalance.toString(),
    finalPendingReward: finalPendingReward.toString(),
    stakingContractTokenBalance: finalStakingContractBalance.toString(),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});