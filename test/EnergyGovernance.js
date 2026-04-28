const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("EnergyGovernance", function () {
  let owner;
  let voter1;
  let voter2;
  let voterWithoutTokens;
  let other;

  let energyToken;
  let supplierCollateral;
  let mockPriceFeed;
  let oracleAdapter;
  let supplierStaking;
  let energyGovernance;

  const INITIAL_MINIMUM_COLLATERAL = ethers.parseUnits("1000", 18);
  const UPDATED_MINIMUM_COLLATERAL = ethers.parseUnits("2000", 18);

  const MOCK_PRICE = 200000000000n;
  const MOCK_DECIMALS = 8;

  const VOTING_PERIOD = 3600;

  async function increaseTime(seconds) {
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine");
  }

  async function deployFixture() {
    [owner, voter1, voter2, voterWithoutTokens, other] =
      await ethers.getSigners();

    const EnergyToken = await ethers.getContractFactory("EnergyToken");
    energyToken = await EnergyToken.deploy(owner.address);
    await energyToken.waitForDeployment();

    const SupplierCollateral = await ethers.getContractFactory(
      "SupplierCollateral"
    );

    supplierCollateral = await SupplierCollateral.deploy(
      owner.address,
      await energyToken.getAddress(),
      INITIAL_MINIMUM_COLLATERAL
    );
    await supplierCollateral.waitForDeployment();

    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    mockPriceFeed = await MockPriceFeed.deploy(MOCK_PRICE, MOCK_DECIMALS);
    await mockPriceFeed.waitForDeployment();

    const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
    oracleAdapter = await OracleAdapter.deploy(
      owner.address,
      await mockPriceFeed.getAddress()
    );
    await oracleAdapter.waitForDeployment();

    const SupplierStaking = await ethers.getContractFactory("SupplierStaking");
    supplierStaking = await SupplierStaking.deploy(
      owner.address,
      await energyToken.getAddress(),
      await oracleAdapter.getAddress()
    );
    await supplierStaking.waitForDeployment();

    const EnergyGovernance = await ethers.getContractFactory(
      "EnergyGovernance"
    );

    energyGovernance = await EnergyGovernance.deploy(
      owner.address,
      await energyToken.getAddress(),
      await supplierCollateral.getAddress(),
      await supplierStaking.getAddress(),
      VOTING_PERIOD
    );
    await energyGovernance.waitForDeployment();

    await supplierCollateral.setGovernance(
      await energyGovernance.getAddress()
    );

    await supplierStaking.setGovernance(await energyGovernance.getAddress());

    await energyToken.mint(voter1.address, ethers.parseUnits("100", 18));
    await energyToken.mint(voter2.address, ethers.parseUnits("50", 18));

    return {
      owner,
      voter1,
      voter2,
      voterWithoutTokens,
      other,
      energyToken,
      supplierCollateral,
      mockPriceFeed,
      oracleAdapter,
      supplierStaking,
      energyGovernance,
    };
  }

  async function createProposalMinimumCollateral() {
    const tx = await energyGovernance
      .connect(voter1)
      .createProposal(
        0,
        UPDATED_MINIMUM_COLLATERAL,
        "Atualizar caução mínima"
      );

    await tx.wait();

    return 1;
  }

  async function createProposalRewardRate(newRate) {
    const tx = await energyGovernance
      .connect(voter1)
      .createProposal(
        1,
        newRate,
        "Atualizar taxa base de recompensa"
      );

    await tx.wait();

    return 1;
  }

  beforeEach(async function () {
    await deployFixture();
  });

  it("deve definir corretamente o owner inicial", async function () {
    expect(await energyGovernance.owner()).to.equal(owner.address);
  });

  it("deve definir corretamente o token de governança", async function () {
    expect(await energyGovernance.governanceToken()).to.equal(
      await energyToken.getAddress()
    );
  });

  it("deve definir corretamente o contrato de caução", async function () {
    expect(await energyGovernance.collateral()).to.equal(
      await supplierCollateral.getAddress()
    );
  });

  it("deve definir corretamente o contrato de staking", async function () {
    expect(await energyGovernance.staking()).to.equal(
      await supplierStaking.getAddress()
    );
  });

  it("deve definir corretamente o período de votação", async function () {
    expect(await energyGovernance.votingPeriod()).to.equal(VOTING_PERIOD);
  });

  it("deve permitir criação de proposta por endereço com poder de voto", async function () {
    await expect(
      energyGovernance
        .connect(voter1)
        .createProposal(
          0,
          UPDATED_MINIMUM_COLLATERAL,
          "Atualizar caução mínima"
        )
    ).to.emit(energyGovernance, "ProposalCreated");

    expect(await energyGovernance.nextProposalId()).to.equal(1);

    const proposal = await energyGovernance.getProposal(1);

    expect(proposal.id).to.equal(1);
    expect(proposal.proposalType).to.equal(0);
    expect(proposal.newValue).to.equal(UPDATED_MINIMUM_COLLATERAL);
    expect(proposal.description).to.equal("Atualizar caução mínima");
    expect(proposal.votesFor).to.equal(0);
    expect(proposal.votesAgainst).to.equal(0);
    expect(proposal.closed).to.equal(false);
    expect(proposal.executed).to.equal(false);
  });

  it("não deve permitir criação de proposta por endereço sem poder de voto", async function () {
    await expect(
      energyGovernance
        .connect(voterWithoutTokens)
        .createProposal(
          0,
          UPDATED_MINIMUM_COLLATERAL,
          "Atualizar caução mínima"
        )
    ).to.be.revertedWith("No voting power");
  });

  it("não deve permitir criação de proposta com descrição vazia", async function () {
    await expect(
      energyGovernance
        .connect(voter1)
        .createProposal(0, UPDATED_MINIMUM_COLLATERAL, "")
    ).to.be.revertedWith("Empty description");
  });

  it("deve contabilizar corretamente votos favoráveis e contrários", async function () {
    await createProposalMinimumCollateral();

    await expect(energyGovernance.connect(voter1).vote(1, true)).to.emit(
      energyGovernance,
      "Voted"
    );

    await expect(energyGovernance.connect(voter2).vote(1, false)).to.emit(
      energyGovernance,
      "Voted"
    );

    const proposal = await energyGovernance.getProposal(1);

    expect(proposal.votesFor).to.equal(ethers.parseUnits("100", 18));
    expect(proposal.votesAgainst).to.equal(ethers.parseUnits("50", 18));
  });

  it("não deve permitir voto duplicado", async function () {
    await createProposalMinimumCollateral();

    await energyGovernance.connect(voter1).vote(1, true);

    await expect(
      energyGovernance.connect(voter1).vote(1, true)
    ).to.be.revertedWith("Already voted");
  });

  it("não deve permitir voto em proposta inexistente", async function () {
    await expect(
      energyGovernance.connect(voter1).vote(999, true)
    ).to.be.revertedWith("Proposal does not exist");
  });

  it("não deve permitir voto de endereço sem poder de voto", async function () {
    await createProposalMinimumCollateral();

    await expect(
      energyGovernance.connect(voterWithoutTokens).vote(1, true)
    ).to.be.revertedWith("No voting power");
  });

  it("não deve permitir votação após o encerramento do prazo", async function () {
    await createProposalMinimumCollateral();

    await increaseTime(VOTING_PERIOD + 1);

    await expect(
      energyGovernance.connect(voter1).vote(1, true)
    ).to.be.revertedWith("Voting period ended");
  });

  it("não deve permitir encerrar votação antes do fim do prazo", async function () {
    await createProposalMinimumCollateral();

    await expect(
      energyGovernance.closeProposal(1)
    ).to.be.revertedWith("Voting still open");
  });

  it("deve permitir encerrar votação após o fim do prazo", async function () {
    await createProposalMinimumCollateral();

    await energyGovernance.connect(voter1).vote(1, true);

    await increaseTime(VOTING_PERIOD + 1);

    await expect(energyGovernance.closeProposal(1)).to.emit(
      energyGovernance,
      "ProposalClosed"
    );

    const proposal = await energyGovernance.getProposal(1);
    expect(proposal.closed).to.equal(true);
  });

  it("não deve permitir encerrar votação duplicadamente", async function () {
    await createProposalMinimumCollateral();

    await energyGovernance.connect(voter1).vote(1, true);

    await increaseTime(VOTING_PERIOD + 1);

    await energyGovernance.closeProposal(1);

    await expect(
      energyGovernance.closeProposal(1)
    ).to.be.revertedWith("Proposal already closed");
  });

  it("deve permitir execução de proposta aprovada para atualizar caução mínima", async function () {
    await createProposalMinimumCollateral();

    await energyGovernance.connect(voter1).vote(1, true);

    await increaseTime(VOTING_PERIOD + 1);

    await energyGovernance.closeProposal(1);

    await expect(energyGovernance.executeProposal(1)).to.emit(
      energyGovernance,
      "ProposalExecuted"
    );

    expect(await supplierCollateral.minimumCollateral()).to.equal(
      UPDATED_MINIMUM_COLLATERAL
    );

    const proposal = await energyGovernance.getProposal(1);
    expect(proposal.executed).to.equal(true);
  });

  it("deve permitir execução de proposta aprovada para atualizar reward rate", async function () {
    const newRewardRate = 200;

    await createProposalRewardRate(newRewardRate);

    await energyGovernance.connect(voter1).vote(1, true);

    await increaseTime(VOTING_PERIOD + 1);

    await energyGovernance.closeProposal(1);

    await expect(energyGovernance.executeProposal(1)).to.emit(
      energyGovernance,
      "ProposalExecuted"
    );

    expect(await supplierStaking.baseRewardRate()).to.equal(newRewardRate);

    const proposal = await energyGovernance.getProposal(1);
    expect(proposal.executed).to.equal(true);
  });

  it("não deve permitir execução antes do encerramento formal da votação", async function () {
    await createProposalMinimumCollateral();

    await energyGovernance.connect(voter1).vote(1, true);

    await expect(
      energyGovernance.executeProposal(1)
    ).to.be.revertedWith("Proposal not closed");
  });

  it("não deve permitir execução após fim do prazo, mas antes de closeProposal", async function () {
    await createProposalMinimumCollateral();

    await energyGovernance.connect(voter1).vote(1, true);

    await increaseTime(VOTING_PERIOD + 1);

    await expect(
      energyGovernance.executeProposal(1)
    ).to.be.revertedWith("Proposal not closed");
  });

  it("não deve permitir execução de proposta rejeitada", async function () {
    await createProposalMinimumCollateral();

    await energyGovernance.connect(voter1).vote(1, false);

    await increaseTime(VOTING_PERIOD + 1);

    await energyGovernance.closeProposal(1);

    await expect(
      energyGovernance.executeProposal(1)
    ).to.be.revertedWith("Proposal rejected");
  });

  it("não deve permitir execução duplicada da mesma proposta", async function () {
    await createProposalMinimumCollateral();

    await energyGovernance.connect(voter1).vote(1, true);

    await increaseTime(VOTING_PERIOD + 1);

    await energyGovernance.closeProposal(1);

    await energyGovernance.executeProposal(1);

    await expect(
      energyGovernance.executeProposal(1)
    ).to.be.revertedWith("Already executed");
  });

  it("não deve permitir execução de proposta inexistente", async function () {
    await expect(
      energyGovernance.executeProposal(999)
    ).to.be.revertedWith("Proposal does not exist");
  });

  it("deve retornar status VotingOpen enquanto a votação estiver aberta", async function () {
    await createProposalMinimumCollateral();

    const proposalStatus = await energyGovernance.getProposalStatus(1);

    expect(proposalStatus).to.equal(1);
  });

  it("deve retornar status WaitingClosure após o fim do prazo e antes do fechamento", async function () {
    await createProposalMinimumCollateral();

    await increaseTime(VOTING_PERIOD + 1);

    const proposalStatus = await energyGovernance.getProposalStatus(1);

    expect(proposalStatus).to.equal(2);
  });

  it("deve retornar status ClosedApproved após encerramento de proposta aprovada", async function () {
    await createProposalMinimumCollateral();

    await energyGovernance.connect(voter1).vote(1, true);

    await increaseTime(VOTING_PERIOD + 1);

    await energyGovernance.closeProposal(1);

    const proposalStatus = await energyGovernance.getProposalStatus(1);

    expect(proposalStatus).to.equal(3);
  });

  it("deve retornar status ClosedRejected após encerramento de proposta rejeitada", async function () {
    await createProposalMinimumCollateral();

    await energyGovernance.connect(voter1).vote(1, false);

    await increaseTime(VOTING_PERIOD + 1);

    await energyGovernance.closeProposal(1);

    const proposalStatus = await energyGovernance.getProposalStatus(1);

    expect(proposalStatus).to.equal(4);
  });

  it("deve retornar status Executed após execução da proposta", async function () {
    await createProposalMinimumCollateral();

    await energyGovernance.connect(voter1).vote(1, true);

    await increaseTime(VOTING_PERIOD + 1);

    await energyGovernance.closeProposal(1);
    await energyGovernance.executeProposal(1);

    const proposalStatus = await energyGovernance.getProposalStatus(1);

    expect(proposalStatus).to.equal(5);
  });

  it("deve retornar status NotFound para proposta inexistente", async function () {
    const proposalStatus = await energyGovernance.getProposalStatus(999);

    expect(proposalStatus).to.equal(0);
  });

  it("deve indicar corretamente se a votação está aberta", async function () {
    await createProposalMinimumCollateral();

    expect(await energyGovernance.isVotingOpen(1)).to.equal(true);

    await increaseTime(VOTING_PERIOD + 1);

    expect(await energyGovernance.isVotingOpen(1)).to.equal(false);
  });

  it("deve indicar corretamente se a proposta pode ser encerrada", async function () {
    await createProposalMinimumCollateral();

    expect(await energyGovernance.canCloseProposal(1)).to.equal(false);

    await increaseTime(VOTING_PERIOD + 1);

    expect(await energyGovernance.canCloseProposal(1)).to.equal(true);
  });

  it("deve indicar corretamente se a proposta pode ser executada", async function () {
    await createProposalMinimumCollateral();

    await energyGovernance.connect(voter1).vote(1, true);

    expect(await energyGovernance.canExecuteProposal(1)).to.equal(false);

    await increaseTime(VOTING_PERIOD + 1);

    await energyGovernance.closeProposal(1);

    expect(await energyGovernance.canExecuteProposal(1)).to.equal(true);
  });

  it("o owner deve conseguir atualizar o período de votação", async function () {
    const newVotingPeriod = 120;

    await expect(
      energyGovernance.connect(owner).setVotingPeriod(newVotingPeriod)
    ).to.emit(energyGovernance, "VotingPeriodUpdated");

    expect(await energyGovernance.votingPeriod()).to.equal(newVotingPeriod);
  });

  it("um endereço não autorizado não deve conseguir atualizar o período de votação", async function () {
    await expect(
      energyGovernance.connect(other).setVotingPeriod(120)
    ).to.be.reverted;
  });

  it("não deve permitir definir período de votação igual a zero", async function () {
    await expect(
      energyGovernance.connect(owner).setVotingPeriod(0)
    ).to.be.revertedWith("Invalid voting period");
  });
});