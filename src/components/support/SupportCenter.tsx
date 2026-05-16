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
  MessageCircleQuestion,
  Phone,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import logoSuporte from "@/assets/logo-suporte.png";

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

const STORAGE_KEY = "support_tickets_v1";

const SupportCtx = createContext<{ open: () => void } | null>(null);

export function useSupport() {
  const ctx = useContext(SupportCtx);
  if (!ctx) throw new Error("useSupport must be used within SupportProvider");
  return ctx;
}

export function SupportProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"home" | "new">("home");
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // form
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("Dúvida");
  const [priority, setPriority] = useState("Média");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTickets(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (next: Ticket[]) => {
    setTickets(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const reset = () => {
    setSubject("");
    setCategory("Dúvida");
    setPriority("Média");
    setDescription("");
    setFileName("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error("Preencha assunto e descrição");
      return;
    }
    const t: Ticket = {
      id: crypto.randomUUID(),
      subject: subject.trim().slice(0, 200),
      category,
      priority,
      description: description.trim().slice(0, 2000),
      fileName: fileName || undefined,
      status: "Aberto",
      createdAt: new Date().toISOString(),
    };
    persist([t, ...tickets]);
    toast.success("Chamado enviado com sucesso");
    reset();
    setView("home");
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

      {/* Floating button */}
      <button
        type="button"
        onClick={() => { setIsOpen(true); setView("home"); }}
        aria-label="Abrir Central de Suporte"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-[#2FAE7C] text-white shadow-lg hover:brightness-110 transition grid place-items-center"
      >
        <HelpCircle className="h-6 w-6" />
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
              <img src={logoSuporte} alt="Suporte" className="h-14 w-14 object-contain" />
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
                  {tickets.length === 0 ? (
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
                    <a href="#" className="flex items-center gap-2 text-sm rounded-md px-2 py-2 hover:bg-muted">
                      <BookOpen className="h-4 w-4 text-[#0B3A5D]" /> Documentação
                    </a>
                    <a href="#" className="flex items-center gap-2 text-sm rounded-md px-2 py-2 hover:bg-muted">
                      <MessageCircleQuestion className="h-4 w-4 text-[#0B3A5D]" /> FAQ
                    </a>
                    <a href="#" className="flex items-center gap-2 text-sm rounded-md px-2 py-2 hover:bg-muted">
                      <Phone className="h-4 w-4 text-[#2FAE7C]" /> WhatsApp do suporte
                    </a>
                    <a href="#" className="flex items-center gap-2 text-sm rounded-md px-2 py-2 hover:bg-muted">
                      <Video className="h-4 w-4 text-[#0B3A5D]" /> Tutoriais em vídeo
                    </a>
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
                  <Button type="submit" className="flex-1 bg-[#2FAE7C] hover:bg-[#2FAE7C]/90 text-white">
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
