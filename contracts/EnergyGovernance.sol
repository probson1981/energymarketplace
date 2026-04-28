// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EnergyGovernance
 * @author Patrício Alves
 * @notice Este contrato implementa a governança simples do protocolo
 *         de marketplace de ofertas de fornecimento de energia.
 *
 * @dev O objetivo deste contrato é permitir que participantes com poder
 *      de voto proponham e decidam alterações em parâmetros relevantes
 *      do sistema.
 *
 *      Nesta versão do MVP, a governança consegue atuar sobre:
 *      1. valor mínimo global de caução exigido dos fornecedores
 *      2. taxa base de recompensa do staking
 *
 *      Observação importante:
 *      - A governança não altera a caução individual de cada fornecedor.
 *      - A governança altera o valor mínimo global de referência.
 *      - Cada fornecedor permanece com seu saldo individual depositado.
 *      - O status operacional do fornecedor deve ser recalculado comparando:
 *
 *        collateralBalance[fornecedor] >= minimumCollateral
 *
 *      A lógica geral é:
 *      1. um participante com poder de voto cria uma proposta
 *      2. os participantes votam até o prazo final
 *      3. após o prazo, a proposta pode ser encerrada
 *      4. se os votos favoráveis superarem os contrários,
 *         a proposta pode ser executada
 *
 *      O contrato herda Ownable para permitir administração residual.
 *      O contrato também usa ReentrancyGuard na execução da proposta,
 *      pois essa função chama contratos externos do protocolo.
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @dev Interface mínima esperada do contrato SupplierCollateral.
 */
interface ISupplierCollateralGoverned {
    /**
     * @notice Atualiza o valor mínimo global de caução exigido.
     *
     * @param newAmount Novo valor mínimo global
     */
    function setMinimumCollateral(uint256 newAmount) external;
}

/**
 * @dev Interface mínima esperada do contrato SupplierStaking.
 */
interface ISupplierStakingGoverned {
    /**
     * @notice Atualiza a taxa base de recompensa do staking.
     *
     * @param newRate Nova taxa base de recompensa
     */
    function setBaseRewardRate(uint256 newRate) external;
}

contract EnergyGovernance is Ownable, ReentrancyGuard {
    /**
     * @notice Enumeração dos tipos de proposta suportados nesta versão.
     *
     * @dev Cada proposta, ao ser executada, afetará um parâmetro específico
     *      de um contrato do protocolo.
     *
     *      UpdateMinimumCollateral = altera a caução mínima global.
     *      UpdateRewardRate = altera a taxa base de recompensa do staking.
     */
    enum ProposalType {
        UpdateMinimumCollateral,
        UpdateRewardRate
    }

    /**
     * @notice Enumeração auxiliar para facilitar a leitura do estado
     *         da proposta pelo frontend.
     */
    enum ProposalStatus {
        NotFound,
        VotingOpen,
        WaitingClosure,
        ClosedApproved,
        ClosedRejected,
        Executed
    }

    /**
     * @notice Estrutura que representa uma proposta de governança.
     *
     * @param id Identificador da proposta
     * @param proposalType Tipo da proposta
     * @param newValue Novo valor que será aplicado se aprovada
     * @param description Texto descritivo da proposta
     * @param deadline Timestamp final da votação
     * @param votesFor Soma ponderada dos votos favoráveis
     * @param votesAgainst Soma ponderada dos votos contrários
     * @param closed Indica se a votação da proposta já foi encerrada
     * @param executed Indica se a proposta já foi executada
     */
    struct Proposal {
        uint256 id;
        ProposalType proposalType;
        uint256 newValue;
        string description;
        uint256 deadline;
        uint256 votesFor;
        uint256 votesAgainst;
        bool closed;
        bool executed;
    }

    /**
     * @dev Token usado para medir o poder de voto.
     *
     *      Nesta versão, o peso do voto é dado pelo saldo de tokens ERC-20
     *      mantido pelo votante no momento da votação.
     */
    IERC20 public immutable governanceToken;

    /**
     * @dev Referência ao contrato de caução governado.
     */
    ISupplierCollateralGoverned public immutable collateral;

    /**
     * @dev Referência ao contrato de staking governado.
     */
    ISupplierStakingGoverned public immutable staking;

    /**
     * @dev Contador incremental do próximo identificador de proposta.
     */
    uint256 public nextProposalId;

    /**
     * @dev Duração padrão do período de votação, em segundos.
     */
    uint256 public votingPeriod;

    /**
     * @dev Mapeia proposalId para os dados completos da proposta.
     */
    mapping(uint256 => Proposal) public proposals;

    /**
     * @dev Mapeia proposalId e votante para informar se aquele endereço
     *      já votou na respectiva proposta.
     */
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /**
     * @dev Evento emitido quando uma proposta é criada.
     *
     * @param proposalId Identificador da proposta
     * @param proposalType Tipo da proposta
     * @param newValue Novo valor pretendido
     * @param deadline Prazo final da votação
     */
    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalType proposalType,
        uint256 newValue,
        uint256 deadline
    );

    /**
     * @dev Evento emitido quando um voto é registrado.
     *
     * @param proposalId Identificador da proposta
     * @param voter Endereço do votante
     * @param support Indica se o voto foi favorável ou contrário
     * @param weight Peso do voto
     */
    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );

    /**
     * @dev Evento emitido quando a votação de uma proposta é encerrada.
     *
     * @param proposalId Identificador da proposta
     * @param approved Indica se a proposta foi aprovada pela votação
     * @param votesFor Total de votos favoráveis
     * @param votesAgainst Total de votos contrários
     */
    event ProposalClosed(
        uint256 indexed proposalId,
        bool approved,
        uint256 votesFor,
        uint256 votesAgainst
    );

    /**
     * @dev Evento emitido quando uma proposta é executada.
     *
     * @param proposalId Identificador da proposta
     * @param proposalType Tipo da proposta executada
     * @param newValue Valor aplicado pela proposta
     */
    event ProposalExecuted(
        uint256 indexed proposalId,
        ProposalType proposalType,
        uint256 newValue
    );

    /**
     * @dev Evento específico emitido quando a caução mínima global
     *      é alterada por proposta de governança.
     *
     * @param proposalId Identificador da proposta executada
     * @param newMinimumCollateral Novo valor mínimo global de caução
     */
    event MinimumCollateralChangeApplied(
        uint256 indexed proposalId,
        uint256 newMinimumCollateral
    );

    /**
     * @dev Evento específico emitido quando a taxa base de recompensa
     *      é alterada por proposta de governança.
     *
     * @param proposalId Identificador da proposta executada
     * @param newRewardRate Nova taxa base de recompensa
     */
    event RewardRateChangeApplied(
        uint256 indexed proposalId,
        uint256 newRewardRate
    );

    /**
     * @dev Evento emitido quando o período de votação é atualizado.
     *
     * @param oldVotingPeriod Período anterior
     * @param newVotingPeriod Novo período
     */
    event VotingPeriodUpdated(
        uint256 oldVotingPeriod,
        uint256 newVotingPeriod
    );

    /**
     * @notice Construtor do contrato.
     *
     * @param initialOwner Endereço do owner inicial
     * @param tokenAddress Endereço do token ERC-20 usado para governança
     * @param collateralAddress Endereço do SupplierCollateral
     * @param stakingAddress Endereço do SupplierStaking
     * @param initialVotingPeriod Duração inicial da votação, em segundos
     */
    constructor(
        address initialOwner,
        address tokenAddress,
        address collateralAddress,
        address stakingAddress,
        uint256 initialVotingPeriod
    ) Ownable(initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        require(tokenAddress != address(0), "Invalid token");
        require(collateralAddress != address(0), "Invalid collateral");
        require(stakingAddress != address(0), "Invalid staking");
        require(initialVotingPeriod > 0, "Invalid voting period");

        governanceToken = IERC20(tokenAddress);
        collateral = ISupplierCollateralGoverned(collateralAddress);
        staking = ISupplierStakingGoverned(stakingAddress);
        votingPeriod = initialVotingPeriod;
    }

    /**
     * @notice Cria uma nova proposta de governança.
     *
     * @dev Apenas participantes com saldo positivo de token podem criar propostas.
     *
     *      Para reduzir erro no frontend, recomenda-se usar as funções
     *      específicas:
     *      - createMinimumCollateralProposal(...)
     *      - createRewardRateProposal(...)
     *
     * @param proposalType Tipo da proposta
     * @param newValue Novo valor que se deseja aplicar
     * @param description Texto descritivo da proposta
     *
     * @return proposalId Identificador da proposta criada
     */
    function createProposal(
        ProposalType proposalType,
        uint256 newValue,
        string calldata description
    ) public returns (uint256 proposalId) {
        require(governanceToken.balanceOf(msg.sender) > 0, "No voting power");
        require(newValue > 0, "Invalid new value");
        require(bytes(description).length > 0, "Empty description");

        proposalId = ++nextProposalId;

        uint256 deadline = block.timestamp + votingPeriod;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposalType: proposalType,
            newValue: newValue,
            description: description,
            deadline: deadline,
            votesFor: 0,
            votesAgainst: 0,
            closed: false,
            executed: false
        });

        emit ProposalCreated(
            proposalId,
            proposalType,
            newValue,
            deadline
        );
    }

    /**
     * @notice Cria proposta específica para alterar a caução mínima global.
     *
     * @dev Esta função evita erro no frontend com o número do proposalType.
     *
     *      Atenção: o valor deve ser enviado em unidades do token ERC-20,
     *      considerando 18 casas decimais.
     *
     *      Exemplo:
     *      50 EnergyToken = 50000000000000000000
     *
     * @param newMinimumCollateral Novo valor mínimo global de caução
     * @param description Texto descritivo da proposta
     *
     * @return proposalId Identificador da proposta criada
     */
    function createMinimumCollateralProposal(
        uint256 newMinimumCollateral,
        string calldata description
    ) external returns (uint256 proposalId) {
        return createProposal(
            ProposalType.UpdateMinimumCollateral,
            newMinimumCollateral,
            description
        );
    }

    /**
     * @notice Cria proposta específica para alterar a taxa base de recompensa.
     *
     * @dev Esta função evita erro no frontend com o número do proposalType.
     *
     * @param newRewardRate Nova taxa base de recompensa
     * @param description Texto descritivo da proposta
     *
     * @return proposalId Identificador da proposta criada
     */
    function createRewardRateProposal(
        uint256 newRewardRate,
        string calldata description
    ) external returns (uint256 proposalId) {
        return createProposal(
            ProposalType.UpdateRewardRate,
            newRewardRate,
            description
        );
    }

    /**
     * @notice Permite votar em uma proposta ainda aberta.
     *
     * @dev O voto é ponderado pelo saldo de tokens do votante no momento
     *      da votação.
     *
     *      Cada endereço só pode votar uma vez em cada proposta.
     *
     * @param proposalId Identificador da proposta
     * @param support true para voto favorável; false para contrário
     */
    function vote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.id != 0, "Proposal does not exist");
        require(!proposal.closed, "Proposal closed");
        require(block.timestamp <= proposal.deadline, "Voting period ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        uint256 weight = governanceToken.balanceOf(msg.sender);
        require(weight > 0, "No voting power");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            proposal.votesFor += weight;
        } else {
            proposal.votesAgainst += weight;
        }

        emit Voted(proposalId, msg.sender, support, weight);
    }

    /**
     * @notice Encerra uma proposta após o fim do prazo de votação.
     *
     * @dev A proposta só pode ser encerrada se:
     *      1. ela existir
     *      2. o prazo de votação já tiver terminado
     *      3. ela ainda não tiver sido encerrada
     *      4. ela ainda não tiver sido executada
     *
     * @param proposalId Identificador da proposta
     */
    function closeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.id != 0, "Proposal does not exist");
        require(block.timestamp > proposal.deadline, "Voting still open");
        require(!proposal.closed, "Proposal already closed");
        require(!proposal.executed, "Already executed");

        proposal.closed = true;

        bool approved = proposal.votesFor > proposal.votesAgainst;

        emit ProposalClosed(
            proposalId,
            approved,
            proposal.votesFor,
            proposal.votesAgainst
        );
    }

    /**
     * @notice Executa uma proposta aprovada após o encerramento da votação.
     *
     * @dev A proposta só pode ser executada se:
     *      1. ela existir
     *      2. a votação já tiver sido encerrada
     *      3. ela ainda não tiver sido executada
     *      4. os votos favoráveis forem maiores que os contrários
     *
     *      A marcação como executada ocorre antes das chamadas externas,
     *      reduzindo risco de reentrância.
     *
     * @param proposalId Identificador da proposta
     */
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.id != 0, "Proposal does not exist");
        require(proposal.closed, "Proposal not closed");
        require(!proposal.executed, "Already executed");
        require(proposal.votesFor > proposal.votesAgainst, "Proposal rejected");

        proposal.executed = true;

        if (proposal.proposalType == ProposalType.UpdateMinimumCollateral) {
            collateral.setMinimumCollateral(proposal.newValue);

            emit MinimumCollateralChangeApplied(
                proposalId,
                proposal.newValue
            );
        } else if (proposal.proposalType == ProposalType.UpdateRewardRate) {
            staking.setBaseRewardRate(proposal.newValue);

            emit RewardRateChangeApplied(
                proposalId,
                proposal.newValue
            );
        } else {
            revert("Invalid proposal type");
        }

        emit ProposalExecuted(
            proposalId,
            proposal.proposalType,
            proposal.newValue
        );
    }

    /**
     * @notice Atualiza o período de votação para novas propostas.
     *
     * @dev Não altera o prazo de propostas já criadas.
     *
     * @param newVotingPeriod Novo período de votação, em segundos
     */
    function setVotingPeriod(uint256 newVotingPeriod) external onlyOwner {
        require(newVotingPeriod > 0, "Invalid voting period");

        uint256 oldVotingPeriod = votingPeriod;
        votingPeriod = newVotingPeriod;

        emit VotingPeriodUpdated(oldVotingPeriod, newVotingPeriod);
    }

    /**
     * @notice Retorna os dados completos de uma proposta.
     *
     * @param proposalId Identificador da proposta
     * @return Estrutura Proposal com os dados da proposta
     */
    function getProposal(
        uint256 proposalId
    ) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    /**
     * @notice Retorna a quantidade total de propostas criadas.
     *
     * @return Quantidade de propostas criadas
     */
    function getProposalCount() external view returns (uint256) {
        return nextProposalId;
    }

    /**
     * @notice Retorna o estado atual de uma proposta.
     *
     * @param proposalId Identificador da proposta
     * @return Estado atual da proposta
     */
    function getProposalStatus(
        uint256 proposalId
    ) public view returns (ProposalStatus) {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.id == 0) {
            return ProposalStatus.NotFound;
        }

        if (proposal.executed) {
            return ProposalStatus.Executed;
        }

        if (!proposal.closed && block.timestamp <= proposal.deadline) {
            return ProposalStatus.VotingOpen;
        }

        if (!proposal.closed && block.timestamp > proposal.deadline) {
            return ProposalStatus.WaitingClosure;
        }

        if (proposal.closed && proposal.votesFor > proposal.votesAgainst) {
            return ProposalStatus.ClosedApproved;
        }

        return ProposalStatus.ClosedRejected;
    }

    /**
     * @notice Indica se uma proposta ainda está aberta para votação.
     *
     * @param proposalId Identificador da proposta
     * @return true se a proposta estiver aberta para votação
     */
    function isVotingOpen(uint256 proposalId) external view returns (bool) {
        return getProposalStatus(proposalId) == ProposalStatus.VotingOpen;
    }

    /**
     * @notice Indica se uma proposta já pode ser encerrada.
     *
     * @param proposalId Identificador da proposta
     * @return true se a proposta puder ser encerrada
     */
    function canCloseProposal(
        uint256 proposalId
    ) external view returns (bool) {
        return getProposalStatus(proposalId) == ProposalStatus.WaitingClosure;
    }

    /**
     * @notice Indica se uma proposta já pode ser executada.
     *
     * @param proposalId Identificador da proposta
     * @return true se a proposta puder ser executada
     */
    function canExecuteProposal(
        uint256 proposalId
    ) external view returns (bool) {
        return getProposalStatus(proposalId) == ProposalStatus.ClosedApproved;
    }
}