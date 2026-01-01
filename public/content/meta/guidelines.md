---
id: guidelines
title: Editing Guidelines
description: Style and formatting guidelines for wiki contributors
tags: [meta, guidelines, style]
category: Meta
date: 2025-12-12
---

# Editing Guidelines

This page outlines best practices for creating and editing content on the Slayer Legend Wiki.

## Page Structure

Every page should include:

### Frontmatter
```yaml
---
title: Your Page Title
description: Brief description for search and previews
tags: [relevant, tags]
category: Section Name
date: 2025-12-12
---
```

### Content Organization

1. **Main heading** (`#`) - Page title
2. **Introduction** - Brief overview of the topic
3. **Sections** (`##`) - Major topics
4. **Subsections** (`###`) - Detailed breakdown

## Writing Style

### Clarity
- Use simple, clear language
- Avoid jargon unless necessary
- Define terms on first use
- Keep sentences concise

### Formatting
- Use **bold** for important terms
- Use *italic* for emphasis
- Use `code blocks` for game terms/UI elements
- Use lists for multiple items

### Examples

**Good:**
> The **Promotion System** allows you to upgrade your character to higher tiers, increasing their base stats.

**Avoid:**
> The promotion system thing lets you make your guy stronger by doing promotions which makes stats go up.

## Images

When adding images:

1. Place images in `/public/images/` in appropriate subdirectories
2. Use descriptive filenames: `promotion-mithril-tier.jpg`
3. Add alt text: `![Mithril tier promotion](/images/promotions/mithril-tier.jpg)`
4. Optimize file sizes (keep under 500KB)

## Tables

Use tables for structured data:

```markdown
| Tier | Gold Cost | Stats Bonus |
|------|-----------|-------------|
| Bronze | 10,000 | +5% |
| Silver | 50,000 | +10% |
| Gold | 100,000 | +15% |
```

## Links

### Internal Links
```markdown
[See Promotion Guide](/characters/promotions)
```

### External Links
```markdown
[Official Discord](https://discord.gg/example)
```

## Keyboard Shortcuts

The page editor supports keyboard shortcuts to speed up your editing workflow. All shortcuts work when the markdown editor is focused.

### Formatting Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| **Ctrl+B** | Bold | Make selected text bold |
| **Ctrl+I** | Italic | Make selected text italic |
| **Ctrl+E** | Code Block | Insert or wrap with code block |
| **Ctrl+Q** | Quote | Insert or wrap with quote |

### Structure Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| **Ctrl+1** | Heading 1 | Convert current line to H1 |
| **Ctrl+2** | Heading 2 | Convert current line to H2 |
| **Ctrl+Shift+L** | Bullet List | Create bullet list |
| **Ctrl+Shift+O** | Numbered List | Create numbered list |

### Insertion Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| **Ctrl+K** | Link | Open link insertion dialog |
| **Ctrl+Shift+T** | Table | Insert markdown table |

### Tips

- **Shortcuts only work when editor is focused** - Click in the editor area first
- **Mac users**: Use **Cmd** instead of **Ctrl**
- **Selection-based shortcuts**: Select text first for bold, italic, code, and quote
- **Line-based shortcuts**: Place cursor on line for heading conversions
- **View shortcuts in tooltips**: Hover over toolbar buttons to see their shortcuts

### Using Shortcuts Effectively

**Format text quickly:**
1. Select the text you want to format
2. Press **Ctrl+B** for bold or **Ctrl+I** for italic
3. No need to type markdown syntax manually

**Create structure fast:**
1. Type your heading text
2. Press **Ctrl+1** or **Ctrl+2** to convert to heading
3. The markdown `#` symbols are added automatically

**Insert links efficiently:**
1. Select link text (optional)
2. Press **Ctrl+K**
3. Enter URL and text in the dialog

## Data Injection System

The wiki supports powerful data injection using the `{{...}}` syntax to automatically display game data like spirits, skills, and equipment.

### Why Use Data Injection?

**Benefits:**
- ✅ Automatic updates when game data changes
- ✅ Consistent formatting across all pages
- ✅ Rich, interactive displays
- ✅ No need to manually maintain stats
- ✅ Autocomplete suggestions in the editor

### Basic Syntax

All data injection uses double curly braces:
```markdown
{{type:identifier:display-mode}}
```

### Spirit Data

**Spirit by ID:**
```markdown
{{data:spirits:1:inline:false}}
```
Displays: Spirit #1 (Todd) inline without showing the ID

**Spirit by ID with card:**
```markdown
{{data:spirits:4}}
```
Displays: Spirit #4 (Loar) as a full card (default mode)

**Parameters:**
- `spirits` - Data source
- ID number (1-13 for spirits)
- `inline` or `card` - Display mode (default: `card`)
- `true` or `false` - Show ID number (default: `true`)

**Examples:**

Use **inline** for mentions in paragraphs:
```markdown
Use {{data:spirits:6:inline:false}} (Todd) for gold farming.
```
Result: Shows Todd's name/icon inline without ID

Use **card** for detailed information:
```markdown
{{data:spirits:8}}
```
Result: Shows full Loar card with stats and abilities

### Skill Data

**Skill by name:**
```markdown
{{skill:Fire Slash}}
```
Displays: Full skill card with detailed information

**Skill with display mode:**
```markdown
{{skill:Ice Spear:compact}}
```
Displays: Compact skill information

**Display modes:**
- `detailed` (default) - Full card with all information
- `compact` - Smaller, condensed display
- `inline` - Just the name/icon for text flow

### Equipment Data

**Equipment by name:**
```markdown
{{equipment:Legendary Sword}}
```
Displays: Full equipment card

**Equipment with mode:**
```markdown
{{equipment:Dragon Armor:compact}}
```
Displays: Compact equipment information

### Generic Data Injection

For any data source in the database:

**Syntax:**
```markdown
{{data:source:id:template:showId}}
```

**Parameters:**
1. `source` - Data type (spirits, skills, equipment, etc.)
2. `id` - Item ID or name
3. `template` - Display template (`card`, `inline`, `table`)
4. `showId` - Show ID number (`true` or `false`)

**Available data sources:**
- `spirits` - Spirit characters
- `skills` - All skills
- `equipment` - Equipment items
- `spirit-upgrades` - Spirit level costs
- `companions` - Companion data

### Common Use Cases

**In paragraphs (inline):**
```markdown
The best spirit for gold farming is {{data:spirits:6:inline:false}},
which provides a significant gold drop bonus.
```

**As references (card):**
```markdown
## Recommended Spirits

For boss farming:
{{data:spirits:4}}

For experience farming:
{{data:spirits:10}}
```

**Lists with inline:**
```markdown
**Key Spirits:**
- Gold: {{data:spirits:6:inline:false}} (Todd)
- Experience: {{data:spirits:10:inline:false}} (Luga)
- Boss: {{data:spirits:4:inline:false}} (Loar)
```

### Legacy HTML Comment Syntax

The system also supports HTML comment syntax (for compatibility):

```markdown
<!-- data:spirits:1:inline:false -->
<!-- skill:Fire Slash:detailed -->
<!-- equipment:Dragon Sword -->
```

**However, the `{{...}}` syntax is preferred** as it's more visible in the editor.

### Editor Autocomplete

The page editor provides autocomplete for data injection:

**To use autocomplete:**
1. Type `{{` in the editor
2. Choose the data type (spirits, skills, equipment)
3. Search for the item by name or ID
4. Select display mode
5. Press Enter to insert

This ensures correct syntax and valid references.

### Spirit IDs Quick Reference

Common spirit IDs for quick reference:
- 1: Ulse (Attack boost)
- 2: Rawy (Critical rate)
- 3: Herh (Cooldown reduction)
- 4: Loar (Boss damage)
- 5: Mum (Normal monster damage)
- 6: Todd (Gold boost)
- 7: Dang (Physical defense)
- 8: Uzu (Drop rate)
- 9: Bo (Max HP)
- 10: Luga (Experience boost)
- 11: Kart (First strike damage)
- 12: Noah (Burst skill damage)
- 13: Song (Skill damage)

### Best Practices

**Do:**
- ✅ Use `inline:false` in sentences to avoid showing IDs
- ✅ Use `card` mode for detailed references
- ✅ Use descriptive text around data injections
- ✅ Test that data injection displays correctly
- ✅ Use autocomplete to avoid typos

**Don't:**
- ❌ Use card mode in middle of sentences
- ❌ Show IDs when mentioning spirits casually
- ❌ Hardcode stats that could be data-injected
- ❌ Use invalid IDs or names
- ❌ Mix multiple display modes inconsistently

### Examples in Context

**Good usage:**
```markdown
## Gold Farming Strategy

Use {{data:spirits:6:inline:false}} (Todd) to maximize gold drops
while farming. His bonus applies to all monster kills.

For detailed information:
{{data:spirits:6}}
```

**Avoid:**
```markdown
Use {{data:spirits:6}} for gold. (Shows full card inline - breaks text flow)
```

### Troubleshooting

**Data injection not showing?**
- Check ID/name is correct
- Verify data source exists
- Try using autocomplete to ensure valid reference
- Check for typos in syntax

**Display looks wrong?**
- Verify display mode (`inline`, `card`, `detailed`, `compact`)
- Check if using `inline` for in-text mentions
- Ensure proper spacing around injection

## Validation

Before submitting:

1. **Preview your changes** - Use the preview mode
2. **Check metadata** - Ensure all required fields are filled
3. **Verify links** - Make sure all links work
4. **Test formatting** - Check tables, lists, and code blocks

## Common Mistakes

- ❌ Missing frontmatter
- ❌ Broken image links
- ❌ Inconsistent heading levels
- ❌ Malformed tables
- ❌ Unclosed code blocks

## Metadata Requirements

The page editor validates metadata to ensure quality:

- **Title**: Required, max 200 characters
- **Description**: Max 500 characters
- **Tags**: Max 20 tags, 50 characters each
- **Category**: Max 100 characters
- **Date**: Valid date format (YYYY-MM-DD)

## Questions?

If you need help or have questions about these guidelines, visit [How to Contribute](/meta/contributing) or open an issue on GitHub.
