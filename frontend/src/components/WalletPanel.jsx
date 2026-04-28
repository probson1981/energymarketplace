import { ethers } from "ethers";

/**
 * @title Painel de conexão da carteira
 * @author Patrício Alves
 * @notice Este componente concentra a conexão com a MetaMask
 *         e a troca para a rede local do Hardhat.
 *
 * @dev Ele não executa ações de contratos.
 *      Apenas:
 *      - conecta carteira
 *      - troca rede
 *      - mostra conta e chainId
 */
function WalletPanel({
  account,
  chainId,
  expectedChainId,
  expectedNetworkName,
  networkOk,
  status,
  error,
  setProvider,
  setSigner,
  setAccount,
  setChainId,
  setStatus,
  setError,
}) {
  /**
   * @dev Extrai uma mensagem de erro amigável.
   */
  function parseError(err) {
    return (
      err?.shortMessage ||
      err?.reason ||
      err?.message ||
      "Erro desconhecido"
    );
  }

  /**
   * @notice Conecta a carteira MetaMask.
   */
  async function connectWallet() {
    try {
      setError("");

      if (!window.ethereum) {
        setError("MetaMask não detectada no navegador.");
        return;
      }

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      await browserProvider.send("eth_requestAccounts", []);

      const currentSigner = await browserProvider.getSigner();
      const currentAccount = await currentSigner.getAddress();
      const currentNetwork = await browserProvider.getNetwork();

      setProvider(browserProvider);
      setSigner(currentSigner);
      setAccount(currentAccount);
      setChainId(Number(currentNetwork.chainId));
      setStatus("Carteira conectada com sucesso.");
    } catch (err) {
      setError(parseError(err));
    }
  }

  /**
   * @notice Solicita à carteira a troca para a rede local do Hardhat.
   *
   * @dev Se a rede ainda não estiver cadastrada,
   *      a função tenta adicioná-la automaticamente.
   */
  async function switchToHardhatLocal() {
    try {
      setError("");

      if (!window.ethereum) {
        setError("MetaMask não detectada no navegador.");
        return;
      }

      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x7a69" }],
        });

        setStatus("Rede alterada para Hardhat Local.");
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x7a69",
                chainName: "Hardhat Local",
                rpcUrls: ["http://127.0.0.1:8545"],
                nativeCurrency: {
                  name: "Ethereum",
                  symbol: "ETH",
                  decimals: 18,
                },
              },
            ],
          });

          setStatus("Rede Hardhat Local adicionada e selecionada.");
        } else {
          throw switchError;
        }
      }

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const currentSigner = await browserProvider.getSigner();
      const currentAccount = await currentSigner.getAddress();
      const currentNetwork = await browserProvider.getNetwork();

      setProvider(browserProvider);
      setSigner(currentSigner);
      setAccount(currentAccount);
      setChainId(Number(currentNetwork.chainId));
    } catch (err) {
      setError(parseError(err));
    }
  }

  return (
    <div className="panel-card">
      <h2>Carteira blockchain</h2>

      <p><strong>Status:</strong> {status}</p>

      {error && (
        <p className="error-text">
          <strong>Erro:</strong> {error}
        </p>
      )}

      <div className="button-row">
        <button onClick={connectWallet}>Conectar carteira</button>
        <button onClick={switchToHardhatLocal}>Trocar para Hardhat Local</button>
      </div>

      <div className="info-block">
        <p><strong>Conta:</strong> {account || "não conectada"}</p>
        <p><strong>Chain ID detectado:</strong> {chainId ?? "não detectado"}</p>
        <p><strong>Rede esperada:</strong> {expectedNetworkName}</p>
        <p><strong>Chain ID esperado:</strong> {expectedChainId}</p>
        <p><strong>Rede compatível:</strong> {networkOk ? "sim" : "não"}</p>
      </div>
    </div>
  );
}

export default WalletPanel;