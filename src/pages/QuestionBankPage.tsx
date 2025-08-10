import Header from "@/components/Header";
import QuestionBankManager from "@/components/QuestionBankManager";

const QuestionBankPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 bg-secondary/50 rounded-lg my-4">
        <QuestionBankManager />
      </main>
    </div>
  );
};

export default QuestionBankPage;