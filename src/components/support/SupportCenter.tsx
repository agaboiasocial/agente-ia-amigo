import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HelpCircle,
  Plus,
  ArrowLeft,
  Paperclip,
  BookOpen,
  Phone,
  Video,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import logoSuporte from "@/assets/logo-suporte.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

// ─── Config dos links de suporte (atualizar quando os valores oficiais forem definidos) ──
const SUPPORT_WHATSAPP = ""; // número oficial, só dígitos com DDI. Ex: "5511999999999"
const SUPPORT_WELCOME = "Olá! Preciso de ajuda com a plataforma IAS.";
const TUTORIALS_URL = "";    // portal de treinamento (link virá depois)
const DOCS_URL = "";         // documentação (opcional)

function openExternal(url: string, fallbackMsg: string) {
  if (!url) { toast.info(fallbackMsg); return; }
  window.open(url, "_blank", "noopener,noreferrer");
}

type Status = "Aberto" | "Em andamento" | "Resolvido";
type Ticket = {
  id: string;
  subject: string;
  category: string;
  priority: string;
  description: string;
  fileName?: string;
  status: Status;
  createdAt: string;
};

const SupportCtx = createContext<{ open: () => void } | null>(null);

export function useSupport() {
  const ctx = useContext(SupportCtx);
  if (!ctx) throw new Error("useSupport must be used within SupportProvider");
  return ctx;
}

export function SupportProvider({ children }: { children: ReactNode }) {
  const { user, accountId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"home" | "new">("home");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // form
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("Dúvida");
  const [priority, setPriority] = useState("Média");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState<string>("");

  useEffect(() => {
    if (!isOpen || !user?.id || !accountId) return;
    let cancelled = false;
    const loadTickets = async () => {
      setLoadingTickets(true);
      const { data, error } = await (supabase as any)
        .from("support_tickets")
        .select("id, subject, category, priority, description, message, attachment_url, status, created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        setTickets([]);
      } else {
        setTickets(((data ?? []) as any[]).map((row) => ({
          id: row.id,
          subject: row.subject,
          category: row.category ?? "Dúvida",
          priority: row.priority ?? "Média",
          description: row.description ?? row.message ?? "",
          fileName: row.attachment_url ?? undefined,
          status: mapStatus(row.status),
          createdAt: row.created_at ?? new Date().toISOString(),
        })));
      }
      setLoadingTickets(false);
    };
    void loadTickets();
    return () => { cancelled = true; };
  }, [accountId, isOpen, user?.id]);

  const reset = () => {
    setSubject("");
    setCategory("Dúvida");
    setPriority("Média");
    setDescription("");
    setFileName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error("Preencha assunto e descrição");
      return;
    }
    if (!user?.id || !accountId) {
      toast.error("Conta atual não identificada. Recarregue a página e tente novamente.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        account_id: accountId,
        user_id: user.id,
        subject: subject.trim().slice(0, 200),
        category,
        priority,
        description: description.trim().slice(0, 2000),
        message: description.trim().slice(0, 2000),
        attachment_url: fileName || null,
        status: "open",
      };
      const { data, error } = await (supabase as any)
        .from("support_tickets")
        .insert(payload)
        .select("id, subject, category, priority, description, message, attachment_url, status, created_at")
        .single();
      if (error) throw error;

      const t: Ticket = {
        id: data.id,
        subject: data.subject,
        category: data.category ?? category,
        priority: data.priority ?? priority,
        description: data.description ?? data.message ?? "",
        fileName: data.attachment_url ?? undefined,
        status: mapStatus(data.status),
        createdAt: data.created_at ?? new Date().toISOString(),
      };
      setTickets((current) => [t, ...current]);
      toast.success("Chamado enviado com sucesso");
      reset();
      setView("home");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar chamado");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (s: Status) => {
    const styles: Record<Status, string> = {
      Aberto: "bg-[#F2C94C] text-[#0B3A5D] hover:bg-[#F2C94C]",
      "Em andamento": "bg-[#0B3A5D] text-white hover:bg-[#0B3A5D]",
      Resolvido: "bg-[#2FAE7C] text-white hover:bg-[#2FAE7C]",
    };
    return <Badge className={styles[s]}>{s}</Badge>;
  };

  return (
    <SupportCtx.Provider value={{ open: () => { setIsOpen(true); setView("home"); } }}>
      {children}

      {/* Floating button — posicionado mais acima para não encostar no
          botão Enviar do composer nas telas de chat. */}
      <button
        type="button"
        onClick={() => { setIsOpen(true); setView("home"); }}
        aria-label="Abrir Central de Suporte"
        className="fixed bottom-24 right-5 md:bottom-28 md:right-6 z-30 h-12 w-12 md:h-14 md:w-14 rounded-full bg-[#2FAE7C] text-white shadow-lg hover:brightness-110 transition grid place-items-center"
      >
        <HelpCircle className="h-5 w-5 md:h-6 md:w-6" />
      </button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-5 py-4 border-b">
            <SheetTitle className="flex items-center gap-2 text-[#0B3A5D]">
              {view === "new" && (
                <button onClick={() => setView("home")} className="hover:opacity-70" aria-label="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <img src={logoSuporte} alt="Suporte" className="h-20 w-20 object-contain" />
              Central de Suporte
            </SheetTitle>
            <SheetDescription className="sr-only">
              Painel de suporte e chamados
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {view === "home" && (
              <>
                <section className="space-y-3">
                  <h3 className="font-semibold text-[#0B3A5D]">Precisa de ajuda?</h3>
                  <p className="text-sm text-muted-foreground">
                    Nossa equipe está pronta para te atender. Abra um chamado e responderemos o quanto antes.
                  </p>
                  <Button
                    onClick={() => setView("new")}
                    className="bg-[#2FAE7C] hover:bg-[#2FAE7C]/90 text-white w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Abrir chamado
                  </Button>
                </section>

                <Separator />

                <section className="space-y-3">
                  <h3 className="font-semibold text-[#0B3A5D]">Meus chamados</h3>
                  {loadingTickets ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando chamados...
                    </div>
                  ) : tickets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum chamado ainda.</p>
                  ) : (
                    <ul className="space-y-2">
                      {tickets.map((t) => (
                        <li key={t.id} className="rounded-lg border p-3 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium line-clamp-1">{t.subject}</span>
                            {statusBadge(t.status)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(t.createdAt).toLocaleString("pt-BR")} · {t.category} · {t.priority}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <Separator />

                <section className="space-y-2">
                  <h3 className="font-semibold text-[#0B3A5D]">Links rápidos</h3>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      onClick={() => {
                        const url = SUPPORT_WHATSAPP
                          ? `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(SUPPORT_WELCOME)}`
                          : "";
                        openExternal(url, "Número do suporte será disponibilizado em breve.");
                      }}
                      className="flex items-center gap-2 text-sm rounded-md px-2 py-2 hover:bg-muted text-left"
                    >
                      <Phone className="h-4 w-4 text-[#2FAE7C]" /> WhatsApp do suporte
                    </button>
                    <button
                      onClick={() => openExternal(TUTORIALS_URL, "O portal de treinamento estará disponível em breve.")}
                      className="flex items-center gap-2 text-sm rounded-md px-2 py-2 hover:bg-muted text-left"
                    >
                      <Video className="h-4 w-4 text-[#0B3A5D]" /> Tutoriais
                    </button>
                    <button
                      onClick={() => openExternal(DOCS_URL, "A documentação estará disponível em breve.")}
                      className="flex items-center gap-2 text-sm rounded-md px-2 py-2 hover:bg-muted text-left"
                    >
                      <BookOpen className="h-4 w-4 text-[#0B3A5D]" /> Documentação
                    </button>
                  </div>
                </section>
              </>
            )}

            {view === "new" && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="sup-subject">Assunto</Label>
                  <Input
                    id="sup-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={200}
                    placeholder="Resumo do problema"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Bug", "Dúvida", "Sugestão", "Financeiro", "Outro"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Prioridade</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Baixa", "Média", "Alta", "Urgente"].map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sup-desc">Descrição</Label>
                  <Textarea
                    id="sup-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    maxLength={2000}
                    placeholder="Descreva o que aconteceu..."
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sup-file" className="flex items-center gap-2 cursor-pointer">
                    <Paperclip className="h-4 w-4" /> Anexo (opcional)
                  </Label>
                  <Input
                    id="sup-file"
                    type="file"
                    onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
                  />
                  {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { reset(); setView("home"); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting} className="flex-1 bg-[#2FAE7C] hover:bg-[#2FAE7C]/90 text-white disabled:opacity-60">
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Enviar
                  </Button>
                </div>
              </form>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </SupportCtx.Provider>
  );
}

function mapStatus(status: string | null | undefined): Status {
  if (status === "in_progress" || status === "Em andamento") return "Em andamento";
  if (status === "resolved" || status === "Resolvido") return "Resolvido";
  return "Aberto";
}
