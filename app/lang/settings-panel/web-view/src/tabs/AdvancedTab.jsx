import { useState, useRef } from 'react';
import Switch from '../components/Switch';
import { IconAdvanced } from '../components/Icons';
import ImportExportButtons from '../components/ImportExportButtons';
import ShortcutsCheatSheet from '../components/ShortcutsCheatSheet';

export default function AdvancedTab({ active, debug = {}, updateField, vscodeApi }) {
    if (!active) return null;

    const handleImport = () => {
        if (vscodeApi) {
            vscodeApi.postMessage({ type: 'importSettings' });
        }
    };

    const handleExport = () => {
        if (vscodeApi) {
            vscodeApi.postMessage({ type: 'exportSettings' });
        }
    };

    const [confirmingReset, setConfirmingReset] = useState(false);
    const resetTimerRef = useRef(null);

    const handleReset = () => {
        if (!confirmingReset) {
            setConfirmingReset(true);
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
            resetTimerRef.current = setTimeout(() => setConfirmingReset(false), 4000);
            return;
        }
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
            resetTimerRef.current = null;
        }
        setConfirmingReset(false);
        if (vscodeApi) {
            vscodeApi.postMessage({ type: 'resetSettings' });
        }
    };

    const handleCancelReset = () => {
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
            resetTimerRef.current = null;
        }
        setConfirmingReset(false);
    };

    return (
        <div className="tab-content active">
            <section className="card">
                <h2>
                    <IconAdvanced />
                    Diagnostics &amp; Logs
                </h2>
                <p className="card-desc">Configure logging and tracing options for operations and debugging.</p>

                <Switch
                    id="debugLog"
                    label="Log REST Details to File"
                    description="Save detailed API request/response structures inside 'bml_rest_api.log' in the workspace root"
                    checked={debug.logRestDetails}
                    onChange={(v) => updateField('debug.logRestDetails', v)}
                />
                
                <Switch
                    id="logOutputToFile"
                    label="Log Print Statements to File"
                    description="Output BML print logs to 'bml_debug_print.log' and return values to 'bml_debug_output.log' on debugging"
                    checked={debug.logOutputToFile}
                    onChange={(v) => updateField('debug.logOutputToFile', v)}
                />
                
                <Switch
                    id="showResultsAsTable"
                    label="Show Debug Results as Table"
                    description="Format JSON or dictionary return values in BML debug output as a key-value table"
                    checked={debug.showResultsAsTable}
                    onChange={(v) => updateField('debug.showResultsAsTable', v)}
                />

                <div className="field field-spaced" style={{ marginTop: '16px' }}>
                    <label htmlFor="debugConcurrency">Debug Concurrency (Parallel Transactions)</label>
                    <select
                        id="debugConcurrency"
                        value={debug.concurrency !== undefined ? debug.concurrency : 2}
                        onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) {
                                updateField('debug.concurrency', Math.max(2, Math.min(10, val)));
                            }
                        }}
                    >
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                            <option key={num} value={num}>
                                {num} {num === 2 ? '(Default)' : ''}
                            </option>
                        ))}
                    </select>
                    <p className="field-hint" style={{ marginTop: '4px' }}>
                        Number of transactions to debug simultaneously in parallel (2 to 10 max). Default is 2.
                    </p>
                </div>
            </section>

            <section className="card">
                <h2>
                    Keyboard Shortcuts &amp; Reference Cheat Sheet
                </h2>
                <p className="card-desc">Essential shortcuts, commands, and triggers for Oracle CPQ BigMachines Language development.</p>
                <ShortcutsCheatSheet />
            </section>

            <section className="card">
                <h2>
                    Backup &amp; Restore
                </h2>
                <p className="card-desc">Export current CPQ-BML extension configuration to a JSON file or import settings from a backup.</p>
                <ImportExportButtons
                    onImport={handleImport}
                    onExport={handleExport}
                    onReset={handleReset}
                    confirmingReset={confirmingReset}
                    onCancelReset={handleCancelReset}
                />
            </section>
        </div>
    );
}

