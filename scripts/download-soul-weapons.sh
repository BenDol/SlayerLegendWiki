#!/bin/bash

# Read the JSON file and download each image
OUTPUT_DIR="public/images/content/equipment/soul-weapons"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "Downloading 81 soul weapon images..."

# Read JSON array and download each image
urls=$(cat soul-weapon-image-urls.json | grep -o 'https://[^"]*')
index=1

while IFS= read -r url; do
  if [ -n "$url" ]; then
    # Pad the index to 2 digits
    padded=$(printf "%02d" $index)

    # Determine file extension from URL
    if [[ $url == *.webp ]]; then
      ext="webp"
    elif [[ $url == *.png ]]; then
      ext="png"
    else
      ext="webp"
    fi

    filename="sword_2${padded}.${ext}"
    filepath="$OUTPUT_DIR/$filename"

    # Download the image
    echo "Downloading $filename..."
    curl -s -o "$filepath" "$url"

    if [ $? -eq 0 ]; then
      echo "✓ Downloaded: $filename"
    else
      echo "✗ Failed: $filename"
    fi

    index=$((index + 1))
  fi
done <<< "$urls"

echo ""
echo "Download complete! Downloaded $((index - 1)) images to $OUTPUT_DIR"
