import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import deployments from "../config/deployments.json";

/**
 * @title Tela de staking
 * @author Patrício Alves
 * @notice Esta tela permite:
 *         - consultar saldo em stake
 *         - consultar recompensa pendente
 *         - fazer approve e stake
 *         - sacar recompensa
 *         - retirar stake
 *
 * @dev Usa apenas funções já existentes nos contratos do projeto.
 */

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
];

const STAKING_ABI = [
  "function stakedBalance(address) view returns (uint256)",
  "function pendingReward(address) view returns (uint256)",
  "function stake(uint256)",
  "function unstake(uint256)",
  "function claimReward()",
  "function baseRewardRate() view returns (uint256)",
];

function parseError(error) {
  return (
    error?.shortMessage ||
    error?.reason ||
    error?.message ||
    "Erro desconhecido"
  );
}

function formatToken(value) {
  try {
    return Number(ethers.formatUnits(value, 18)).toLocaleString("pt-BR", {
      maximumFractionDigits: 4,
    });
  } catch {
    return "0";
  }
}

function formatRate(value) {
  try {
    return Number(ethers.formatUnits(value, 18)).toLocaleString("pt-BR", {
      maximumFractionDigits: 6,
    });
  } catch {
    return "0";
  }
}

function StakingPage({ signer, account, networkOk }) {
  const [form, setForm] = useState({
    stakeAmount: "100",
    unstakeAmount: "50",
  });

  const [status, setStatus] = useState("Tela pronta.");
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const [tokenBalance, setTokenBalance] = useState("0");
  const [stakeBalance, setStakeBalance] = useState("0");
  const [pendingReward, setPendingReward] = useState("0");
  const [rewardRateBase, setRewardRateBase] = useState("0");

  const tokenContract = useMemo(() => {
    if (!signer) return null;
    return new ethers.Contract(deployments.EnergyToken, TOKEN_ABI, signer);
  }, [signer]);

  const stakingContract = useMemo(() => {
    if (!signer) return null;
    return new ethers.Contract(
      deployments.SupplierStaking,
      STAKING_ABI,
      signer
    );
  }, [signer]);

  async function refreshStakingData() {
    try {
      setError("");
      setIsRefreshing(true);

      if (!tokenContract || !stakingContract || !account) {
        setStatus("Conecte a carteira para consultar o staking.");
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        return;
      }

    const [balanceToken, currentStake, currentPendingReward, currentRewardRate] =
     await Promise.all([
        tokenContract.balanceOf(account),
        stakingContract.stakedBalance(account),
        stakingContract.pendingReward(account),
        stakingContract.baseRewardRate(),
    ]);

      setTokenBalance(balanceToken.toString());
      setStakeBalance(currentStake.toString());
      setPendingReward(currentPendingReward.toString());
      setRewardRateBase(currentRewardRate.toString());

      setStatus("Dados de staking atualizados com sucesso.");
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function approveAndStake() {
    try {
      setError("");
      setIsStaking(true);

      if (!tokenContract || !stakingContract || !account) {
        setError("Conecte a carteira antes de fazer stake.");
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        return;
      }

      const amount = ethers.parseUnits(form.stakeAmount || "0", 18);

      if (amount <= 0n) {
        setError("Informe um valor válido para stake.");
        return;
      }

      const balance = await tokenContract.balanceOf(account);

      if (balance < amount) {
        setError("Saldo insuficiente para fazer stake.");
        return;
      }

      setStatus("Aprovando tokens para o staking...");

      const approveTx = await tokenContract.approve(
        deployments.SupplierStaking,
        amount
      );
      await approveTx.wait();

      const allowance = await tokenContract.allowance(
        account,
        deployments.SupplierStaking
      );

      if (allowance < amount) {
        setError("Allowance insuficiente após approve.");
        return;
      }

      setStatus("Realizando stake...");

      const stakeTx = await stakingContract.stake(amount);
      await stakeTx.wait();

      setStatus("Stake realizado com sucesso.");
      await refreshStakingData();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsStaking(false);
    }
  }

  async function unstakeTokens() {
    try {
      setError("");
      setIsUnstaking(true);

      if (!stakingContract || !account) {
        setError("Conecte a carteira antes de retirar stake.");
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        return;
      }

      const amount = ethers.parseUnits(form.unstakeAmount || "0", 18);

      if (amount <= 0n) {
        setError("Informe um valor válido para unstake.");
        return;
      }

      setStatus("Retirando stake...");

      const tx = await stakingContract.unstake(amount);
      await tx.wait();

      setStatus("Unstake realizado com sucesso.");
      await refreshStakingData();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsUnstaking(false);
    }
  }

  async function claimReward() {
    try {
      setError("");
      setIsClaiming(true);

      if (!stakingContract || !account) {
        setError("Conecte a carteira antes de sacar recompensa.");
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        return;
      }

      setStatus("Sacando recompensa...");

      const tx = await stakingContract.claimReward();
      await tx.wait();

      setStatus("Recompensa sacada com sucesso.");
      await refreshStakingData();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsClaiming(false);
    }
  }

  useEffect(() => {
    if (account && signer) {
      refreshStakingData();
    }
  }, [account, signer]);

  return (
    <div className="panel-card">
      <h2>Staking</h2>

      <p>
        <strong>Status:</strong> {status}
      </p>

      {error && (
        <p className="error-text">
          <strong>Erro:</strong> {error}
        </p>
      )}

      <p>
        <strong>Saldo do usuário em EnergyToken:</strong>{" "}
        {formatToken(tokenBalance)} EnergyToken
      </p>

      <p>
        <strong>Saldo em stake:</strong> {formatToken(stakeBalance)} EnergyToken
      </p>

      <p>
        <strong>Recompensa pendente:</strong>{" "}
        {formatToken(pendingReward)} EnergyToken
      </p>

      <p>
        <strong>Taxa base de recompensa:</strong> {formatToken(rewardRateBase)} %
      </p>

      <div className="button-row" style={{ marginTop: "16px" }}>
        <button onClick={refreshStakingData} disabled={isRefreshing}>
          {isRefreshing ? "Atualizando..." : "Atualizar dados"}
        </button>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <h3>Fazer stake</h3>

      <div>
        <label>
          Valor do stake em EnergyToken
          <br />
          <input
            value={form.stakeAmount}
            onChange={(e) => setForm({ ...form, stakeAmount: e.target.value })}
            style={{ width: "220px", padding: "8px", marginTop: "4px" }}
          />
        </label>
      </div>

      <div className="button-row" style={{ marginTop: "16px" }}>
        <button onClick={approveAndStake} disabled={isStaking}>
          {isStaking ? "Processando..." : "Aprovar e fazer stake"}
        </button>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <h3>Retirar stake</h3>

      <div>
        <label>
          Valor do unstake em EnergyToken
          <br />
          <input
            value={form.unstakeAmount}
            onChange={(e) =>
              setForm({ ...form, unstakeAmount: e.target.value })
            }
            style={{ width: "220px", padding: "8px", marginTop: "4px" }}
          />
        </label>
      </div>

      <div className="button-row" style={{ marginTop: "16px" }}>
        <button onClick={unstakeTokens} disabled={isUnstaking}>
          {isUnstaking ? "Processando..." : "Retirar stake"}
        </button>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <h3>Recompensa</h3>

      <div className="button-row" style={{ marginTop: "16px" }}>
        <button onClick={claimReward} disabled={isClaiming}>
          {isClaiming ? "Processando..." : "Sacar recompensa"}
        </button>
      </div>
    </div>
  );
}

export default StakingPage;