import { useMemo, useState } from "react";
import { ethers } from "ethers";
import deployments from "../config/deployments.json";

/**
 * @title Tela de lançamento de ofertas do fornecedor
 * @author Patrício Alves
 * @notice Esta tela permite ao fornecedor criar uma oferta no marketplace
 *         e consultar os dados da última oferta criada por este fluxo.
 *
 * @dev Usa apenas funções já existentes no contrato:
 *      - createOffer(...)
 *      - nextOfferId()
 *      - getOffer(uint256)
 *
 * @dev Como o contrato atual exige o parâmetro extraBenefit,
 *      esta tela envia string vazia internamente, sem expor esse campo ao usuário.
 *
 * @dev A tarifa é tratada como valor decimal com 6 casas.
 *      Exemplo:
 *      - 0,63 -> 630000 internamente
 *      - 1,25 -> 1250000 internamente
 */

const MARKETPLACE_ABI = [
  "function createOffer(uint256,uint256,string,uint256,uint256) returns (uint256)",
  "function nextOfferId() view returns (uint256)",
  "function getOffer(uint256) view returns (tuple(uint256 id,address supplier,uint256 tariff,uint256 earlyPaymentDiscount,string extraBenefit,uint256 validUntil,uint256 maxConsumers,uint256 acceptedCount,bool active))",
];

function parseError(error) {
  return (
    error?.shortMessage ||
    error?.reason ||
    error?.message ||
    "Erro desconhecido"
  );
}

function formatTimestamp(timestampValue) {
  try {
    const timestamp = Number(timestampValue);
    if (!timestamp) return "-";

    const date = new Date(timestamp * 1000);
    return date.toLocaleString("pt-BR");
  } catch {
    return "-";
  }
}

/**
 * @dev Normaliza entrada decimal para o padrão com ponto.
 *
 * Exemplos:
 * - "0,63" -> "0.63"
 * - "1.25" -> "1.25"
 */
function normalizeDecimalInput(value) {
  return String(value).replace(",", ".").trim();
}

/**
 * @dev Converte string decimal para inteiro escalado.
 *
 * Exemplo com 6 casas:
 * - "0.63" -> 630000
 */
function parseDecimalToUint(value, decimals = 6) {
  const normalized = normalizeDecimalInput(value);

  if (!normalized || isNaN(Number(normalized))) {
    throw new Error("Valor decimal inválido.");
  }

  return ethers.parseUnits(normalized, decimals);
}

/**
 * @dev Converte inteiro escalado em string decimal legível.
 *
 * Exemplo com 6 casas:
 * - 630000 -> "0,63"
 */
function formatUintToDecimalString(value, decimals = 6) {
  try {
    return Number(ethers.formatUnits(value, decimals)).toLocaleString("pt-BR", {
      maximumFractionDigits: decimals,
    });
  } catch {
    return "0";
  }
}

function SupplierOffersPage({ signer, account, networkOk }) {
  const [form, setForm] = useState({
    tariff: "0,63",
    earlyPaymentDiscount: "8",
    validDays: "30",
    maxConsumers: "10",
  });

  const [status, setStatus] = useState("Tela pronta.");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [lastOfferId, setLastOfferId] = useState("");
  const [offerData, setOfferData] = useState(null);

  const marketplaceContract = useMemo(() => {
    if (!signer) return null;

    return new ethers.Contract(
      deployments.EnergyMarketplace,
      MARKETPLACE_ABI,
      signer
    );
  }, [signer]);

  async function refreshLatestOffer() {
    try {
      setError("");
      setIsRefreshing(true);

      if (!marketplaceContract || !account) {
        setStatus("Conecte a carteira para consultar ofertas.");
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        return;
      }

      const currentNextOfferId = await marketplaceContract.nextOfferId();

      if (currentNextOfferId === 0n) {
        setLastOfferId("");
        setOfferData(null);
        setStatus("Ainda não há ofertas criadas.");
        return;
      }

      const offer = await marketplaceContract.getOffer(currentNextOfferId);

      setLastOfferId(currentNextOfferId.toString());
      setOfferData({
        id: offer.id.toString(),
        supplier: offer.supplier,
        tariff: offer.tariff.toString(),
        earlyPaymentDiscount: offer.earlyPaymentDiscount.toString(),
        validUntil: offer.validUntil.toString(),
        maxConsumers: offer.maxConsumers.toString(),
        acceptedCount: offer.acceptedCount.toString(),
        active: offer.active,
      });

      setStatus("Oferta mais recente atualizada com sucesso.");
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function createOffer() {
    try {
      setError("");
      setIsCreating(true);

      if (!marketplaceContract || !account) {
        setError("Conecte a carteira antes de criar a oferta.");
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        return;
      }

      if (
        !form.tariff ||
        !form.earlyPaymentDiscount ||
        !form.validDays ||
        !form.maxConsumers
      ) {
        setError("Preencha todos os campos da oferta.");
        return;
      }

      const validDaysNumber = Number(form.validDays);
      const maxConsumersNumber = Number(form.maxConsumers);

      if (validDaysNumber <= 0 || maxConsumersNumber <= 0) {
        setError("Validade e número máximo de consumidores devem ser maiores que zero.");
        return;
      }

      const parsedTariff = parseDecimalToUint(form.tariff, 6);

      const validUntil =
        Math.floor(Date.now() / 1000) + validDaysNumber * 24 * 60 * 60;

      setStatus("Criando oferta...");

      const tx = await marketplaceContract.createOffer(
        parsedTariff,
        BigInt(form.earlyPaymentDiscount),
        "",
        BigInt(validUntil),
        BigInt(form.maxConsumers)
      );

      await tx.wait();

      const createdOfferId = await marketplaceContract.nextOfferId();
      const offer = await marketplaceContract.getOffer(createdOfferId);

      setLastOfferId(createdOfferId.toString());
      setOfferData({
        id: offer.id.toString(),
        supplier: offer.supplier,
        tariff: offer.tariff.toString(),
        earlyPaymentDiscount: offer.earlyPaymentDiscount.toString(),
        validUntil: offer.validUntil.toString(),
        maxConsumers: offer.maxConsumers.toString(),
        acceptedCount: offer.acceptedCount.toString(),
        active: offer.active,
      });

      setStatus("Oferta criada com sucesso.");
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="panel-card">
      <h2>Lançamento de ofertas</h2>

      <p>
        <strong>Status:</strong> {status}
      </p>

      {error && (
        <p className="error-text">
          <strong>Erro:</strong> {error}
        </p>
      )}

      <div style={{ marginTop: "16px" }}>
        <label>
          Tarifa(kWh)
          <br />
          <input
            value={form.tariff}
            onChange={(e) => setForm({ ...form, tariff: e.target.value })}
            style={{ width: "220px", padding: "8px", marginTop: "4px" }}
          />
        </label>
      </div>

      <div style={{ marginTop: "16px" }}>
        <label>
          (%) Desconto por pagamento antecipado
          <br />
          <input
            value={form.earlyPaymentDiscount}
            onChange={(e) =>
              setForm({ ...form, earlyPaymentDiscount: e.target.value })
            }
            style={{ width: "220px", padding: "8px", marginTop: "4px" }}
          />
        </label>
      </div>

      <div style={{ marginTop: "16px" }}>
        <label>
          Validade da oferta em dias
          <br />
          <input
            value={form.validDays}
            onChange={(e) => setForm({ ...form, validDays: e.target.value })}
            style={{ width: "220px", padding: "8px", marginTop: "4px" }}
          />
        </label>
      </div>

      <div style={{ marginTop: "16px" }}>
        <label>
          Número máximo de consumidores
          <br />
          <input
            value={form.maxConsumers}
            onChange={(e) =>
              setForm({ ...form, maxConsumers: e.target.value })
            }
            style={{ width: "220px", padding: "8px", marginTop: "4px" }}
          />
        </label>
      </div>

      <div className="button-row" style={{ marginTop: "16px" }}>
        <button onClick={createOffer} disabled={isCreating}>
          {isCreating ? "Criando..." : "Criar oferta"}
        </button>

        <button onClick={refreshLatestOffer} disabled={isRefreshing}>
          {isRefreshing ? "Atualizando..." : "Atualizar última oferta"}
        </button>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <h3>Última oferta consultada</h3>

      {!offerData && <p>Nenhuma oferta carregada.</p>}

      {offerData && (
        <>
          <p>
            <strong>ID da oferta:</strong> {lastOfferId}
          </p>

          <p>
            <strong>Fornecedor:</strong> {offerData.supplier}
          </p>

          <p>
            <strong>Tarifa(kWh):</strong>{" "}
            {formatUintToDecimalString(offerData.tariff, 6)}
          </p>

          <p>
            <strong>(%) Desconto por pagamento antecipado:</strong>{" "}
            {offerData.earlyPaymentDiscount}
          </p>

          <p>
            <strong>Válida até:</strong> {formatTimestamp(offerData.validUntil)}
          </p>

          <p>
            <strong>Número máximo de consumidores:</strong>{" "}
            {offerData.maxConsumers}
          </p>

          <p>
            <strong>Consumidores já aceitos:</strong>{" "}
            {offerData.acceptedCount}
          </p>

          <p>
            <strong>Oferta ativa:</strong> {offerData.active ? "sim" : "não"}
          </p>
        </>
      )}
    </div>
  );
}

export default SupplierOffersPage;