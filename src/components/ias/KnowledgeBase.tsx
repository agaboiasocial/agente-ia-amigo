import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Upload, FileText, Trash2, RefreshCw, Loader2, CheckCircle2, AlertCircle,
  Clock, BookOpen, File,
} from "lucide-react";

const sb = supabase as any;

const ALLOWED: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface DocRow {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  status: string;
  enabled: boolean;
  error_message: string | null;
  created_at: string;
  uploaded_by: string | null;
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusInfo(status: string, enabled: boolean) {
  if (!enabled) return { label: "Desativado", cls: "bg-muted text-muted-foreground", Icon: File };
  if (status === "ready") return { label: "Pronto", cls: "bg-success/15 text-success", Icon: CheckCircle2 };
  if (status === "processing" || status === "uploaded") return { label: "Processando", cls: "bg-warning/20 text-warning-foreground", Icon: Clock };
  if (status === "error") return { label: "Erro", cls: "bg-destructive/15 text-destructive", Icon: AlertCircle };
  return { label: status, cls: "bg-muted text-muted-foreground", Icon: File };
}

export function KnowledgeBase() {
  const { accountId, user, session } = useAuth();
  const qc = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["knowledge_docs", accountId],
    queryFn: async (): Promise<DocRow[]> => {
      if (!accountId) return [];
      // só metadados (nunca extracted_text na listagem)
      const { data } = await sb
        .from("ai_knowledge_documents")
        .select("id, file_name, file_path, file_type, file_size, status, enabled, error_message, created_at, uploaded_by")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      return (data ?? []) as DocRow[];
    },
    enabled: !!accountId,
    refetchInterval: (q) => {
      const rows = (q.state.data as DocRow[] | undefined) ?? [];
      return rows.some((d) => d.status === "processing" || d.status === "uploaded") ? 3000 : false;
    },
  });

  const processDoc = useCallback(async (documentId: string) => {
    await supabase.functions.invoke("knowledge-process", {
      body: { documentId },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    qc.invalidateQueries({ queryKey: ["knowledge_docs", accountId] });
  }, [accountId, qc, session]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!accountId) { toast.error("Conta não identificada"); return; }
    const file = files[0];
    const ext = (file.name.split(".").pop() || "").toLowerCase();

    if (!ALLOWED[ext]) { toast.error(`Tipo .${ext} não permitido. Use: PDF, DOCX, TXT, MD, CSV.`); return; }
    if (file.size > MAX_SIZE) { toast.error("Arquivo maior que 10MB."); return; }

    setUploading(true);
    try {
      const docId = crypto.randomUUID();
      const path = `${accountId}/${docId}.${ext}`;
      const { error: upErr } = await supabase.storage.from("ai-documents").upload(path, file, {
        contentType: file.type || ALLOWED[ext], upsert: false,
      });
      if (upErr) throw upErr;

      const { error: insErr } = await sb.from("ai_knowledge_documents").insert({
        id: docId,
        account_id: accountId,
        uploaded_by: user?.id ?? null,
        file_name: file.name,
        file_path: path,
        file_type: ext,
        mime_type: file.type || ALLOWED[ext],
        file_size: file.size,
        status: "uploaded",
        enabled: true,
      });
      if (insErr) throw insErr;

      qc.invalidateQueries({ queryKey: ["knowledge_docs", accountId] });
      toast.success("Arquivo enviado. Processando...");
      void processDoc(docId);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const toggleEnabled = useMutation({
    mutationFn: async (doc: DocRow) => {
      const { error } = await sb.from("ai_knowledge_documents").update({ enabled: !doc.enabled, updated_at: new Date().toISOString() }).eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge_docs", accountId] }),
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar"),
  });

  const removeDoc = useMutation({
    mutationFn: async (doc: DocRow) => {
      await supabase.storage.from("ai-documents").remove([doc.file_path]).catch(() => null);
      const { error } = await sb.from("ai_knowledge_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["knowledge_docs", accountId] }); toast.success("Documento removido"); },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover"),
  });

  const counts = {
    total: docs.length,
    active: docs.filter((d) => d.enabled && d.status === "ready").length,
    ready: docs.filter((d) => d.status === "ready").length,
    error: docs.filter((d) => d.status === "error").length,
  };

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-brand/10 text-brand grid place-items-center shrink-0">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-brand">Base de Conhecimento</h3>
          <p className="text-xs text-muted-foreground">Documentos que a IA consulta antes de responder (PDF, DOCX, TXT, MD, CSV — máx 10MB).</p>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
        <SummaryCard label="Enviados" value={counts.total} />
        <SummaryCard label="Ativos na IA" value={counts.active} tone="success" />
        <SummaryCard label="Processados" value={counts.ready} tone="brand" />
        <SummaryCard label="Com erro" value={counts.error} tone={counts.error > 0 ? "danger" : undefined} />
      </div>

      {/* Upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${dragOver ? "border-success bg-success/5" : "border-border"}`}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-3">Arraste um arquivo aqui ou</p>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Selecionar arquivo
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt,.md,.csv"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : docs.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Nenhum documento ainda. Suba o primeiro arquivo acima.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const st = statusInfo(doc.status, doc.enabled);
            return (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{doc.file_name}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${st.cls}`}>
                      <st.Icon className="h-2.5 w-2.5" /> {st.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="uppercase">{doc.file_type}</span>
                    <span>· {fmtSize(doc.file_size)}</span>
                    <span>· {new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
                    {doc.uploaded_by === user?.id && <span>· por você</span>}
                  </div>
                  {doc.status === "error" && doc.error_message && (
                    <p className="text-[11px] text-destructive mt-1">{doc.error_message}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Ativar/desativar */}
                  <button
                    onClick={() => toggleEnabled.mutate(doc)}
                    title={doc.enabled ? "Desativar para a IA" : "Ativar para a IA"}
                    className={`relative h-5 w-9 rounded-full transition-colors ${doc.enabled ? "bg-success" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${doc.enabled ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                  {/* Reprocessar */}
                  {(doc.status === "error" || doc.status === "ready") && (
                    <button
                      onClick={() => { void processDoc(doc.id); toast.info("Reprocessando..."); }}
                      title="Reprocessar"
                      className="h-8 w-8 rounded-lg hover:bg-muted grid place-items-center text-muted-foreground"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                  {/* Remover */}
                  <button
                    onClick={() => { if (confirm(`Remover "${doc.file_name}"?`)) removeDoc.mutate(doc); }}
                    title="Remover"
                    className="h-8 w-8 rounded-lg hover:bg-destructive/10 grid place-items-center text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "brand" | "danger" }) {
  const color = tone === "success" ? "text-success" : tone === "brand" ? "text-brand" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <div className="bg-background border rounded-lg p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
