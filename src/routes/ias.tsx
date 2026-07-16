import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Bot, Sparkles, Wand2, Zap, CheckCircle2, Save, Clock, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { KnowledgeBase } from "@/components/ias/KnowledgeBase";

export const Route = createFileRoute("/ias")({ component: IASPage });

const sb = supabase as any;
const DEFAULT_SYSTEM_PROMPT =
  "Você é o IAS, atendente virtual da nossa empresa. Seja cordial, objetivo e use português brasileiro. Sempre que não souber, ofereça transferir para um agente humano.";

interface AISettings {
  id: string;
  account_id: string | null;
  persona_name: string;
  system_prompt: string;
  model: string;
  temperature: number;
  is_active: boolean;
  handoff_keyword: string;
  buffer_seconds: number;
  notification_group_jid: string;
  schedule_enabled: boolean;
  schedule_days: string[];
  schedule_start: string;
  schedule_end: string;
  off_hours_message: string;
  ignore_numbers: string[];
}

function useAISettings(accountId: string | null) {
  return useQuery({
    queryKey: ["ai_settings", accountId],
    queryFn: async (): Promise<AISettings | null> => {
      if (!accountId) throw new Error("Conta atual não identificada");
      const { data, error } = await sb
        .from("ai_settings")
        .select("*")
        .eq("account_id", accountId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });
}

function IASPage() {
  const queryClient = useQueryClient();
  const { accountId } = useAuth();
  const { data: settings } = useAISettings(accountId);
  const [enabled, setEnabled] = useState(true);
  const [personaName, setPersonaName] = useState("IAS Assistente");
  const [model, setModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState(0.7);
  const [handoffKeyword, setHandoffKeyword] = useState("#humano");
  const [prompt, setPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [autoReply, setAutoReply] = useState(true);
  const [bufferSeconds, setBufferSeconds] = useState(3);
  const [notificationGroupJid, setNotificationGroupJid] = useState("");
  const [ignoreNumbers, setIgnoreNumbers] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDays, setScheduleDays] = useState<string[]>(["seg", "ter", "qua", "qui", "sex"]);
  const [scheduleStart, setScheduleStart] = useState("08:00");
  const [scheduleEnd, setScheduleEnd] = useState("18:00");
  const [offHoursMessage, setOffHoursMessage] = useState("Estamos fora do horário de atendimento. Retornaremos em breve!");

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.is_active);
    setPersonaName(settings.persona_name ?? "IAS Assistente");
    setModel(settings.model ?? "gpt-4o-mini");
    setTemperature(Number(settings.temperature ?? 0.7));
    setHandoffKeyword(settings.handoff_keyword ?? "#humano");
    setPrompt(settings.system_prompt ?? DEFAULT_SYSTEM_PROMPT);
    setAutoReply((settings.buffer_seconds ?? 3) >= 0);
    setBufferSeconds(settings.buffer_seconds ?? 3);
    setNotificationGroupJid(settings.notification_group_jid ?? "");
    setIgnoreNumbers((settings.ignore_numbers ?? []).join(", "));
    setScheduleEnabled(settings.schedule_enabled ?? false);
    setScheduleDays(settings.schedule_days ?? ["seg", "ter", "qua", "qui", "sex"]);
    setScheduleStart(settings.schedule_start ?? "08:00");
    setScheduleEnd(settings.schedule_end ?? "18:00");
    setOffHoursMessage(settings.off_hours_message ?? "Estamos fora do horário de atendimento. Retornaremos em breve!");
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      if (!accountId) {
        throw new Error("Conta atual não identificada. Vincule o usuário a uma conta antes de salvar o IAS.");
      }
      const payload: Record<string, any> = {
        account_id: accountId,
        persona_name: personaName,
        system_prompt: prompt,
        model,
        temperature,
        is_active: enabled,
        handoff_keyword: handoffKeyword,
        buffer_seconds: autoReply ? Math.max(0, bufferSeconds) : -1,
        notification_group_jid: notificationGroupJid || null,
        ignore_numbers: ignoreNumbers ? ignoreNumbers.split(",").map((n: string) => n.trim()).filter(Boolean) : [],
        schedule_enabled: scheduleEnabled,
        schedule_days: scheduleDays,
        schedule_start: scheduleStart,
        schedule_end: scheduleEnd,
        off_hours_message: offHoursMessage,
        updated_at: new Date().toISOString(),
      };
      // Uma linha por conta (constraint única em account_id) — evita duplicatas
      const { error } = await sb
        .from("ai_settings")
        .upsert(payload, { onConflict: "account_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_settings", accountId] });
      toast.success("Configuração do IAS salva");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppLayout
      title="IAS — Agente Inteligente"
      actions={
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {save.isPending ? "Salvando..." : "Salvar IA"}
        </button>
      }
    >
      <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status card */}
        <div className="lg:col-span-2 bg-card rounded-xl border shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-success/15 text-success grid place-items-center">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-semibold text-brand text-lg">Assistente IAS</h2>
                <p className="text-xs text-muted-foreground">Responde clientes automaticamente com IA contextual.</p>
              </div>
            </div>
            <button
              onClick={() => setEnabled((e) => !e)}
              className={`h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                enabled ? "bg-success text-success-foreground" : "bg-background border"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {enabled ? "Ativo" : "Desativado"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome do agente">
              <input
                value={personaName}
                onChange={(e) => setPersonaName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
              />
            </Field>
            <Field label="Idioma principal">
              <select className="w-full h-10 px-3 rounded-lg border bg-background text-sm">
                <option>Português (BR)</option>
                <option>Inglês</option>
                <option>Espanhol</option>
              </select>
            </Field>
            <Field label="Modelo de IA">
              <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full h-10 px-3 rounded-lg border bg-background text-sm">
                <option value="gpt-5.4-mini">IAS-Ultra (gpt-5.4-mini)</option>
                <option value="gpt-5.1-mini">IAS-Plus (gpt-5.1-mini)</option>
                <option value="gpt-4.1-mini">IAS-Lite (gpt-4.1-mini)</option>
                <option value="gpt-4o-mini">IAS-Pro (gpt-4o-mini)</option>
                <option value="gpt-4.1">IAS-Max (gpt-4.1)</option>
              </select>
            </Field>
            <Field label="Palavra de transferência">
              <input
                value={handoffKeyword}
                onChange={(e) => setHandoffKeyword(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
              />
            </Field>
            <Field label="Temperatura">
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
              />
            </Field>
            <Field label="Buffer (segundos)">
              <input
                type="number"
                min="0"
                max="30"
                step="1"
                value={bufferSeconds}
                onChange={(e) => setBufferSeconds(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                title="Tempo de espera para agrupar mensagens rápidas antes de responder"
              />
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Grupo de notificação (JID WhatsApp)">
              <input
                value={notificationGroupJid}
                onChange={(e) => setNotificationGroupJid(e.target.value)}
                placeholder="120363xxxxxx@g.us"
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                title="ID do grupo WhatsApp para receber alertas de handoff"
              />
            </Field>
            <Field label="Números ignorados">
              <input
                value={ignoreNumbers}
                onChange={(e) => setIgnoreNumbers(e.target.value)}
                placeholder="5511999999999, 5521888888888"
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                title="Números que a IA nunca deve responder (separados por vírgula)"
              />
            </Field>
          </div>

          <div className="mt-5">
            <label className="text-xs font-medium">Instruções do agente (system prompt)</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1 w-full min-h-[120px] p-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success"
            />
          </div>

          <div className="mt-5 flex items-center justify-between p-4 rounded-lg bg-background border">
            <div>
              <div className="text-sm font-medium">Resposta automática</div>
              <div className="text-xs text-muted-foreground">IAS responde a primeira mensagem antes do agente humano</div>
            </div>
            <button onClick={() => setAutoReply((a) => !a)}
              className={`relative h-6 w-11 rounded-full transition-colors ${autoReply ? "bg-success" : "bg-muted"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${autoReply ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>

          {/* Schedule */}
          <div className="mt-5 rounded-lg bg-background border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Horário de atendimento</div>
                <div className="text-xs text-muted-foreground">IA só responde dentro do horário definido</div>
              </div>
              <button onClick={() => setScheduleEnabled((s) => !s)}
                className={`relative h-6 w-11 rounded-full transition-colors ${scheduleEnabled ? "bg-success" : "bg-muted"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${scheduleEnabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
            {scheduleEnabled && (
              <>
                <div className="flex flex-wrap gap-2">
                  {(["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() =>
                        setScheduleDays((prev) =>
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                        )
                      }
                      className={`h-8 px-3 rounded-lg text-xs font-medium border transition-colors ${
                        scheduleDays.includes(d)
                          ? "bg-success text-success-foreground border-success"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Início">
                    <input type="time" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border bg-background text-sm" />
                  </Field>
                  <Field label="Fim">
                    <input type="time" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border bg-background text-sm" />
                  </Field>
                </div>
                <Field label="Mensagem fora do horário">
                  <textarea
                    value={offHoursMessage}
                    onChange={(e) => setOffHoursMessage(e.target.value)}
                    rows={2}
                    className="w-full p-3 rounded-lg border bg-background text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-success"
                  />
                </Field>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          <Stat icon={Zap} label="Mensagens hoje" value="1.284" tone="success" />
          <Stat icon={Sparkles} label="Taxa de resolução" value="78%" tone="brand" />
          <Stat icon={Wand2} label="Tempo médio" value="1m 12s" tone="warning" />

        </div>
      </div>

      {/* Base de Conhecimento — documentos que a IA consulta */}
      <KnowledgeBase />
      </div>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function Stat({ icon: Icon, label, value, tone }: any) {
  const map: any = {
    success: "bg-success/15 text-success",
    brand: "bg-brand/10 text-brand",
    warning: "bg-warning/30 text-warning-foreground",
  };
  return (
    <div className="bg-card rounded-xl border p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg grid place-items-center ${map[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold text-brand">{value}</div>
      </div>
    </div>
  );
}
