import AdminPage from "./pages/AdminPage";
import GovernancePage from "./pages/GovernancePage";
import StakingPage from "./pages/StakingPage";
import ConsumerOffersPage from "./pages/ConsumerOffersPage";
import SupplierOffersPage from "./pages/SupplierOffersPage";
import { useMemo, useState } from "react";
import LoginPage from "./pages/LoginPage";
import WalletPanel from "./components/WalletPanel";
import ConsumerRegisterPage from "./pages/ConsumerRegisterPage";
import deployments from "./config/deployments.json";
import SupplierRegisterPage from "./pages/SupplierRegisterPage";
import "./App.css";

/**
 * @title Aplicação principal do frontend
 * @notice Esta versão adapta automaticamente a rede esperada
 *         com base no campo "network" do deployments.json.
 */
function App() {
  const [loggedUser, setLoggedUser] = useState(null);

  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [status, setStatus] = useState("Aplicação pronta para conexão.");
  const [error, setError] = useState("");

  const appConfig = deployments;

  /**
   * @dev Define automaticamente o chainId esperado com base na rede atual.
   */
  const expectedChainId = useMemo(() => {
    if (appConfig?.network === "sepolia") return 11155111;
    if (appConfig?.network === "localhost") return 31337;
    return null;
  }, [appConfig]);

  /**
   * @dev Define o nome da rede esperada para exibição.
   */
  const expectedNetworkName = useMemo(() => {
    if (appConfig?.network === "sepolia") return "Sepolia";
    if (appConfig?.network === "localhost") return "Hardhat Local";
    return appConfig?.network || "Rede desconhecida";
  }, [appConfig]);

  const networkOk = useMemo(() => {
    if (!chainId || !expectedChainId) return false;
    return Number(chainId) === Number(expectedChainId);
  }, [chainId, expectedChainId]);

  function handleLogin(user) {
    setLoggedUser(user);
    setStatus("Login realizado com sucesso.");
    setError("");
  }

  function handleLogout() {
    setLoggedUser(null);
    setProvider(null);
    setSigner(null);
    setAccount("");
    setChainId(null);
    setStatus("Aplicação pronta para conexão.");
    setError("");
  }

  if (!loggedUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="internal-page">
      <div className="internal-layout">
        <div className="panel-card">
          <h1>Energy Marketplace</h1>
          <p><strong>Usuário:</strong> {loggedUser.username}</p>
          <p><strong>Papel:</strong> {loggedUser.role}</p>

          <div className="button-row">
            <button onClick={handleLogout}>Sair</button>
          </div>
        </div>

        <WalletPanel
          account={account}
          chainId={chainId}
          expectedChainId={expectedChainId}
          expectedNetworkName={expectedNetworkName}
          networkOk={networkOk}
          status={status}
          error={error}
          setProvider={setProvider}
          setSigner={setSigner}
          setAccount={setAccount}
          setChainId={setChainId}
          setStatus={setStatus}
          setError={setError}
        />

        {loggedUser.role === "consumer" && (
          <>
            <ConsumerRegisterPage
              signer={signer}
              account={account}
              networkOk={networkOk}
            />

            <ConsumerOffersPage
              signer={signer}
              account={account}
              networkOk={networkOk}
            />
          </>
        )}

        {loggedUser.role === "supplier" && (
          <>
            <SupplierRegisterPage
              signer={signer}
              account={account}
              networkOk={networkOk}
            />

            <SupplierOffersPage
              signer={signer}
              account={account}
              networkOk={networkOk}
            />

            <StakingPage
              signer={signer}
              account={account}
              networkOk={networkOk}
            />

            <GovernancePage
              signer={signer}
              account={account}
              networkOk={networkOk}
            />
          </>
        )}

        {loggedUser.role === "admin" && (
          <AdminPage
            signer={signer}
            provider={provider}
            account={account}
            chainId={chainId}
            networkOk={networkOk}
          />
        )}
      </div>
    </div>
  );
}

export default App;