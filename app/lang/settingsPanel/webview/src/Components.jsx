import { useState } from 'react';

export function Pill({ tone, children }) {
    return <span className={`pill ${tone}`}>{children}</span>;
}

export function Switch({ id, label, description, checked, onChange }) {
    return (
        <div className="switch">
            <div className="switch-label-group">
                <span className="switch-label">{label}</span>
                {description && <p className="field-hint">{description}</p>}
            </div>
            <label className="switch-control" htmlFor={id}>
                <input id={id} type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
                <span className="switch-track">
                    <span className="switch-thumb" />
                </span>
            </label>
        </div>
    );
}

export const IconConnection = () => (
    <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
);

export const IconEnvironments = () => (
    <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
);

export const IconOperations = () => (
    <svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /><line x1="12" y1="4" x2="12" y2="20" /></svg>
);

export const IconMcp = () => (
    <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></svg>
);

export const IconAdvanced = () => (
    <svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
);

export const IconFeatures = () => (
    <svg viewBox="0 0 24 24"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
);
