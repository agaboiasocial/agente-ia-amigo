import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "ias.pwa.dismissed";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !(window as any).MSStream;
}

/**
 * Banner "Baixe o app" + botão de instalação.
 * - Android/Chrome/Edge: usa o evento beforeinstallprompt (instalação nativa).
 * - iOS/Safari: mostra instruções "Adicionar à Tela de Início" (iOS não expõe prompt).
 */
export function InstallPWA() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // já instalado
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS não dispara beforeinstallprompt — mostra o banner com instrução manual
    if (isIOS()) setVisible(true);

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    setShowIosSheet(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const onDownload = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice.catch(() => {});
      setDeferred(null);
      setVisible(false);
      return;
    }
    if (isIOS()) {
      setShowIosSheet(true);
      return;
    }
    // Fallback: alguns navegadores instalam pelo menu; orienta o usuário
    setShowIosSheet(true);
  };

  if (!visible) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 pointer-events-none">
        <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border bg-card shadow-xl p-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-brand text-brand-foreground grid place-items-center shrink-0">
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand">Baixe o app IAS</p>
            <p className="text-xs text-muted-foreground">Instale na tela inicial e use como aplicativo.</p>
          </div>
          <button
            onClick={onDownload}
            className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold whitespace-nowrap"
          >
            Baixe aqui
          </button>
          <button onClick={dismiss} className="h-9 w-9 grid place-items-center text-muted-foreground shrink-0" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showIosSheet && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowIosSheet(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-brand">Instalar o app IAS</h3>
            <ol className="space-y-3 text-sm text-foreground">
              <li className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-brand text-brand-foreground grid place-items-center text-xs font-bold shrink-0">1</span>
                Toque em <Share className="h-4 w-4 inline text-brand" /> <span className="font-medium">Compartilhar</span> na barra do navegador.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-brand text-brand-foreground grid place-items-center text-xs font-bold shrink-0">2</span>
                Escolha <Plus className="h-4 w-4 inline text-brand" /> <span className="font-medium">Adicionar à Tela de Início</span>.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-brand text-brand-foreground grid place-items-center text-xs font-bold shrink-0">3</span>
                Confirme em <span className="font-medium">Adicionar</span>. Pronto!
              </li>
            </ol>
            <button onClick={() => setShowIosSheet(false)} className="w-full h-10 rounded-lg bg-success text-success-foreground text-sm font-semibold">
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
