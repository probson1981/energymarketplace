import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import deployments from "../config/deployments.json";
import GovernancePage from "./GovernancePage";

/**
 * @title Tela administrativa do protocolo
 * @author Patrício Alves
 * @notice Esta tela reúne:
 *         - resumo do ambiente conectado
 *         - visão da tesouraria
 *         - governança
 *
 * @dev Usa apenas funções já existentes no contrato de tesouraria.
 */

const TREASURY_ABI = [
  "function tokenPerEth() view returns (uint256)",
  "function tokenReserve() view returns (uint256)",
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

function formatEth(value) {
  try {
    return Number(ethers.formatEther(value)).toLocaleString("pt-BR", {
      maximumFractionDigits: 6,
    });
  } catch {
    return "0";
  }
}

function AdminPage({ signer, provider, account, chainId, networkOk }) {
  const [status, setStatus] = useState("Tela pronta.");
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [tokenPerEth, setTokenPerEth] = useState("0");
  const [tokenReserve, setTokenReserve] = useState("0");
  const [treasuryEthBalance, setTreasuryEthBalance] = useState("0");

  const treasuryContract = useMemo(() => {
    if (!signer) return null;

    return new ethers.Contract(
      deployments.MarketplaceTreasury,
      TREASURY_ABI,
      signer
    );
  }, [signer]);

  async function refreshAdminData() {
    try {
      setError("");
      setIsRefreshing(true);

      if (!treasuryContract || !provider || !account) {
        setStatus("Conecte a carteira para consultar o painel administrativo.");
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        return;
      }

      const [currentTokenPerEth, currentTokenReserve, currentTreasuryEth] =
        await Promise.all([
          treasuryContract.tokenPerEth(),
          treasuryContract.tokenReserve(),
          provider.getBalance(deployments.MarketplaceTreasury),
        ]);

      setTokenPerEth(currentTokenPerEth.toString());
      setTokenReserve(currentTokenReserve.toString());
      setTreasuryEthBalance(currentTreasuryEth.toString());

      setStatus("Painel administrativo atualizado com sucesso.");
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (account && signer && provider) {
      refreshAdminData();
    }
  }, [account, signer, provider]);

  return (
    <>
      <div className="panel-card">
        <h2>Painel administrativo</h2>

        <p>
          <strong>Status:</strong> {status}
        </p>

        {error && (
          <p className="error-text">
            <strong>Erro:</strong> {error}
          </p>
        )}

        <div className="button-row" style={{ marginTop: "16px" }}>
          <button onClick={refreshAdminData} disabled={isRefreshing}>
            {isRefreshing ? "Atualizando..." : "Atualizar painel"}
          </button>
        </div>

        <hr style={{ margin: "24px 0" }} />

        <h3>Ambiente conectado</h3>

        <p>
          <strong>Conta conectada:</strong> {account || "não conectada"}
        </p>

        <p>
          <strong>Chain ID:</strong> {chainId ?? "não detectado"}
        </p>

        <p>
          <strong>Rede compatível:</strong> {networkOk ? "sim" : "não"}
        </p>

        <p>
          <strong>Endereço da tesouraria:</strong> {deployments.MarketplaceTreasury}
        </p>

        <p>
          <strong>Endereço do token:</strong> {deployments.EnergyToken}
        </p>

        <p>
          <strong>Endereço da governança:</strong> {deployments.EnergyGovernance}
        </p>

        <hr style={{ margin: "24px 0" }} />

        <h3>Tesouraria do marketplace</h3>

        <p>
          <strong>Preço atual:</strong> {formatToken(tokenPerEth)} EnergyToken por 1 ETH
        </p>

        <p>
          <strong>Reserva atual da tesouraria:</strong> {formatToken(tokenReserve)} EnergyToken
        </p>

        <p>
          <strong>Saldo em ETH arrecadado:</strong> {formatEth(treasuryEthBalance)} ETH
        </p>
      </div>

      <GovernancePage
        signer={signer}
        account={account}
        networkOk={networkOk}
      />
    </>
  );
}

export default AdminPage;