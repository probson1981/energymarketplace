// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EnergyMarketplace
 * @author Patrício Alves
 * @notice Este contrato implementa o núcleo de negócio do marketplace
 *         de ofertas de fornecimento de energia.
 *
 * @dev Esta versão integra formalmente o ConsumerRegistry, exigindo que
 *      apenas consumidores cadastrados e ativos possam aceitar ofertas.
 *
 *      Também foram acrescentadas validações de endereço no construtor,
 *      proteção contra reentrância na aceitação de oferta e validações
 *      adicionais de existência da oferta.
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @dev Interface mínima do cadastro de fornecedores.
 */
interface ISupplierRegistry {
    function isSupplierActive(address supplier) external view returns (bool);
}

/**
 * @dev Interface mínima do contrato de caução.
 */
interface ISupplierCollateral {
    function hasMinimumCollateral(address supplier) external view returns (bool);
}

/**
 * @dev Interface mínima do contrato NFT de adesão.
 */
interface ISupplyAgreementNFT {
    function mintAgreement(
        address consumer,
        address supplier,
        uint256 offerId,
        string calldata metadataURI
    ) external returns (uint256 tokenId);
}

/**
 * @dev Interface mínima do cadastro de consumidores.
 */
interface IConsumerRegistry {
    function isConsumerActive(address consumer) external view returns (bool);
}

contract EnergyMarketplace is Ownable, ReentrancyGuard {
    /**
     * @dev Estrutura que representa uma oferta criada por fornecedor.
     */
    struct Offer {
        uint256 id;
        address supplier;
        uint256 tariff;
        uint256 earlyPaymentDiscount;
        string extraBenefit;
        uint256 validUntil;
        uint256 maxConsumers;
        uint256 acceptedCount;
        bool active;
    }

    /**
     * @dev Próximo identificador incremental de oferta.
     */
    uint256 public nextOfferId;

    /**
     * @dev Referência ao cadastro de fornecedores.
     */
    ISupplierRegistry public immutable registry;

    /**
     * @dev Referência ao contrato de caução.
     */
    ISupplierCollateral public immutable collateral;

    /**
     * @dev Referência ao contrato NFT de adesão.
     */
    ISupplyAgreementNFT public immutable agreementNFT;

    /**
     * @dev Referência ao cadastro de consumidores.
     */
    IConsumerRegistry public immutable consumerRegistry;

    /**
     * @dev Mapeia id da oferta para sua estrutura.
     */
    mapping(uint256 => Offer) public offers;

    /**
     * @dev Indica se determinado consumidor já aceitou determinada oferta.
     */
    mapping(uint256 => mapping(address => bool)) public hasAcceptedOffer;

    /**
     * @dev Evento emitido quando uma oferta é criada.
     */
    event OfferCreated(uint256 indexed offerId, address indexed supplier);

    /**
     * @dev Evento emitido quando uma oferta é atualizada.
     */
    event OfferUpdated(uint256 indexed offerId);

    /**
     * @dev Evento emitido quando uma oferta é desativada.
     */
    event OfferDeactivated(uint256 indexed offerId);

    /**
     * @dev Evento emitido quando uma oferta é aceita por consumidor.
     */
    event OfferAccepted(
        uint256 indexed offerId,
        address indexed consumer,
        uint256 agreementTokenId
    );

    /**
     * @notice Construtor do marketplace.
     *
     * @param initialOwner Endereço do owner inicial
     * @param registryAddress Endereço do SupplierRegistry
     * @param collateralAddress Endereço do SupplierCollateral
     * @param nftAddress Endereço do SupplyAgreementNFT
     * @param consumerRegistryAddress Endereço do ConsumerRegistry
     */
    constructor(
        address initialOwner,
        address registryAddress,
        address collateralAddress,
        address nftAddress,
        address consumerRegistryAddress
    ) Ownable(initialOwner) {
        require(registryAddress != address(0), "Invalid registry");
        require(collateralAddress != address(0), "Invalid collateral");
        require(nftAddress != address(0), "Invalid NFT");
        require(
            consumerRegistryAddress != address(0),
            "Invalid consumer registry"
        );

        registry = ISupplierRegistry(registryAddress);
        collateral = ISupplierCollateral(collateralAddress);
        agreementNFT = ISupplyAgreementNFT(nftAddress);
        consumerRegistry = IConsumerRegistry(consumerRegistryAddress);
    }

    /**
     * @notice Permite a um fornecedor ativo e com caução mínima criar oferta.
     *
     * @param tariff Tarifa ofertada
     * @param earlyPaymentDiscount Desconto por antecipação
     * @param extraBenefit Benefício adicional textual
     * @param validUntil Timestamp de validade da oferta
     * @param maxConsumers Número máximo de consumidores
     * @return offerId Identificador da oferta criada
     */
    function createOffer(
        uint256 tariff,
        uint256 earlyPaymentDiscount,
        string calldata extraBenefit,
        uint256 validUntil,
        uint256 maxConsumers
    ) external returns (uint256 offerId) {
        require(registry.isSupplierActive(msg.sender), "Supplier not active");
        require(
            collateral.hasMinimumCollateral(msg.sender),
            "Insufficient collateral"
        );
        require(validUntil > block.timestamp, "Invalid expiration");
        require(maxConsumers > 0, "Invalid max consumers");

        offerId = ++nextOfferId;

        offers[offerId] = Offer({
            id: offerId,
            supplier: msg.sender,
            tariff: tariff,
            earlyPaymentDiscount: earlyPaymentDiscount,
            extraBenefit: extraBenefit,
            validUntil: validUntil,
            maxConsumers: maxConsumers,
            acceptedCount: 0,
            active: true
        });

        emit OfferCreated(offerId, msg.sender);
    }

    /**
     * @notice Permite ao fornecedor dono atualizar sua oferta.
     *
     * @param offerId Identificador da oferta
     * @param tariff Nova tarifa
     * @param earlyPaymentDiscount Novo desconto por antecipação
     * @param extraBenefit Novo benefício adicional
     * @param validUntil Novo prazo de validade
     * @param maxConsumers Novo limite máximo de consumidores
     */
    function updateOffer(
        uint256 offerId,
        uint256 tariff,
        uint256 earlyPaymentDiscount,
        string calldata extraBenefit,
        uint256 validUntil,
        uint256 maxConsumers
    ) external {
        Offer storage offer = offers[offerId];

        require(offer.id != 0, "Offer does not exist");
        require(offer.supplier == msg.sender, "Not offer owner");
        require(offer.active, "Offer inactive");

        require(
            registry.isSupplierActive(msg.sender),
            "Supplier not active"
        );

        require(
            collateral.hasMinimumCollateral(msg.sender),
            "Supplier below minimum collateral"
        );

        require(validUntil > block.timestamp, "Invalid expiration");
        require(maxConsumers > 0, "Invalid max consumers");
        require(maxConsumers >= offer.acceptedCount, "Below accepted count");

        offer.tariff = tariff;
        offer.earlyPaymentDiscount = earlyPaymentDiscount;
        offer.extraBenefit = extraBenefit;
        offer.validUntil = validUntil;
        offer.maxConsumers = maxConsumers;

        emit OfferUpdated(offerId);
    }

    /**
     * @notice Permite ao fornecedor dono desativar sua oferta.
     *
     * @param offerId Identificador da oferta
     */
    function deactivateOffer(uint256 offerId) external {
        Offer storage offer = offers[offerId];

        require(offer.id != 0, "Offer does not exist");
        require(offer.supplier == msg.sender, "Not offer owner");
        require(offer.active, "Offer inactive");

        offer.active = false;

        emit OfferDeactivated(offerId);
    }

    /**
     * @notice Permite a um consumidor cadastrado e ativo aceitar uma oferta.
     *
     * @dev A função usa nonReentrant porque chama contrato externo para
     *      cunhar o NFT de adesão. Antes da chamada externa, o estado interno
     *      é atualizado, seguindo o padrão checks-effects-interactions.
     *
     * @param offerId Identificador da oferta
     * @param metadataURI URI dos metadados da adesão
     * @return tokenId Identificador do NFT emitido
     */
    function acceptOffer(
        uint256 offerId,
        string calldata metadataURI
    ) external nonReentrant returns (uint256 tokenId) {
        Offer storage offer = offers[offerId];

        require(offer.id != 0, "Offer does not exist");

        require(
            consumerRegistry.isConsumerActive(msg.sender),
            "Consumer not active"
        );

        require(
            registry.isSupplierActive(offer.supplier),
            "Supplier not active"
        );

        require(
            collateral.hasMinimumCollateral(offer.supplier),
            "Supplier below minimum collateral"
        );

        require(offer.active, "Offer inactive");
        require(block.timestamp <= offer.validUntil, "Offer expired");
        require(offer.acceptedCount < offer.maxConsumers, "Offer full");
        require(!hasAcceptedOffer[offerId][msg.sender], "Already accepted");

        hasAcceptedOffer[offerId][msg.sender] = true;
        offer.acceptedCount += 1;

        tokenId = agreementNFT.mintAgreement(
            msg.sender,
            offer.supplier,
            offerId,
            metadataURI
        );

        emit OfferAccepted(offerId, msg.sender, tokenId);
    }

    /**
     * @notice Retorna os dados completos de uma oferta.
     *
     * @param offerId Identificador da oferta
     * @return Estrutura Offer com os dados da oferta
     */
    function getOffer(uint256 offerId) external view returns (Offer memory) {
        Offer memory offer = offers[offerId];

        require(offer.id != 0, "Offer does not exist");

        return offer;
    }

    /**
     * @notice Informa se um fornecedor está apto a operar no marketplace.
     *
     * @dev O fornecedor é considerado apto quando está ativo no cadastro
     *      e possui caução igual ou superior ao mínimo exigido.
     *
     * @param supplier Endereço do fornecedor consultado
     *
     * @return active true se o fornecedor está ativo no SupplierRegistry
     * @return hasCollateral true se possui caução mínima
     * @return eligible true se active e hasCollateral forem verdadeiros
     */
    function getSupplierEligibility(
        address supplier
    )
        external
        view
        returns (
            bool active,
            bool hasCollateral,
            bool eligible
        )
    {
        active = registry.isSupplierActive(supplier);
        hasCollateral = collateral.hasMinimumCollateral(supplier);
        eligible = active && hasCollateral;
    }    
}