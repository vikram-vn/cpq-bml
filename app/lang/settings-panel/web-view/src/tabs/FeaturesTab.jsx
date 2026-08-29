import Switch from '../components/Switch';
import { IconFeatures } from '../components/Icons';

export default function FeaturesTab({ active, features = {}, inlayHints = {}, updateField }) {
    if (!active) return null;

    return (
        <div className="tab-content active">
            <section className="card">
                <h2>
                    <IconFeatures />
                    Editor Features
                </h2>
                <p className="card-desc">Configure BigMachines Language (BML) editor assistant features.</p>

                <Switch
                    id="lintEnable"
                    label="Enable BML Linting"
                    description="Runs diagnostics and quick-fix suggestions for BigMachines Language syntax"
                    checked={features.lint}
                    onChange={(v) => updateField('features.lint', v)}
                />

                <Switch
                    id="commentsEnable"
                    label={<>Enable BML Better Comments <span className="shortcut-chip">Ctrl+/</span></>}
                    description="Colorizes tagged comments (TODO/FIXME/!/?/* etc), highlights bml-lint-disable and beautify ignore directives, and styles doc-header comment blocks"
                    checked={features.comments}
                    onChange={(v) => updateField('features.comments', v)}
                />

                <Switch
                    id="spellingEnable"
                    label="Enable BML Spelling Checker"
                    description="Checks spelling in comments, identifiers, and string literals using custom and English dictionaries"
                    checked={features.spelling}
                    onChange={(v) => updateField('features.spelling', v)}
                />

                <Switch
                    id="beautifierEnable"
                    label={<>Enable BML Beautifier <span className="shortcut-chip">Shift+Alt+F</span></>}
                    description="Formats and cleans up BigMachines Language source files or selections using standard formatting style"
                    checked={features.beautifier}
                    onChange={(v) => updateField('features.beautifier', v)}
                />

                <Switch
                    id="intellisenseEnable"
                    label={<>Enable BML IntelliSense <span className="shortcut-chip">Ctrl+Space</span></>}
                    description="Enables autocomplete, hover tips, signature help, go-to-definition, find all references, rename symbol, and document outline/breadcrumbs"
                    checked={features.intellisense}
                    onChange={(v) => updateField('features.intellisense', v)}
                />

                <Switch
                    id="inlayHintsEnable"
                    label="Enable Parameter Inlay Hints"
                    description="Renders inline parameter name labels inside BML function call parentheses"
                    checked={inlayHints.enabled}
                    onChange={(v) => updateField('inlayHints.enabled', v)}
                />

                <Switch
                    id="inlayVarTypesEnable"
                    label="Enable Inferred Variable Type Hints"
                    description="Renders inline data type annotations for variable declarations inferred from BMQL, constructors, or function returns"
                    checked={inlayHints.variableTypes}
                    onChange={(v) => updateField('inlayHints.variableTypes.enabled', v)}
                />

                <Switch
                    id="docHeaderEnable"
                    label={<>Enable Auto Doc-Header <span className="shortcut-chip">///</span></>}
                    description="Automatically generates and inserts structured BML function doc-headers when typing '///' at start of line"
                    checked={features.docHeader}
                    onChange={(v) => updateField('features.docHeader', v)}
                />

                <Switch
                    id="xsltEnable"
                    label="Enable XSLT Formatting"
                    description="Formats XML/XSLT documents using standard XML/XSLT formatting style"
                    checked={features.xslt}
                    onChange={(v) => updateField('features.xslt', v)}
                />

                <Switch
                    id="metricsEnable"
                    label="Enable BML Code Metrics"
                    description="Calculates cyclomatic complexity, nesting depth, line counts, and generates workspace-wide metrics dashboard"
                    checked={features.metrics}
                    onChange={(v) => updateField('features.metrics', v)}
                />

                <Switch
                    id="testingEnable"
                    label="Enable BML Unit &amp; Snapshot Testing"
                    description="Enables running tests from *.bmltest.json sidecars, and creating/running regression snapshot tests against remote environments"
                    checked={features.testing}
                    onChange={(v) => updateField('features.testing', v)}
                />
            </section>
        </div>
    );
}
