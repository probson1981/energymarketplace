// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SupplyAgreementNFT
 * @author Patrício Alves
 * @notice Este contrato implementa o NFT do protocolo de marketplace de
 *         ofertas de fornecimento de energia.
 *
 * @dev Cada NFT representa uma adesão individual de um consumidor a uma
 *      determinada oferta cadastrada no marketplace.
 *
 *      Assim, este contrato funciona como comprovante digital on-chain da
 *      contratação ou adesão realizada.
 *
 *      O contrato herda:
 *      - ERC721, da OpenZeppelin, para o padrão de token não fungível
 *      - Ownable, da OpenZeppelin, para controle de acesso administrativo
 *      - ReentrancyGuard, da OpenZeppelin, para proteção em funções sensíveis
 *
 *      A lógica principal é:
 *      1. o marketplace autorizado chama a função de mint
 *      2. os dados da adesão são registrados internamente
 *      3. o tokenURI é associado ao tokenId
 *      4. o NFT é emitido para o consumidor
 *
 *      A função mintAgreement segue o padrão checks-effects-interactions,
 *      pois grava o estado interno antes da chamada externa indireta
 *      realizada por _safeMint.
 */

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SupplyAgreementNFT is ERC721, Ownable, ReentrancyGuard {
    /**
     * @notice Estrutura que armazena os dados de cada adesão.
     *
     * @dev Cada token NFT emitido estará associado a uma instância dessa
     *      estrutura, permitindo recuperar informações relevantes da adesão.
     *
     * @param offerId Identificador da oferta aceita pelo consumidor
     * @param supplier Endereço do fornecedor responsável pela oferta
     * @param consumer Endereço do consumidor que recebeu o NFT
     * @param acceptedAt Timestamp do momento em que a adesão foi registrada
     * @param metadataURI URI com metadados descritivos da adesão
     */
    struct AgreementData {
        uint256 offerId;
        address supplier;
        address consumer;
        uint256 acceptedAt;
        string metadataURI;
    }

    /**
     * @dev Contador incremental do próximo tokenId.
     */
    uint256 public nextTokenId;

    /**
     * @dev Endereço do contrato marketplace autorizado a cunhar NFTs.
     */
    address public marketplace;

    /**
     * @dev Mapeia tokenId para os dados completos da adesão.
     */
    mapping(uint256 => AgreementData) public agreements;

    /**
     * @dev Mapeia tokenId para sua URI de metadados.
     */
    mapping(uint256 => string) private _tokenURIs;

    /**
     * @dev Evento emitido quando o endereço do marketplace é atualizado.
     *
     * @param marketplaceAddress Novo endereço autorizado
     */
    event MarketplaceUpdated(address indexed marketplaceAddress);

    /**
     * @dev Evento emitido quando um NFT de adesão é cunhado.
     *
     * @param tokenId Identificador do NFT emitido
     * @param offerId Identificador da oferta aceita
     * @param consumer Endereço do consumidor que recebeu o NFT
     * @param supplier Endereço do fornecedor da oferta
     */
    event AgreementMinted(
        uint256 indexed tokenId,
        uint256 indexed offerId,
        address indexed consumer,
        address supplier
    );

    /**
     * @notice Construtor do contrato.
     *
     * @dev Define:
     *      - nome do NFT: "Supply Agreement NFT"
     *      - símbolo do NFT: "SAG"
     *      - owner inicial do contrato
     *
     * @param initialOwner Endereço do proprietário inicial
     */
    constructor(address initialOwner)
        ERC721("Supply Agreement NFT", "SAG")
        Ownable(initialOwner)
    {}

    /**
     * @dev Modificador que restringe o acesso apenas ao marketplace autorizado.
     */
    modifier onlyMarketplace() {
        require(marketplace != address(0), "Marketplace not set");
        require(msg.sender == marketplace, "Only marketplace");
        _;
    }

    /**
     * @notice Define o endereço do marketplace autorizado a cunhar NFTs.
     *
     * @dev Apenas o owner pode atualizar esse endereço.
     *
     * @param marketplaceAddress Endereço do contrato marketplace
     */
    function setMarketplace(address marketplaceAddress) external onlyOwner {
        require(marketplaceAddress != address(0), "Invalid marketplace");

        marketplace = marketplaceAddress;

        emit MarketplaceUpdated(marketplaceAddress);
    }

    /**
     * @notice Cunha um novo NFT de adesão para o consumidor.
     *
     * @dev Esta função só pode ser chamada pelo marketplace autorizado.
     *      O tokenId é incrementado automaticamente.
     *
     *      A função segue o padrão checks-effects-interactions:
     *      1. valida os endereços;
     *      2. incrementa o tokenId;
     *      3. registra os dados da adesão;
     *      4. registra a URI;
     *      5. emite o evento;
     *      6. executa o _safeMint.
     *
     *      Caso o _safeMint falhe, toda a transação é revertida,
     *      inclusive os dados gravados e o evento emitido.
     *
     * @param consumer Endereço do consumidor que receberá o NFT
     * @param supplier Endereço do fornecedor da oferta
     * @param offerId Identificador da oferta aceita
     * @param metadataURI URI com os metadados descritivos da adesão
     *
     * @return tokenId Identificador do NFT recém-cunhado
     */
    function mintAgreement(
        address consumer,
        address supplier,
        uint256 offerId,
        string calldata metadataURI
    ) external onlyMarketplace nonReentrant returns (uint256 tokenId) {
        require(consumer != address(0), "Invalid consumer");
        require(supplier != address(0), "Invalid supplier");

        tokenId = ++nextTokenId;

        agreements[tokenId] = AgreementData({
            offerId: offerId,
            supplier: supplier,
            consumer: consumer,
            acceptedAt: block.timestamp,
            metadataURI: metadataURI
        });

        _tokenURIs[tokenId] = metadataURI;

        emit AgreementMinted(tokenId, offerId, consumer, supplier);

        _safeMint(consumer, tokenId);
    }

    /**
     * @notice Retorna a URI de metadados associada ao token.
     *
     * @dev Reverte caso o token não exista.
     *
     * @param tokenId Identificador do NFT
     * @return URI de metadados do token
     */
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    /**
     * @notice Retorna os dados completos da adesão associados a um NFT.
     *
     * @param tokenId Identificador do NFT
     * @return Estrutura AgreementData com os dados da adesão
     */
    function getAgreementData(
        uint256 tokenId
    ) external view returns (AgreementData memory) {
        _requireOwned(tokenId);
        return agreements[tokenId];
    }
}