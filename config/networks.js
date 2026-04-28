require("dotenv").config();

/**
 * @title Configuração de redes do projeto
 * @author Patrício Alves
 * @notice Este arquivo centraliza os parâmetros específicos de cada rede
 *         suportada pelo protocolo.
 *
 * @dev Cada rede informa:
 *      - se utiliza mock de price feed
 *      - endereço do feed real, quando aplicável
 *      - valor mínimo inicial da caução
 *      - período inicial de votação
 *      - parâmetros do mock local
 *
 *      Redes suportadas:
 *      - hardhat: rede temporária local
 *      - localhost: rede local persistente via npx hardhat node
 *      - sepolia: testnet Ethereum
 *      - custom: rede EVM customizada
 */

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return String(value).toLowerCase() === "true";
}

function parseInteger(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Valor inteiro positivo inválido: ${value}`);
  }

  return parsed;
}

function parseString(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return String(value);
}

module.exports = {
  /**
   * Rede Hardhat temporária.
   *
   * Uso:
   * npx hardhat run scripts/deploy.js
   *
   * Essa rede é útil para testes rápidos. Ela usa MockPriceFeed.
   */
  hardhat: {
    useMockPriceFeed: true,
    priceFeedAddress: null,

    initialMinimumCollateral: parseString(
      process.env.LOCAL_INITIAL_MINIMUM_COLLATERAL,
      "1000"
    ),

    initialVotingPeriod: parseInteger(
      process.env.LOCAL_INITIAL_VOTING_PERIOD,
      60
    ),

    mockPrice: BigInt(
      parseString(process.env.LOCAL_MOCK_PRICE, "200000000000")
    ),

    mockDecimals: parseInteger(process.env.LOCAL_MOCK_DECIMALS, 8),
  },

  /**
   * Rede local persistente.
   *
   * Uso:
   * Terminal 1:
   * npx hardhat node
   *
   * Terminal 2:
   * npx hardhat run scripts/deploy.js --network localhost
   *
   * Essa rede é a melhor para testar com frontend local.
   */
  localhost: {
    useMockPriceFeed: true,
    priceFeedAddress: null,

    initialMinimumCollateral: parseString(
      process.env.LOCAL_INITIAL_MINIMUM_COLLATERAL,
      "1000"
    ),

    initialVotingPeriod: parseInteger(
      process.env.LOCAL_INITIAL_VOTING_PERIOD,
      60
    ),

    mockPrice: BigInt(
      parseString(process.env.LOCAL_MOCK_PRICE, "200000000000")
    ),

    mockDecimals: parseInteger(process.env.LOCAL_MOCK_DECIMALS, 8),
  },

  /**
   * Rede Sepolia.
   *
   * Por padrão, usa price feed externo, por exemplo Chainlink.
   * O endereço deve ser informado no arquivo .env pela variável:
   *
   * SEPOLIA_PRICE_FEED=0x...
   *
   * Para teste emergencial com mock na Sepolia, pode usar:
   *
   * SEPOLIA_USE_MOCK_PRICE_FEED=true
   *
   * Porém, para a entrega da atividade, o ideal é manter false
   * e usar um feed real da testnet.
   */
  sepolia: {
    useMockPriceFeed: parseBoolean(
      process.env.SEPOLIA_USE_MOCK_PRICE_FEED,
      false
    ),

    priceFeedAddress: parseString(process.env.SEPOLIA_PRICE_FEED, ""),

    initialMinimumCollateral: parseString(
      process.env.SEPOLIA_INITIAL_MINIMUM_COLLATERAL,
      "10"
    ),

    initialVotingPeriod: parseInteger(
      process.env.SEPOLIA_INITIAL_VOTING_PERIOD,
      60
    ),

    mockPrice: BigInt(
      parseString(process.env.SEPOLIA_MOCK_PRICE, "200000000000")
    ),

    mockDecimals: parseInteger(process.env.SEPOLIA_MOCK_DECIMALS, 8),
  },

  /**
   * Rede EVM customizada.
   *
   * Pode ser usada futuramente para outra testnet ou rede privada.
   */
  custom: {
    useMockPriceFeed: parseBoolean(
      process.env.CUSTOM_USE_MOCK_PRICE_FEED,
      false
    ),

    priceFeedAddress: parseString(process.env.CUSTOM_PRICE_FEED, ""),

    initialMinimumCollateral: parseString(
      process.env.CUSTOM_INITIAL_MINIMUM_COLLATERAL,
      "1000"
    ),

    initialVotingPeriod: parseInteger(
      process.env.CUSTOM_INITIAL_VOTING_PERIOD,
      3600
    ),

    mockPrice: BigInt(
      parseString(process.env.CUSTOM_MOCK_PRICE, "200000000000")
    ),

    mockDecimals: parseInteger(process.env.CUSTOM_MOCK_DECIMALS, 8),
  },
};