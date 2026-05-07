export type Channel = "WhatsApp" | "Web" | "Instagram";
export type ConvStatus = "aberta" | "pendente" | "resolvida";
export type KanbanStage = "novo" | "atendimento" | "aguardando" | "resolvido";

export const kanbanStages: { id: KanbanStage; label: string; color: string }[] = [
  { id: "novo", label: "Novo", color: "var(--warning)" },
  { id: "atendimento", label: "Em atendimento", color: "var(--success)" },
  { id: "aguardando", label: "Aguardando cliente", color: "var(--brand)" },
  { id: "resolvido", label: "Resolvido", color: "oklch(0.65 0.02 250)" },
];

export interface Message {
  id: string;
  from: "cliente" | "agente";
  text: string;
  time: string;
  isNote?: boolean;
}

export interface Conversation {
  id: string;
  contactId: string;
  contactName: string;
  avatar: string;
  channel: Channel;
  lastMessage: string;
  time: string;
  unread: boolean;
  status: ConvStatus;
  agent: string;
  online: boolean;
  messages: Message[];
  slaRemaining: number; // minutes
  openedAt: string;
  stage: KanbanStage;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  channel: Channel;
  lastConv: string;
  createdAt: string;
  labels: string[];
}

const initials = (n: string) =>
  n.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();

export const agents = [
  { id: "a1", name: "Mariana Souza", role: "admin", avatar: "MS" },
  { id: "a2", name: "Carlos Pereira", role: "agente", avatar: "CP" },
  { id: "a3", name: "Beatriz Lima", role: "agente", avatar: "BL" },
  { id: "a4", name: "Ricardo Alves", role: "agente", avatar: "RA" },
];

export const conversations: Conversation[] = [
  {
    id: "c1", stage: "atendimento",
    contactId: "k1",
    contactName: "João da Silva",
    avatar: initials("João Silva"),
    channel: "WhatsApp",
    lastMessage: "Boa tarde, preciso de ajuda com meu pedido #4521",
    time: "14:32",
    unread: true,
    status: "aberta",
    agent: "Mariana Souza",
    online: true,
    slaRemaining: 12,
    openedAt: "há 18 min",
    messages: [
      { id: "m1", from: "cliente", text: "Boa tarde, preciso de ajuda com meu pedido #4521", time: "14:30" },
      { id: "m2", from: "agente", text: "Olá João! Tudo bem? Vou verificar seu pedido agora mesmo.", time: "14:31" },
      { id: "m3", from: "cliente", text: "Obrigado! Já faz 5 dias que não chegou.", time: "14:32" },
    ],
  },
  {
    id: "c2", stage: "novo",
    contactId: "k2",
    contactName: "Fernanda Oliveira",
    avatar: initials("Fernanda Oliveira"),
    channel: "Instagram",
    lastMessage: "Vocês têm em outras cores?",
    time: "13:58",
    unread: true,
    status: "aberta",
    agent: "Carlos Pereira",
    online: false,
    slaRemaining: 45,
    openedAt: "há 32 min",
    messages: [
      { id: "m1", from: "cliente", text: "Oi! Vi o produto no story", time: "13:55" },
      { id: "m2", from: "cliente", text: "Vocês têm em outras cores?", time: "13:58" },
    ],
  },
  {
    id: "c3", stage: "aguardando",
    contactId: "k3",
    contactName: "Pedro Henrique Costa",
    avatar: initials("Pedro Costa"),
    channel: "Web",
    lastMessage: "Como faço para emitir a segunda via?",
    time: "12:15",
    unread: false,
    status: "pendente",
    agent: "Beatriz Lima",
    online: true,
    slaRemaining: 3,
    openedAt: "há 1h 12min",
    messages: [
      { id: "m1", from: "cliente", text: "Como faço para emitir a segunda via?", time: "12:15" },
      { id: "m2", from: "agente", text: "Vou te enviar o passo a passo agora.", time: "12:18" },
    ],
  },
  {
    id: "c4", stage: "resolvido",
    contactId: "k4",
    contactName: "Aline Rodrigues",
    avatar: initials("Aline Rodrigues"),
    channel: "WhatsApp",
    lastMessage: "Perfeito, muito obrigada pelo atendimento!",
    time: "Ontem",
    unread: false,
    status: "resolvida",
    agent: "Mariana Souza",
    online: false,
    slaRemaining: 0,
    openedAt: "ontem",
    messages: [
      { id: "m1", from: "cliente", text: "Perfeito, muito obrigada pelo atendimento!", time: "17:42" },
    ],
  },
  {
    id: "c5", stage: "novo",
    contactId: "k5",
    contactName: "Gustavo Almeida",
    avatar: initials("Gustavo Almeida"),
    channel: "WhatsApp",
    lastMessage: "Estou aguardando retorno desde ontem.",
    time: "11:02",
    unread: true,
    status: "aberta",
    agent: "Ricardo Alves",
    online: true,
    slaRemaining: -8,
    openedAt: "há 2h 30min",
    messages: [
      { id: "m1", from: "cliente", text: "Estou aguardando retorno desde ontem.", time: "11:02" },
    ],
  },
  {
    id: "c6", stage: "resolvido",
    contactId: "k6",
    contactName: "Camila Ferreira",
    avatar: initials("Camila Ferreira"),
    channel: "Web",
    lastMessage: "Funcionou, obrigada!",
    time: "09:48",
    unread: false,
    status: "resolvida",
    agent: "Beatriz Lima",
    online: false,
    slaRemaining: 0,
    openedAt: "hoje",
    messages: [
      { id: "m1", from: "cliente", text: "Funcionou, obrigada!", time: "09:48" },
    ],
  },
];

export const contacts: Contact[] = [
  { id: "k1", name: "João da Silva", email: "joao.silva@email.com", phone: "(11) 98765-4321", channel: "WhatsApp", lastConv: "Hoje, 14:32", createdAt: "12/03/2024", labels: ["VIP", "Recorrente"] },
  { id: "k2", name: "Fernanda Oliveira", email: "fernanda.oli@email.com", phone: "(21) 99876-5432", channel: "Instagram", lastConv: "Hoje, 13:58", createdAt: "05/01/2025", labels: ["Lead"] },
  { id: "k3", name: "Pedro Henrique Costa", email: "pedrohc@email.com", phone: "(31) 97654-3210", channel: "Web", lastConv: "Hoje, 12:15", createdAt: "22/11/2024", labels: ["Suporte"] },
  { id: "k4", name: "Aline Rodrigues", email: "aline.rod@email.com", phone: "(41) 98123-4567", channel: "WhatsApp", lastConv: "Ontem", createdAt: "08/08/2024", labels: ["VIP"] },
  { id: "k5", name: "Gustavo Almeida", email: "gustavo.al@email.com", phone: "(51) 99012-3456", channel: "WhatsApp", lastConv: "Hoje, 11:02", createdAt: "17/02/2025", labels: ["Urgente"] },
  { id: "k6", name: "Camila Ferreira", email: "camila.f@email.com", phone: "(11) 98567-1234", channel: "Web", lastConv: "Hoje, 09:48", createdAt: "30/09/2024", labels: [] },
  { id: "k7", name: "Lucas Martins", email: "lucasm@email.com", phone: "(11) 99988-7766", channel: "WhatsApp", lastConv: "12/04/2026", createdAt: "01/10/2024", labels: ["Recorrente"] },
  { id: "k8", name: "Patrícia Gomes", email: "patgomes@email.com", phone: "(48) 98877-6655", channel: "Instagram", lastConv: "10/04/2026", createdAt: "14/12/2024", labels: ["Lead"] },
];

export const auditLogs = [
  { id: "1", time: "07/05/2026 14:32", agent: "Mariana Souza", action: "mensagem_enviada", convId: "#c1", contact: "João da Silva", details: "Resposta enviada via WhatsApp" },
  { id: "2", time: "07/05/2026 14:18", agent: "Carlos Pereira", action: "conversa_atribuida", convId: "#c2", contact: "Fernanda Oliveira", details: "Atribuída de Mariana para Carlos" },
  { id: "3", time: "07/05/2026 13:55", agent: "Beatriz Lima", action: "nota_adicionada", convId: "#c3", contact: "Pedro Costa", details: "Cliente solicita 2ª via" },
  { id: "4", time: "07/05/2026 12:40", agent: "Mariana Souza", action: "conversa_resolvida", convId: "#c4", contact: "Aline Rodrigues", details: "Caso encerrado com CSAT 5" },
  { id: "5", time: "07/05/2026 11:30", agent: "Ricardo Alves", action: "transferencia", convId: "#c5", contact: "Gustavo Almeida", details: "Transferido para time financeiro" },
  { id: "6", time: "07/05/2026 10:12", agent: "Beatriz Lima", action: "mensagem_enviada", convId: "#c6", contact: "Camila Ferreira", details: "Tutorial enviado" },
  { id: "7", time: "07/05/2026 09:48", agent: "Beatriz Lima", action: "conversa_resolvida", convId: "#c6", contact: "Camila Ferreira", details: "Cliente confirmou solução" },
  { id: "8", time: "06/05/2026 18:20", agent: "Mariana Souza", action: "mensagem_enviada", convId: "#c7", contact: "Lucas Martins", details: "Follow-up de proposta" },
];

export const quickReplies = [
  { id: "1", shortcut: "/saudacao", message: "Olá! Tudo bem? Sou da equipe IAS, como posso te ajudar hoje?" },
  { id: "2", shortcut: "/aguarde", message: "Só um momento, estou verificando essa informação para você." },
  { id: "3", shortcut: "/encerrar", message: "Posso te ajudar com mais alguma coisa? Caso não, vou encerrar nosso atendimento. Tenha um ótimo dia!" },
];

export const labels = [
  { id: "1", name: "VIP", color: "#2FAE7C" },
  { id: "2", name: "Urgente", color: "#EF4444" },
  { id: "3", name: "Lead", color: "#F2C94C" },
  { id: "4", name: "Suporte", color: "#0B3A5D" },
  { id: "5", name: "Recorrente", color: "#8B5CF6" },
];
