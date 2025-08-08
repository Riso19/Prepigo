import { useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface ClozeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const ClozeEditor = ({ value, onChange }: ClozeEditorProps) => {
  const quillRef = useRef<ReactQuill>(null);

  const handleClozeClick = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const range = quill.getSelection();
    if (range && range.length > 0) {
      const text = quill.getText(range.index, range.length);
      const currentContent = quill.getText();
      const clozeRegex = /{{c(\d+)::/g;
      let maxId = 0;
      let match;
      while ((match = clozeRegex.exec(currentContent)) !== null) {
        maxId = Math.max(maxId, parseInt(match[1], 10));
      }
      const newId = maxId + 1;

      quill.deleteText(range.index, range.length);
      quill.insertText(range.index, `{{c${newId}::${text}}}`);
      quill.setSelection(range.index + `{{c${newId}::${text}}}`.length, 0);
    }
  };

  const modules = {
    toolbar: {
      container: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'underline'],
        ['link'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['clean'],
        ['cloze']
      ],
      handlers: {
        'cloze': handleClozeClick
      }
    }
  };

  return (
    <div className="bg-white">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
      />
    </div>
  );
};

// Add the custom button to the toolbar
const quillIcons = ReactQuill.Quill.import('ui/icons');
quillIcons['cloze'] = '[...]';

export default ClozeEditor;