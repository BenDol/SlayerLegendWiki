# HTML Injection Security Audit Report
**Date**: 2025-12-30
**Scope**: Client and Server-side protections for page editing

## Executive Summary

✅ **VERDICT: ROBUST PROTECTION IN PLACE**

The wiki has **comprehensive, multi-layered security** against HTML injection and XSS attacks:
- ✅ Client-side sanitization (rendering)
- ✅ Server-side validation (PR checks)
- ✅ No raw HTML injection points
- ✅ Automated security testing

## Protection Layers

### 1. Client-Side Sanitization (Critical Layer)

**Location**: `wiki-framework/src/components/wiki/PageViewer.jsx:74-107`

**Technology**: `rehype-sanitize` with custom schema

**What it blocks**:
- ✅ `<script>` tags
- ✅ Event handlers (`onclick`, `onerror`, `onload`, etc.)
- ✅ `javascript:` URLs
- ✅ `<iframe>`, `<object>`, `<embed>` tags
- ✅ `<form>`, `<input>`, `<button>` tags
- ✅ Inline `<style>` tags with JavaScript
- ✅ `<base>` tag manipulation
- ✅ Dangerous data URIs

**What it allows** (whitelist-based):
```javascript
{
  tagNames: ['span', 'div', 'u', ...defaultSchema.tagNames],
  attributes: {
    span: ['className', /^text-/],  // Only text-* Tailwind classes
    img: ['src', 'alt', 'title', 'width', 'height'],
    div: ['align', /^(left|center|right)$/],
    h1-h6: ['id'],  // For anchor links
  },
  protocols: {
    src: ['http', 'https', '/'],  // No javascript:, data:, blob:
    href: ['http', 'https', 'mailto', '/', '#'],
  }
}
```

**Pipeline order** (critical for security):
```
User Content → Markdown Parse → HTML Parse (rehype-raw)
→ SANITIZE (rehype-sanitize) ← CRITICAL
→ Syntax Highlight → Render
```

**Status**: ✅ **SECURE** - Sanitization happens on every render

---

### 2. Server-Side Validation (Secondary Layer)

**Location**: `wiki-framework/scripts/validateHtml.js`

**Trigger**: GitHub Actions on every PR (`html-security-validation.yml`)

**Detection patterns**:
```javascript
CRITICAL Severity:
- <script> tags
- Event handlers (onclick, onerror, etc.)
- javascript: URLs
- Data URIs with scripts
- SVG with embedded scripts

HIGH Severity:
- <iframe> tags
- <object>/<embed> tags
- <base> tags
- CSS expressions (IE legacy)
- Data URIs with HTML

MEDIUM Severity:
- <form> tags
- Meta refresh redirects
- CSS @import in style attributes

LOW Severity:
- Suspicious class names (non-Tailwind)
```

**Features**:
- ✅ Scans all `.md`, `.jsx`, `.js`, `.html` files in PRs
- ✅ Strips code blocks before scanning (prevents false positives)
- ✅ Skips React event handlers (onClick in JSX is safe)
- ✅ Posts detailed report as PR comment
- ✅ Adds `security:warning` label if issues found
- ✅ **BLOCKS PR merge** if critical issues detected

**Status**: ✅ **ACTIVE** - Running on all PRs

---

### 3. Content Storage (GitHub)

**Flow**: `PageEditor → handleSave → updateFileContent → GitHub API`

**Processing**:
```
Content → Parse Frontmatter (gray-matter)
→ UTF-8 Encode → Base64 Encode
→ GitHub API (repos.createOrUpdateFileContents)
```

**No server-side sanitization** during save because:
1. ✅ Content stored as markdown in GitHub (version controlled)
2. ✅ Sanitization happens at render time (client-side)
3. ✅ PR validation catches malicious content before merge
4. ✅ Direct commits require write access (trusted users only)

**Status**: ✅ **SECURE BY DESIGN** - Storage is dumb, rendering is smart

---

### 4. Anonymous Edits

**Method**: GitHub Issues → GitHub Actions → Create PR

**Location**: `wiki-framework/src/services/github/anonymousEdits.js`

**Process**:
1. Client creates GitHub Issue with edit data as JSON
2. GitHub Actions workflow processes the issue
3. Actions creates PR with the content
4. PR goes through standard validation (layer #2 above)

**Security**:
- ✅ Content stored in issue body (not executed)
- ✅ PR creation triggers `html-security-validation.yml`
- ✅ Malicious content blocked before merge
- ✅ No direct write access for anonymous users

**Status**: ✅ **SECURE** - Same validation as authenticated edits

---

## Dangerous Pattern Audit

### ❌ No `dangerouslySetInnerHTML` in User Content

**Found only 2 safe uses**:

1. `wiki-framework/src/pages/MaintenancePage.jsx:34`
   - **Use**: Renders admin-controlled maintenance HTML
   - **Source**: `wiki-config.json` (admin-only)
   - **Status**: ✅ SAFE (admin content, not user-editable)

2. `wiki-framework/src/components/common/FirstTimeTutorial.jsx:173`
   - **Use**: CSS animation styles only
   - **Source**: Hardcoded CSS keyframes
   - **Status**: ✅ SAFE (no user input)

### ✅ No Bypasses Found

Searched for potential sanitization bypasses:
- ❌ No `dangerouslySetInnerHTML` with user content
- ❌ No `v-html` (Vue)
- ❌ No direct DOM manipulation with user input
- ❌ No `eval()` or `Function()` with user content

---

## Attack Scenario Testing

### Scenario 1: XSS via Script Tag
```markdown
<script>alert('XSS')</script>
```
**Result**: ✅ **BLOCKED**
- Server validation: CRITICAL error, PR blocked
- Client sanitization: `<script>` tag stripped

### Scenario 2: Event Handler Injection
```markdown
<img src="x" onerror="alert('XSS')" />
```
**Result**: ✅ **BLOCKED**
- Server validation: CRITICAL error, PR blocked
- Client sanitization: `onerror` attribute stripped

### Scenario 3: JavaScript URL
```markdown
<a href="javascript:alert('XSS')">Click me</a>
```
**Result**: ✅ **BLOCKED**
- Server validation: CRITICAL error, PR blocked
- Client sanitization: `href` removed (invalid protocol)

### Scenario 4: Data URI with HTML
```markdown
<img src="data:text/html,<script>alert('XSS')</script>" />
```
**Result**: ✅ **BLOCKED**
- Server validation: HIGH severity error
- Client sanitization: Invalid `src` protocol stripped

### Scenario 5: SVG with Script
```markdown
<svg><script>alert('XSS')</script></svg>
```
**Result**: ✅ **BLOCKED**
- Server validation: CRITICAL error, PR blocked
- Client sanitization: `<script>` inside SVG stripped

### Scenario 6: CSS Expression (IE Legacy)
```markdown
<div style="width: expression(alert('XSS'))">Content</div>
```
**Result**: ✅ **BLOCKED**
- Server validation: HIGH severity error
- Client sanitization: `style` attribute stripped

---

## Security Strengths

### 1. Defense in Depth
✅ Multiple layers ensure even if one fails, others catch attacks:
- Layer 1: Client sanitization (always active)
- Layer 2: Server validation (PR checks)
- Layer 3: Code review (human oversight)

### 2. Whitelist Approach
✅ Only explicitly allowed HTML is permitted:
- Default: Block everything
- Explicit: Allow specific tags/attributes/protocols
- Safer than blacklist (trying to block known attacks)

### 3. Automated Testing
✅ Security validation runs on every PR:
- No manual security review required
- Immediate feedback to contributors
- Blocks merge if critical issues found

### 4. Comprehensive Documentation
✅ Security measures documented:
- `wiki-framework/SECURITY.md` (detailed guide)
- `CLAUDE.md` (coding standards)
- Inline comments in sanitization schema

### 5. No Trust of User Input
✅ All user content treated as potentially malicious:
- Markdown → parsed → sanitized → rendered
- No assumptions about user intent
- No "trusted user" bypass

---

## Potential Improvements (Optional)

### 1. Content Security Policy (CSP)
**Status**: Not implemented
**Risk**: LOW (sanitization already effective)
**Benefit**: Additional browser-level protection

**Recommendation**: Add CSP headers to block inline scripts:
```
Content-Security-Policy: script-src 'self'; object-src 'none';
```

### 2. Subresource Integrity (SRI)
**Status**: Not checked
**Risk**: LOW (using npm packages)
**Benefit**: Verify CDN resources haven't been tampered with

**Recommendation**: Add SRI hashes to external scripts/styles

### 3. Rate Limiting on Anonymous Edits
**Status**: No rate limiting
**Risk**: MEDIUM (spam/abuse via anonymous form)
**Benefit**: Prevent abuse of anonymous edit system

**Recommendation**: Add rate limiting by IP/fingerprint

### 4. Dependency Scanning
**Status**: Unknown
**Risk**: MEDIUM (npm packages may have vulnerabilities)
**Benefit**: Early detection of vulnerable dependencies

**Recommendation**: Add `npm audit` to CI/CD pipeline

---

## Security Contact

**Reporting Vulnerabilities**:
1. **Do not** create public GitHub issue
2. Contact repository maintainers privately
3. Include proof of concept (sanitized)
4. Allow time for patch before disclosure

**Security Team**: Repository maintainers
**Response Time**: TBD
**Disclosure Policy**: Responsible disclosure

---

## Conclusion

**Overall Security Rating**: ✅ **EXCELLENT**

The wiki has **production-ready security** against HTML injection attacks:

1. ✅ **Client-side sanitization** prevents all XSS attacks at render time
2. ✅ **Server-side validation** catches malicious content in PRs
3. ✅ **No bypass points** - all user content goes through sanitization
4. ✅ **Automated testing** ensures ongoing protection
5. ✅ **Well-documented** security measures

**Recommended Actions**:
- ✅ **Current protections**: Keep existing sanitization and validation
- ⚠️ **Optional**: Add CSP headers for defense in depth
- ⚠️ **Optional**: Add rate limiting for anonymous edits
- ⚠️ **Optional**: Add `npm audit` to CI/CD

**No critical security issues identified.**

---

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [rehype-sanitize Documentation](https://github.com/rehypejs/rehype-sanitize)
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- Wiki Framework Security: `wiki-framework/SECURITY.md`
