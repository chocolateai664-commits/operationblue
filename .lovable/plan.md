## Plan: Mobile Nav Animation, File Upload Button, and Navigation Testing

### 1. Add slide-down animation to mobile nav dropdown (Landing.tsx)

- Add a `slide-down` keyframe in `tailwind.config.ts` that animates from `max-height: 0; opacity: 0` to `max-height: 200px; opacity: 1`
- Replace the conditional `{menuOpen && ...}` with an always-rendered div that toggles between `animate-slide-down` and `hidden` states using `overflow-hidden` and CSS transition classes
- Apply the animation class to the mobile dropdown container

### 2. Add file upload button to ChatInput

- Add a `+` button (Plus icon from lucide-react) to the left side of the chat input area
- Wire it to a hidden `<input type="file">` that accepts `.zip,.doc,.docx,.pdf,.txt,.json,.csv,.xml` files
- On file selection, use the `document--parse_document` pattern client-side — read the file content as text (for text files) or upload to storage for binary docs
- Create a storage bucket `chat-uploads` via migration for storing uploaded files
- Parse text-based files client-side and inject their content into the chat message as context
- For binary files (.zip, .doc, .docx, .pdf), upload to storage and create an edge function to parse them server-side, returning extracted text
- Display the attached file name as a chip/badge above the input

### 3. Test navigation links

- Use browser tools to open the preview at mobile viewport, open hamburger menu, and click each link to verify correct routing

### Files to create/edit


| File                                | Action                                      |
| ----------------------------------- | ------------------------------------------- |
| `tailwind.config.ts`                | Add `slide-down` keyframe + animation       |
| `src/pages/Landing.tsx`             | Apply slide animation to mobile dropdown    |
| `src/components/chat/ChatInput.tsx` | Add `+` button with file input for uploads  |
| `src/pages/Index.tsx`               | Pass file data through to chat send handler |
| `src/hooks/useMessages.tsx`         | Support file content in messages            |


### Technical Details

- **Animation**: CSS keyframe approach with `max-height` transition avoids layout jank; `overflow-hidden` prevents content flash
- **File upload**: Client-side `FileReader` for text files (.txt, .csv, .json, .xml, .md). For .zip files, use JSZip to list/extract text contents. For .doc/.docx/.pdf, upload to storage bucket and note the limitation or use a simple text extraction approach
- **Accepted types**: `.zip, .doc, .docx, .pdf, .txt, .json, .csv, .xml, .md`
- **UX**: File chip shows filename + remove button; file content prepended to user message as `[Attached: filename]\n<content>\n---\nUser message. Let AI do the task of responding to the task.` 
  ```javascript
  import React, { useRef, useState } from 'react'
  import { Plus } from 'lucide-react'

  const MAX_FILE_SIZE = 500_000
  const MAX_CONTENT_LENGTH = 10000
  const MAX_FILES = 20
  const MAX_TOTAL_SIZE = 1_000_000

  export default function ChatInput({ onSend }) {
    const [message, setMessage] = useState('')
    const [attachedFile, setAttachedFile] = useState(null)
    const [attachedFiles, setAttachedFiles] = useState([])

    const fileInputRef = useRef(null)
    const folderInputRef = useRef(null)

    const handleFileUpload = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (file.size > MAX_FILE_SIZE) {
        alert('File too large (max 500KB)')
        return
      }

      const text = await file.text()
      const content = text.slice(0, MAX_CONTENT_LENGTH)

      setAttachedFile({ name: file.name, content })
      setAttachedFiles([])
    }

    const handleFolderUpload = async (e) => {
      const files = Array.from(e.target.files || [])

      let totalSize = 0
      let processed = []

      for (const file of files.slice(0, MAX_FILES)) {
        const isText = /\.(txt|json|csv|xml|md|js|ts|jsx|tsx)$/i.test(file.name)
        if (!isText) continue
        if (file.size > 200_000) continue

        const text = await file.text()
        const truncated = text.slice(0, 5000)

        totalSize += truncated.length
        if (totalSize > MAX_TOTAL_SIZE) break

        processed.push({
          name: file.webkitRelativePath || file.name,
          content: truncated,
        })
      }

      setAttachedFiles(processed)
      setAttachedFile(null)
    }

    const formatMessage = () => {
      if (attachedFile) {
        return `[Attached: ${attachedFile.name}]\n${attachedFile.content}\n---\n${message}`
      }

      if (attachedFiles.length > 0) {
        const fileBlocks = attachedFiles
          .map(f => `File: ${f.name}\n${f.content}`)
          .join('\n\n---\n\n')

        return `[Folder Attachment]\n\n${fileBlocks}\n\n---\n${message}`
      }

      return message
    }

    const handleSend = () => {
      if (!message.trim() && !attachedFile && attachedFiles.length === 0) return

      const finalMessage = formatMessage()
      onSend(finalMessage)

      setMessage('')
      setAttachedFile(null)
      setAttachedFiles([])
    }

    return (
      <div className="w-full border-t p-3">
        {/* Attachments */}
        {attachedFile && (
          <div className="mb-2 flex items-center gap-2 bg-muted px-2 py-1 rounded">
            <span className="text-sm">{attachedFile.name}</span>
            <button onClick={() => setAttachedFile(null)}>✕</button>
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div className="mb-2 flex items-center gap-2 bg-muted px-2 py-1 rounded">
            📁 {attachedFiles.length} files attached
            <button onClick={() => setAttachedFiles([])}>✕</button>
          </div>
        )}

        {/* Input Row */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2"
          >
            <Plus size={18} />
          </button>

          <button
            onClick={() => folderInputRef.current?.click()}
            className="p-2 text-xs"
          >
            📁
          </button>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".txt,.json,.csv,.xml,.md,.js,.ts,.jsx,.tsx"
            onChange={handleFileUpload}
          />

          <input
            ref={folderInputRef}
            type="file"
            className="hidden"
            webkitdirectory="true"
            multiple
            onChange={handleFolderUpload}
          />

          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border rounded px-3 py-2"
          />

          <button
            onClick={handleSend}
            className="px-4 py-2 bg-black text-white rounded"
          >
            Send
          </button>
        </div>
      </div>
    )
  }

  ```