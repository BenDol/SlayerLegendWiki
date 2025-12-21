# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Links

- **[Architecture Guide](.claude/architecture.md)** - Framework structure, submodules, what lives where
- **[Registry Patterns](.claude/registries.md)** - Content renderer, route, and data browser registries
- **[Development Guide](.claude/development.md)** - Commands, debugging, git workflow
- **[Features Reference](.claude/features.md)** - Components, hooks, and framework capabilities
- **[Configuration](.claude/configuration.md)** - Config files, environment setup, deployment

## Project Overview

This is a **parent wiki project** built using the [GitHub Wiki Framework](https://github.com/BenDol/GithubWiki) as a git submodule. The framework handles all React components, routing, and core functionality, while this repository contains only content, configuration, and customization.

### Critical Concepts

**🚨 FRAMEWORK RULE:** The `wiki-framework/` directory is a **git submodule**. Never edit files inside `wiki-framework/` - all customizations belong in the parent project. The framework must NEVER import from the parent project.

**🎯 REGISTRY PATTERN:** All game-specific functionality is added via registries in `main.jsx`:
- Content renderers for custom markdown syntax
- Custom routes for tools/builders
- Data files for Data Browser
- Pickers for page editor

**READ FROM THE LOGS AT ANY TIME:** The logs are located in `wiki-framework/logs/debug.log`
- These are remote logs for development
- Check the `public/wiki-config.json` to confirm that `enableRemoteLoggingInDev` is `true`, if so you know you can listen for the logs
- The hotreload will apply your changes so in the case where there isn't anything required from the developer, start reviewing the logs for what you need
- The developer will cancel this if they need something else
- If there is no activity in the logs after 3 minutes, cancel the background task to stop viewing the logs (developer is like AFK)
- This is CRITICAL for fast development!

See **[Registry Patterns](.claude/registries.md)** for details.

## Quick Start

```bash
# Development
npm run dev              # Start Netlify dev + config watcher (http://localhost:8888)
npm run build            # Build for production
npm run build:search     # Rebuild search index after content changes

# Framework updates
cd wiki-framework && git pull origin main && cd ..
git add wiki-framework && git commit -m "Update framework"
```

## Project Structure

```
Parent Project (this repo)       Framework Submodule
├── public/content/              wiki-framework/
│   ├── getting-started/         ├── src/           # React app
│   ├── characters/              ├── scripts/       # Build tools
│   └── ...                      └── vite.config.base.js
├── public/data/
├── src/components/              # Game-specific only
├── wiki-config.json             # SOURCE OF TRUTH
├── main.jsx                     # App entry + registrations
└── vite.config.js
```

**Parent project:** Content, config, game-specific components
**Framework submodule:** Generic React app, routing, UI components

See **[Architecture Guide](.claude/architecture.md)** for complete details.

## Common Tasks

### Adding New Content
1. Create markdown file in `public/content/{section}/`
2. Add frontmatter (title, description, tags)
3. Rebuild search: `npm run build:search`

### Adding Game-Specific Component
1. Create component in `src/components/`
2. Register in `main.jsx` if needed for markdown rendering
3. Use Content Renderer Registry pattern

See **[Development Guide](.claude/development.md)** for workflows.

### Modifying Framework
**DO NOT** edit `wiki-framework/` directly. Instead:
1. Check if registries can solve your need
2. If framework change needed, update framework repo separately
3. Pull framework updates: `cd wiki-framework && git pull`

## Important Constraints

1. **Never modify `wiki-framework/` files** - Framework is generic, reusable
2. **Game-specific components belong in `src/components/`** - Keep framework clean
3. **Always rebuild search index** after content changes: `npm run build:search`
4. **Restart dev server** after configuration changes
5. **Use frontmatter** on all markdown files for proper indexing
6. **Never bypass HTML sanitization** - Don't use `dangerouslySetInnerHTML`

## Coding Standards

### Logging Standards

**CRITICAL: Use centralized logger instead of console for all logging.**

The project uses a centralized logging utility (`src/utils/logger.js`) that provides environment-aware filtering and structured prefixes.

#### Basic Usage

```javascript
import { createLogger } from '../utils/logger';
const logger = createLogger('ComponentName');

// Critical user actions
logger.info('User saved build', { buildName, userId });

// Development debugging
logger.debug('Cache hit', { key, value });

// Verbose lifecycle
logger.trace('Effect running', { deps });

// Errors and warnings
logger.error('Failed to load data', { error });
logger.warn('Using fallback value', { key });
```

#### Log Levels

| Level | Production | Development | Use Cases |
|-------|-----------|-------------|-----------|
| **ERROR** | ✅ Visible | ✅ Visible | API failures, exceptions, data corruption |
| **WARN** | ✅ Visible | ✅ Visible | Fallbacks, deprecations, missing optional data |
| **INFO** | ⚠️ Critical Only | ✅ All | User actions + lifecycle events |
| **DEBUG** | ❌ Hidden | ✅ Visible | Cache ops, validations, internal state |
| **TRACE** | ❌ Hidden | ✅ Visible | Lifecycle, polling, verbose tracking |

#### Critical Actions (INFO Logged in Production)

These keywords in INFO messages trigger production logging:
- **Authentication**: `login`, `logout`, `authenticate`
- **Data operations**: `save`, `delete`, `create`, `update`
- **Sharing**: `share`, `export`, `import`, `copy`
- **Monetization**: `donate`, `payment`

#### Child Loggers

Use child loggers for nested contexts:

```javascript
const logger = createLogger('SoulWeapon');
const cacheLogger = logger.child('Cache');
const bestWeaponLogger = logger.child('BestWeapon');

cacheLogger.debug('Cached 5 submissions'); // Outputs: [SoulWeapon:Cache] Cached 5 submissions
```

#### Best Practices

1. **Never use `console.log/warn/error` directly** - Always use logger
2. **Choose appropriate log levels** - Don't use INFO for internal debugging
3. **Include context data** - Pass objects as second parameter
4. **Use consistent prefixes** - Typically component or module name
5. **Keep messages concise** - Logs should be scannable
6. **Production = clean** - Only errors, warnings, and critical actions visible

#### Migration Pattern

**Before:**
```javascript
console.log('[Component] Doing something:', value);
console.error('[Component] Failed:', error);
```

**After:**
```javascript
const logger = createLogger('Component');
logger.debug('Doing something', { value });
logger.error('Failed', { error });
```

### Use Constants for Configuration Values

**CRITICAL: Extract repetitive magic numbers and strings into named constants.**

```javascript
// ❌ BAD - Magic numbers everywhere
const [gridScale, setGridScale] = useState(1.5);
<input min="0.5" max="2.4" step="0.1" />
const newInventory = Array(8).fill(null);

// ✅ GOOD - Named constants
const GRID_SCALE_DEFAULT = 1.5;
const GRID_SCALE_MIN = 0.5;
const GRID_SCALE_MAX = 2.4;
const INVENTORY_SIZE = 8;

const [gridScale, setGridScale] = useState(GRID_SCALE_DEFAULT);
<input min={GRID_SCALE_MIN} max={GRID_SCALE_MAX} />
const newInventory = Array(INVENTORY_SIZE).fill(null);
```

See example in `src/components/SoulWeaponEngravingBuilder.jsx` (lines 25-46).

### Component Rendering Order

**ALWAYS check loading states FIRST** to prevent flickering:

```javascript
// ✅ CORRECT
if (loading) return <LoadingSpinner />;
if (!isAuthenticated) return <AuthRequired />;
if (error) return <ErrorMessage />;
return <Content />;

// ❌ WRONG - Auth check before loading causes flicker
if (!isAuthenticated) return <AuthRequired />;
if (loading) return <LoadingSpinner />;
```

## Git Workflow

**IMPORTANT: Claude should NEVER handle git commits or pushes.**

- User handles all git operations manually
- Claude makes code changes only
- User reviews and commits with their own messages

**Framework submodule:**
- Often in detached HEAD state (normal)
- DO NOT use git commands in `wiki-framework/` directory
- User handles all submodule operations

## Documentation

For detailed information on specific topics, see:

- **[Architecture](.claude/architecture.md)** - Full architecture details
- **[Registries](.claude/registries.md)** - Registry pattern documentation
- **[Development](.claude/development.md)** - Development workflows
- **[Features](.claude/features.md)** - Framework features reference
- **[Configuration](.claude/configuration.md)** - Config and deployment

## Getting Help

- `/help` - Get help with Claude Code
- [GitHub Issues](https://github.com/anthropics/claude-code/issues) - Report issues with Claude Code
- [Framework Docs](https://github.com/BenDol/GithubWiki) - Wiki framework documentation
