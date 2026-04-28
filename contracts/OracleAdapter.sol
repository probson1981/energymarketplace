// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OracleAdapter
 * @author Patrício Alves
 * @notice Este contrato implementa um adaptador para consulta de oráculo
 *         externo no protocolo de marketplace de ofertas de fornecimento
 *         de energia.
 *
 * @dev A função deste contrato é desacoplar os demais módulos da lógica
 *      direta do feed de preço.
 *
 *      Em vez de cada contrato consultar diretamente um oráculo externo,
 *      o protocolo pode centralizar essa leitura neste adaptador.
 *
 *      Isso traz vantagens como:
 *      1. modularização
 *      2. menor acoplamento entre contratos
 *      3. facilidade de substituição futura do provedor de oráculo
 *      4. melhor organização da arquitetura
 *
 *      Nesta versão, o adaptador trabalha com um feed compatível com
 *      AggregatorV3Interface, como os feeds da Chainlink.
 *
 *      Para Sepolia, pode ser usado, por exemplo, o feed ETH/USD:
 *      0x694AA1769357215DE4FAC081bf1f309aDC325306
 */

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Interface mínima para leitura de um feed de preço externo.
 *
 *      Esta interface expõe apenas as funções necessárias para a leitura
 *      do último valor disponível e da quantidade de casas decimais.
 *
 *      A interface é compatível com feeds Chainlink AggregatorV3Interface
 *      e também com mocks locais que implementem latestRoundData()
 *      e decimals().
 */
interface AggregatorV3Interface {
    /**
     * @notice Retorna os dados da rodada mais recente do feed.
     *
     * @return roundId Identificador da rodada
     * @return answer Valor retornado pelo feed
     * @return startedAt Timestamp de início da rodada
     * @return updatedAt Timestamp da última atualização
     * @return answeredInRound Rodada em que a resposta foi produzida
     */
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    /**
     * @notice Retorna o número de casas decimais utilizadas pelo feed.
     *
     * @return Quantidade de casas decimais
     */
    function decimals() external view returns (uint8);
}

contract OracleAdapter is Ownable {
    /**
     * @dev Referência ao contrato externo do feed de preço.
     *
     *      Não foi declarado como immutable porque o owner pode atualizar
     *      o feed por meio de setPriceFeed().
     */
    AggregatorV3Interface public priceFeed;

    /**
     * @dev Tempo máximo admitido desde a última atualização do feed.
     *
     *      Em testnet, alguns feeds podem ter atualização menos frequente.
     *      Por isso, foi adotado um valor inicial de 7 dias para reduzir
     *      falhas indevidas durante demonstrações do MVP.
     *
     *      O owner pode ajustar esse valor por setMaxStaleness().
     */
    uint256 public maxStaleness;

    /**
     * @dev Evento emitido quando o endereço do feed de preço é atualizado.
     *
     * @param oldFeed Endereço anterior do feed
     * @param newFeed Novo endereço do feed
     */
    event PriceFeedUpdated(
        address indexed oldFeed,
        address indexed newFeed
    );

    /**
     * @dev Evento emitido quando o tempo máximo de defasagem é atualizado.
     *
     * @param oldMaxStaleness Valor anterior
     * @param newMaxStaleness Novo valor
     */
    event MaxStalenessUpdated(
        uint256 oldMaxStaleness,
        uint256 newMaxStaleness
    );

    /**
     * @notice Construtor do contrato.
     *
     * @param initialOwner Endereço do owner inicial
     * @param feedAddress Endereço inicial do feed de preço
     */
    constructor(
        address initialOwner,
        address feedAddress
    ) Ownable(initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        require(feedAddress != address(0), "Invalid feed");

        priceFeed = AggregatorV3Interface(feedAddress);

        /*
         * Valor inicial pensado para testnet e MVP.
         * Em produção, poderia ser reduzido conforme a política de risco
         * adotada para o protocolo.
         */
        maxStaleness = 7 days;
    }

    /**
     * @notice Atualiza o endereço do feed de preço externo.
     *
     * @dev Apenas o owner pode executar esta função.
     *
     * @param feedAddress Novo endereço do feed
     */
    function setPriceFeed(address feedAddress) external onlyOwner {
        require(feedAddress != address(0), "Invalid feed");

        address oldFeed = address(priceFeed);
        priceFeed = AggregatorV3Interface(feedAddress);

        emit PriceFeedUpdated(oldFeed, feedAddress);
    }

    /**
     * @notice Atualiza o tempo máximo admitido desde a última atualização
     *         do feed.
     *
     * @dev Apenas o owner pode executar esta função.
     *
     * @param newMaxStaleness Novo limite de defasagem, em segundos
     */
    function setMaxStaleness(uint256 newMaxStaleness) external onlyOwner {
        require(newMaxStaleness > 0, "Invalid staleness");

        uint256 oldMaxStaleness = maxStaleness;
        maxStaleness = newMaxStaleness;

        emit MaxStalenessUpdated(oldMaxStaleness, newMaxStaleness);
    }

    /**
     * @notice Retorna o preço mais recente informado pelo oráculo,
     *         juntamente com a quantidade de casas decimais.
     *
     * @dev Esta função será usada por outros contratos do protocolo,
     *      como o staking, para ajustar parâmetros econômicos.
     *
     *      Foram adicionadas verificações básicas:
     *      1. resposta positiva;
     *      2. rodada iniciada;
     *      3. rodada concluída;
     *      4. resposta compatível com a rodada atual;
     *      5. preço não defasado além de maxStaleness.
     *
     * @return price Valor retornado pelo feed
     * @return feedDecimals Quantidade de casas decimais do feed
     */
    function getLatestPrice()
        public
        view
        returns (int256 price, uint8 feedDecimals)
    {
        (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        require(answer > 0, "Invalid oracle answer");
        require(startedAt > 0, "Oracle round not started");
        require(updatedAt > 0, "Oracle round not complete");
        require(answeredInRound >= roundId, "Stale oracle round");
        require(
            block.timestamp - updatedAt <= maxStaleness,
            "Oracle price is stale"
        );

        return (answer, priceFeed.decimals());
    }

    /**
     * @notice Retorna o preço normalizado para 18 casas decimais.
     *
     * @dev Essa função é auxiliar. Ela facilita o uso do preço junto com
     *      tokens ERC-20 que normalmente usam 18 casas decimais.
     *
     *      Exemplo:
     *      Se o feed ETH/USD retorna 3000 com 8 casas decimais,
     *      o valor bruto será 300000000000.
     *      Esta função converte para 3000000000000000000000.
     *
     * @return normalizedPrice Preço normalizado para 18 casas decimais
     */
    function getLatestPrice18() external view returns (uint256 normalizedPrice) {
        (int256 price, uint8 feedDecimals) = getLatestPrice();

        uint256 unsignedPrice = uint256(price);

        if (feedDecimals == 18) {
            return unsignedPrice;
        }

        if (feedDecimals < 18) {
            return unsignedPrice * (10 ** (18 - feedDecimals));
        }

        return unsignedPrice / (10 ** (feedDecimals - 18));
    }

    /**
     * @notice Retorna os dados brutos da última rodada do feed.
     *
     * @dev Função útil para depuração, testes e demonstração do uso
     *      do oráculo real no frontend ou no relatório.
     *
     *      Os valores são explicitamente atribuídos antes do retorno para
     *      evitar alerta de retorno ignorado na análise estática.
     *
     * @return roundId Identificador da rodada
     * @return answer Valor retornado pelo feed
     * @return startedAt Timestamp de início da rodada
     * @return updatedAt Timestamp da última atualização
     * @return answeredInRound Rodada em que a resposta foi produzida
     */
    function getLatestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        (
            uint80 _roundId,
            int256 _answer,
            uint256 _startedAt,
            uint256 _updatedAt,
            uint80 _answeredInRound
        ) = priceFeed.latestRoundData();

        return (
            _roundId,
            _answer,
            _startedAt,
            _updatedAt,
            _answeredInRound
        );
    }

    /**
     * @notice Retorna o endereço atual do feed de preço.
     *
     * @return Endereço do feed usado pelo adaptador
     */
    function getPriceFeedAddress() external view returns (address) {
        return address(priceFeed);
    }
}