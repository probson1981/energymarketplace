import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import deployments from "../config/deployments.json";

/**
 * @title Tela de cadastro de consumidor
 * @author Patrício Alves
 * @notice Esta tela permite registrar o consumidor no ConsumerRegistry
 *         e consultar seu status ativo.
 *
 * @dev Esta versão usa apenas funções já existentes nos contratos:
 *      - registerConsumer(string,string)
 *      - isConsumerActive(address)
 */

const CONSUMER_REGISTRY_ABI = [
  "function registerConsumer(string,string)",
  "function isConsumerActive(address) view returns (bool)",
];

function parseError(error) {
  return (
    error?.shortMessage ||
    error?.reason ||
    error?.message ||
    "Erro desconhecido"
  );
}

function ConsumerRegisterPage({
  signer,
  account,
  networkOk,
}) {
  /**
   * @dev Estado do formulário.
   */
  const [form, setForm] = useState({
    name: "Consumidor Demo",
    documentId: "CPF-DEMO-001",
  });

  /**
   * @dev Estado do consumidor na aplicação.
   */
  const [consumerActive, setConsumerActive] = useState(false);

  /**
   * @dev Estados de interface.
   */
  const [status, setStatus] = useState("Tela pronta.");
  const [error, setError] = useState("");

  /**
   * @dev Instância do contrato ConsumerRegistry.
   */
  const consumerRegistry = useMemo(() => {
    if (!signer) return null;

    return new ethers.Contract(
      deployments.ConsumerRegistry,
      CONSUMER_REGISTRY_ABI,
      signer
    );
  }, [signer]);

  /**
   * @notice Atualiza o status do consumidor.
   */
  async function refreshConsumerStatus() {
    try {
      setError("");

      if (!consumerRegistry || !account) {
        setStatus("Conecte a carteira para consultar o consumidor.");
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        return;
      }

      const active = await consumerRegistry.isConsumerActive(account);
      setConsumerActive(active);
      setStatus("Status do consumidor atualizado.");
    } catch (err) {
      setError(parseError(err));
    }
  }

  /**
   * @notice Registra o consumidor no contrato.
   */
  async function registerConsumer() {
    try {
      setError("");

      if (!consumerRegistry || !account) {
        setError("Conecte a carteira antes de registrar o consumidor.");
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        return;
      }

      if (!form.name || !form.documentId) {
        setError("Informe nome e documento do consumidor.");
        return;
      }

      setStatus("Registrando consumidor...");

      const tx = await consumerRegistry.registerConsumer(
        form.name,
        form.documentId
      );

      await tx.wait();

      setStatus("Consumidor registrado com sucesso.");
      await refreshConsumerStatus();
    } catch (err) {
      setError(parseError(err));
    }
  }

  /**
   * @dev Atualiza automaticamente o status ao mudar a conta.
   */
  useEffect(() => {
    if (account && signer) {
      refreshConsumerStatus();
    }
  }, [account, signer]);

  return (
    <div className="panel-card">
      <h2>Cadastro de consumidor</h2>

      <p><strong>Status:</strong> {status}</p>

      {error && (
        <p className="error-text">
          <strong>Erro:</strong> {error}
        </p>
      )}

      <p>
        <strong>Consumidor ativo:</strong> {consumerActive ? "sim" : "não"}
      </p>

      <div style={{ marginTop: "16px" }}>
        <label>
          Nome do consumidor
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
          Documento do consumidor
          <br />
          <input
            value={form.documentId}
            onChange={(e) => setForm({ ...form, documentId: e.target.value })}
            style={{ width: "320px", padding: "8px", marginTop: "4px" }}
          />
        </label>
      </div>

      <div className="button-row" style={{ marginTop: "16px" }}>
        <button onClick={registerConsumer}>Registrar consumidor</button>
        <button onClick={refreshConsumerStatus}>Atualizar status</button>
      </div>
    </div>
  );
}

export default ConsumerRegisterPage;