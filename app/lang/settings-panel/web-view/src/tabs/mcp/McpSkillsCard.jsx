import { useState } from 'react';
import { IconFeatures, IconSync } from '../../components/Icons';

export const BML_SKILLS = [
    {
        name: 'bml-language',
        title: 'Core Language',
        desc: 'Syntax, data types, control flow & built-ins',
        topics: ['Data types (String, Integer, Float, Boolean, Date)', 'Control flow (if/else, for loops)', 'Built-in string & math functions', 'Function signatures & return value validation'],
    },
    {
        name: 'bml-pitfalls',
        title: 'Anti-Patterns & Traps',
        desc: 'Security, memory leaks, performance & limits',
        topics: ['BMQL injection prevention', 'Unbounded loop execution safeguards', 'Excessive datatable row operations', 'String concatenation performance in tight loops'],
    },
    {
        name: 'cpq-domain',
        title: 'CPQ Domain & Architecture',
        desc: 'Commerce, Configuration & BOM lifecycle',
        topics: ['Commerce Process & Document lifecycle', 'Configuration rules & attribute events', 'Bill of Materials (BOM) hierarchy', 'Transaction lines & sub-document structures'],
    },
    {
        name: 'bml-db-access',
        title: 'BMQL & Database',
        desc: 'BMQL syntax, Data Tables & CRUD operations',
        topics: ['SELECT BMQL queries with WHERE & ORDER BY', 'Data Table CRUD operations', 'Parameterized queries to prevent injection', 'Result set records iteration & cleanup'],
    },
    {
        name: 'bml-json-dict',
        title: 'JSON & Dictionaries',
        desc: 'json, jsonarray & dictionary manipulation',
        topics: ['json() and jsonarray() data types', 'jsonget, jsonput & jsonremove methods', 'Dictionary key-value storage mapping', 'Nested JSON formatting & payload building'],
    },
    {
        name: 'bml-web-services',
        title: 'Web Services & REST',
        desc: 'urldata, HTTP REST, SOAP & XML calls',
        topics: ['urldata() HTTP GET/POST integrations', 'Header and timeout configurations', 'SOAP envelope XML creation & parsing', 'Status code checks and error recovery'],
    },
    {
        name: 'bml-editor-workflow',
        title: 'Editor & Libraries',
        desc: 'Function-to-function calls & libraries',
        topics: ['Library utility functions', 'Local vs global function scopes', 'Parameter passing conventions', 'Editor validation & syntax checking'],
    },
    {
        name: 'cpq-rest-api',
        title: 'Oracle CPQ REST APIs',
        desc: 'REST catalog, q-filter, sort & pagination',
        topics: ['Collection filtering with q parameter', 'Sorting with orderBy parameter', 'Pagination with limit & offset', 'Hierarchical expansion with expand parameter'],
    },
];

export default function McpSkillsCard({ isSyncingSkills, handleSyncSkills }) {
    const [selectedSkill, setSelectedSkill] = useState(null);

    return (
        <section className="card" style={{ marginTop: '20px' }}>
            <h2>
                <IconFeatures />
                BML AI Skills
            </h2>
            <p className="card-desc">
                Synchronizes CPQ BigMachines Language guidelines, BMQL rules, and architecture standards into your AI assistant skills. Click any skill card to preview its rules.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', margin: '14px 0' }}>
                {BML_SKILLS.map((s) => {
                    const isSelected = selectedSkill && selectedSkill.name === s.name;
                    return (
                        <div
                            key={s.name}
                            onClick={() => setSelectedSkill(isSelected ? null : s)}
                            style={{
                                border: isSelected
                                    ? '1px solid var(--vscode-focusBorder, #007acc)'
                                    : '1px solid var(--vscode-widget-border, #333)',
                                borderRadius: '5px',
                                padding: '10px',
                                background: isSelected
                                    ? 'var(--vscode-list-activeSelectionBackground, rgba(0, 122, 204, 0.15))'
                                    : 'var(--vscode-editor-background, rgba(0,0,0,0.1))',
                                cursor: 'pointer',
                                transition: 'border-color 0.15s ease'
                            }}
                            title="Click to preview skill topics and rules"
                        >
                            <div style={{ fontWeight: 600, fontSize: '0.85em', color: 'var(--vscode-foreground)' }}>
                                {s.name}
                            </div>
                            <div style={{ fontSize: '0.75em', color: 'var(--vscode-descriptionForeground)', marginTop: '3px' }}>
                                {s.desc}
                            </div>
                        </div>
                    );
                })}
            </div>

            {selectedSkill && (
                <div
                    style={{
                        border: '1px solid var(--vscode-focusBorder, #007acc)',
                        borderRadius: '5px',
                        padding: '12px 14px',
                        marginBottom: '14px',
                        background: 'var(--vscode-editorWidget-background, #252526)'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--vscode-foreground)' }}>
                            Skill Preview: <code style={{ color: 'var(--vscode-textLink-foreground, #3794ff)' }}>{selectedSkill.name}</code> ({selectedSkill.title})
                        </div>
                        <button
                            type="button"
                            className="secondary"
                            onClick={() => setSelectedSkill(null)}
                            style={{ padding: '2px 8px', fontSize: '0.75em' }}
                        >
                            Close
                        </button>
                    </div>
                    <p style={{ fontSize: '0.85em', margin: '0 0 8px', color: 'var(--vscode-descriptionForeground)' }}>
                        {selectedSkill.desc}
                    </p>
                    <div style={{ fontSize: '0.8em', fontWeight: 600, color: 'var(--vscode-foreground)', marginBottom: '4px' }}>
                        Core Topics &amp; Reference Rules:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>
                        {selectedSkill.topics.map((t, i) => (
                            <li key={i} style={{ marginBottom: '2px' }}>{t}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                    type="button"
                    onClick={handleSyncSkills}
                    disabled={isSyncingSkills}
                >
                    <span className={isSyncingSkills ? 'spinner' : ''} style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <IconSync />
                    </span>
                    {isSyncingSkills ? 'Syncing BML Skills...' : 'Sync BML Skills to IDE'}
                </button>
            </div>
        </section>
    );
}
