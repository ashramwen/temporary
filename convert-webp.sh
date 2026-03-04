#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-hy-5085}"

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "Directory not found: $TARGET_DIR" >&2
  exit 1
fi

converted=0
skipped=0
REPORT="$TARGET_DIR/size-report.md"

{
  echo "# WebP Conversion Size Report"
  echo ""
  echo "| File | Original | WebP | Savings | Quality |"
  echo "|------|----------|------|---------|---------|"
} > "$REPORT"

total_orig=0
total_webp=0

while IFS= read -r src; do
  out="${src%.*}.webp"

  if [[ ! -f "$out" ]]; then
    ext=$(echo "${src##*.}" | tr '[:upper:]' '[:lower:]')
    if [[ "$ext" == "gif" ]]; then
      gif2webp -quiet "$src" -o "$out"
      quality=80
    else
      cwebp -quiet "$src" -o "$out"
      quality=75
    fi
    echo "done  $src -> $out"
    converted=$((converted + 1))
  else
    echo "skip  $src"
    skipped=$((skipped + 1))
    ext=$(echo "${src##*.}" | tr '[:upper:]' '[:lower:]')
    if [[ "$ext" == "gif" ]]; then quality=80; else quality=75; fi
  fi

  orig_size=$(stat -f%z "$src")
  webp_size=$(stat -f%z "$out")
  savings=$(( (orig_size - webp_size) * 100 / orig_size ))

  fmt_size() {
    local bytes=$1
    if (( bytes >= 1048576 )); then
      echo "$(echo "scale=2; $bytes/1048576" | bc) MB"
    else
      echo "$(echo "scale=1; $bytes/1024" | bc) KB"
    fi
  }

  orig_fmt=$(fmt_size "$orig_size")
  webp_fmt=$(fmt_size "$webp_size")

  echo "| $(basename "$src") | ${orig_fmt} | ${webp_fmt} | ${savings}% | ${quality} |" >> "$REPORT"

  total_orig=$((total_orig + orig_size))
  total_webp=$((total_webp + webp_size))
done < <(find "$TARGET_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.gif" \) | sort)

total_savings=$(( (total_orig - total_webp) * 100 / total_orig ))

fmt_total() {
  local bytes=$1
  if (( bytes >= 1048576 )); then
    echo "$(echo "scale=2; $bytes/1048576" | bc) MB"
  else
    echo "$(echo "scale=1; $bytes/1024" | bc) KB"
  fi
}

{
  echo ""
  echo "**Total: $(fmt_total $total_orig) → $(fmt_total $total_webp) (${total_savings}% smaller)**"
} >> "$REPORT"

echo ""
echo "converted: $converted  skipped: $skipped"
echo "report:    $REPORT"
