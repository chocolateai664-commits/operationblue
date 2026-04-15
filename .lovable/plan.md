

## Plan: Drag-and-Drop File Zone, Multi-File Picker, and File Search/Filter

### What Changes

Upgrade `ChatInput.tsx` to support:
1. **Drag-and-drop** files and folders onto the chat input area
2. **Multi-file support** on the `+` button (currently only picks one file)
3. **File list with search/filter** when multiple files are attached (instead of just a count badge)
4. **Individual file removal** from the attached list

### Implementation Details

**Edit: `src/components/chat/ChatInput.tsx`**

1. **Drag-and-drop handling** — wrap the entire input area in drag event handlers (`onDragOver`, `onDragLeave`, `onDrop`). On drop, use `webkitGetAsEntry()` to recursively traverse folder entries. Show a visual "drop here" overlay when dragging. Reuse the existing `summarizeContent` pipeline for processing dropped files.

2. **Multi-file picker** — change the `+` button's hidden input to accept `multiple`. Process all selected files (up to `MAX_FILES`), not just the first one. Merge into the existing `attachedFiles` array.

3. **Unified file list** — collapse `attachedFile` (single) and `attachedFiles` (folder) into one `attachedFiles` array. Show each file as an individual badge/chip with an X button for removal. When more than 3 files are attached, show a collapsible list.

4. **Search/filter** — when 5+ files are attached, show a small search input above the file chips to filter by filename. Filtered-out files remain attached; the filter only controls visibility.

### Files to Edit

| File | Change |
|------|--------|
| `src/components/chat/ChatInput.tsx` | Add drag-drop zone, multi-file picker, file list with search, unify attachment state |

No database, edge function, or routing changes needed.

