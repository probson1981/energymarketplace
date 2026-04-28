require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("dotenv").config();

/**
 * @title Configuração principal do Hardhat
 * @author Patrício Alves
 * @notice Este arquivo define o compilador e as redes suportadas pelo projeto.
 *
 * @dev Esta versão foi ajustada para não quebrar o ambiente local quando
 *      as variáveis da Sepolia ou de outras redes ainda não estiverem
 *      corretamente preenchidas.
 *
 *      A lógica é:
 *      - localhost sempre disponível
 *      - sepolia só recebe accounts se a chave privada parecer válida
 *      - custom só recebe accounts se a chave privada parecer válida
 */

/**
 * @dev Remove prefixo 0x, se existir.
 */
function normalizePrivateKey(key) {
  if (!key) return "";
  return key.startsWith("0x") ? key.slice(2) : key;
}

/**
 * @dev Verifica se a chave privada parece válida.
 *
 *      Para o Hardhat, esperamos 64 caracteres hexadecimais.
 */
function isValidPrivateKey(key) {
  const normalized = normalizePrivateKey(key);
  return /^[0-9a-fA-F]{64}$/.test(normalized);
}

/**
 * @dev Retorna o array de contas apenas se a chave privada for válida.
 *      Caso contrário, retorna array vazio.
 */
function getAccountsFromEnv() {
  const key = process.env.PRIVATE_KEY || "";

  if (!isValidPrivateKey(key)) {
    return [];
  }

  return [`0x${normalizePrivateKey(key)}`];
}

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: getAccountsFromEnv(),
    },
    custom: {
      url: process.env.CUSTOM_RPC_URL || "",
      accounts: getAccountsFromEnv(),
    },
  },
};