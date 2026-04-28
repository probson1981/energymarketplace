import { useState } from "react";

/**
 * @title Tela de login da aplicação
 * @author Patrício Alves
 * @notice Esta tela implementa o acesso inicial ao site.
 *
 * @dev Este login é apenas da interface do site.
 *      Ele não substitui a conexão com a carteira blockchain.
 *
 *      Usuários simulados nesta etapa:
 *      - consumidor1
 *      - fornecedor1
 *      - admin1
 */
const MOCK_USERS = [
  { username: "consumidor1", password: "123456", role: "consumer" },
  { username: "consumidor2", password: "123456", role: "consumer" },
  { username: "fornecedor1", password: "123456", role: "supplier" },
  { username: "fornecedor2", password: "123456", role: "supplier" },
  { username: "fornecedor3", password: "123456", role: "supplier" },
  { username: "fornecedor4", password: "123456", role: "supplier" },
  { username: "admin1", password: "123456", role: "admin" },
];

function LoginPage({ onLogin }) {
  /**
   * @dev Estados do formulário de login.
   */
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  /**
   * @notice Processa o login local do site.
   *
   * @dev Procura o usuário na lista simulada e,
   *      se encontrar, informa ao App quem entrou.
   */
  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const foundUser = MOCK_USERS.find(
      (user) => user.username === username && user.password === password
    );

    if (!foundUser) {
      setError("Usuário ou senha inválidos.");
      return;
    }

    onLogin(foundUser);
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Energy Marketplace</h1>
        <p className="subtitle">Entre com seu usuário e senha.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Usuário
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu usuário"
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
            />
          </label>

          <button type="submit">Entrar</button>
        </form>

        {error && <p className="error-text">{error}</p>}

        <div className="login-help">
          <p><strong>Usuários de teste</strong></p>
          <p>Consumidor: consumidor1 / 123456</p>
          <p>Consumidor: consumidor2 / 123456</p>
          <p>Fornecedor: fornecedor1 / 123456</p>
          <p>Fornecedor: fornecedor2 / 123456</p>
          <p>Fornecedor: fornecedor3 / 123456</p>
          <p>Fornecedor: fornecedor4 / 123456</p>
          <p>Admin: admin1 / 123456</p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;