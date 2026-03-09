#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ONBOARDING_DIR="$ROOT_DIR/public/onboarding"
RAW_IMAGES_DIR="$ONBOARDING_DIR/raw"
VIDEO_INPUT="$ROOT_DIR/Masal_Kahramanları_Ormanda_Video.mp4"
VIDEO_OUTPUT="$ONBOARDING_DIR/fortale-onboarding-intro.mp4"

mkdir -p "$ONBOARDING_DIR"

if command -v ffmpeg >/dev/null 2>&1 && [[ -f "$VIDEO_INPUT" ]]; then
  ffmpeg -y \
    -i "$VIDEO_INPUT" \
    -filter_complex "[0:v]scale=720:1280,boxblur=20:8[bg];[0:v]scale=720:1280:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p" \
    -r 24 \
    -c:v libx264 \
    -preset veryfast \
    -crf 25 \
    -movflags +faststart \
    -c:a aac \
    -b:a 96k \
    -ac 2 \
    -ar 44100 \
    "$VIDEO_OUTPUT"
  echo "Video optimized: $VIDEO_OUTPUT"
else
  echo "Video skipped. ffmpeg missing or source not found: $VIDEO_INPUT"
fi

if ! command -v cwebp >/dev/null 2>&1; then
  echo "Image optimization skipped. cwebp not found."
  exit 0
fi

if [[ ! -d "$RAW_IMAGES_DIR" ]]; then
  echo "Image optimization skipped. Place 6 images under: $RAW_IMAGES_DIR"
  exit 0
fi

IMAGE_FILES=()
while IFS= read -r image_file; do
  IMAGE_FILES+=("$image_file")
done < <(find "$RAW_IMAGES_DIR" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) | sort)

if [[ "${#IMAGE_FILES[@]}" -eq 0 ]]; then
  echo "Image optimization skipped. No input files under: $RAW_IMAGES_DIR"
  exit 0
fi

index=1
for image_path in "${IMAGE_FILES[@]}"; do
  output_path="$ONBOARDING_DIR/fortale-${index}.webp"
  cwebp -quiet -q 82 -m 6 -resize 1080 0 "$image_path" -o "$output_path"
  echo "Image optimized: $output_path"
  index=$((index + 1))
done

echo "Done."
