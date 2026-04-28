
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockPriceFeed
 * @author Patrício Alves
 * @notice Este contrato simula um feed de preço externo para testes do
 *         OracleAdapter.
 *
 * @dev Ele implementa apenas as funções mínimas esperadas pelo adaptador:
 *      - latestRoundData()
 *      - decimals()
 *
 *      O objetivo é permitir testes locais sem depender de um oráculo real.
 */
contract MockPriceFeed {
    /**
     * @dev Valor simulado do preço.
     */
    int256 private _answer;

    /**
     * @dev Quantidade de casas decimais do feed.
     */
    uint8 private _decimals;

    /**
     * @notice Construtor do mock.
     *
     * @param initialAnswer Valor inicial simulado do preço
     * @param initialDecimals Quantidade inicial de casas decimais
     */
    constructor(int256 initialAnswer, uint8 initialDecimals) {
        _answer = initialAnswer;
        _decimals = initialDecimals;
    }

    /**
     * @notice Atualiza o valor simulado do preço.
     *
     * @param newAnswer Novo valor do preço
     */
    function setAnswer(int256 newAnswer) external {
        _answer = newAnswer;
    }

    /**
     * @notice Atualiza a quantidade de casas decimais.
     *
     * @param newDecimals Novo número de casas decimais
     */
    function setDecimals(uint8 newDecimals) external {
        _decimals = newDecimals;
    }

    /**
     * @notice Retorna a quantidade de casas decimais do feed.
     */
    function decimals() external view returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Retorna dados simulados da rodada mais recente.
     *
     * @dev Esta assinatura é compatível com a interface esperada
     *      pelo OracleAdapter.
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
        )
    {
        return (1, _answer, block.timestamp, block.timestamp, 1);
    }
}