# CRITICAL: Code Removal Policy

**NEVER blindly remove code without thorough verification.**

## Required Steps Before Removing ANY Code

### 1. Search for ALL usages
```bash
# Search for variable/prop name across entire codebase
grep -r "variableName" src/
```

### 2. Trace the data flow
- Where is this data coming from?
- Where is it going?
- What depends on it?
- Are there side effects or callbacks?

### 3. Check parent/child relationships
- If removing a prop, check BOTH:
  - Parent component (where it's passed)
  - Child component (where it's received)
- Look for state that depends on the prop
- Look for effects that use it in dependencies

### 4. Search for indirect usage
- Used in useEffect dependency arrays?
- Used in useMemo/useCallback dependencies?
- Used in conditional logic?
- Passed to other components?

### 5. Consider all modes/contexts
- Does the component work in multiple modes? (modal, page, etc.)
- Are there feature flags that change behavior?
- Different user states? (authenticated, anonymous)

## Example Mistake: SpiritBuilder savedBuilds

**What I did wrong:**
Removed both `savedBuilds={savedBuilds}` and `onBuildsChange={setSavedBuilds}` props without checking usage.

**What I should have done:**
1. Search for `savedBuilds` usage: Found it used in lines 51, 266, 279, 289
2. Trace data flow: Parent needs `savedBuilds` for matching logic (line 279)
3. Check panel implementation: Found `onBuildsChange(sortedBuilds)` call (line 101)
4. Conclusion: Keep `onBuildsChange`, remove only `savedBuilds` prop

**Correct fix:**
- Remove `savedBuilds={savedBuilds}` (causes controlled mode with empty array)
- Keep `onBuildsChange={setSavedBuilds}` (parent needs the data)

## The Rule

**If you're not 100% certain a piece of code is unused, DO NOT REMOVE IT.**

When in doubt:
1. Ask the user
2. Add a TODO comment
3. Leave it alone

Removing working code is ALWAYS worse than leaving unused code.
