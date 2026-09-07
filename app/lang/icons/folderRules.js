/**
 * folderRules.js
 * 
 * Semantic rule definitions and domain concepts dictionary for CPQ-BML
 * dynamic Material folder icon assignment.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Decision Engine: Ordered Rules & Classifiers (67 Rules)
// ─────────────────────────────────────────────────────────────────────────────
const RULE_MATCHERS = [
  // 1. Modifications / Updates / Overrides / Migrations / Patches
  {
    id: 'modifications-updates', icon: 'folder-update',
    regex: /(?:^|[-_./])(modif(?:y|ied|ications?)|updates?|edits?|changes?|overrides?|diffs?|delta|patch(?:es)?|upgrades?)(?:[-_./]|$)/i,
    description: 'Modification scripts, override functions, and incremental patches'
  },
  // 2. Database, BMQL, Data Tables, System Lookups, SQL & Queries
  {
    id: 'database-bmql-tables', icon: 'folder-database',
    regex: /(?:^|[-_./])(db|database|bmql|lookups?|datatables?|data[-_]tables?|sql|queries|query|tables?|records?|dal|repository|repositories|schema|schemas|models?|entities|entity|migrations?|seeders?|fixtures?|bulk[-_]?(?:downloads?|uploads?|imports?|exports?)|downloads?|uploads?|data[-_]?cube[-_]?export|cube)(?:[-_./]|$)/i,
    description: 'BMQL queries, CPQ Data Tables, schema models, and database access'
  },
  // 3. Workflows, Lifecycles, Pipelines & Processes
  {
    id: 'workflows-processes', icon: 'folder-flow',
    regex: /(?:^|[-_./])(workflow|workflows|flow|flows|steps?|process|processes|pipeline|pipelines|lifecycle|lifecycles|gh[-_]?workflows|circleci)(?:[-_./]|$)/i,
    description: 'Workflows, step executions, approval flows, and CI/CD pipelines'
  },
  // 4. JSON & Dictionary Data Structures
  {
    id: 'json-dictionaries', icon: 'folder-json',
    regex: /(?:^|[-_./])(json|dicts?|dictionary|dictionaries|globaldict|hash|hashes|keyval|keyvalue)(?:[-_./]|$)/i,
    description: 'JSON schemas, BML dictionaries, global dictionary helpers'
  },
  // 5. XML, XSL, XSLT, XPath, SOAP & Markup Templates
  {
    id: 'xml-xslt-templates', icon: 'folder-xml',
    regex: /(?:^|[-_./])(xslt?|xsl|xml|xpath|wsdl|markup|soap)(?:[-_./]|$)/i,
    description: 'XML documents, XSL/XSLT transformations, and SOAP envelopes'
  },
  // 6. Web Services, REST, APIs, Endpoints, HTTP & Urldata
  {
    id: 'webservices-rest-api', icon: 'folder-api',
    regex: /(?:^|[-_./])(rest|apis?|web[-_]?services?|webservices?|http|https?|urldata|endpoints?|services?|clients?|requests?|responses?|postman)(?:[-_./]|$)/i,
    description: 'REST web services, HTTP urldata clients, and API definitions'
  },
  // 7. Model Context Protocol (MCP), Remote Integrations & Connectors
  {
    id: 'mcp-integrations-connections', icon: 'folder-connection',
    regex: /(?:^|[-_./])(mcp|connections?|integrations?|rpc|grpc|sockets?|connectors?|adapters?|webhooks?|proxy|proxies|remote|links?|crm|salesforce|dynamics|fusion|e[-_]?business[-_]?suite|docusign|esignature)(?:[-_./]|$)/i,
    description: 'Model Context Protocol (MCP) servers, connectors, and remote integrations'
  },
  // 8. Commerce Processes, Cart, Pricing, Quotes, Transactions & Orders
  {
    id: 'commerce-cart-pricing-quotes', icon: 'folder-cart',
    regex: /(?:^|[-_./])(commerce[-_]?libraries|commerce[-_]?library|commerce[-_]?processes?|commerce|e[-_]?commerce|carts?|shop|pricing|prices?|pricer|transactions?|orders?|quotes?|quoting|collaborative[-_]?quoting|discounts?|charges?|tax|currencies|currency|invoices?|billing|abo|standard[-_]?abo|package[-_]?abo|rate[-_]?cards?|rate[-_]?plans?|shopping[-_]?carts?|subscription[-_]?workbench|workbench(?:es)?)(?:[-_./]|$)/i,
    description: 'Commerce processes, quoting, pricing calculations, and transaction rules'
  },
  // 9. Configuration, Setup, Admin Settings, Options & Preferences
  {
    id: 'config-setup-settings', icon: 'folder-config',
    regex: /(?:^|[-_./])(config|configuration|setup|setups|settings?[-_]?panel|settings?|options?|preferences?|prefs?|environment|environments|env|properties|props|dotenv)(?:[-_./]|$)/i,
    description: 'Configuration rules, extension settings, environment properties, and options'
  },
  // 10. Administration & Management
  {
    id: 'admin-management', icon: 'folder-admin',
    regex: /(?:^|[-_./])(admin|administration|mgmt|management|manager|superadmin|cpq[-_]?admin|host[-_]?company|partner[-_]?organizations?|participant[-_]?profiles?)(?:[-_./]|$)/i,
    description: 'Administration consoles, user management, and system setup'
  },
  // 11. Rules, Business Logic, Policies & Best Practices
  {
    id: 'rules-policies-governance', icon: 'folder-rules',
    regex: /(?:^|[-_./])(rules?|bom[-_]?rules?|policies|policy|approv(?:als?|ers?|ing)|best[-_]?practices?|governance|compliance|delegated[-_]?approvers?)(?:[-_./]|$)/i,
    description: 'Business rules, approval matrices, policy enforcement, and best practices'
  },
  // 12. Constraints, Guardrails & Input Restrictions
  {
    id: 'constraints-guardrails-validators', icon: 'folder-guard',
    regex: /(?:^|[-_./])(constraints?|guards?|guardrails?|restrictions?|limits?|validations?|validators?|sanitizers?)(?:[-_./]|$)/i,
    description: 'Configuration constraints, input validation guardrails, and limits'
  },
  // 13. Recommendations, Recommended Items & Favorites
  {
    id: 'recommendations-favorites', icon: 'folder-favicon',
    regex: /(?:^|[-_./])(recommendations?|recommended[-_]?items?|recommended[-_]?item|favorites?|stars?|featured|upgrades?|upsell|crosssell)(?:[-_./]|$)/i,
    description: 'Product recommendation rules, upsell/cross-sell rules, and favorites'
  },
  // 14. Access Control, Security, User Rights & Permissions
  {
    id: 'security-access-permissions', icon: 'folder-secure',
    regex: /(?:^|[-_./])(access(?:[-_]?rights)?|security|auth|authentication|authorization|permissions?|roles?|rbac|usersession|sessions?|single[-_]?sign[-_]?on|sso)(?:[-_./]|$)/i,
    description: 'Access rights, role permissions, authentication tokens, and user sessions'
  },
  // 15. Secrets, Keys, Passwords & Credentials
  {
    id: 'secrets-keys-credentials', icon: 'folder-keys',
    regex: /(?:^|[-_./])(keys?|secrets?|passwords?|credentials?|certs?|certificates?|tokens?|vault)(?:[-_./]|$)/i,
    description: 'API keys, credentials, secret vaults, and security certificates'
  },
  // 16. Attributes, Variables, Inlay Hints & Parameter Completions
  {
    id: 'attributes-variables-elements', icon: 'folder-element',
    regex: /(?:^|[-_./])(attributes?|variables?|elements?|params?|parameters?|param[-_]?completions?|inlay[-_]?hints?|fields?|props|properties|serial[-_]?numbers?|question[-_]?sets?)(?:[-_./]|$)/i,
    description: 'BML attributes, system variables, parameters, and inlay hint metadata'
  },
  // 17. Constants, Enums, Literals, Strings & Static Values
  {
    id: 'constants-enums-literals', icon: 'folder-constant',
    regex: /(?:^|[-_./])(constants?|enums?|strings?|literals?|types?|typedefs?)(?:[-_./]|$)/i,
    description: 'Constants, string literals, enumeration types, and literal value tables'
  },
  // 18. Debugging, Traces & Diagnostics
  {
    id: 'debug-diagnostics', icon: 'folder-debug',
    regex: /(?:^|[-_./])(debug|debugging|debugger|traces?|profiling|diagnostics?)(?:[-_./]|$)/i,
    description: 'BML debugger files, diagnostic logs, and debug sessions'
  },
  // 19. Pitfalls, Errors, Warnings, Exceptions & Bugs
  {
    id: 'pitfalls-errors-warnings', icon: 'folder-error',
    regex: /(?:^|[-_./])(pitfalls?|errors?|warnings?|bugs?|deprecated|issues?|faults?|exceptions?|problems?)(?:[-_./]|$)/i,
    description: 'BML pitfall detectors, error catalogs, warning handlers, and issue trackers'
  },
  // 20. Linters, Code Review, Diagnostic Inspections & Quality
  {
    id: 'linters-code-review-quality', icon: 'folder-review',
    regex: /(?:^|[-_./])(linters?|lint|reviews?|inspections?|quality|advisories|eslint|audits?)(?:[-_./]|$)/i,
    description: 'BML code linters, AST inspections, quality advisories, and diagnostic checks'
  },
  // 21. Beautifier, Code Formatter & Prettifier
  {
    id: 'beautifier-formatter-prettier', icon: 'folder-beautify',
    regex: /(?:^|[-_./])(beautify|formatters?|formatting|pretty|prettify|cleanup|indent|indenter)(?:[-_./]|$)/i,
    description: 'BML beautifier, indentation engine, and source formatting tools'
  },
  // 22. Code Metrics, Benchmarks, Analytics, Coverage & Telemetry
  {
    id: 'metrics-benchmarks-analytics', icon: 'folder-metrics',
    regex: /(?:^|[-_./])(metrics?|benchmarks?|analytics|stats|statistics|measurements?|coverage|telemetry|profiler)(?:[-_./]|$)/i,
    description: 'Performance benchmarks, AST metrics, test coverage, and analytics'
  },
  // 23. Artificial Intelligence, LLMs, Agents, Gemini, Claude & Copilots
  {
    id: 'ai-agents-llm-gemini', icon: 'folder-gemini-ai',
    regex: /(?:^|[-_./])(ai|agents?|gemini|llm|copilot|bots?|prompts?|crawlers?|claude|openai|gpt|subagents?|nlp|machine[-_]?learning|assistant|intellisense)(?:[-_./]|$)/i,
    description: 'AI agents, Gemini tools, LLM prompts, MCP assistants, and web crawlers'
  },
  // 24. Prompts & Instruction Templates
  {
    id: 'prompts-instructions', icon: 'folder-prompts',
    regex: /(?:^|[-_./])(prompts?|instructions?|prompt[-_]?templates?|system[-_]?prompts?)(?:[-_./]|$)/i,
    description: 'Prompt engineering templates and agent instruction sets'
  },
  // 25. Skills & Agent Capabilities
  {
    id: 'skills-capabilities', icon: 'folder-skills',
    regex: /(?:^|[-_./])(skills?|capabilities|competencies|tools[-_]?catalog)(?:[-_./]|$)/i,
    description: 'Antigravity / AI agent skills, workflows, and tool catalogs'
  },
  // 26. Library Modules, Util Libraries & Packages
  {
    id: 'libraries-packages-modules', icon: 'folder-lib',
    regex: /(?:^|[-_./])(libraries|library|libs?|packages?|pkgs?|modules?|vendor|node_modules|external)(?:[-_./]|$)/i,
    description: 'BML Library functions, external vendor modules, and package bundles'
  },
  // 27. Utilities, Tools, Handlers & Helpers
  {
    id: 'utilities-tools-helpers', icon: 'folder-utils',
    regex: /(?:^|[-_./])(util[-_]?libraries|util[-_]?library|utils?|utilities|helpers?|tool[-_]?defs?|tools?|toolkits?|handlers?|wrappers?)(?:[-_./]|$)/i,
    description: 'General utilities, BML util libraries, tool definitions, and helper routines'
  },
  // 28. Categories, Filters, Groupings & Classifications
  {
    id: 'categories-filters-groupings', icon: 'folder-filter',
    regex: /(?:^|[-_./])(categories|category|filters?|types?|classes|groupings?|taxonomies|taxonomy|tags?)(?:[-_./]|$)/i,
    description: 'Product categories, classification filters, and tag structures'
  },
  // 29. Components & Subcomponents
  {
    id: 'components-subcomponents', icon: 'folder-components',
    regex: /(?:^|[-_./])(components?|subcomponents?|widgets?|controls?)(?:[-_./]|$)/i,
    description: 'Reusable components, subcomponents, and UI widgets'
  },
  // 30. Contracts, SLAs & Legal Terms
  {
    id: 'contracts-agreements', icon: 'folder-contract',
    regex: /(?:^|[-_./])(contracts?|agreements?|sla|terms)(?:[-_./]|$)/i,
    description: 'CPQ contract templates, agreements, SLAs, and legal clauses'
  },
  // 31. Temporary Files & Cache
  {
    id: 'temp-cache', icon: 'folder-temp',
    regex: /(?:^|[-_./])(temp|tmp|temporary|cache|cached)(?:[-_./]|$)/i,
    description: 'Temporary files, caching directories, and ephemeral state'
  },
  // 32. Webviews, Layouts, UI Panels, Tabs & Screens
  {
    id: 'webviews-layouts-ui', icon: 'folder-layout',
    regex: /(?:^|[-_./])(web[-_]?views?|layouts?|views?|ui|screens?|windows?|tabs?|panels?|pages?|designers?)(?:[-_./]|$)/i,
    description: 'VS Code webviews, CPQ layout editors, UI panels, and screen definitions'
  },
  // 33. Themes, Material Icons & Appearance
  {
    id: 'themes-icons-appearance', icon: 'folder-theme',
    regex: /(?:^|[-_./])(material|themes?|styles?|css|icons?|appearance|colors?|palettes?)(?:[-_./]|$)/i,
    description: 'Material icon themes, color themes, styling stylesheets, and assets'
  },
  // 34. Actions, Triggers, Events & Handlers
  {
    id: 'actions-triggers-events', icon: 'folder-trigger',
    regex: /(?:^|[-_./])(actions?|triggers?|commands?|events?|listeners?|signals?|hooks?|interceptors?|punch[-_]?in|punchin[-_]?actions?)(?:[-_./]|$)/i,
    description: 'Action scripts, trigger functions, event listeners, and hook handlers'
  },
  // 35. Comments, Annotations, Messages & Discussions
  {
    id: 'comments-messages-discussions', icon: 'folder-messages',
    regex: /(?:^|[-_./])(comments?|messages?|chat|discussions?|notes?|feedback|conversations?)(?:[-_./]|$)/i,
    description: 'BML comment processors, doc annotations, message channels, and chats'
  },
  // 36. Tests, Testing Suites, Specs & Runners
  {
    id: 'tests-specs-runners', icon: 'folder-test',
    regex: /(?:^|[-_./])(tests?|testing|specs?|suites?|unit|integration|e2e|benchmarks?[-_]?tests?)(?:[-_./]|$)/i,
    description: 'BML unit tests, regression suites, test runners, and test fixtures'
  },
  // 37. Mocks, Stubs, Fixtures & Fakes
  {
    id: 'mocks-stubs-fixtures', icon: 'folder-mock',
    regex: /(?:^|[-_./])(mocks?|stubs?|fixtures?|fakes?|spies|doubles)(?:[-_./]|$)/i,
    description: 'Mock data, test stubs, simulated CPQ responses, and fixtures'
  },
  // 38. Sandbox, Scratchpad & Experiments
  {
    id: 'sandbox-scratch-playground', icon: 'folder-sandbox',
    regex: /(?:^|[-_./])(sandbox|scratch|scratchpad|playground|experiments?|labs?|drafts?)(?:[-_./]|$)/i,
    description: 'Experimental scratchpad, temporary sandbox scripts, and playgrounds'
  },
  // 39. Snapshots, Backups & History
  {
    id: 'snapshots-backups-history', icon: 'folder-backup',
    regex: /(?:^|[-_./])(snapshots?|backups?|history|archives?|dumps?)(?:[-_./]|$)/i,
    description: 'Environment snapshots, state backups, change history, and archives'
  },
  // 40. Syntaxes, Grammars, Tokenizers, AST & Spell Checking
  {
    id: 'syntaxes-grammars-lexer-ast', icon: 'folder-syntax',
    regex: /(?:^|[-_./])(syntaxes?|syntax|spell[-_]?check|spelling|grammar|grammars|tokens?|lexers?|parsers?|ast)(?:[-_./]|$)/i,
    description: 'TextMate syntaxes, BML grammar definitions, AST parsers, and spellcheck'
  },
  // 41. Mathematics & Mathematical Formulas
  {
    id: 'math-formulas-calculations', icon: 'folder-functions',
    regex: /(?:^|[-_./])(math|formulas?|calculat(?:or|ors|ions?|ed?)|algorithms?|arithmetic|win[-_]?probability)(?:[-_./]|$)/i,
    description: 'Mathematical formulas, calculation engines, and numerical functions'
  },
  // 42. Dates, DateTime & Event Calendars
  {
    id: 'dates-datetime-calendars', icon: 'folder-event',
    regex: /(?:^|[-_./])(dates?|datetime|time|events?|calendar|clocks?|timestamps?)(?:[-_./]|$)/i,
    description: 'Date/time utilities, calendar calculations, and event scheduling'
  },
  // 43. Arrays, Queues, Lists & Collections
  {
    id: 'arrays-queues-lists', icon: 'folder-queue',
    regex: /(?:^|[-_./])(arrays?|queues?|lists?|line[-_]?items?|collections?|stacks?)(?:[-_./]|$)/i,
    description: 'BML arrays, line item arrays, priority queues, and collection handlers'
  },
  // 44. BOM (Bill of Materials), Products, Hierarchy Trees & Clusters
  {
    id: 'bom-hierarchy-trees-clusters', icon: 'folder-cluster',
    regex: /(?:^|[-_./])(bom|bill[-_]?of[-_]?materials?|hierarchy|trees?|clusters?|parts?|catalog|catalog[-_]?definition|all[-_]?product[-_]?families?|products?|product[-_]?lines?|product[-_]?line|product[-_]?families?|product[-_]?family|models?|manage[-_]?boms?)(?:[-_./]|$)/i,
    description: 'BOM hierarchies, product lines/families, part catalogs, and clusters'
  },
  // 45. Web Links & Hyperlinks
  {
    id: 'urls-links-hyperlinks', icon: 'folder-link',
    regex: /(?:^|[-_./])(urls?|links?|href|shortcuts?|aliases)(?:[-_./]|$)/i,
    description: 'Reference URLs, CPQ bookmark links, and external documentation hrefs'
  },
  // 46. Documentation, Markdown & DocMD
  {
    id: 'docs-markdown-docmd', icon: 'folder-docs',
    regex: /(?:^|[-_./])(docs?|documentations?|markdown|docmd|html2docmd|guides?|manuals?|readme|articles?)(?:[-_./]|$)/i,
    description: 'BML documentation, Markdown guides, DocMD generators, and manuals'
  },
  // 47. PDF & Print Document Engine
  {
    id: 'pdf-print-documents', icon: 'folder-pdf',
    regex: /(?:^|[-_./])(pdf|pdfs|print|doc[-_]?engine|proposals?|datasheets?)(?:[-_./]|$)/i,
    description: 'PDF document generation, proposal engines, and print templates'
  },
  // 48. Privacy & Hiding Rules
  {
    id: 'privacy-hiding-rules', icon: 'folder-private',
    regex: /(?:^|[-_./])(hiding|hidden|privates?|internal|secrets?)(?:[-_./]|$)/i,
    description: 'BML hiding rules, private libraries, and internal attributes'
  },
  // 49. Scripts, Automation & Build Tasks
  {
    id: 'scripts-automation-cli', icon: 'folder-scripts',
    regex: /(?:^|[-_./])(scripts?|automation|runners?|cli|tasks?|bin|jobs?|cron|scheduler)(?:[-_./]|$)/i,
    description: 'Build scripts, automation runners, CLI tools, and scheduled tasks'
  },
  // 50. Command-line Tools & Shell Scripts
  {
    id: 'commands-cli-tools', icon: 'folder-command',
    regex: /(?:^|[-_./])(commands?|cmds?|cli[-_]?tools?)(?:[-_./]|$)/i,
    description: 'Command palettes, CLI subcommands, and operational commands'
  },
  // 52. Source Code Roots
  {
    id: 'source-code-roots', icon: 'folder-src',
    regex: /(?:^|[-_./])(src|sources?|app|apps?|applications?|code|core)(?:[-_./]|$)/i,
    description: 'Main source code and application roots'
  },
  // 52. Distribution, Build Output & Target Artifacts
  {
    id: 'dist-build-artifacts', icon: 'folder-dist',
    regex: /(?:^|[-_./])(dist|build|out|output|target|releases?|bundles?|artifacts?)(?:[-_./]|$)/i,
    description: 'Build distribution bundles, target packages, and compiled output'
  },
  // 53. Snippets, Code Fragments & Templates
  {
    id: 'snippets-code-fragments', icon: 'folder-snippet',
    regex: /(?:^|[-_./])(snippets?|code[-_]?snippets?|fragments?|templates?|boilerplate)(?:[-_./]|$)/i,
    description: 'BML code snippets, boilerplate templates, and reusable fragments'
  },
  // 54. Version Control & Git Repositories
  {
    id: 'git-vcs-repositories', icon: 'folder-git',
    regex: /(?:^|[-_./])(git|\.git|vcs|github|gitlab|gitea|repo|repositories)(?:[-_./]|$)/i,
    description: 'Git repositories, version control configs, and repository hooks'
  },
  // 55. VS Code, IDEs & Extensions
  {
    id: 'vscode-ide-extensions', icon: 'folder-vscode',
    regex: /(?:^|[-_./])(\.vscode|vscode|ide|extensions?|plugins?|addons?)(?:[-_./]|$)/i,
    description: 'VS Code workspaces, launch configurations, and extension bundles'
  },
  // 56. Logs, Logging, Audits & Traces
  {
    id: 'logs-audits-traces', icon: 'folder-log',
    regex: /(?:^|[-_./])(logs?|logging|audits?|traces?|journal|history)(?:[-_./]|$)/i,
    description: 'Execution logs, REST API logs, audit trails, and runtime traces'
  },
  // 57. Internationalization (i18n) & Localization (l10n)
  {
    id: 'i18n-localization-locales', icon: 'folder-i18n',
    regex: /(?:^|[-_./])(i18n|l10n|locales?|languages?|translations?|messages[-_]?(?:en|fr|de|es|ja|zh))(?:[-_./]|$)/i,
    description: 'Internationalization bundles, locale dictionaries, and translations'
  },
  // 58. Images, Media & Vector Graphics
  {
    id: 'images-media-graphics', icon: 'folder-images',
    regex: /(?:^|[-_./])(images?|img|media|assets?|graphics?|svgs?|drawings?|photos?)(?:[-_./]|$)/i,
    description: 'Images, SVG icons, media assets, and graphic resources'
  },
  // 59. Stylesheets, CSS & Visual Themes
  {
    id: 'styles-css-themes', icon: 'folder-css',
    regex: /(?:^|[-_./])(css|styles?|stylesheets?|themes?|sass|scss|less|styling)(?:[-_./]|$)/i,
    description: 'CSS, stylesheets, style themes, and styling resources'
  },
  // 59. Code Generators & Scaffolding
  {
    id: 'generators-scaffolding', icon: 'folder-generator',
    regex: /(?:^|[-_./])(generators?|generate|scaffolding|codegen|builders?)(?:[-_./]|$)/i,
    description: 'Code generators, schema builders, and scaffolding tools'
  },
  // 60. Middleware & Interceptors
  {
    id: 'middleware-interceptors', icon: 'folder-middleware',
    regex: /(?:^|[-_./])(middleware|middlewares|interceptors?|pipeline[-_]?handlers?)(?:[-_./]|$)/i,
    description: 'Middleware pipelines, request/response interceptors, and filters'
  },
  // 61. Routes & Routing Handlers
  {
    id: 'routes-router-handlers', icon: 'folder-routes',
    regex: /(?:^|[-_./])(routes?|routing|router|controllers?|endpoints?)(?:[-_./]|$)/i,
    description: 'URL routing tables, request controllers, and route handlers'
  },
  // 62. State Management, Stores & Caching
  {
    id: 'stores-state-cache', icon: 'folder-store',
    regex: /(?:^|[-_./])(stores?|state|storage|cache|caching|memento)(?:[-_./]|$)/i,
    description: 'State management stores, runtime caches, and storage drivers'
  },
  // 63. Python Scripts & Modules
  {
    id: 'python-modules', icon: 'folder-python',
    regex: /(?:^|[-_./])(python|py|scripts[-_]?py|crawlers?[-_]?py)(?:[-_./]|$)/i,
    description: 'Python helper scripts, doc crawlers, and ML tools'
  },
  // 64. TypeScript & JavaScript Source
  {
    id: 'javascript-typescript-source', icon: 'folder-javascript',
    regex: /(?:^|[-_./])(typescript|ts|javascript|js|node)(?:[-_./]|$)/i,
    description: 'JavaScript / TypeScript source files and Node.js routines'
  },
  // 65. Containerization & Cloud Infrastructure
  {
    id: 'containers-cloud-infrastructure', icon: 'folder-container',
    regex: /(?:^|[-_./])(docker|containers?|k8s|kubernetes|helm|compose|cloud|oci|aws|azure|gcp|serverless)(?:[-_./]|$)/i,
    description: 'Docker containers, Kubernetes manifests, and cloud infrastructure'
  },
  // 66. Language Fallbacks: Any unclassified BML folder gets BML icon
  {
    id: 'fallback-bml', icon: 'folder-bml',
    regex: /bml/i,
    description: 'Fallback icon for general BML language scripts and modules'
  },
  // 67. Domain Fallbacks: Any unclassified CPQ folder gets CPQ Cart icon
  {
    id: 'fallback-cpq', icon: 'folder-cart',
    regex: /cpq/i,
    description: 'Fallback icon for general Oracle CPQ domain components'
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// Oracle CPQ & BML Domain Lexicon
// ─────────────────────────────────────────────────────────────────────────────
const CPQ_BML_DOMAIN_CONCEPTS = [
  "abo-external-orders", "abo-workbench", "access", "advisories", "agents",
  "ai-functions", "all-product-families", "approval-matrix", "approval-notifications", "approval-sequences",
  "approvals", "array-sets", "arrays", "asset-based-ordering", "assets",
  "attributes", "audit-log", "auth", "beautify", "benchmarks",
  "bill-of-materials", "bml-scripts", "bml-unit-tests", "bmlt", "bmql",
  "bom", "bom-attribute-definition", "bom-instance", "bom-item-definition", "bom-item-tree",
  "bom-items", "bom-mapping", "bom-panel", "bom-pricing", "bom-root-items",
  "bom-rules", "bom-tables", "build", "bulk-downloads", "bulk-uploads",
  "business-metrics", "cache", "calculators", "catalog-definition", "categories",
  "charge-definitions", "claude", "collaborative-quoting", "commerce-cloud", "commerce-functions",
  "commerce-libraries", "commerce-process", "commerce-processes", "components", "config-rules",
  "configurable-attributes", "configuration", "configuration-flows", "constants", "constraint",
  "constraint-rules", "contract-negotiations", "contracts", "copilot", "coverage",
  "crawler", "crawler-docs", "custom-actions", "custom-asset-fields", "custom-xsl",
  "data-cube-export", "data-table-validation", "data-tables", "database", "date",
  "datetime", "deal-management", "debug", "delegated-approvers", "developer-toolkit",
  "dictionary", "digital-assistant", "dist", "doc-engine", "docmd",
  "docs", "document-designer", "document-views", "docusign-esignature", "dynamics-crm",
  "e-business-suite", "eligibility-rules", "email-authentication", "email-designer", "enterprise-contracts",
  "external-configurator", "external-email", "file-manager", "formula-management", "forwarding-rules",
  "ftp-automation", "fusion-crm", "gemini", "general-settings", "git",
  "github", "heading-styles", "help-icons", "helpers", "hiding",
  "hiding-rules", "host-company", "icons", "inlay-hints", "integration-center",
  "integrations", "intellisense", "jet-transaction-ui", "json", "layout-editor",
  "libraries", "line-item-grid", "line-items", "lint", "manage-boms",
  "manage-parts", "material", "math", "mcp-servers", "mcp-tools",
  "menu-attributes", "metrics", "migration-activities", "migration-center", "migration-packages",
  "model", "model-mapping", "models", "modified", "modify",
  "order-management", "order-of-operations", "orders", "override-functions", "package-abo",
  "param-completions", "part-associations", "part-custom-fields", "part-filters", "participant-profiles",
  "partner-organizations", "parts-management", "parts-search", "price-agreements", "price-books",
  "price-guidance", "price-models", "price-optimization", "price-score", "price-waterfall",
  "pricing", "pricing-engine", "pricing-lookups", "pricing-matrices", "pricing-options",
  "pricing-portal", "pricing-preview", "pricing-rules", "print-documents", "product-configuration",
  "product-families", "product-family", "product-line", "product-lines", "profiling",
  "proposals", "proxy-login", "punch-in", "punchin-actions", "quality",
  "question-sets", "quote-actions", "quote-designer", "rate-cards", "rate-plans",
  "recommendation", "recommendation-rules", "recommended-item", "recommended-items", "redwood-admin",
  "redwood-quote-ui", "reference-application", "report-templates", "rest", "rules",
  "salesforce-crm", "scripts", "security", "serial-numbers", "services",
  "shopping-carts", "single-sign-on", "site-metrics", "skills", "snapshots",
  "snippets", "soap", "sql", "standard-abo", "strings",
  "style-sets", "stylesheet-manager", "subcomponents", "submit-actions", "subscription-management",
  "subscription-workbench", "syntaxes", "telemetry", "temp", "testing",
  "themes", "tokens", "tool-defs", "transaction-line-grid", "transaction-lines",
  "transaction-locking", "transactions", "transition-rules", "ui-designer", "urldata",
  "user-access-rights", "user-permissions", "util-functions", "util-libraries", "utils",
  "validation", "variables", "web-services", "web-view", "win-probability",
  "workflow-interaction", "xml", "xslt"
];

module.exports = {
  RULE_MATCHERS,
  CPQ_BML_DOMAIN_CONCEPTS
};
