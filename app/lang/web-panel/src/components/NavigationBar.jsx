import React from 'react';

const PAGES = [
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'graph', label: 'Dependency Graph', icon: '🕸️' },
  { id: 'interactive', label: 'Cloud Inspector', icon: '🔍' }
];

export default function NavigationBar({ activePage, onSelectPage, onPopOut, pageTitle }) {
  return (
    <header className="web-panel-navbar" role="navigation" aria-label="Web Panel Pages">
      <div className="web-panel-nav-left">
        <span className="web-panel-brand-badge">CPQ BML</span>
        <nav className="web-panel-tabs" role="tablist">
          {PAGES.map((page) => {
            const isActive = activePage === page.id;
            return (
              <button
                key={page.id}
                role="tab"
                aria-selected={isActive}
                className={`web-panel-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => onSelectPage(page.id)}
                title={`Switch to ${page.label}`}
              >
                <span className="web-panel-tab-icon">{page.icon}</span>
                <span className="web-panel-tab-label">{page.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="web-panel-nav-right">
        {pageTitle && <span className="web-panel-context-title">{pageTitle}</span>}
        <button
          className="web-panel-popout-btn"
          onClick={onPopOut}
          title="Open current page in a separate editor tab"
          aria-label="Open in new tab"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.5 1A1.5 1.5 0 0 0 0 2.5v11A1.5 1.5 0 0 0 1.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-5a.5.5 0 0 0-1 0v5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H7a.5.5 0 0 0 0-1H1.5z"/>
            <path d="M10.5 0a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5A.5.5 0 0 0 15.5 0h-5z"/>
          </svg>
          <span>Open in New Tab</span>
        </button>
      </div>
    </header>
  );
}
