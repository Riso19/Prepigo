import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const CodeBlock = ({ code, className }: { code: string; className?: string }) => (
  <pre className={`bg-muted text-muted-foreground p-4 rounded-md overflow-x-auto text-sm ${className}`}>
    <code>{code.trim()}</code>
  </pre>
);

const ImportExportGuidePage = () => {
  const zipStructure = `
my_question_bank.zip
├── data.json
└── media/
    └── image1.png
  `;

  const jsonExample = `
[
  {
    "id": "qb-1700000000000",
    "name": "Cardiology",
    "mcqs": [
      {
        "id": "mcq-1700000000001",
        "question": "What is the primary function of the <b>sinoatrial (SA) node</b>?",
        "options": [
          {
            "id": "opt-1700000000002",
            "text": "To pump blood to the lungs.",
            "isCorrect": false
          },
          {
            "id": "opt-1700000000003",
            "text": "To act as the heart's natural pacemaker.",
            "isCorrect": true
          }
        ],
        "explanation": "The SA node generates electrical impulses...",
        "tags": ["Anatomy", "Physiology"]
      }
    ],
    "subBanks": [
      {
        "id": "qb-1700000000005",
        "name": "Pharmacology",
        "mcqs": [
          {
            "id": "mcq-1700000000006",
            "question": "Which drug class is shown? <img src=\\"media://beta_blocker.jpg\\">",
            "options": [
              { "id": "opt-1700000000007", "text": "ACE Inhibitors", "isCorrect": false },
              { "id": "opt-1700000000008", "text": "Beta Blockers", "isCorrect": true }
            ],
            "explanation": "The image shows blocking of beta-adrenergic receptors...",
            "tags": ["Pharmacology"]
          }
        ],
        "subBanks": []
      }
    ]
  }
]
  `;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button asChild variant="ghost" className="-ml-4">
            <Link to="/settings"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings</Link>
          </Button>

          <h1 className="text-3xl font-bold">Importing and Exporting Your Question Bank</h1>
          <p className="text-muted-foreground">
            This guide provides detailed instructions on how to use the import and export features. This is essential for creating backups, sharing your content, or migrating data.
          </p>

          <Card>
            <CardHeader>
              <CardTitle>Exporting Your Data (Creating a Backup)</CardTitle>
              <CardDescription>
                Exporting creates a single `.zip` file containing all your question banks, MCQs, and associated images.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-semibold">How to Export:</h3>
              <ol className="list-decimal list-inside space-y-2">
                <li>Navigate to the <strong>Settings</strong> page (click the gear icon in the header).</li>
                <li>Scroll down to the <strong>Data Management</strong> section.</li>
                <li>In the "MCQs" card, click the <strong>"Export MCQs"</strong> button.</li>
                <li>A file named `prepigo_mcq_backup_[date].zip` will be downloaded. Keep this file safe.</li>
              </ol>
              <h3 className="font-semibold pt-2">What's in the Exported File?</h3>
              <ul className="list-disc list-inside">
                <li><strong>`data.json`</strong>: A file with all your question bank text, structure, and answers.</li>
                <li><strong>`media/` folder</strong>: A folder containing all the images you've added.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Importing Data</CardTitle>
              <CardDescription>
                You can import data from a `.zip` file (recommended) or a legacy `.json` file.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-semibold">How to Import:</h3>
              <ol className="list-decimal list-inside space-y-2">
                <li>Navigate to the <strong>Settings</strong> page.</li>
                <li>In the <strong>Data Management</strong> section, click the <strong>"Import MCQs"</strong> button.</li>
                <li>Select the `.zip` or `.json` file from your computer.</li>
                <li>An import confirmation dialog will appear. Choose an import method:</li>
              </ol>
              <div className="pl-6 space-y-4 pt-2">
                <div>
                  <h4 className="font-semibold">1. Merge (Default & Safest)</h4>
                  <p className="text-sm text-muted-foreground">Adds content from the file to your existing collection without deleting anything. Use this to combine question banks.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-destructive">2. Replace</h4>
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-destructive">Warning: This is a destructive action!</strong> It deletes all of your current question banks before importing. Use this to restore from a backup.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Advanced: The `.zip` File Structure</CardTitle>
              <CardDescription>
                For developers, AI agents, or users who want to create their own import files.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>The archive must be a standard `.zip` file containing a `data.json` file and an optional `media` folder at its root.</p>
              <CodeBlock code={zipStructure} />
              <h3 className="font-semibold pt-2">`data.json` Schema</h3>
              <p>The `data.json` file must be a JSON array of `QuestionBankData` objects.</p>
              
              <h4 className="font-medium">`QuestionBankData` Object</h4>
              <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Field</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
                  <TableBody>
                    <TableRow className="text-xs sm:text-sm"><TableCell>`id`</TableCell><TableCell>String</TableCell><TableCell>A unique ID for the bank (e.g., `qb-12345`).</TableCell></TableRow>
                    <TableRow className="text-xs sm:text-sm"><TableCell>`name`</TableCell><TableCell>String</TableCell><TableCell>The name of the question bank.</TableCell></TableRow>
                    <TableRow className="text-xs sm:text-sm"><TableCell>`mcqs`</TableCell><TableCell>Array</TableCell><TableCell>An array of `McqData` objects.</TableCell></TableRow>
                    <TableRow className="text-xs sm:text-sm"><TableCell>`subBanks`</TableCell><TableCell>Array</TableCell><TableCell>An array of nested `QuestionBankData` objects for hierarchy.</TableCell></TableRow>
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              <h4 className="font-medium">`McqData` Object</h4>
              <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Field</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
                  <TableBody>
                    <TableRow className="text-xs sm:text-sm"><TableCell>`id`</TableCell><TableCell>String</TableCell><TableCell>A unique ID for the MCQ (e.g., `mcq-67890`).</TableCell></TableRow>
                    <TableRow className="text-xs sm:text-sm"><TableCell>`question`</TableCell><TableCell>String</TableCell><TableCell>The question text (HTML is supported).</TableCell></TableRow>
                    <TableRow className="text-xs sm:text-sm"><TableCell>`options`</TableCell><TableCell>Array</TableCell><TableCell>An array of `McqOption` objects.</TableCell></TableRow>
                    <TableRow className="text-xs sm:text-sm"><TableCell>`explanation`</TableCell><TableCell>String</TableCell><TableCell>The explanation for the answer (HTML is supported).</TableCell></TableRow>
                    <TableRow className="text-xs sm:text-sm"><TableCell>`tags`</TableCell><TableCell>Array</TableCell><TableCell>An optional array of strings (e.g., `["Anatomy"]`).</TableCell></TableRow>
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              <h3 className="font-semibold pt-2">Linking Media Files</h3>
              <p>To include an image, place it in the `media/` folder and reference it in your HTML content using the `media://` protocol.</p>
              <CodeBlock code={`<img src="media://diagram.png">`} />

              <h3 className="font-semibold pt-2">Full Example</h3>
              <CodeBlock code={jsonExample} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ImportExportGuidePage;