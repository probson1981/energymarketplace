// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SupplierStaking
 * @author Patrício Alves
 * @notice Este contrato implementa o módulo de staking dos fornecedores
 *         do protocolo de marketplace de ofertas de fornecimento de energia.
 *
 * @dev O objetivo deste contrato é permitir que fornecedores depositem
 *      tokens em staking e, com isso, acumulem recompensas ao longo do tempo.
 *
 *      A lógica geral é:
 *      1. o fornecedor deposita tokens em staking
 *      2. o contrato registra o saldo depositado e o instante do último marco
 *      3. a recompensa é calculada em função do valor em stake, do tempo
 *         decorrido e de uma taxa base
 *      4. o OracleAdapter pode ser consultado para permitir ajuste futuro
 *         da taxa de recompensa com base em dado externo
 *      5. o fornecedor pode sacar recompensa e retirar stake
 *
 *      Esta versão revisada acrescenta:
 *      - validação contra endereço zero no construtor
 *      - validação contra endereço zero em setOracle
 *      - verificação explícita de saldo do contrato antes de pagar reward
 *      - verificação explícita de saldo do contrato antes de devolver unstake
 *      - eventos de bloqueio para rastreabilidade operacional
 *      - proteção contra reentrância nas funções sensíveis
 *      - aplicação mais clara do padrão checks-effects-interactions em stake
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @dev Interface mínima esperada do OracleAdapter.
 */
interface IOracleAdapter {
    /**
     * @notice Retorna o preço mais recente e a quantidade de casas decimais.
     *
     * @return price Valor retornado pelo feed
     * @return decimals Quantidade de casas decimais do feed
     */
    function getLatestPrice()
        external
        view
        returns (int256 price, uint8 decimals);
}

contract SupplierStaking is Ownable, ReentrancyGuard {
    /**
     * @dev Referência ao token ERC-20 do protocolo.
     */
    IERC20 public immutable token;

    /**
     * @dev Referência ao contrato OracleAdapter.
     */
    IOracleAdapter public oracleAdapter;

    /**
     * @dev Endereço da governança autorizada a alterar parâmetros do contrato,
     *      além do owner.
     */
    address public governance;

    /**
     * @dev Taxa base de recompensa.
     */
    uint256 public baseRewardRate;

    /**
     * @dev Mapeia cada fornecedor ao saldo atualmente depositado em staking.
     */
    mapping(address => uint256) public stakedBalance;

    /**
     * @dev Mapeia cada fornecedor ao instante da última atualização relevante
     *      para cálculo de recompensa.
     */
    mapping(address => uint256) public lastStakeTimestamp;

    /**
     * @dev Evento emitido quando um fornecedor realiza stake.
     *
     * @param supplier Endereço do fornecedor
     * @param amount Quantidade depositada
     */
    event Staked(address indexed supplier, uint256 amount);

    /**
     * @dev Evento emitido quando um fornecedor retira parte do stake.
     *
     * @param supplier Endereço do fornecedor
     * @param amount Quantidade retirada
     */
    event Unstaked(address indexed supplier, uint256 amount);

    /**
     * @dev Evento emitido quando um fornecedor saca sua recompensa.
     *
     * @param supplier Endereço do fornecedor
     * @param reward Quantidade de recompensa paga
     */
    event RewardClaimed(address indexed supplier, uint256 reward);

    /**
     * @dev Evento emitido quando a taxa base de recompensa é atualizada.
     *
     * @param newRate Novo valor da taxa
     */
    event RewardRateUpdated(uint256 newRate);

    /**
     * @dev Evento emitido quando o endereço da governança é atualizado.
     *
     * @param governanceAddress Novo endereço da governança
     */
    event GovernanceUpdated(address indexed governanceAddress);

    /**
     * @dev Evento emitido quando o endereço do oráculo é atualizado.
     *
     * @param oracleAddress Novo endereço do OracleAdapter
     */
    event OracleUpdated(address indexed oracleAddress);

    /**
     * @dev Evento emitido quando um claim de recompensa é bloqueado
     *      por falta de saldo suficiente no contrato.
     *
     * @param supplier Endereço do fornecedor
     * @param requestedReward Recompensa solicitada
     * @param availableBalance Saldo disponível no contrato
     * @param reason Motivo textual do bloqueio
     */
    event RewardClaimBlocked(
        address indexed supplier,
        uint256 requestedReward,
        uint256 availableBalance,
        string reason
    );

    /**
     * @dev Evento emitido quando um unstake é bloqueado
     *      por falta de saldo suficiente no contrato.
     *
     * @param supplier Endereço do fornecedor
     * @param requestedAmount Quantidade solicitada para unstake
     * @param availableBalance Saldo disponível no contrato
     * @param reason Motivo textual do bloqueio
     */
    event UnstakeBlocked(
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
     * @param oracleAddress Endereço do OracleAdapter
     */
    constructor(
        address initialOwner,
        address tokenAddress,
        address oracleAddress
    ) Ownable(initialOwner) {
        require(tokenAddress != address(0), "Invalid token");
        require(oracleAddress != address(0), "Invalid oracle");

        token = IERC20(tokenAddress);
        oracleAdapter = IOracleAdapter(oracleAddress);
        baseRewardRate = 1e16;
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
     * @notice Atualiza o endereço do OracleAdapter.
     *
     * @dev Apenas o owner pode executar esta função.
     *
     * @param oracleAddress Novo endereço do OracleAdapter
     */
    function setOracle(address oracleAddress) external onlyOwner {
        require(oracleAddress != address(0), "Invalid oracle");

        oracleAdapter = IOracleAdapter(oracleAddress);

        emit OracleUpdated(oracleAddress);
    }

    /**
     * @notice Atualiza a taxa base de recompensa.
     *
     * @dev Apenas o owner ou a governança podem executar esta função.
     *
     * @param newRate Novo valor da taxa base
     */
    function setBaseRewardRate(
        uint256 newRate
    ) external onlyGovernanceOrOwner {
        baseRewardRate = newRate;

        emit RewardRateUpdated(newRate);
    }

    /**
     * @notice Permite ao fornecedor depositar tokens em staking.
     *
     * @dev O fornecedor deve primeiro autorizar este contrato a movimentar
     *      seus tokens por meio da função approve do ERC-20.
     *
     *      A função usa nonReentrant e segue o padrão:
     *      1. valida a entrada
     *      2. atualiza o estado interno
     *      3. executa a chamada externa transferFrom
     *
     *      Caso a transferência falhe, toda a transação é revertida,
     *      inclusive a atualização feita em stakedBalance.
     *
     * @param amount Quantidade de tokens a depositar em staking
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");

        stakedBalance[msg.sender] += amount;
        lastStakeTimestamp[msg.sender] = block.timestamp;

        bool success = token.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Permite ao fornecedor retirar parte do saldo em staking.
     *
     * @dev Além de verificar o saldo lógico em stake, a função verifica
     *      explicitamente se o contrato possui saldo real de token suficiente
     *      para devolver o valor solicitado.
     *
     * @param amount Quantidade a retirar do staking
     */
    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");
        require(stakedBalance[msg.sender] >= amount, "Insufficient stake");

        uint256 available = token.balanceOf(address(this));

        if (available < amount) {
            emit UnstakeBlocked(
                msg.sender,
                amount,
                available,
                "Insufficient contract balance"
            );
            revert("Insufficient contract balance");
        }

        stakedBalance[msg.sender] -= amount;

        bool success = token.transfer(msg.sender, amount);
        require(success, "Transfer failed");

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Permite ao fornecedor sacar a recompensa acumulada.
     *
     * @dev Antes do pagamento, a função verifica explicitamente se o contrato
     *      possui saldo real de token suficiente para a recompensa calculada.
     */
    function claimReward() external nonReentrant {
        uint256 reward = pendingReward(msg.sender);
        require(reward > 0, "No reward");

        uint256 available = token.balanceOf(address(this));

        if (available < reward) {
            emit RewardClaimBlocked(
                msg.sender,
                reward,
                available,
                "Insufficient reward reserve"
            );
            revert("Insufficient reward reserve");
        }

        lastStakeTimestamp[msg.sender] = block.timestamp;

        bool success = token.transfer(msg.sender, reward);
        require(success, "Transfer failed");

        emit RewardClaimed(msg.sender, reward);
    }

    /**
     * @notice Calcula a recompensa pendente de um fornecedor.
     *
     * @param supplier Endereço do fornecedor
     * @return Quantidade estimada de recompensa pendente
     */
    function pendingReward(address supplier) public view returns (uint256) {
        uint256 balance = stakedBalance[supplier];

        if (balance == 0) {
            return 0;
        }

        uint256 elapsed = block.timestamp - lastStakeTimestamp[supplier];
        uint256 adjustedRate = _getAdjustedRewardRate();

        return (balance * adjustedRate * elapsed) / 1e18;
    }

    /**
     * @notice Retorna a taxa efetivamente usada no cálculo da recompensa.
     *
     * @dev Nesta versão do MVP, o preço do oráculo é consultado para
     *      demonstrar a integração com dado externo, mas a taxa efetiva
     *      permanece igual à baseRewardRate.
     *
     * @return Taxa ajustada de recompensa
     */
    function _getAdjustedRewardRate() internal view returns (uint256) {
        (int256 price, uint8 feedDecimals) = oracleAdapter.getLatestPrice();

        if (price <= 0 || feedDecimals == 0) {
            return baseRewardRate;
        }

        return baseRewardRate;
    }
}