# Documentação Técnica Resumida — Sistema IAS / Agente IA Social

## 1. Visão Geral

O IAS / Agente IA Social foi desenvolvido com uma arquitetura open source, permitindo maior transparência, flexibilidade técnica e independência de fornecedores proprietários.

A base principal do sistema é o Supabase, utilizado como núcleo da infraestrutura da aplicação.

O Supabase centraliza os principais recursos técnicos do sistema, incluindo:

- banco de dados;
- autenticação;
- permissões de acesso;
- Row Level Security (RLS);
- Edge Functions;
- APIs;
- integrações externas.

Essa estrutura permite que o IAS opere de forma organizada, segura e escalável, mantendo os dados e regras essenciais concentrados em uma base única e controlável.

## 2. Estratégia de Integração

A estratégia oficial recomendada para o IAS é utilizar o Supabase como centro das integrações do sistema.

O Supabase deve ser usado para integrações críticas e para qualquer fluxo que envolva dados sensíveis, regras de negócio ou processamento essencial da operação.

Entre os principais usos recomendados estão:

- integrações críticas;
- dados sensíveis;
- regras de negócio;
- IA;
- CRM/ERP;
- financeiro;
- estoque;
- vendas;
- WhatsApp/Evolution.

Essa abordagem garante maior controle sobre segurança, rastreabilidade, permissões e consistência dos dados.

O IAS não depende do N8N para funcionar. O N8N pode ser utilizado como ferramenta complementar de automação quando necessário, mas não faz parte da dependência central do sistema.

## 3. Integração com N8N

O IAS não foi desenvolvido para ter compatibilidade nativa com automações do N8N.

O N8N pode ser utilizado apenas como ferramenta auxiliar, em cenários específicos de automação externa ou apoio operacional.

Quando necessário, o N8N pode consumir APIs ou webhooks externos disponibilizados pelo sistema ou por serviços integrados.

No entanto, a estratégia oficial do IAS é utilizar o Supabase como base central das integrações.

Integrações robustas, críticas ou diretamente ligadas às regras de negócio devem ser implementadas diretamente no Supabase, garantindo maior segurança, controle, rastreabilidade e consistência dos dados.

## 4. Inteligência Artificial

A IA do IAS utiliza configurações do agente dentro do próprio sistema.

Os prompts, instruções e comportamentos da IA podem ser ajustados na área da IA ou diretamente no código, conforme a estrutura implementada no projeto.

A IA pode utilizar dados armazenados no Supabase, incluindo conversas, contatos, agentes e mensagens.

Alterações avançadas no funcionamento da IA exigem conhecimento técnico em Supabase, backend, banco de dados e lógica de inteligência artificial.

## 5. Supabase

O Supabase é responsável pelos principais recursos técnicos do IAS, incluindo autenticação, banco de dados PostgreSQL, permissões, tabelas, Row Level Security (RLS), Edge Functions e variáveis de ambiente.

Alterações em tabelas, políticas de RLS, Edge Functions e APIs devem ser realizadas por profissional técnico qualificado.

Não é recomendado alterar regras de banco, permissões ou estruturas internas sem conhecimento de desenvolvimento, pois isso pode comprometer a segurança, a estabilidade e o funcionamento do sistema.

## 6. GitHub e Estrutura do Projeto

O GitHub deve ser utilizado como fonte oficial do código do IAS / Agente IA Social.

O acesso ao repositório deve ser controlado por permissões, garantindo que apenas pessoas autorizadas possam visualizar, alterar ou publicar mudanças no projeto.

Alterações no código devem ser realizadas por desenvolvedor ou pessoa técnica com conhecimento da estrutura do sistema.

Recomenda-se criar branches específicas para alterações, correções ou novas funcionalidades, evitando mudanças diretas sem controle.

Também é recomendado versionar correções e evoluções do sistema, mantendo histórico claro das alterações realizadas.

Campos de referência:

- URL do repositório:
- Responsável:
- Permissões:
- Ambiente de produção:
- Ambiente de homologação:

## 7. Personalização do Sistema

Logo, cores, nome do sistema, favicon, textos e ajustes visuais são alterados diretamente no código.

Não existe painel visual completo para personalização sem desenvolvimento.

Para realizar personalizações, é necessário ter noção básica de frontend, estrutura do projeto e processo de deploy.

Alterações maiores de layout, identidade visual, navegação ou comportamento da interface exigem atuação de desenvolvedor.

## 8. Integração com CRM e ERP

Integrações com CRM e ERP são possíveis dentro da arquitetura do IAS.

No entanto, esse tipo de integração é considerado complexo e deve ser tratado como desenvolvimento técnico sob demanda.

Essas integrações exigem análise da API externa, autenticação, mapeamento de dados, logs, tratamento de erros e sincronização entre sistemas.

Dependendo do cenário, podem ser necessárias Edge Functions, tabelas auxiliares, filas, retries e auditoria para garantir segurança e confiabilidade.

Não se trata de uma configuração simples por botão.

Cada integração com CRM ou ERP deve ser planejada, implementada, testada e validada tecnicamente conforme a necessidade do cliente e os recursos disponíveis na API externa.

## 9. Resumo Executivo

O IAS / Agente IA Social é um sistema open source baseado em Supabase.

O Supabase é a base recomendada para integrações, centralizando banco de dados, autenticação, permissões, RLS, Edge Functions, APIs e regras críticas do sistema.

O N8N não é dependência do IAS e também não é uma integração nativa oficial do sistema.

IA, CRM, ERP e personalizações podem evoluir dentro da arquitetura do projeto, mas exigem desenvolvimento técnico.

Alterações visuais e integrações avançadas devem ser feitas no código por pessoa técnica, com atenção à estrutura do sistema, segurança, dados e deploy.

Esta documentação resume a arquitetura e as diretrizes técnicas do IAS / Agente IA Social. Evoluções futuras, integrações avançadas e customizações devem ser realizadas por profissional técnico com conhecimento em Supabase, frontend, backend e deploy.
