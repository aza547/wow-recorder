find release/build/mac-arm64/WarcraftRecorder.app -type l 2>/dev/null | while read link; do
  target=$(readlink "$link")
  case "$target" in
    /*) echo "ABSOLUTE: $link -> $target" ;;    *..*)
      # Resolve relative target
      resolved=$(cd "$(dirname "$link")" && cd "$(dirname "$target")" 2>/dev/null && pwd)
      case "$resolved" in
        */WarcraftRecorder.app/*) ;;
        *) echo "ESCAPES BUNDLE: $link -> $target" ;;
      esac
    ;;
  esac
done | head -30
echo "---broken symlinks---"
