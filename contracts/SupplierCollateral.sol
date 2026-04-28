// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SupplierCollateral
 * @author Patrício Alves
 * @notice Este contrato implementa o módulo de caução ou garantia dos
 *         fornecedores do protocolo de marketplace de ofertas de
 *         fornecimento de energia.
 *
 * @dev Esta versão revisada acrescenta:
 *      1. validação contra endereço zero no construtor;
 *      2. proteção contra reentrância;
 *      3. aplicação mais clara do padrão checks-effects-interactions.
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SupplierCollateral is Ownable, ReentrancyGuard {
    /**
     * @dev Referência ao token ERC-20 do protocolo.
     */
    IERC20 public immutable token;

    /**
     * @dev Valor mínimo de caução exigido.
     */
    uint256 public minimumCollateral;

    /**
     * @dev Endereço da governança autorizada a alterar parâmetros
     *      do contrato, além do owner.
     */
    address public governance;

    /**
     * @dev Mapeia cada fornecedor ao saldo total de caução depositado.
     */
    mapping(address => uint256) public collateralBalance;

    /**
     * @dev Evento emitido quando um fornecedor deposita caução.
     */
    event CollateralDeposited(address indexed supplier, uint256 amount);

    /**
     * @dev Evento emitido quando um fornecedor retira caução.
     */
    event CollateralWithdrawn(address indexed supplier, uint256 amount);

    /**
     * @dev Evento emitido quando parte da caução de um fornecedor é penalizada.
     */
    event CollateralSlashed(address indexed supplier, uint256 amount);

    /**
     * @dev Evento emitido quando o valor mínimo de caução é atualizado.
     */
    event MinimumCollateralUpdated(uint256 newAmount);

    /**
     * @dev Evento emitido quando o endereço da governança é atualizado.
     */
    event GovernanceUpdated(address indexed governanceAddress);

    /**
     * @dev Evento emitido quando um saque de caução é bloqueado
     *      por falta de saldo real do contrato.
     *
     * @param supplier Endereço do fornecedor
     * @param requestedAmount Quantidade solicitada
     * @param availableBalance Saldo disponível do contrato
     * @param reason Motivo textual
     */
    event CollateralWithdrawalBlocked(
        address indexed supplier,
        uint256 requestedAmount,
        uint256 availableBalance,
        string reason
    );

    /**
     * @notice Construtor do contrato.
     *
     * @param initialOwner Endereço do owner inicial
     * @param tokenAddress Endereço do token ERC-20 do protocolo
     * @param initialMinimum Valor mínimo inicial de caução
     */
    constructor(
        address initialOwner,
        address tokenAddress,
        uint256 initialMinimum
    ) Ownable(initialOwner) {
        require(tokenAddress != address(0), "Invalid token");

        token = IERC20(tokenAddress);
        minimumCollateral = initialMinimum;
    }

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
     * @param governanceAddress Endereço do contrato de governança
     */
    function setGovernance(address governanceAddress) external onlyOwner {
        require(governanceAddress != address(0), "Invalid governance");

        governance = governanceAddress;

        emit GovernanceUpdated(governanceAddress);
    }

    /**
     * @notice Atualiza o valor mínimo exigido de caução.
     *
     * @dev Apenas o owner ou a governança podem executar esta função.
     *
     * @param newAmount Novo valor mínimo de caução
     */
    function setMinimumCollateral(
        uint256 newAmount
    ) external onlyGovernanceOrOwner {
        minimumCollateral = newAmount;

        emit MinimumCollateralUpdated(newAmount);
    }

    /**
     * @notice Permite ao fornecedor depositar tokens como caução.
     *
     * @dev A função usa nonReentrant e segue o padrão
     *      checks-effects-interactions:
     *      1. valida a entrada;
     *      2. atualiza o saldo lógico;
     *      3. executa a chamada externa transferFrom.
     *
     *      Caso a transferência falhe, toda a transação é revertida,
     *      incluindo a alteração feita no saldo lógico.
     *
     * @param amount Quantidade de tokens a depositar como caução
     */
    function depositCollateral(uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");

        collateralBalance[msg.sender] += amount;

        bool success = token.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        emit CollateralDeposited(msg.sender, amount);
    }

    /**
     * @notice Permite ao fornecedor retirar parte ou toda a sua caução.
     *
     * @dev Além da regra de saldo lógico e saldo remanescente mínimo,
     *      a função verifica se o contrato possui saldo real de token
     *      suficiente para cumprir a retirada.
     *
     *      A atualização de estado ocorre antes da transferência externa.
     *
     * @param amount Quantidade a retirar
     */
    function withdrawCollateral(uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");
        require(
            collateralBalance[msg.sender] >= amount,
            "Insufficient collateral"
        );

        uint256 remaining = collateralBalance[msg.sender] - amount;

        require(
            remaining >= minimumCollateral || remaining == 0,
            "Below minimum collateral"
        );

        uint256 available = token.balanceOf(address(this));

        if (available < amount) {
            emit CollateralWithdrawalBlocked(
                msg.sender,
                amount,
                available,
                "Insufficient contract balance"
            );
            revert("Insufficient contract balance");
        }

        collateralBalance[msg.sender] = remaining;

        bool success = token.transfer(msg.sender, amount);
        require(success, "Transfer failed");

        emit CollateralWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Penaliza parte da caução de um fornecedor.
     *
     * @param supplier Endereço do fornecedor penalizado
     * @param amount Quantidade a ser penalizada
     */
    function slashCollateral(
        address supplier,
        uint256 amount
    ) external onlyGovernanceOrOwner {
        require(supplier != address(0), "Invalid supplier");
        require(amount > 0, "Invalid amount");
        require(
            collateralBalance[supplier] >= amount,
            "Insufficient collateral"
        );

        collateralBalance[supplier] -= amount;

        emit CollateralSlashed(supplier, amount);
    }

    /**
     * @notice Informa se o fornecedor possui a caução mínima exigida.
     *
     * @param supplier Endereço do fornecedor
     * @return true se o saldo de caução for suficiente; false caso contrário
     */
    function hasMinimumCollateral(
        address supplier
    ) external view returns (bool) {
        return collateralBalance[supplier] >= minimumCollateral;
    }

    /**
     * @notice Retorna o status de caução de um fornecedor.
     *
     * @dev Essa função facilita o uso pelo frontend, pois retorna em uma única
     *      chamada o valor depositado, o mínimo exigido e se o fornecedor está
     *      apto sob o critério de caução.
     *
     * @param supplier Endereço do fornecedor consultado
     *
     * @return deposited Valor depositado pelo fornecedor
     * @return requiredAmount Valor mínimo atualmente exigido
     * @return compliant true se deposited >= requiredAmount
     */
    function getCollateralStatus(
        address supplier
    )
        external
        view
        returns (
            uint256 deposited,
            uint256 requiredAmount,
            bool compliant
        )
    {
        deposited = collateralBalance[supplier];
        requiredAmount = minimumCollateral;
        compliant = deposited >= requiredAmount;
    }
}