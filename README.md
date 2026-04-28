# Energia Livre Web3

## 1. Visão geral

Este projeto implementa um protótipo Web3 para um marketplace de ofertas de fornecimento de energia. A aplicação combina contratos inteligentes, frontend Web e carteira MetaMask para permitir o cadastro de consumidores e fornecedores, compra de tokens, depósito de caução, criação e aceitação de ofertas, emissão de NFT de adesão, staking de tokens e governança por votação.

O objetivo do sistema é demonstrar, em ambiente de teste, como regras comerciais podem ser registradas e executadas em blockchain, com rastreabilidade pública das operações por meio do Sepolia Etherscan.

A rede de teste utilizada no deploy atual é a Sepolia.

```text
Rede: Sepolia
Chain ID: 11155111
Deployer: 0x8F992da5D0Eec581145E31635Dc23cfc9e937851
Período de votação da governança: 60 segundos
Price feed externo Chainlink ETH/USD: 0x694AA1769357215DE4FAC081bf1f309aDC325306
```

## 2. Componentes principais

O protocolo é formado por contratos inteligentes com responsabilidades separadas.

| Contrato | Função principal |
|---|---|
| `EnergyToken` | Token ERC-20 usado no sistema para compra, caução, staking e governança. |
| `SupplyAgreementNFT` | NFT ERC-721 emitido ao consumidor quando uma oferta é aceita. |
| `SupplierRegistry` | Cadastro de fornecedores. |
| `ConsumerRegistry` | Cadastro de consumidores. |
| `SupplierCollateral` | Controle da caução mínima exigida dos fornecedores. |
| `OracleAdapter` | Adaptador para leitura de price feed externo compatível com Chainlink. |
| `SupplierStaking` | Módulo de staking dos fornecedores e cálculo de recompensa. |
| `EnergyMarketplace` | Núcleo de negócio das ofertas de energia. |
| `EnergyGovernance` | Governança simples para alteração de parâmetros do protocolo. |
| `MarketplaceTreasury` | Tesouraria para venda de EnergyToken mediante pagamento em ETH. |

## 3. Contratos implantados na Sepolia

Os contratos abaixo correspondem ao último deploy sincronizado no frontend.

| Contrato | Endereço em Sepolia | Link no Sepolia Etherscan |
|---|---|---|
| `EnergyToken` | `0x2502d50e6F8De55479d1D2cB33F55e4e496Cde3d` | https://sepolia.etherscan.io/address/0x2502d50e6F8De55479d1D2cB33F55e4e496Cde3d |
| `SupplyAgreementNFT` | `0x9cD75D2F2cf42d5a8A81993c9B0F0f2C2BA9AD84` | https://sepolia.etherscan.io/address/0x9cD75D2F2cf42d5a8A81993c9B0F0f2C2BA9AD84 |
| `SupplierRegistry` | `0x87F265CE0e08F1E1a7dbFE1A0f0338CC3d88C3c0` | https://sepolia.etherscan.io/address/0x87F265CE0e08F1E1a7dbFE1A0f0338CC3d88C3c0 |
| `ConsumerRegistry` | `0x8DdB5CC32171C526c4D79347D5291471b2903619` | https://sepolia.etherscan.io/address/0x8DdB5CC32171C526c4D79347D5291471b2903619 |
| `SupplierCollateral` | `0xa117f2690281f124ba501011959d60D72D241089` | https://sepolia.etherscan.io/address/0xa117f2690281f124ba501011959d60D72D241089 |
| `OracleAdapter` | `0xFbE5f4C5da2331c76d70f2144A1ad5146a9C0A5A` | https://sepolia.etherscan.io/address/0xFbE5f4C5da2331c76d70f2144A1ad5146a9C0A5A |
| `SupplierStaking` | `0xe8A4670601e7F5d8d6Dd558f45353E655BFB4142` | https://sepolia.etherscan.io/address/0xe8A4670601e7F5d8d6Dd558f45353E655BFB4142 |
| `EnergyMarketplace` | `0x32aEf9A17A8E110bAEAB2BafceA16E6B8a7Fe46C` | https://sepolia.etherscan.io/address/0x32aEf9A17A8E110bAEAB2BafceA16E6B8a7Fe46C |
| `EnergyGovernance` | `0x6dA6Eb5c4617d33A38Bf6E913Ac3745DEC91ED5d` | https://sepolia.etherscan.io/address/0x6dA6Eb5c4617d33A38Bf6E913Ac3745DEC91ED5d |
| `MarketplaceTreasury` | `0x9B41e8F8093Ee70098C3eF9a4314A901D23d10Ba` | https://sepolia.etherscan.io/address/0x9B41e8F8093Ee70098C3eF9a4314A901D23d10Ba |
| `ExternalPriceFeed` | `0x694AA1769357215DE4FAC081bf1f309aDC325306` | https://sepolia.etherscan.io/address/0x694AA1769357215DE4FAC081bf1f309aDC325306 |

## 4. Parâmetros iniciais do deploy

```text
initialMinimumCollateral: 10000000000000000000
initialVotingPeriod: 60
rateio temporal da votação: 60 segundos
tokenPerEth: 10000000000000000000000
initialTreasuryReserve: 1000000000000000000000000
useMockPriceFeed: false
```

Interpretação dos principais parâmetros:

| Parâmetro | Interpretação |
|---|---|
| `initialMinimumCollateral` | Caução mínima inicial de 10 EnergyToken. |
| `initialVotingPeriod` | Período inicial de votação de 60 segundos. |
| `tokenPerEth` | 1 ETH compra 10.000 EnergyToken. |
| `initialTreasuryReserve` | Reserva inicial de 1.000.000 EnergyToken na tesouraria. |
| `useMockPriceFeed` | Valor falso. O deploy usa price feed externo. |

## 5. Configuração inicial após o deploy

Após o deploy, foi executado o script de setup. Ele configurou os vínculos necessários entre os contratos.

| Vínculo configurado | Valor configurado |
|---|---|
| `SupplyAgreementNFT.marketplace` | `0x32aEf9A17A8E110bAEAB2BafceA16E6B8a7Fe46C` |
| `SupplierCollateral.governance` | `0x6dA6Eb5c4617d33A38Bf6E913Ac3745DEC91ED5d` |
| `SupplierStaking.governance` | `0x6dA6Eb5c4617d33A38Bf6E913Ac3745DEC91ED5d` |

Esses vínculos são importantes porque:

- O `SupplyAgreementNFT` só permite mint de NFT pelo marketplace autorizado.
- O `SupplierCollateral` só aceita alteração da caução mínima pelo owner ou pela governança configurada.
- O `SupplierStaking` só aceita alteração da taxa base de recompensa pelo owner ou pela governança configurada.

## 6. Fluxo funcional da aplicação

### 6.1. Compra de EnergyToken

O usuário compra EnergyToken usando ETH por meio do contrato `MarketplaceTreasury`. A tesouraria possui uma reserva inicial de tokens e transfere tokens para o comprador conforme a taxa `tokenPerEth`.

Fluxo:

```text
Usuário envia ETH para MarketplaceTreasury
MarketplaceTreasury calcula a quantidade de EnergyToken
MarketplaceTreasury transfere EnergyToken para o usuário
```

### 6.2. Cadastro de consumidor

O consumidor registra seus dados no `ConsumerRegistry`. Apenas consumidores cadastrados e ativos podem aceitar ofertas no marketplace.

Fluxo:

```text
Consumidor conecta carteira
Consumidor registra seus dados
ConsumerRegistry marca o consumidor como registrado e ativo
```

### 6.3. Cadastro de fornecedor

O fornecedor registra seus dados no `SupplierRegistry`. Para operar, o fornecedor precisa estar ativo e possuir caução mínima suficiente.

Fluxo:

```text
Fornecedor conecta carteira
Fornecedor registra seus dados
SupplierRegistry marca o fornecedor como registrado e ativo
```

### 6.4. Caução do fornecedor

O fornecedor precisa depositar EnergyToken como caução no contrato `SupplierCollateral`. A aptidão operacional do fornecedor é calculada comparando o saldo depositado com o valor global `minimumCollateral`.

Regra:

```text
Fornecedor apto = fornecedor ativo e caução depositada maior ou igual à caução mínima global
```

A governança pode alterar o valor global de caução mínima. Quando isso acontece, a caução individual de cada fornecedor não muda. O que muda é o valor de referência usado para avaliar se o fornecedor continua apto.

Exemplo:

```text
Fornecedor A depositou 80 EnergyToken
Fornecedor B depositou 50 EnergyToken
Nova caução mínima aprovada pela governança: 70 EnergyToken
Fornecedor A continua apto
Fornecedor B fica inapto operacionalmente
```

### 6.5. Criação de oferta

O fornecedor só consegue criar oferta se estiver ativo e possuir caução mínima suficiente.

Fluxo:

```text
Fornecedor cadastrado e ativo
Fornecedor deposita caução suficiente
Fornecedor cria oferta com tarifa, desconto, benefício, validade e limite de consumidores
```

### 6.6. Aceitação de oferta e mint de NFT

O consumidor ativo pode aceitar uma oferta válida. Ao aceitar, o marketplace chama o contrato `SupplyAgreementNFT`, que emite um NFT de adesão para o consumidor.

Fluxo:

```text
Consumidor escolhe oferta
Marketplace valida consumidor, oferta, validade e limite
Marketplace chama SupplyAgreementNFT.mintAgreement
Consumidor recebe NFT de adesão
```

### 6.7. Staking

O fornecedor pode fazer staking de EnergyToken no `SupplierStaking`. A recompensa pendente é calculada em função do saldo em stake, da taxa base e do tempo decorrido.

Observação importante:

A recompensa pendente é um valor calculado. Para o pagamento ocorrer, o contrato `SupplierStaking` precisa ter saldo real de EnergyToken suficiente para pagar a recompensa. Se o contrato não tiver reserva, a função de saque de recompensa pode reverter com:

```text
Insufficient reward reserve
```

### 6.8. Governança

A governança permite criar propostas para alterar parâmetros do protocolo. Nesta versão, os parâmetros governáveis são:

| Tipo de proposta | Efeito |
|---|---|
| Atualizar caução mínima | Altera o valor global `minimumCollateral` em `SupplierCollateral`. |
| Atualizar taxa base de recompensa | Altera `baseRewardRate` em `SupplierStaking`. |

Fluxo da proposta:

```text
Criar proposta
Votar a favor ou contra
Aguardar fim do prazo de votação
Encerrar votação
Executar proposta aprovada
```

A votação é ponderada pelo saldo de EnergyToken do votante no momento do voto.

## 7. Comandos principais

### 7.1. Instalação das dependências

Na raiz do projeto:

```bash
npm install
```

No frontend:

```bash
cd frontend
npm install
```

### 7.2. Compilar contratos

Na raiz do projeto:

```bash
npx hardhat compile
```

### 7.3. Rodar testes

```bash
npx hardhat test
```

### 7.4. Deploy em rede local Hardhat

Em um terminal:

```bash
npx hardhat node
```

Em outro terminal:

```bash
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/setup.js --network localhost
node scripts/sync_frontend_deployments.js localhost
```

### 7.5. Deploy em Sepolia

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
npx hardhat run scripts/setup.js --network sepolia
node scripts/sync_frontend_deployments.js sepolia
```

### 7.6. Rodar frontend

```bash
cd frontend
npm run dev
```

## 8. Arquivo de sincronização do frontend

Após cada deploy, o script abaixo deve ser executado para atualizar o frontend com os endereços mais recentes:

```bash
node scripts/sync_frontend_deployments.js sepolia
```

Esse comando copia os endereços implantados para:

```text
frontend/src/config/deployments.json
```

Se esse arquivo não estiver atualizado, o frontend poderá interagir com contratos antigos.

## 9. Auditoria preliminar

Foram utilizadas duas etapas principais de auditoria preliminar:

1. Testes automatizados com Hardhat.
2. Análise estática com Slither.

Os testes com Hardhat foram usados para validar os fluxos funcionais dos contratos. O Slither foi usado para identificar padrões de risco e pontos de melhoria.

Durante a auditoria, foram tratados achados como:

- ausência de validação contra endereço zero;
- pontos de reentrância;
- retorno ignorado no `OracleAdapter`;
- variáveis que poderiam ser `immutable`;
- melhoria no fluxo da governança com encerramento formal da votação antes da execução.

Permanecem como riscos residuais documentados:

- uso de `block.timestamp` para prazos de votação, validade de oferta, staking e verificação do oráculo;
- uso de chamada de baixo nível com `call` no saque de ETH da tesouraria, mitigado por `onlyOwner`, `nonReentrant`, validações e checagem de sucesso;
- alertas associados a bibliotecas externas da OpenZeppelin, tratados como informacionais;
- necessidade de auditoria profissional independente antes de uso em produção.

A tentativa de instalar o Mythril localmente no Windows apresentou problema operacional com dependências nativas, especialmente `pyethash` e `ckzg`. Por isso, a auditoria foi fechada com Hardhat e Slither.

## 10. Classificação do estado atual

O sistema deve ser classificado como:

```text
MVP funcional com segurança básica adequada para ambiente de teste, com riscos residuais conhecidos e documentados.
```

O sistema não deve ser classificado como pronto para produção sem auditoria profissional independente e sem revisão adicional dos parâmetros econômicos, da reserva de recompensas e das regras de governança.

## 11. Observações importantes

- Os contratos antigos permanecem visíveis no Etherscan, pois o histórico da blockchain não é apagado.
- A aplicação deve sempre usar o conjunto de contratos do deploy mais recente sincronizado no frontend.
- A governança altera parâmetros globais, não os saldos individuais dos usuários.
- A caução individual do fornecedor permanece a mesma após mudança da caução mínima global.
- O status operacional do fornecedor deve ser recalculado dinamicamente conforme o mínimo global atual.
- Recompensa pendente de staking não significa saldo disponível para pagamento; o contrato precisa ter reserva real de EnergyToken.

