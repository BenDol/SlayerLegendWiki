# HTML Security Validation Workflow

## Overview

This GitHub Actions workflow automatically validates HTML content in pull requests to detect potential XSS and injection attacks.

## When It Runs

- **Trigger**: Pull requests (opened, synchronized, reopened)
- **Files**: Changes to markdown and JavaScript files in:
  - `public/content/**/*.md`
  - `src/**/*.jsx`
  - `src/**/*.js`

## What It Does

### 1. Security Scanning
Scans changed files for dangerous patterns:
- Script tags (`<script>`)
- Event handlers (`onclick`, `onerror`, etc.)
- JavaScript URLs (`javascript:`)
- Data URIs with HTML/JavaScript
- Iframe/object/embed injection
- Form elements
- Base tag manipulation
- CSS expressions
- SVG with scripts

### 2. Severity Levels

- **🔴 Critical**: Script injection, event handlers, JavaScript URLs
- **🟠 High**: Iframes, objects, base tags, data URIs
- **🟡 Medium**: Forms, meta refresh
- **🔵 Low**: Suspicious class names

### 3. PR Comments

Automatically posts a comment on the PR with:
- Summary table of issues by severity
- Detailed list of each finding with file location
- Explanation of what was detected
- Information about sanitization

### 4. Labels

- **Adds `security:warning`**: When critical/high severity issues are detected
- **Removes label**: When issues are resolved

### 5. Status Checks

- **✅ Passes**: No critical issues detected
- **❌ Fails**: Critical issues found (blocks merge if required)

## Example Report

When issues are detected, the workflow comments:

```markdown
## 🚨 HTML Security Validation Results

**⚠️ CRITICAL SECURITY ISSUES DETECTED**

### Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 2 |
| 🟠 High | 1 |
| 🟡 Medium | 0 |
| 🔵 Low | 0 |

### 🔴 Critical Severity Issues

**`public/content/guides/example.md:42`**
- Script tag detected - potential XSS attack
- Matched: `<script>`
- Context: `<script>alert('XSS')</script>`

**`public/content/guides/example.md:58`**
- Event handler attribute detected - potential XSS attack
- Matched: `onclick=`
- Context: `<img src="x" onclick="alert('XSS')">`
```

## Configuration

### Validation Script
**File**: `wiki-framework/scripts/validateHtml.js`

Defines security patterns and severity levels. Modify here to:
- Add new patterns
- Adjust severity levels
- Exclude certain patterns

### Workflow Settings
**File**: `.github/workflows/html-security-validation.yml`

Modify to:
- Change trigger paths
- Adjust permissions
- Customize label behavior

## Testing Locally

Run the validator manually:

```bash
# Validate all files
npm run validate:html

# Or directly
node wiki-framework/scripts/validateHtml.js

# In PR context (simulated)
GITHUB_BASE_REF=origin/main GITHUB_SHA=HEAD node wiki-framework/scripts/validateHtml.js
```

## False Positives

If legitimate HTML is flagged:

1. **Comment on the PR** explaining why the HTML is safe
2. **Request review** from a maintainer
3. **Consider refactoring** to use markdown instead of HTML

The sanitizer will still block dangerous content even if the check passes.

## Bypassing (Not Recommended)

To bypass the check (emergency only):

1. Maintainers can merge despite failing check
2. Or temporarily disable workflow in repo settings

**Note**: The sanitizer (`rehype-sanitize`) still protects against XSS even if this check is bypassed.

## Maintenance

### Adding New Patterns

Edit `wiki-framework/scripts/validateHtml.js`:

```javascript
SECURITY_PATTERNS.newPattern = {
  pattern: /dangerous-pattern/gi,
  severity: 'critical',
  message: 'Description of the issue'
};
```

### Updating Labels

Labels are managed via `.github/labels.json` and synced automatically.

## Security Philosophy

This workflow provides **defense in depth**:

1. **Layer 1**: This GitHub Action (detection before merge)
2. **Layer 2**: `rehype-sanitize` (runtime protection)
3. **Layer 3**: Content Security Policy (browser protection)

Even if someone bypasses this check, the sanitizer prevents actual XSS attacks.

## Related Documentation

- [`wiki-framework/SECURITY.md`](../../wiki-framework/SECURITY.md) - Sanitization details
- [`.claude/memory/HTML-INJECTION-SECURITY.md`](../../.claude/memory/HTML-INJECTION-SECURITY.md) - Implementation notes
- [`CLAUDE.md`](../../CLAUDE.md) - Security section

## Troubleshooting

### Workflow Not Running

- Check file paths match trigger patterns
- Verify workflow is enabled in repo settings
- Check GitHub Actions permissions

### False Negatives

If malicious content isn't detected:
- Update patterns in `validateHtml.js`
- Test locally first
- Report the pattern for future detection

### False Positives

If safe content is flagged:
- Refactor to use markdown syntax
- Use toolbar features (color picker, image inserter)
- Request maintainer review with explanation
