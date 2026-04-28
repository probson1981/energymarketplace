import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import deployments from "../config/deployments.json";

/**
 * @title Tela de cadastro de fornecedor, compra de token e caução
 * @author Patrício Alves
 * @notice Esta tela permite:
 *         - registrar fornecedor
 *         - consultar status ativo
 *         - consultar saldo do token
 *         - comprar EnergyToken da tesouraria on-chain
 *         - consultar saldo de caução
 *         - aprovar e depositar caução
 *
 * @dev Esta versão usa apenas funções já existentes nos contratos.
 */

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
];

const SUPPLIER_REGISTRY_ABI = [
  "function registerSupplier(string,string)",
  "function isSupplierActive(address) view returns (bool)",
];

const COLLATERAL_ABI = [
  "function depositCollateral(uint256)",
  "function collateralBalance(address) view returns (uint256)",
  "function hasMinimumCollateral(address) view returns (bool)",
  "function minimumCollateral() view returns (uint256)",
];

const TREASURY_ABI = [
  "function tokenPerEth() view returns (uint256)",
  "function tokenReserve() view returns (uint256)",
  "function buyTokens() payable returns (uint256)",
  "function quoteTokenAmount(uint256 ethAmount) view returns (uint256)",
];

function parseError(error) {
  return (
    error?.shortMessage ||
    error?.reason ||
    error?.message ||
    "Erro desconhecido"
  );
}

/**
 * @dev Formata valores de token com 18 casas decimais para exibição humana.
 */
function formatToken(value) {
  try {
    return Number(ethers.formatUnits(value, 18)).toLocaleString("pt-BR", {
      maximumFractionDigits: 4,
    });
  } catch {
    return "0";
  }
}

/**
 * @dev Formata valores em ETH para exibição humana.
 */
function formatEth(value) {
  try {
    return Number(ethers.formatEther(value)).toLocaleString("pt-BR", {
      maximumFractionDigits: 6,
    });
  } catch {
    return "0";
  }
}

function SupplierRegisterPage({ signer, account, networkOk }) {
  /**
   * @dev Estado do formulário principal do fornecedor.
   */
  const [form, setForm] = useState({
    name: "Fornecedor Demo",
    documentId: "CNPJ-DEMO-001",
    collateralAmount: "1500",
  });

  /**
   * @dev Estado da compra de token com ETH.
   */
  const [purchaseForm, setPurchaseForm] = useState({
    ethAmount: "1",
  });

  /**
   * @dev Estados operacionais da tela.
   */
  const [supplierActive, setSupplierActive] = useState(false);
  const [tokenBalance, setTokenBalance] = useState("0");
  const [collateralBalance, setCollateralBalance] = useState("0");
  const [minimumCollateral, setMinimumCollateral] = useState("0");
  const [hasMinimumCollateral, setHasMinimumCollateral] = useState(false);

  /**
   * @dev Estados da tesouraria.
   */
  const [tokenPerEth, setTokenPerEth] = useState("0");
  const [treasuryReserve, setTreasuryReserve] = useState("0");
  const [quotedTokenAmount, setQuotedTokenAmount] = useState("0");

  /**
   * @dev Estados visuais.
   */
  const [status, setStatus] = useState("Tela pronta.");
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [flashSuccess, setFlashSuccess] = useState(false);

  /**
   * @dev Instâncias dos contratos.
   */
  const tokenContract = useMemo(() => {
    if (!signer) return null;
    return new ethers.Contract(deployments.EnergyToken, TOKEN_ABI, signer);
  }, [signer]);

  const supplierRegistry = useMemo(() => {
    if (!signer) return null;
    return new ethers.Contract(
      deployments.SupplierRegistry,
      SUPPLIER_REGISTRY_ABI,
      signer
    );
  }, [signer]);

  const collateralContract = useMemo(() => {
    if (!signer) return null;
    return new ethers.Contract(
      deployments.SupplierCollateral,
      COLLATERAL_ABI,
      signer
    );
  }, [signer]);

  const treasuryContract = useMemo(() => {
    if (!signer) return null;
    return new ethers.Contract(
      deployments.MarketplaceTreasury,
      TREASURY_ABI,
      signer
    );
  }, [signer]);

  function triggerSuccessFlash() {
    setFlashSuccess(true);
    setTimeout(() => setFlashSuccess(false), 1800);
  }

  /**
   * @notice Atualiza os dados do fornecedor, da tesouraria e da caução.
   */
  async function refreshSupplierData() {
    try {
      setError("");
      setIsRefreshing(true);

      if (
        !tokenContract ||
        !supplierRegistry ||
        !collateralContract ||
        !treasuryContract ||
        !account
      ) {
        setStatus("Conecte a carteira para consultar o fornecedor.");
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        return;
      }

      const [
        active,
        balanceToken,
        balanceCollateral,
        minCollateral,
        hasMinCollateral,
        currentTokenPerEth,
        currentTreasuryReserve,
      ] = await Promise.all([
        supplierRegistry.isSupplierActive(account),
        tokenContract.balanceOf(account),
        collateralContract.collateralBalance(account),
        collateralContract.minimumCollateral(),
        collateralContract.hasMinimumCollateral(account),
        treasuryContract.tokenPerEth(),
        treasuryContract.tokenReserve(),
      ]);

      setSupplierActive(active);
      setTokenBalance(balanceToken.toString());
      setCollateralBalance(balanceCollateral.toString());
      setMinimumCollateral(minCollateral.toString());
      setHasMinimumCollateral(hasMinCollateral);
      setTokenPerEth(currentTokenPerEth.toString());
      setTreasuryReserve(currentTreasuryReserve.toString());

      try {
        const ethValue = purchaseForm.ethAmount || "0";
        const quoted = await treasuryContract.quoteTokenAmount(
          ethers.parseEther(ethValue)
        );
        setQuotedTokenAmount(quoted.toString());
      } catch {
        setQuotedTokenAmount("0");
      }

      setStatus("Dados atualizados com sucesso.");
      triggerSuccessFlash();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsRefreshing(false);
    }
  }

  /**
   * @notice Registra o fornecedor no contrato.
   */
  async function registerSupplier() {
    try {
      setError("");
      setIsRegistering(true);

      if (!supplierRegistry || !account) {
        setError("Conecte a carteira antes de registrar o fornecedor.");
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        return;
      }

      if (!form.name || !form.documentId) {
        setError("Informe nome e documento do fornecedor.");
        return;
      }

      setStatus("Registrando fornecedor...");

      const tx = await supplierRegistry.registerSupplier(
        form.name,
        form.documentId
      );

      await tx.wait();

      setStatus("Fornecedor registrado com sucesso.");
      await refreshSupplierData();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsRegistering(false);
    }
  }

  /**
   * @notice Compra EnergyToken da tesouraria enviando ETH.
   */
  async function buyTokensFromTreasury() {
    try {
      setError("");
      setIsBuying(true);

      if (!treasuryContract || !account) {
        setError("Conecte a carteira antes de comprar tokens.");
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        return;
      }

      const ethAmount = purchaseForm.ethAmount || "0";

      if (Number(ethAmount) <= 0) {
        setError("Informe um valor válido em ETH.");
        return;
      }

      setStatus("Comprando EnergyToken da tesouraria...");

      const tx = await treasuryContract.buyTokens({
        value: ethers.parseEther(ethAmount),
      });

      await tx.wait();

      setStatus("Compra de EnergyToken realizada com sucesso.");
      await refreshSupplierData();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsBuying(false);
    }
  }

  /**
   * @notice Aprova e deposita a caução.
   */
  async function approveAndDepositCollateral() {
    try {
      setError("");
      setIsDepositing(true);

      if (!tokenContract || !collateralContract || !account) {
        setError("Conecte a carteira antes de depositar a caução.");
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        return;
      }

      const amount = ethers.parseUnits(form.collateralAmount || "0", 18);

      if (amount <= 0n) {
        setError("Informe um valor válido para a caução.");
        return;
      }

      const balance = await tokenContract.balanceOf(account);

      if (balance < amount) {
        setError("Saldo insuficiente para depositar a caução.");
        return;
      }

      setStatus("Aprovando tokens para a caução...");

      const approveTx = await tokenContract.approve(
        deployments.SupplierCollateral,
        amount
      );
      await approveTx.wait();

      const allowance = await tokenContract.allowance(
        account,
        deployments.SupplierCollateral
      );

      if (allowance < amount) {
        setError("Allowance insuficiente após o approve.");
        return;
      }

      setStatus("Depositando caução...");

      const depositTx = await collateralContract.depositCollateral(amount);
      await depositTx.wait();

      setStatus("Caução depositada com sucesso.");
      await refreshSupplierData();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsDepositing(false);
    }
  }

  useEffect(() => {
    if (account && signer) {
      refreshSupplierData();
    }
  }, [account, signer]);

  /**
   * @dev Atualiza a cotação local quando o usuário altera o valor em ETH.
   */
  useEffect(() => {
    async function updateQuote() {
      try {
        if (!treasuryContract) return;

        const ethValue = purchaseForm.ethAmount || "0";
        if (Number(ethValue) <= 0) {
          setQuotedTokenAmount("0");
          return;
        }

        const quoted = await treasuryContract.quoteTokenAmount(
          ethers.parseEther(ethValue)
        );
        setQuotedTokenAmount(quoted.toString());
      } catch {
        setQuotedTokenAmount("0");
      }
    }

    updateQuote();
  }, [purchaseForm.ethAmount, treasuryContract]);

  return (
    <div className={`panel-card ${flashSuccess ? "panel-flash-success" : ""}`}>
      <h2>Cadastro de fornecedor, compra de token e caução</h2>

      <p><strong>Status:</strong> {status}</p>

      {error && (
        <p className="error-text">
          <strong>Erro:</strong> {error}
        </p>
      )}

      <p>
        <strong>Fornecedor ativo:</strong>{" "}
        <span className={supplierActive ? "status-yes" : "status-no"}>
          {supplierActive ? "sim" : "não"}
        </span>
      </p>

      <p>
        <strong>Saldo do usuário em EnergyToken:</strong> {formatToken(tokenBalance)} EnergyToken
      </p>

      <p>
        <strong>Caução depositada no marketplace:</strong> {formatToken(collateralBalance)} EnergyToken
      </p>

      <p>
        <strong>Caução mínima exigida:</strong> {formatToken(minimumCollateral)} EnergyToken
      </p>

      <p>
        <strong>Possui caução mínima:</strong>{" "}
        <span className={hasMinimumCollateral ? "status-yes" : "status-no"}>
          {hasMinimumCollateral ? "sim" : "não"}
        </span>
      </p>

      <div style={{ marginTop: "16px" }}>
        <label>
          Nome do fornecedor
          <br />
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={{ width: "320px", padding: "8px", marginTop: "4px" }}
          />
        </label>
      </div>

      <div style={{ marginTop: "16px" }}>
        <label>
          Documento do fornecedor
          <br />
          <input
            value={form.documentId}
            onChange={(e) => setForm({ ...form, documentId: e.target.value })}
            style={{ width: "320px", padding: "8px", marginTop: "4px" }}
          />
        </label>
      </div>

      <div className="button-row" style={{ marginTop: "16px" }}>
        <button onClick={registerSupplier} disabled={isRegistering}>
          {isRegistering ? "Registrando..." : "Registrar fornecedor"}
        </button>

        <button onClick={refreshSupplierData} disabled={isRefreshing}>
          {isRefreshing ? "Atualizando..." : "Atualizar dados"}
        </button>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <h3>Compra de EnergyToken</h3>

      <p>
        <strong>Preço atual:</strong> {formatToken(tokenPerEth)} EnergyToken por 1 ETH
      </p>

      <p>
        <strong>Tokens disponíveis na tesouraria:</strong> {formatToken(treasuryReserve)} EnergyToken
      </p>

      <div>
        <label>
          Valor em ETH para compra
          <br />
          <input
            value={purchaseForm.ethAmount}
            onChange={(e) =>
              setPurchaseForm({ ...purchaseForm, ethAmount: e.target.value })
            }
            style={{ width: "220px", padding: "8px", marginTop: "4px" }}
          />
        </label>
      </div>

      <p style={{ marginTop: "12px" }}>
        <strong>Você receberá aproximadamente:</strong> {formatToken(quotedTokenAmount)} EnergyToken
      </p>

      <div className="button-row" style={{ marginTop: "16px" }}>
        <button onClick={buyTokensFromTreasury} disabled={isBuying}>
          {isBuying ? "Comprando..." : "Comprar EnergyToken"}
        </button>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <h3>Caução</h3>

      <div>
        <label>
          Valor da caução em EnergyToken
          <br />
          <input
            value={form.collateralAmount}
            onChange={(e) =>
              setForm({ ...form, collateralAmount: e.target.value })
            }
            style={{ width: "220px", padding: "8px", marginTop: "4px" }}
          />
        </label>
      </div>

      <div className="button-row" style={{ marginTop: "16px" }}>
        <button
          onClick={approveAndDepositCollateral}
          disabled={isDepositing}
        >
          {isDepositing ? "Processando..." : "Aprovar e depositar caução"}
        </button>
      </div>
    </div>
  );
}

export default SupplierRegisterPage;