// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MarketplaceTreasury
 * @author Patrício Alves
 * @notice Tesouraria on-chain do marketplace para venda de EnergyToken.
 *
 * @dev Fluxo:
 *      1. a empresa ou owner abastece este contrato com EnergyToken
 *      2. o usuário envia ETH para comprar EnergyToken
 *      3. o contrato transfere os tokens para a carteira do comprador
 *      4. o owner pode sacar o ETH arrecadado
 *
 *      Este contrato permite que a entrada de tokens no sistema
 *      aconteça integralmente via blockchain.
 *
 *      Esta versão utiliza ReentrancyGuard nas funções que fazem
 *      transferência de tokens ou ETH.
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MarketplaceTreasury is Ownable, ReentrancyGuard {
    /**
     * @dev Token ERC-20 do protocolo.
     */
    IERC20 public immutable token;

    /**
     * @dev Quantidade de tokens vendida por 1 ETH.
     *
     * Exemplo:
     * - se tokenPerEth = 1000e18
     * - então 1 ETH compra 1000 tokens
     */
    uint256 public tokenPerEth;

    /**
     * @dev Evento emitido quando o preço é atualizado.
     */
    event TokenPriceUpdated(uint256 newTokenPerEth);

    /**
     * @dev Evento emitido quando um usuário compra tokens.
     */
    event TokensPurchased(
        address indexed buyer,
        uint256 ethPaid,
        uint256 tokenAmount
    );

    /**
     * @dev Evento emitido quando o owner saca ETH da tesouraria.
     */
    event EthWithdrawn(address indexed to, uint256 amount);

    /**
     * @notice Construtor da tesouraria.
     *
     * @param initialOwner Owner inicial
     * @param tokenAddress Endereço do EnergyToken
     * @param initialTokenPerEth Quantidade inicial de tokens por ETH
     */
    constructor(
        address initialOwner,
        address tokenAddress,
        uint256 initialTokenPerEth
    ) Ownable(initialOwner) {
        require(tokenAddress != address(0), "Invalid token");
        require(initialTokenPerEth > 0, "Invalid price");

        token = IERC20(tokenAddress);
        tokenPerEth = initialTokenPerEth;
    }

    /**
     * @notice Atualiza a quantidade de tokens vendida por 1 ETH.
     *
     * @dev Apenas o owner pode atualizar.
     *
     * @param newTokenPerEth Novo valor
     */
    function setTokenPerEth(uint256 newTokenPerEth) external onlyOwner {
        require(newTokenPerEth > 0, "Invalid price");

        tokenPerEth = newTokenPerEth;

        emit TokenPriceUpdated(newTokenPerEth);
    }

    /**
     * @notice Retorna a cotação de tokens para um valor em ETH.
     *
     * @param ethAmount Quantidade em wei
     * @return tokenAmount Quantidade de tokens a receber
     */
    function quoteTokenAmount(
        uint256 ethAmount
    ) public view returns (uint256 tokenAmount) {
        require(ethAmount > 0, "Invalid ETH amount");

        tokenAmount = (ethAmount * tokenPerEth) / 1 ether;
    }

    /**
     * @notice Permite comprar tokens enviando ETH.
     *
     * @dev O contrato precisa já possuir saldo suficiente de EnergyToken.
     *      A função é protegida contra reentrância porque realiza
     *      transferência externa de ERC-20.
     *
     * @return tokenAmount Quantidade de tokens comprada
     */
    function buyTokens()
        external
        payable
        nonReentrant
        returns (uint256 tokenAmount)
    {
        require(msg.value > 0, "No ETH sent");

        tokenAmount = quoteTokenAmount(msg.value);
        require(tokenAmount > 0, "Zero token amount");

        uint256 treasuryBalance = token.balanceOf(address(this));
        require(treasuryBalance >= tokenAmount, "Insufficient token reserve");

        bool success = token.transfer(msg.sender, tokenAmount);
        require(success, "Token transfer failed");

        emit TokensPurchased(msg.sender, msg.value, tokenAmount);
    }

    /**
     * @notice Retorna o saldo atual de tokens da tesouraria.
     *
     * @return Saldo de EnergyToken mantido pela tesouraria
     */
    function tokenReserve() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @notice Retorna o saldo atual de ETH da tesouraria.
     *
     * @return Saldo em wei mantido pela tesouraria
     */
    function ethReserve() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Saca ETH arrecadado na tesouraria.
     *
     * @dev Usa call para transferência de ETH, que é o padrão mais flexível
     *      em Solidity moderno. O risco é mitigado por:
     *      1. onlyOwner;
     *      2. nonReentrant;
     *      3. validação de endereço;
     *      4. validação de valor;
     *      5. verificação explícita de sucesso.
     *
     * @param to Destino do saque
     * @param amount Quantidade em wei
     */
    function withdrawEth(
        address payable to,
        uint256 amount
    ) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(address(this).balance >= amount, "Insufficient ETH balance");

        emit EthWithdrawn(to, amount);

        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
    }
}