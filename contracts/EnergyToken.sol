
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EnergyToken
 * @author Patrício Alves
 * @notice Este contrato implementa o token ERC-20 do protocolo de marketplace
 *         de ofertas de fornecimento de energia.
 *
 * @dev Este token será utilizado como ativo utilitário interno do sistema,
 *      servindo como base para:
 *      1. caução ou garantia exigida dos fornecedores
 *      2. staking com recompensa
 *      3. governança do protocolo
 *      4. eventual pagamento de taxas internas
 *
 *      O contrato herda:
 *      - ERC20, da OpenZeppelin, para o padrão de token fungível
 *      - Ownable, da OpenZeppelin, para controle de acesso administrativo
 *
 *      Além disso, o contrato implementa um mecanismo simples de "minters",
 *      isto é, endereços autorizados a cunhar novos tokens.
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EnergyToken is ERC20, Ownable {
    /**
     * @dev Mapeamento que registra quais endereços possuem permissão
     *      para cunhar novos tokens.
     *
     *      Se minters[account] == true, então aquele endereço está autorizado.
     */
    mapping(address => bool) public minters;

    /**
     * @dev Evento emitido quando a permissão de minter é alterada.
     *
     * @param account Endereço cuja permissão foi alterada
     * @param allowed Novo estado da permissão
     */
    event MinterUpdated(address indexed account, bool allowed);

    /**
     * @dev Evento emitido quando novos tokens são cunhados.
     *
     * @param to Endereço que recebeu os tokens
     * @param amount Quantidade cunhada
     */
    event TokensMinted(address indexed to, uint256 amount);

    /**
     * @notice Construtor do token.
     *
     * @dev Define:
     *      - o nome do token: "Energy Token"
     *      - o símbolo do token: "ENG"
     *      - o owner inicial do contrato
     *
     * @param initialOwner Endereço que será o proprietário inicial do contrato
     */
    constructor(address initialOwner)
        ERC20("Energy Token", "ENG")
        Ownable(initialOwner)
    {}

    /**
     * @notice Define se um endereço pode ou não cunhar novos tokens.
     *
     * @dev Apenas o proprietário do contrato pode executar esta função.
     *
     * @param account Endereço cujo status de minter será alterado
     * @param allowed True para autorizar; false para revogar a autorização
     */
    function setMinter(address account, bool allowed) external onlyOwner {
        minters[account] = allowed;
        emit MinterUpdated(account, allowed);
    }

    /**
     * @notice Cunha novos tokens para um endereço.
     *
     * @dev Esta função pode ser executada:
     *      - pelo owner do contrato
     *      - por endereços previamente autorizados como minters
     *
     *      Se o chamador não for owner nem minter autorizado, a execução falha.
     *
     * @param to Endereço que receberá os novos tokens
     * @param amount Quantidade de tokens a ser cunhada
     */
    function mint(address to, uint256 amount) external {
        require(
            minters[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );

        _mint(to, amount);

        emit TokensMinted(to, amount);
    }
}