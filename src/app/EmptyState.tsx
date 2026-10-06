import {
  FileDown,
  FileText,
  FolderOpen,
  GitBranch,
  Moon,
  PenLine,
  Plus,
  ShieldCheck,
  Sigma,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { project } from "@/config/project";
import { messages } from "@/i18n/messages";
import { LogoBpdf } from "./LogoBpdf";
import { anuncioDeAtajo } from "./pdf/atajos";

/** Lo que se ve sin documento abierto. Toda la ventana sigue aceptando ficheros soltados. */
export function EmptyState({
  onOpen,
  onOpenFolder,
  onCreate,
}: {
  onOpen: () => void;
  onOpenFolder: () => void;
  onCreate: () => void;
}) {
  const t = messages.emptyState;
  const features = [
    { icon: Moon, title: t.features.dark.title, body: t.features.dark.body, tone: "violet" },
    {
      icon: ShieldCheck,
      title: t.features.privacy.title,
      body: t.features.privacy.body,
      tone: "green",
    },
    { icon: Sigma, title: t.features.katex.title, body: t.features.katex.body, tone: "purple" },
    {
      icon: GitBranch,
      title: t.features.mermaid.title,
      body: t.features.mermaid.body,
      tone: "pink",
    },
    {
      icon: PenLine,
      title: t.features.edit.title,
      body: t.features.edit.body,
      tone: "blue",
    },
    {
      icon: FileDown,
      title: t.features.export.title,
      body: t.features.export.body,
      tone: "orange",
    },
  ] as const;

  return (
    <section aria-labelledby="estado-vacio-titulo" className="home-landing">
      <div className="home-orbit home-orbit-left" aria-hidden="true" />
      <div className="home-orbit home-orbit-right" aria-hidden="true" />

      <div className="home-document home-document-left" aria-hidden="true">
        <span className="home-document-badge">{t.decorations.pdf}</span>
        <span className="home-document-line home-document-line-wide" />
        <span className="home-document-line" />
        <span className="home-document-line home-document-line-short" />
        <FileText className="home-document-symbol" />
      </div>
      <div className="home-document home-document-right" aria-hidden="true">
        <span className="home-document-badge">{t.decorations.markdown}</span>
        <span className="home-document-line home-document-line-wide" />
        <span className="home-document-line" />
        <span className="home-document-line home-document-line-short" />
        <GitBranch className="home-document-symbol" />
      </div>

      <div className="home-content">
        <div className="home-hero">
          <LogoBpdf className="home-hero-logo size-20 sm:size-24" />
          <p className="home-brand">{project.name}</p>
          <h1 id="estado-vacio-titulo">{t.title}</h1>
          <p className="home-intro">
            <span>{t.body}</span>
            <span>{t.local}</span>
          </p>
          <div className="home-actions">
            <Button
              {...anuncioDeAtajo("abrir", messages.open.button, true)}
              className="home-action home-action-primary"
              onClick={onOpen}
            >
              <FileText aria-hidden="true" className="size-5" />
              {messages.open.button}
            </Button>
            <Button
              variant="secondary"
              className="home-action home-action-secondary"
              onClick={onOpenFolder}
            >
              <FolderOpen aria-hidden="true" className="size-5" />
              {messages.open.folder}
            </Button>
            <Button
              variant="secondary"
              className="home-action home-action-secondary"
              onClick={onCreate}
            >
              <Plus aria-hidden="true" className="size-5" />
              {messages.open.create}
            </Button>
          </div>
        </div>

        <section className="home-features" aria-labelledby="funciones-titulo">
          <h2 id="funciones-titulo" className="sr-only">
            {t.features.title}
          </h2>
          <ul>
            {features.map(({ icon: Icon, title, body, tone }) => (
              <li key={title} className="home-feature-card">
                <Icon aria-hidden="true" className="home-feature-icon" data-tone={tone} />
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <aside className="home-privacy" aria-labelledby="privacidad-titulo">
          <ShieldCheck aria-hidden="true" className="home-privacy-icon" />
          <div>
            <h2 id="privacidad-titulo">{t.privacy}</h2>
            <p>{t.privacyDetail}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
