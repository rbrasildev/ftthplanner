import React from 'react';
import { Trash2 } from 'lucide-react';
import { Note } from '../../types';
import { useLanguage } from '../../LanguageContext';

interface NotesLayerProps {
    notes: Note[] | undefined;
    onUpdateNoteText: (id: string, text: string) => void;
    onDeleteNote: (id: string) => void;
}

// Sticky notes rendered as HTML (not SVG) for better textarea/layout integration.
// Drag is handled by the parent via `data-note-id` + global mousedown listener —
// the attribute must stay on the outer div for DOM lookup in handleMouseDown.
export const NotesLayer = React.memo<NotesLayerProps>(({ notes, onUpdateNoteText, onDeleteNote }) => {
    const { t } = useLanguage();
    if (!notes || notes.length === 0) return null;

    return (
        <>
            {notes.map(note => (
                <div
                    key={note.id}
                    data-note-id={note.id}
                    className="absolute z-50 group/note select-none cursor-move flex flex-col pt-1"
                    style={{
                        transform: `translate(${note.x}px, ${note.y}px)`,
                        width: note.width,
                        height: note.height,
                        backgroundColor: note.color,
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                        borderRadius: '2px',
                        border: '1px solid #eab308',
                        pointerEvents: 'auto',
                    }}
                >
                    <div className="h-3 w-full flex items-center justify-center opacity-30 group-hover/note:opacity-100 transition-opacity">
                        <div className="w-8 h-0.5 bg-yellow-900/20 rounded-full" />
                    </div>

                    <div className="flex-1 px-2 pb-2">
                        <textarea
                            className="w-full h-full bg-transparent border-none outline-none font-sans resize-none text-[11px] leading-tight text-yellow-900 font-medium placeholder:text-yellow-700/30"
                            value={note.text}
                            onChange={(e) => onUpdateNoteText(note.id, e.target.value)}
                            placeholder={t('note_placeholder') || '...'}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                    </div>

                    <button
                        onClick={() => onDeleteNote(note.id)}
                        className="absolute top-0.5 right-0.5 p-0.5 text-yellow-900/20 hover:text-red-500 opacity-0 group-hover/note:opacity-100 transition-all pointer-events-auto"
                    >
                        <Trash2 className="w-2.5 h-2.5" />
                    </button>
                </div>
            ))}
        </>
    );
});

NotesLayer.displayName = 'NotesLayer';
