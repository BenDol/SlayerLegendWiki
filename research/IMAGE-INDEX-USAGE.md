# IMAGE INDEX USAGE GUIDE

## Quick Reference

The image index provides fast lookup of all 39,000+ game images by:
- **Keywords** - Search by game terms (companion, skill, weapon, etc.)
- **IDs** - Look up images by numeric ID
- **Categories** - Browse by organized folders
- **Search terms** - Full-text search across filenames

## Files Created

1. **`public/data/image-index.json`** (Full Index)
   - Complete image metadata
   - Dimensions, filesize, all keywords
   - Use for detailed lookups

2. **`public/data/image-search-index.json`** (Search Index)
   - Optimized for fast searches
   - Smaller file size for web loading
   - Use for in-browser search

## Usage Examples

### 1. Search by Keyword

```javascript
import imageIndex from './data/image-search-index.json';

// Find all companion images
const companionImages = imageIndex.byKeyword['companion'] || [];
const imageDetails = companionImages.map(id => imageIndex.images[id]);

console.log(`Found ${imageDetails.length} companion images`);
```

### 2. Search by Category

```javascript
// Get all skill icons
const skillImages = imageIndex.byCategory['skills'] || [];
const skills = skillImages.map(id => imageIndex.images[id]);
```

### 3. Search by ID

```javascript
// Look up specific image by ID
const imageId = '1003';
const recordId = imageIndex.byId[imageId];
const image = imageIndex.images[recordId];

console.log(`Image path: ${image.path}`);
```

### 4. Full-Text Search

```javascript
// Search for "fire skill"
function searchImages(query) {
    const terms = query.toLowerCase().split(' ');
    const results = new Set();

    terms.forEach(term => {
        const matches = imageIndex.searchIndex[term] || [];
        matches.forEach(id => results.add(id));
    });

    return Array.from(results).map(id => imageIndex.images[id]);
}

const fireSkills = searchImages('fire skill');
```

### 5. Filter by Type

```javascript
// Get all portrait images
const portraits = Object.values(imageIndex.images)
    .filter(img => img.type === 'portrait');
```

### 6. React Component Example

```jsx
import { useState, useEffect } from 'react';
import imageIndex from './data/image-search-index.json';

function ImageSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);

    useEffect(() => {
        if (!query) {
            setResults([]);
            return;
        }

        const terms = query.toLowerCase().split(' ');
        const resultIds = new Set();

        terms.forEach(term => {
            (imageIndex.searchIndex[term] || []).forEach(id => resultIds.add(id));
        });

        const images = Array.from(resultIds)
            .map(id => imageIndex.images[id])
            .slice(0, 50); // Limit results

        setResults(images);
    }, [query]);

    return (
        <div>
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search images..."
            />

            <div className="results">
                {results.map(img => (
                    <div key={img.id}>
                        <img src={img.path} alt={img.filename} />
                        <p>{img.filename}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
```

## Index Structure

### Image Record Format

```json
{
    "id": "1003",
    "filename": "Icon_Skill_Fire.png",
    "path": "/images/skills/Icon_Skill_Fire.png",
    "category": "skills",
    "type": "skill",
    "keywords": ["icon", "skill", "fire"],
    "dimensions": {"width": 128, "height": 128},
    "filesize": 15420,
    "source": "contents.apk (assetpack/contents)"
}
```

### Search Index Format

```json
{
    "byKeyword": {
        "fire": ["img_1", "img_52", "img_103"],
        "skill": ["img_1", "img_2", "img_3"]
    },
    "byCategory": {
        "skills": ["img_1", "img_2", "img_3"],
        "companions": ["img_100", "img_101"]
    },
    "searchIndex": {
        "fire": ["img_1", "img_52"],
        "icon": ["img_1", "img_2", "img_10"]
    }
}
```

## Common Queries

### Find companion skill icons
```javascript
const friendSkillIcons = Object.values(imageIndex.images)
    .filter(img =>
        img.keywords.includes('friend') &&
        img.keywords.includes('skill') &&
        img.type === 'icon'
    );
```

### Find all weapon sprites
```javascript
const weapons = imageIndex.byCategory['equipment/weapons'] || [];
const weaponImages = weapons.map(id => imageIndex.images[id]);
```

### Find monster boss images
```javascript
const bosses = imageIndex.byCategory['monsters/bosses'] || [];
const bossImages = bosses.map(id => imageIndex.images[id]);
```

---

*Index contains 39,000+ images with full metadata and search capabilities*
