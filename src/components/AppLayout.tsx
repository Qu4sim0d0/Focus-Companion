import { memo, type ReactNode } from "react";
import { t, type Locale } from "../i18n";

interface LayoutProps {
  locale: Locale;
  connected: boolean;
  settingsOpen: boolean;
  onOpenSettings: () => void;
  children: ReactNode;
}

export function Layout({
  locale,
  connected,
  settingsOpen,
  onOpenSettings,
  children,
}: LayoutProps) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">FC</div>
          <div>
            <p className="eyebrow">{t(locale, "appEyebrow")}</p>
            <h1>{t(locale, "appTitle")}</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="status-pill" data-connected={connected}>
            <span className="status-dot" aria-hidden="true" />
            {connected ? t(locale, "connected") : t(locale, "disconnected")}
          </div>
          <button
            className="settings-menu-button"
            aria-controls="settings-drawer"
            aria-expanded={settingsOpen}
            onClick={onOpenSettings}
          >
            {t(locale, "settingsMenu")}
          </button>
        </div>
      </header>
      {children}
    </main>
  );
}

export const MainContent = memo(function MainContent({ children }: { children: ReactNode }) {
  return <>{children}</>;
});

interface SidebarProps {
  open: boolean;
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}

export function Sidebar({ open, labelledBy, onClose, children }: SidebarProps) {
  return (
    <div
      className="settings-overlay"
      data-open={open}
      aria-hidden={!open}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        id="settings-drawer"
        className="settings-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </aside>
    </div>
  );
}
