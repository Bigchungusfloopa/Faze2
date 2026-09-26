import { useState, useCallback, useEffect } from 'react'

export function useDragAndDrop(onDropCallback: (files: File[]) => void) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragOut = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // if relatedTarget is null, the drag has left the window
    if (!e.relatedTarget) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        onDropCallback(Array.from(e.dataTransfer.files))
      }
    },
    [onDropCallback]
  )

  useEffect(() => {
    window.addEventListener('dragenter', handleDragIn)
    window.addEventListener('dragleave', handleDragOut)
    window.addEventListener('dragover', handleDrag)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragIn)
      window.removeEventListener('dragleave', handleDragOut)
      window.removeEventListener('dragover', handleDrag)
      window.removeEventListener('drop', handleDrop)
    }
  }, [handleDragIn, handleDragOut, handleDrag, handleDrop])

  return { isDragging }
}
