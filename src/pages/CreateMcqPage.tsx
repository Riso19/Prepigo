import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuestionBanks } from "@/contexts/QuestionBankContext";
import { findQuestionBankById, addMcqToBank, getAllTagsFromQuestionBanks } from "@/lib/question-bank-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { McqData, McqOption } from "@/data/questionBanks";
import { ArrowLeft, PlusCircle, X } from "lucide-react";
import HtmlEditor from "@/components/HtmlEditor";
import { TagEditor } from "@/components/TagEditor";
import { showError } from "@/utils/toast";

const CreateMcqPage = () => {
  const { bankId } = useParams<{ bankId: string }>();
  const { questionBanks, setQuestionBanks } = useQuestionBanks();
  const navigate = useNavigate();

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<Omit<McqOption, 'isCorrect'>[]>([
    { id: `opt${Date.now()}-1`, text: "" },
    { id: `opt${Date.now()}-2`, text: "" },
  ]);
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const bank = bankId ? findQuestionBankById(questionBanks, bankId) : null;
  const allTags = useMemo(() => getAllTagsFromQuestionBanks(questionBanks), [questionBanks]);

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
    if (!bankId) return;
    if (!question.trim()) {
      showError("Question cannot be empty.");
      return;
    }
    if (options.some(opt => !opt.text.trim())) {
      showError("All options must have text.");
      return;
    }
    if (!correctOptionId) {
      showError("You must select a correct answer.");
      return;
    }
    if (!explanation.trim()) {
      showError("Explanation cannot be empty.");
      return;
    }

    const newMcq: McqData = {
      id: `mcq${Date.now()}`,
      question,
      options: options.map(opt => ({
        ...opt,
        isCorrect: opt.id === correctOptionId,
      })),
      explanation,
      tags,
    };

    setQuestionBanks(banks => addMcqToBank(banks, bankId, newMcq));
    navigate(`/question-bank`);
  };

  if (!bank) {
    return <div>Question Bank not found</div>;
  }

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/question-bank")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Question Banks
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Add MCQ to "{bank.name}"</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Question</Label>
              <HtmlEditor value={question} onChange={setQuestion} placeholder="What is the capital of France?" />
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
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveOption(option.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </RadioGroup>
              <Button variant="outline" size="sm" onClick={handleAddOption}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Option
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Explanation</Label>
              <HtmlEditor value={explanation} onChange={setExplanation} placeholder="Provide a detailed explanation for the correct answer." />
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <TagEditor tags={tags} onTagsChange={setTags} allTags={allTags} />
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={handleSave}>Save MCQ</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateMcqPage;