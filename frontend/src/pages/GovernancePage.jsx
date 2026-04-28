import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import deployments from "../config/deployments.json";

/**
 * @title Tela de governança
 * @author Patrício Alves
 * @notice Esta tela permite:
 *         - criar proposta
 *         - consultar proposta por ID
 *         - votar a favor ou contra
 *         - encerrar votação
 *         - executar proposta aprovada
 *
 * @dev Ajustes principais desta versão:
 *      1. Para proposta de caução mínima, converte o valor com
 *         ethers.parseUnits(valor, 18).
 *      2. Para proposta de reward rate, mantém o valor como inteiro bruto.
 *      3. Exibe a caução mínima global atual lida diretamente do contrato
 *         SupplierCollateral.
 *      4. Após executar proposta, recarrega os dados da proposta e o valor
 *         atual da caução mínima.
 */

const GOVERNANCE_ABI = [
  "function nextProposalId() view returns (uint256)",
  "function createProposal(uint8 proposalType,uint256 newValue,string description) returns (uint256)",
  "function createMinimumCollateralProposal(uint256 newMinimumCollateral,string description) returns (uint256)",
  "function createRewardRateProposal(uint256 newRewardRate,string description) returns (uint256)",
  "function vote(uint256 proposalId,bool support)",
  "function closeProposal(uint256 proposalId)",
  "function executeProposal(uint256 proposalId)",
  "function getProposalStatus(uint256 proposalId) view returns (uint8)",
  "function isVotingOpen(uint256 proposalId) view returns (bool)",
  "function canCloseProposal(uint256 proposalId) view returns (bool)",
  "function canExecuteProposal(uint256 proposalId) view returns (bool)",
  "function getProposal(uint256 proposalId) view returns (tuple(uint256 id,uint8 proposalType,uint256 newValue,string description,uint256 deadline,uint256 votesFor,uint256 votesAgainst,bool closed,bool executed))",
];

const SUPPLIER_COLLATERAL_ABI = [
  "function minimumCollateral() view returns (uint256)",
];

const PROPOSAL_STATUS = {
  0: "Não encontrada",
  1: "Votação aberta",
  2: "Prazo encerrado, aguardando fechamento",
  3: "Encerrada e aprovada",
  4: "Encerrada e rejeitada",
  5: "Executada",
};

function parseError(error) {
  return (
    error?.shortMessage ||
    error?.reason ||
    error?.message ||
    "Erro desconhecido"
  );
}

function normalizeDecimalInput(value) {
  return String(value || "").trim().replace(",", ".");
}

function formatTimestamp(timestampValue) {
  try {
    const timestamp = Number(timestampValue);
    if (!timestamp) return "-";
    return new Date(timestamp * 1000).toLocaleString("pt-BR");
  } catch {
    return "-";
  }
}

function proposalTypeLabel(value) {
  const numeric = Number(value);

  if (numeric === 0) return "Atualizar caução mínima";
  if (numeric === 1) return "Atualizar taxa base de recompensa";

  return `Tipo ${numeric}`;
}

function proposalStatusLabel(value) {
  const numeric = Number(value);
  return PROPOSAL_STATUS[numeric] || `Status ${numeric}`;
}

function formatEnergyToken(value) {
  try {
    const formatted = ethers.formatUnits(value, 18);
    const numeric = Number(formatted);

    return `${numeric.toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    })} EnergyToken`;
  } catch {
    return `${value}`;
  }
}

function formatRawValue(value) {
  try {
    return BigInt(value).toString();
  } catch {
    return `${value}`;
  }
}

function formatProposalValue(proposalType, value) {
  const numericType = Number(proposalType);

  if (numericType === 0) {
    return `${formatEnergyToken(value)} (${formatRawValue(value)} unidades mínimas)`;
  }

  if (numericType === 1) {
    return `${formatRawValue(value)} unidades brutas`;
  }

  return formatRawValue(value);
}

function parseNewProposalValue(proposalType, inputValue) {
  const numericType = Number(proposalType);
  const normalizedInput = normalizeDecimalInput(inputValue);

  if (normalizedInput === "") {
    throw new Error("Informe o novo valor da proposta.");
  }

  if (normalizedInput.startsWith("-")) {
    throw new Error("O novo valor deve ser maior que zero.");
  }

  if (numericType === 0) {
    const parsed = ethers.parseUnits(normalizedInput, 18);

    if (parsed <= 0n) {
      throw new Error("A caução mínima deve ser maior que zero.");
    }

    return parsed;
  }

  if (numericType === 1) {
    if (!/^\d+$/.test(normalizedInput)) {
      throw new Error(
        "Para taxa de recompensa, informe um número inteiro em unidades brutas."
      );
    }

    const parsed = BigInt(normalizedInput);

    if (parsed <= 0n) {
      throw new Error("A taxa de recompensa deve ser maior que zero.");
    }

    return parsed;
  }

  throw new Error("Tipo de proposta inválido.");
}

function GovernancePage({ signer, account, networkOk }) {
  const [createForm, setCreateForm] = useState({
    proposalType: "0",
    newValue: "50",
    description: "Alterar caução mínima global para 50 EnergyToken",
  });

  const [queryProposalId, setQueryProposalId] = useState("1");

  const [status, setStatus] = useState("Tela pronta.");
  const [error, setError] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVotingFor, setIsVotingFor] = useState(false);
  const [isVotingAgainst, setIsVotingAgainst] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const [latestProposalId, setLatestProposalId] = useState("");
  const [proposalData, setProposalData] = useState(null);
  const [currentMinimumCollateral, setCurrentMinimumCollateral] = useState("");

  const governanceContract = useMemo(() => {
    if (!signer) return null;

    return new ethers.Contract(
      deployments.EnergyGovernance,
      GOVERNANCE_ABI,
      signer
    );
  }, [signer]);

  const collateralContract = useMemo(() => {
    if (!signer || !deployments.SupplierCollateral) return null;

    return new ethers.Contract(
      deployments.SupplierCollateral,
      SUPPLIER_COLLATERAL_ABI,
      signer
    );
  }, [signer]);

  const actionInProgress =
    isCreating ||
    isLoading ||
    isVotingFor ||
    isVotingAgainst ||
    isClosing ||
    isExecuting;

  function normalizeProposal(proposal, proposalStatus) {
    return {
      id: proposal.id.toString(),
      proposalType: proposal.proposalType.toString(),
      newValue: proposal.newValue.toString(),
      description: proposal.description,
      deadline: proposal.deadline.toString(),
      votesFor: proposal.votesFor.toString(),
      votesAgainst: proposal.votesAgainst.toString(),
      closed: proposal.closed,
      executed: proposal.executed,
      statusCode: Number(proposalStatus),
      statusLabel: proposalStatusLabel(proposalStatus),
    };
  }

  function validateConnection(message) {
    if (!governanceContract || !account) {
      setError(message || "Conecte a carteira para continuar.");
      return false;
    }

    if (!networkOk) {
      setError("A carteira está na rede errada.");
      return false;
    }

    return true;
  }

  async function loadProtocolParameters() {
    try {
      if (!collateralContract || !account || !networkOk) return;

      const minimum = await collateralContract.minimumCollateral();
      setCurrentMinimumCollateral(minimum.toString());
    } catch {
      setCurrentMinimumCollateral("");
    }
  }

  async function loadSpecificProposal(proposalId) {
    try {
      if (!governanceContract) return;

      const proposal = await governanceContract.getProposal(proposalId);
      const proposalStatus = await governanceContract.getProposalStatus(
        proposalId
      );

      if (proposal.id === 0n) {
        setProposalData(null);
        setError("Proposta não encontrada.");
        return;
      }

      setProposalData(normalizeProposal(proposal, proposalStatus));
      setLatestProposalId(proposalId.toString());
    } catch (err) {
      setProposalData(null);
      setError(parseError(err));
    }
  }

  async function loadProposal() {
    try {
      setError("");
      setIsLoading(true);

      if (!validateConnection("Conecte a carteira para consultar propostas.")) {
        return;
      }

      const proposalId = BigInt(queryProposalId || "0");

      if (proposalId <= 0n) {
        setError("Informe um ID de proposta válido.");
        return;
      }

      await loadSpecificProposal(proposalId);
      await loadProtocolParameters();

      setStatus("Proposta carregada com sucesso.");
    } catch (err) {
      setProposalData(null);
      setError(parseError(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function createProposal() {
    try {
      setError("");
      setIsCreating(true);

      if (!validateConnection("Conecte a carteira antes de criar proposta.")) {
        return;
      }

      if (
        createForm.proposalType === "" ||
        createForm.newValue === "" ||
        createForm.description.trim() === ""
      ) {
        setError("Preencha todos os campos da proposta.");
        return;
      }

      const proposalType = Number(createForm.proposalType);

      if (!Number.isInteger(proposalType) || proposalType < 0 || proposalType > 1) {
        setError("Tipo de proposta inválido.");
        return;
      }

      const parsedValue = parseNewProposalValue(
        proposalType,
        createForm.newValue
      );

      setStatus("Criando proposta...");

      let tx;

      if (proposalType === 0) {
        tx = await governanceContract.createMinimumCollateralProposal(
          parsedValue,
          createForm.description.trim()
        );
      } else {
        tx = await governanceContract.createRewardRateProposal(
          parsedValue,
          createForm.description.trim()
        );
      }

      await tx.wait();

      const createdProposalId = await governanceContract.nextProposalId();

      setQueryProposalId(createdProposalId.toString());

      await loadSpecificProposal(createdProposalId);
      await loadProtocolParameters();

      setStatus("Proposta criada com sucesso.");
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsCreating(false);
    }
  }

  async function voteProposal(support) {
    try {
      setError("");
      support ? setIsVotingFor(true) : setIsVotingAgainst(true);

      if (!validateConnection("Conecte a carteira antes de votar.")) {
        return;
      }

      if (!proposalData) {
        setError("Carregue uma proposta antes de votar.");
        return;
      }

      setStatus(support ? "Votando a favor..." : "Votando contra...");

      const tx = await governanceContract.vote(
        BigInt(proposalData.id),
        support
      );

      await tx.wait();

      await loadSpecificProposal(BigInt(proposalData.id));
      await loadProtocolParameters();

      setStatus("Voto registrado com sucesso.");
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsVotingFor(false);
      setIsVotingAgainst(false);
    }
  }

  async function closeProposal() {
    try {
      setError("");
      setIsClosing(true);

      if (!validateConnection("Conecte a carteira antes de encerrar votação.")) {
        return;
      }

      if (!proposalData) {
        setError("Carregue uma proposta antes de encerrar a votação.");
        return;
      }

      setStatus("Encerrando votação...");

      const tx = await governanceContract.closeProposal(
        BigInt(proposalData.id)
      );

      await tx.wait();

      await loadSpecificProposal(BigInt(proposalData.id));
      await loadProtocolParameters();

      setStatus("Votação encerrada com sucesso.");
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsClosing(false);
    }
  }

  async function executeProposal() {
    try {
      setError("");
      setIsExecuting(true);

      if (!validateConnection("Conecte a carteira antes de executar proposta.")) {
        return;
      }

      if (!proposalData) {
        setError("Carregue uma proposta antes de executar.");
        return;
      }

      setStatus("Executando proposta...");

      const tx = await governanceContract.executeProposal(
        BigInt(proposalData.id)
      );

      await tx.wait();

      await loadSpecificProposal(BigInt(proposalData.id));
      await loadProtocolParameters();

      if (Number(proposalData.proposalType) === 0) {
        setStatus("Proposta executada. Caução mínima global atualizada.");
      } else {
        setStatus("Proposta executada com sucesso.");
      }
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsExecuting(false);
    }
  }

  function handleProposalTypeChange(newType) {
    if (newType === "0") {
      setCreateForm({
        proposalType: "0",
        newValue: "50",
        description: "Alterar caução mínima global para 50 EnergyToken",
      });
      return;
    }

    setCreateForm({
      proposalType: "1",
      newValue: "10000000000000000",
      description: "Alterar taxa base de recompensa do staking",
    });
  }

  useEffect(() => {
    async function loadLatestId() {
      try {
        if (!governanceContract || !account || !networkOk) return;

        const currentProposalId = await governanceContract.nextProposalId();

        if (currentProposalId > 0n) {
          setQueryProposalId(currentProposalId.toString());
        }

        await loadProtocolParameters();
      } catch {
        // Mantém silêncio para não poluir a tela durante a conexão.
      }
    }

    loadLatestId();
  }, [governanceContract, collateralContract, account, networkOk]);

  const canVote =
    proposalData &&
    proposalData.statusCode === 1 &&
    !proposalData.closed &&
    !proposalData.executed;

  const canClose =
    proposalData &&
    proposalData.statusCode === 2 &&
    !proposalData.closed &&
    !proposalData.executed;

  const canExecute =
    proposalData &&
    proposalData.statusCode === 3 &&
    proposalData.closed &&
    !proposalData.executed;

  return (
    <div className="panel-card">
      <h2>Governança</h2>

      <p>
        <strong>Status:</strong> {status}
      </p>

      {error && (
        <p className="error-text">
          <strong>Erro:</strong> {error}
        </p>
      )}

      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          border: "1px solid #ddd",
          borderRadius: "8px",
        }}
      >
        <h3>Parâmetros atuais do protocolo</h3>

        <p>
          <strong>Caução mínima global atual:</strong>{" "}
          {currentMinimumCollateral
            ? formatEnergyToken(currentMinimumCollateral)
            : "Não carregada"}
        </p>

        <button onClick={loadProtocolParameters} disabled={actionInProgress}>
          Atualizar parâmetros
        </button>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <h3>Criar proposta</h3>

      <div style={{ marginTop: "16px" }}>
        <label>
          Tipo de proposta
          <br />
          <select
            value={createForm.proposalType}
            onChange={(e) => handleProposalTypeChange(e.target.value)}
            style={{ width: "320px", padding: "8px", marginTop: "4px" }}
          >
            <option value="0">Atualizar caução mínima global</option>
            <option value="1">Atualizar taxa base de recompensa</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: "16px" }}>
        <label>
          Novo valor
          <br />
          <input
            value={createForm.newValue}
            onChange={(e) =>
              setCreateForm({ ...createForm, newValue: e.target.value })
            }
            style={{ width: "260px", padding: "8px", marginTop: "4px" }}
          />
        </label>

        {createForm.proposalType === "0" && (
          <p style={{ marginTop: "6px", fontSize: "0.9rem" }}>
            Para caução mínima, informe o valor em EnergyToken. Exemplo:{" "}
            <strong>50</strong>. O sistema enviará automaticamente{" "}
            <strong>50 × 10¹⁸</strong> unidades mínimas para o contrato.
          </p>
        )}

        {createForm.proposalType === "1" && (
          <p style={{ marginTop: "6px", fontSize: "0.9rem" }}>
            Para taxa de recompensa, informe o valor bruto inteiro. Exemplo:{" "}
            <strong>10000000000000000</strong>.
          </p>
        )}
      </div>

      <div style={{ marginTop: "16px" }}>
        <label>
          Descrição
          <br />
          <input
            value={createForm.description}
            onChange={(e) =>
              setCreateForm({ ...createForm, description: e.target.value })
            }
            style={{ width: "420px", padding: "8px", marginTop: "4px" }}
          />
        </label>
      </div>

      <div className="button-row" style={{ marginTop: "16px" }}>
        <button onClick={createProposal} disabled={isCreating}>
          {isCreating ? "Criando..." : "Criar proposta"}
        </button>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <h3>Consultar proposta</h3>

      <div style={{ marginTop: "16px" }}>
        <label>
          ID da proposta
          <br />
          <input
            value={queryProposalId}
            onChange={(e) => setQueryProposalId(e.target.value)}
            style={{ width: "180px", padding: "8px", marginTop: "4px" }}
          />
        </label>
      </div>

      <div className="button-row" style={{ marginTop: "16px" }}>
        <button onClick={loadProposal} disabled={isLoading}>
          {isLoading ? "Carregando..." : "Carregar proposta"}
        </button>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <h3>Dados da proposta</h3>

      {!proposalData && <p>Nenhuma proposta carregada.</p>}

      {proposalData && (
        <>
          <p>
            <strong>ID da proposta:</strong> {latestProposalId}
          </p>

          <p>
            <strong>Tipo:</strong>{" "}
            {proposalTypeLabel(proposalData.proposalType)}
          </p>

          <p>
            <strong>Novo valor:</strong>{" "}
            {formatProposalValue(
              proposalData.proposalType,
              proposalData.newValue
            )}
          </p>

          <p>
            <strong>Descrição:</strong> {proposalData.description}
          </p>

          <p>
            <strong>Prazo final:</strong>{" "}
            {formatTimestamp(proposalData.deadline)}
          </p>

          <p>
            <strong>Votos a favor:</strong>{" "}
            {formatEnergyToken(proposalData.votesFor)}
          </p>

          <p>
            <strong>Votos contra:</strong>{" "}
            {formatEnergyToken(proposalData.votesAgainst)}
          </p>

          <p>
            <strong>Votação encerrada:</strong>{" "}
            {proposalData.closed ? "sim" : "não"}
          </p>

          <p>
            <strong>Executada:</strong>{" "}
            {proposalData.executed ? "sim" : "não"}
          </p>

          <p>
            <strong>Situação:</strong> {proposalData.statusLabel}
          </p>

          <div className="button-row" style={{ marginTop: "16px" }}>
            {canVote && (
              <>
                <button
                  onClick={() => voteProposal(true)}
                  disabled={actionInProgress}
                >
                  {isVotingFor ? "Votando..." : "Votar a favor"}
                </button>

                <button
                  onClick={() => voteProposal(false)}
                  disabled={actionInProgress}
                >
                  {isVotingAgainst ? "Votando..." : "Votar contra"}
                </button>
              </>
            )}

            {canClose && (
              <button onClick={closeProposal} disabled={actionInProgress}>
                {isClosing ? "Encerrando..." : "Encerrar votação"}
              </button>
            )}

            {canExecute && (
              <button onClick={executeProposal} disabled={actionInProgress}>
                {isExecuting ? "Executando..." : "Executar proposta"}
              </button>
            )}

            {!canVote && !canClose && !canExecute && (
              <button onClick={loadProposal} disabled={isLoading}>
                Atualizar proposta
              </button>
            )}
          </div>

          {proposalData.statusCode === 2 && (
            <p style={{ marginTop: "12px" }}>
              O prazo de votação terminou. Agora é possível encerrar a votação.
            </p>
          )}

          {proposalData.statusCode === 3 && (
            <p style={{ marginTop: "12px" }}>
              A proposta foi encerrada e aprovada. Agora é possível executá-la.
            </p>
          )}

          {proposalData.statusCode === 4 && (
            <p style={{ marginTop: "12px" }}>
              A proposta foi encerrada, mas foi rejeitada porque os votos
              favoráveis não superaram os votos contrários.
            </p>
          )}

          {proposalData.statusCode === 5 && (
            <p style={{ marginTop: "12px" }}>
              A proposta já foi executada.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default GovernancePage;