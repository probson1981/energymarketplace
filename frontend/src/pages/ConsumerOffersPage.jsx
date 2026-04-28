import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import deployments from "../config/deployments.json";

/**
 * @title Tela de ofertas do consumidor
 * @author Patrício Alves
 * @notice Esta tela:
 *         - lista as ofertas existentes
 *         - consulta se a carteira já aceitou cada oferta
 *         - permite aceitar a oferta
 *
 * @dev O contrato atual exige metadataURI em acceptOffer(...).
 *      Nesta tela, a metadataURI é gerada automaticamente.
 */

const MARKETPLACE_ABI = [
  "function nextOfferId() view returns (uint256)",
  "function getOffer(uint256) view returns (tuple(uint256 id,address supplier,uint256 tariff,uint256 earlyPaymentDiscount,string extraBenefit,uint256 validUntil,uint256 maxConsumers,uint256 acceptedCount,bool active))",
  "function hasAcceptedOffer(uint256,address) view returns (bool)",
  "function acceptOffer(uint256,string) returns (uint256)",
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

function ConsumerOffersPage({ signer, account, networkOk }) {
  const [status, setStatus] = useState("Tela pronta.");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [acceptingOfferId, setAcceptingOfferId] = useState("");

  const [offers, setOffers] = useState([]);

  const marketplaceContract = useMemo(() => {
    if (!signer) return null;

    return new ethers.Contract(
      deployments.EnergyMarketplace,
      MARKETPLACE_ABI,
      signer
    );
  }, [signer]);

  /**
   * @notice Carrega a lista de ofertas existentes.
   *
   * @dev Estratégia usada:
   *      - consulta nextOfferId()
   *      - percorre do ID 1 até o último ID
   *      - carrega cada oferta
   *      - carrega também se esta carteira já aceitou
   */
  async function loadOffers() {
    try {
      setError("");
      setIsLoading(true);

      if (!marketplaceContract || !account) {
        setStatus("Conecte a carteira para consultar ofertas.");
        setOffers([]);
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        setOffers([]);
        return;
      }

      const lastOfferId = await marketplaceContract.nextOfferId();

      if (lastOfferId === 0n) {
        setOffers([]);
        setStatus("Ainda não há ofertas cadastradas.");
        return;
      }

      const loadedOffers = [];

      for (let id = 1n; id <= lastOfferId; id++) {
        const offer = await marketplaceContract.getOffer(id);
        const alreadyAccepted = await marketplaceContract.hasAcceptedOffer(
          id,
          account
        );

        loadedOffers.push({
          id: offer.id.toString(),
          supplier: offer.supplier,
          tariff: offer.tariff.toString(),
          earlyPaymentDiscount: offer.earlyPaymentDiscount.toString(),
          validUntil: offer.validUntil.toString(),
          maxConsumers: offer.maxConsumers.toString(),
          acceptedCount: offer.acceptedCount.toString(),
          active: offer.active,
          alreadyAccepted,
        });
      }

      /**
       * @dev Coloca as mais recentes primeiro na lista.
       */
      loadedOffers.reverse();

      setOffers(loadedOffers);
      setStatus("Ofertas carregadas com sucesso.");
    } catch (err) {
      setOffers([]);
      setError(parseError(err));
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * @notice Aceita uma oferta específica.
   *
   * @dev A metadataURI é gerada automaticamente pela interface.
   */
  async function acceptOffer(offerId) {
    try {
      setError("");
      setAcceptingOfferId(offerId);

      if (!marketplaceContract || !account) {
        setError("Conecte a carteira antes de aceitar a oferta.");
        return;
      }

      if (!networkOk) {
        setError("A carteira está na rede errada.");
        return;
      }

      const metadataURI = `ipfs://agreement-offer-${offerId}-consumer-${account.toLowerCase()}`;

      setStatus(`Aceitando oferta ${offerId}...`);

      const tx = await marketplaceContract.acceptOffer(
        BigInt(offerId),
        metadataURI
      );

      await tx.wait();

      setStatus(`Oferta ${offerId} aceita com sucesso.`);
      await loadOffers();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setAcceptingOfferId("");
    }
  }

  useEffect(() => {
    if (account && signer) {
      loadOffers();
    }
  }, [account, signer]);

  return (
    <div className="panel-card">
      <h2>Ofertas disponíveis e contratação</h2>

      <p>
        <strong>Status:</strong> {status}
      </p>

      {error && (
        <p className="error-text">
          <strong>Erro:</strong> {error}
        </p>
      )}

      <div className="button-row" style={{ marginTop: "16px" }}>
        <button onClick={loadOffers} disabled={isLoading}>
          {isLoading ? "Atualizando..." : "Atualizar ofertas"}
        </button>
      </div>

      <hr style={{ margin: "24px 0" }} />

      {offers.length === 0 && <p>Nenhuma oferta carregada.</p>}

      {offers.map((offer) => {
        const offerFull =
          Number(offer.acceptedCount) >= Number(offer.maxConsumers);

        return (
          <div
            key={offer.id}
            style={{
              border: "1px solid #d9e1e8",
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "16px",
              background: "#fafbfc",
            }}
          >
            <p>
              <strong>ID da oferta:</strong> {offer.id}
            </p>

            <p>
              <strong>Fornecedor:</strong> {offer.supplier}
            </p>

            <p>
              <strong>Tarifa(kWh):</strong> {offer.tariff}
            </p>

            <p>
              <strong>(%) Desconto por pagamento antecipado:</strong>{" "}
              {offer.earlyPaymentDiscount}
            </p>

            <p>
              <strong>Válida até:</strong> {formatTimestamp(offer.validUntil)}
            </p>

            <p>
              <strong>Número máximo de consumidores:</strong>{" "}
              {offer.maxConsumers}
            </p>

            <p>
              <strong>Consumidores já aceitos:</strong> {offer.acceptedCount}
            </p>

            <p>
              <strong>Oferta ativa:</strong> {offer.active ? "sim" : "não"}
            </p>

            <p>
              <strong>Esta carteira já aceitou a oferta:</strong>{" "}
              {offer.alreadyAccepted ? "sim" : "não"}
            </p>

            <div className="button-row" style={{ marginTop: "12px" }}>
              <button
                onClick={() => acceptOffer(offer.id)}
                disabled={
                  acceptingOfferId === offer.id ||
                  offer.alreadyAccepted ||
                  !offer.active ||
                  offerFull
                }
              >
                {offer.alreadyAccepted
                  ? "Oferta já aceita"
                  : acceptingOfferId === offer.id
                  ? "Aceitando..."
                  : !offer.active
                  ? "Oferta inativa"
                  : offerFull
                  ? "Oferta lotada"
                  : "Aceitar oferta"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ConsumerOffersPage;