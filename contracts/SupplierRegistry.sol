
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SupplierRegistry
 * @author Patrício Alves
 * @notice Este contrato implementa o cadastro dos fornecedores do protocolo
 *         de marketplace de ofertas de fornecimento de energia.
 *
 * @dev O objetivo deste contrato é registrar quem são os fornecedores aptos
 *      a participar do sistema, armazenando dados básicos e o estado cadastral
 *      de cada um.
 *
 *      Este contrato será utilizado pelos módulos seguintes para verificar:
 *      1. se um fornecedor já está registrado
 *      2. se um fornecedor está ativo
 *      3. se ele pode prosseguir para etapas como caução e publicação de ofertas
 *
 *      O contrato herda Ownable para permitir controle administrativo básico.
 */

import "@openzeppelin/contracts/access/Ownable.sol";

contract SupplierRegistry is Ownable {
    /**
     * @notice Estrutura que representa os dados cadastrais de um fornecedor.
     *
     * @param name Nome do fornecedor
     * @param documentId Identificador cadastral do fornecedor
     * @param registered Indica se o fornecedor foi cadastrado
     * @param active Indica se o fornecedor está ativo no sistema
     * @param registeredAt Timestamp do momento do cadastro
     */
    struct Supplier {
        string name;
        string documentId;
        bool registered;
        bool active;
        uint256 registeredAt;
    }

    /**
     * @dev Mapeia o endereço do fornecedor aos seus dados cadastrais.
     */
    mapping(address => Supplier) public suppliers;

    /**
     * @dev Endereço do marketplace autorizado a atualizar status de fornecedor,
     *      além do owner.
     */
    address public marketplace;

    /**
     * @dev Evento emitido quando um fornecedor é registrado.
     *
     * @param supplier Endereço do fornecedor
     * @param name Nome cadastrado
     * @param documentId Identificador cadastral informado
     */
    event SupplierRegistered(
        address indexed supplier,
        string name,
        string documentId
    );

    /**
     * @dev Evento emitido quando o status ativo de um fornecedor é alterado.
     *
     * @param supplier Endereço do fornecedor
     * @param active Novo status de atividade
     */
    event SupplierStatusUpdated(address indexed supplier, bool active);

    /**
     * @dev Evento emitido quando o endereço do marketplace é atualizado.
     *
     * @param marketplaceAddress Novo endereço do marketplace
     */
    event MarketplaceUpdated(address indexed marketplaceAddress);

    /**
     * @notice Construtor do contrato.
     *
     * @param initialOwner Endereço do proprietário inicial
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @dev Modificador que restringe a execução ao owner ou ao marketplace.
     */
    modifier onlyMarketplaceOrOwner() {
        require(
            msg.sender == marketplace || msg.sender == owner(),
            "Not authorized"
        );
        _;
    }

    /**
     * @notice Define o endereço do marketplace autorizado.
     *
     * @dev Apenas o owner pode executar esta função.
     *
     * @param marketplaceAddress Endereço do contrato marketplace
     */
    function setMarketplace(address marketplaceAddress) external onlyOwner {
        require(marketplaceAddress != address(0), "Invalid marketplace");

        marketplace = marketplaceAddress;

        emit MarketplaceUpdated(marketplaceAddress);
    }

    /**
     * @notice Registra o endereço chamador como fornecedor.
     *
     * @dev Cada endereço só pode se registrar uma única vez.
     *      O fornecedor é registrado inicialmente como ativo.
     *
     * @param name Nome do fornecedor
     * @param documentId Identificador cadastral do fornecedor
     */
    function registerSupplier(
        string calldata name,
        string calldata documentId
    ) external {
        require(!suppliers[msg.sender].registered, "Already registered");

        suppliers[msg.sender] = Supplier({
            name: name,
            documentId: documentId,
            registered: true,
            active: true,
            registeredAt: block.timestamp
        });

        emit SupplierRegistered(msg.sender, name, documentId);
    }

    /**
     * @notice Atualiza o status ativo de um fornecedor.
     *
     * @dev Apenas o owner ou o marketplace autorizado podem executar esta função.
     *
     * @param supplier Endereço do fornecedor
     * @param active Novo status de atividade
     */
    function setSupplierActive(
        address supplier,
        bool active
    ) external onlyMarketplaceOrOwner {
        require(suppliers[supplier].registered, "Supplier not registered");

        suppliers[supplier].active = active;

        emit SupplierStatusUpdated(supplier, active);
    }

    /**
     * @notice Informa se um fornecedor está registrado e ativo.
     *
     * @param supplier Endereço do fornecedor
     * @return true se estiver registrado e ativo; false caso contrário
     */
    function isSupplierActive(address supplier) external view returns (bool) {
        Supplier memory s = suppliers[supplier];
        return s.registered && s.active;
    }

    /**
     * @notice Retorna os dados completos de um fornecedor.
     *
     * @param supplier Endereço do fornecedor
     * @return Estrutura Supplier com os dados cadastrais
     */
    function getSupplier(
        address supplier
    ) external view returns (Supplier memory) {
        return suppliers[supplier];
    }
}