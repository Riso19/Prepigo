import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuestionBanks } from "@/contexts/QuestionBankContext";
import { findMcqById, updateMcq, getAllTagsFromQuestionBanks } from "@/lib/question-bank-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { McqData, McqOption } from "@/data/questionBanks";
import { ArrowLeft, PlusCircle, X } from "lucide-react";
import HtmlEditor from "@/components/HtmlEditor";
import { TagEditor } from "@/components/TagEditor";
import { showError, showSuccess } from "@/utils/toast";

const EditMcqPage = () => {
  const { bankId, mcqId } = useParams<{ bankId: string; mcqId: string }>();
  const { questionBanks, setQuestionBanks } = useQuestionBanks();
  const navigate = useNavigate();

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<Omit<McqOption, 'isCorrect'>[]>([]);
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [originalMcq, setOriginalMcq] = useState<McqData | null>(null);

  const allTags = useMemo(() => getAllTagsFromQuestionBanks(questionBanks), [questionBanks]);

  useEffect(() => {
    if (mcqId) {
      const result = findMcqById(questionBanks, mcqId);
      if (result) {
        const { mcq } = result;
        setOriginalMcq(mcq);
        setQuestion(mcq.question);
        setOptions(mcq.options.map(({ isCorrect, ...rest }) => rest));
        setCorrectOptionId(mcq.options.find(opt => opt.isCorrect)?.id || null);
        setExplanation(mcq.explanation);
        setTags(mcq.tags || []);
      }
    }
  }, [mcqId, questionBanks]);

  const handleAddOption = () => {
    setOptions([...options, { id: `opt${Date.now()}`, text: "" }]);
  };

  const handleRemoveOption = (id: string) => {
    if (options.length <= 2) {
      showError("An MCQ must have at least two options.");
      return;
    }
    setOptions(options.filter(opt => opt.id !== id));
    if (correctOptionId === id) {
      setCorrectOptionId(null);
    }
  };

  const handleOptionChange = (id: string, text: string) => {
    setOptions(options.map(opt => opt.id === id ? { ...opt, text } : opt));
  };

  const handleSave = () => {
    if (!originalMcq) return;
    if (!question.trim()) { showError("Question cannot be empty."); return; }
    if (options.some(opt => !opt.text.trim())) { showError("All options must have text."); return; }
    if (!correctOptionId) { showError("You must select a correct answer."); return; }
    if (!explanation.trim()) { showError("Explanation cannot be empty."); return; }

    const updatedMcq: McqData = {
      ...originalMcq,
      question,
      options: options.map(opt => ({ ...opt, isCorrect: opt.id === correctOptionId })),
      explanation,
      tags,
    };

    setQuestionBanks(banks => updateMcq(banks, updatedMcq));
    showSuccess("MCQ updated successfully!");
    navigate(`/question-bank/${bankId}/view`);
  };

  if (!originalMcq) {
    return <div>Loading MCQ...</div>;
  }

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(`/question-bank/${bankId}/view`)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Bank View
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Edit MCQ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Question</Label>
              <HtmlEditor value={question} onChange={setQuestion} />
            </div>
            <div className="space-y-4">
              <Label>Options</Label>
              <RadioGroup value={correctOptionId || undefined} onValueChange={setCorrectOptionId}>
                {options.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <RadioGroupItem value={option.id} id={option.id} />
                    <Label htmlFor={option.id} className="sr-only">Mark option {index + 1} as correct</Label>
                    <Input
                      value={option.text}
                      onChange={(e) => handleOptionChange(option.id, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-grow"
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveOption(option.id)}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </RadioGroup>
              <Button variant="outline" size="sm" onClick={handleAddOption}><PlusCircle className="mr-2 h-4 w-4" /> Add Option</Button>
            </div>
            <div className="space-y-2">
              <Label>Explanation</Label>
              <HtmlEditor value={explanation} onChange={setExplanation} />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagEditor tags={tags} onTagsChange={setTags} allTags={allTags} />
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditMcqPage;