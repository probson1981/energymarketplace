
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ConsumerRegistry
 * @author Patrício Alves
 * @notice Este contrato implementa o cadastro de consumidores do protocolo.
 *
 * @dev A ideia é dar ao sistema um módulo próprio para registrar e controlar
 *      o status dos consumidores, de forma análoga ao cadastro dos fornecedores.
 *
 *      Regras principais:
 *      1. cada carteira pode se registrar apenas uma vez
 *      2. o próprio consumidor faz seu cadastro inicial
 *      3. owner ou governança podem ativar e desativar consumidores
 *      4. o marketplace poderá futuramente consultar este contrato antes de
 *         permitir que um consumidor aceite uma oferta
 */

import "@openzeppelin/contracts/access/Ownable.sol";

contract ConsumerRegistry is Ownable {
    /**
     * @dev Estrutura de dados do consumidor.
     *
     * @param name Nome do consumidor
     * @param documentId Identificador documental do consumidor
     * @param registered Indica se o consumidor já foi cadastrado
     * @param active Indica se o consumidor está ativo
     * @param registeredAt Timestamp do registro
     */
    struct Consumer {
        string name;
        string documentId;
        bool registered;
        bool active;
        uint256 registeredAt;
    }

    /**
     * @dev Endereço da governança autorizada a atuar além do owner.
     */
    address public governance;

    /**
     * @dev Mapeia cada endereço ao seu cadastro de consumidor.
     */
    mapping(address => Consumer) private consumers;

    /**
     * @dev Evento emitido quando um consumidor é registrado.
     */
    event ConsumerRegistered(address indexed consumer, string name, string documentId);

    /**
     * @dev Evento emitido quando o status ativo do consumidor é alterado.
     */
    event ConsumerStatusUpdated(address indexed consumer, bool active);

    /**
     * @dev Evento emitido quando a governança é atualizada.
     */
    event GovernanceUpdated(address indexed governanceAddress);

    /**
     * @notice Construtor do contrato.
     *
     * @param initialOwner Endereço do owner inicial
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @dev Modificador que restringe a execução ao owner ou à governança.
     */
    modifier onlyGovernanceOrOwner() {
        require(
            msg.sender == governance || msg.sender == owner(),
            "Not authorized"
        );
        _;
    }

    /**
     * @notice Define o endereço da governança autorizada.
     *
     * @dev Apenas o owner pode executar esta função.
     *
     * @param governanceAddress Novo endereço da governança
     */
    function setGovernance(address governanceAddress) external onlyOwner {
        require(governanceAddress != address(0), "Invalid governance");

        governance = governanceAddress;

        emit GovernanceUpdated(governanceAddress);
    }

    /**
     * @notice Registra o próprio usuário como consumidor.
     *
     * @dev O registro é único por carteira. Após o cadastro, o consumidor
     *      já inicia como ativo.
     *
     * @param name Nome do consumidor
     * @param documentId Identificador documental do consumidor
     */
    function registerConsumer(
        string calldata name,
        string calldata documentId
    ) external {
        require(!consumers[msg.sender].registered, "Already registered");
        require(bytes(name).length > 0, "Invalid name");
        require(bytes(documentId).length > 0, "Invalid document");

        consumers[msg.sender] = Consumer({
            name: name,
            documentId: documentId,
            registered: true,
            active: true,
            registeredAt: block.timestamp
        });

        emit ConsumerRegistered(msg.sender, name, documentId);
    }

    /**
     * @notice Atualiza o status ativo de um consumidor.
     *
     * @dev Apenas owner ou governança podem executar esta função.
     *
     * @param consumer Endereço do consumidor
     * @param active Novo status ativo
     */
    function setConsumerActive(
        address consumer,
        bool active
    ) external onlyGovernanceOrOwner {
        require(consumers[consumer].registered, "Consumer not registered");

        consumers[consumer].active = active;

        emit ConsumerStatusUpdated(consumer, active);
    }

    /**
     * @notice Retorna os dados cadastrais de um consumidor.
     *
     * @param consumer Endereço do consumidor
     * @return Dados completos do consumidor
     */
    function getConsumer(
        address consumer
    ) external view returns (Consumer memory) {
        return consumers[consumer];
    }

    /**
     * @notice Informa se o consumidor está ativo.
     *
     * @param consumer Endereço do consumidor
     * @return true se estiver ativo; false caso contrário
     */
    function isConsumerActive(address consumer) external view returns (bool) {
        return consumers[consumer].registered && consumers[consumer].active;
    }
}