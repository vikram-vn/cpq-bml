import Switch from '../components/Switch';
import { IconAdvanced } from '../components/Icons';
import ImportExportButtons from '../components/ImportExportButtons';

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

    const handleReset = () => {
        if (vscodeApi && window.confirm('Are you sure you want to reset all CPQ-BML extension settings to factory defaults?')) {
            vscodeApi.postMessage({ type: 'resetSettings' });
        }
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
            </section>

            <section className="card">
                <h2>
                    Backup &amp; Restore
                </h2>
                <p className="card-desc">Export current CPQ-BML extension configuration to a JSON file or import settings from a backup.</p>
                <ImportExportButtons onImport={handleImport} onExport={handleExport} onReset={handleReset} />
            </section>
        </div>
    );
}

