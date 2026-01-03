---
id: emoticons
title: Emoticons
description: Learn how to use Slayer Legend emoticons in wiki pages
tags: [meta, emoticons, markup]
category: Meta
date: 2025-12-23
---

# Emoticons

Slayer Legend emoticons can be used throughout the wiki to add personality and expression to your content!

## Available Emoticons

Here are all the available emoticons:

| ID | Name | Preview | Usage |
|----|------|---------|-------|
| 1 | Hello | {{emoticon:1}} | `{{emoticon:1}}` or `{{emoticon:Hello}}` |
| 2 | Yep | {{emoticon:2}} | `{{emoticon:2}}` or `{{emoticon:Yep}}` |
| 3 | Laugh | {{emoticon:3}} | `{{emoticon:3}}` or `{{emoticon:Laugh}}` |
| 4 | Okay | {{emoticon:4}} | `{{emoticon:4}}` or `{{emoticon:Okay}}` |
| 5 | Cheer | {{emoticon:5}} | `{{emoticon:5}}` or `{{emoticon:Cheer}}` |
| 6 | Cool | {{emoticon:6}} | `{{emoticon:6}}` or `{{emoticon:Cool}}` |
| 7 | Exhausted | {{emoticon:7}} | `{{emoticon:7}}` or `{{emoticon:Exhausted}}` |
| 8 | Congrats | {{emoticon:8}} | `{{emoticon:8}}` or `{{emoticon:Congrats}}` |
| 1001 | Ok | {{emoticon:1001}} | `{{emoticon:1001}}` or `{{emoticon:Ok}}` |
| 1002 | No | {{emoticon:1002}} | `{{emoticon:1002}}` or `{{emoticon:No}}` |
| 1003 | Hm | {{emoticon:1003}} | `{{emoticon:1003}}` or `{{emoticon:Hm}}` |
| 1004 | Love | {{emoticon:1004}} | `{{emoticon:1004}}` or `{{emoticon:Love}}` |
| 1005 | Question | {{emoticon:1005}} | `{{emoticon:1005}}` or `{{emoticon:Question}}` |
| 1006 | Sleep | {{emoticon:1006}} | `{{emoticon:1006}}` or `{{emoticon:Sleep}}` |
| 1007 | Sad | {{emoticon:1007}} | `{{emoticon:1007}}` or `{{emoticon:Sad}}` |
| 1008 | Happy | {{emoticon:1008}} | `{{emoticon:1008}}` or `{{emoticon:Happy}}` |

## Usage in Markdown

You can use emoticons anywhere in your markdown content using the following syntax:

### Basic Usage

Use either the ID or the name:

```markdown
Hello, Slayer! {{emoticon:1}}

I hope you're having a great day! {{emoticon:Happy}}
```

Result: Hello, Slayer! {{emoticon:1}} I hope you're having a great day! {{emoticon:Happy}}

### Custom Sizes

You can specify a custom size:

```markdown
Small: {{emoticon:Cheer:small}}
Medium: {{emoticon:Cheer:medium}} (default)
Large: {{emoticon:Cheer:large}}
XLarge: {{emoticon:Cheer:xlarge}}
```

Result:
- Small: {{emoticon:Cheer:small}}
- Medium: {{emoticon:Cheer:medium}}
- Large: {{emoticon:Cheer:large}}
- XLarge: {{emoticon:Cheer:xlarge}}

### Custom Pixel Size

You can also specify an exact pixel size:

```markdown
{{emoticon:Cool:48px}}
{{emoticon:Laugh:64px}}
```

Result: {{emoticon:Cool:48px}} {{emoticon:Laugh:64px}}

### In Lists and Tables

Emoticons work great in lists and tables:

**Example List:**
- Getting started? {{emoticon:Question}}
- Completed a tough boss? {{emoticon:Congrats}}
- Need a break? {{emoticon:Exhausted}}

**Example Table:**

| Emotion | Emoticon | When to Use |
|---------|----------|-------------|
| Happy | {{emoticon:Happy}} | When things go well |
| Sad | {{emoticon:Sad}} | When things don't work out |
| Love | {{emoticon:Love}} | When you find amazing loot |

## Usage in React Components

You can also use emoticons directly in React components:

```jsx
import Emoticon from '../components/Emoticon';

function MyComponent() {
  return (
    <div>
      <p>
        Welcome back, Slayer! <Emoticon id={1} />
      </p>
      <p>
        <Emoticon name="Happy" size="large" />
      </p>
    </div>
  );
}
```

### Props

The `Emoticon` component accepts the following props:

| Prop | Type | Description | Default |
|------|------|-------------|---------|
| `id` | number | Emoticon ID (1-8, 1001-1008) | - |
| `name` | string | Emoticon name (e.g., "Hello", "Happy") | - |
| `size` | string | Size preset: "small", "medium", "large", "xlarge", or custom like "48px" | "medium" |
| `alt` | string | Custom alt text | Emoticon name |
| `className` | string | Additional CSS classes | "" |
| `style` | object | Custom inline styles | {} |

**Note:** Either `id` or `name` must be provided.

## Examples

### Expressing Emotions

Great job completing that quest! {{emoticon:Congrats}} You earned some amazing loot! {{emoticon:Love}}

### Reactions

Hmm, that's an interesting strategy... {{emoticon:Hm}} Let me think about it. {{emoticon:Sleep}}

### Encouragement

Don't give up! {{emoticon:Cheer}} You can do it! {{emoticon:Cool}}

## Tips

1. **Use names for readability**: `{{emoticon:Happy}}` is easier to understand than `{{emoticon:1008}}` when editing
2. **Match the tone**: Choose emoticons that match your content's tone
3. **Don't overuse**: A few well-placed emoticons enhance content; too many can be distracting
4. **Size matters**: Use larger sizes for emphasis, smaller for inline text

Happy editing, Slayer! {{emoticon:Cheer}}
