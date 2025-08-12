import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const sm2GrowthData = [
  { review: 1, Easy: 4, Good: 1, Hard: 1 },
  { review: 2, Easy: 10, Good: 6, Hard: 1 },
  { review: 3, Easy: 27, Good: 15, Hard: 2 },
  { review: 4, Easy: 72, Good: 38, Hard: 2 },
  { review: 5, Easy: 196, Good: 94, Hard: 3 },
];

const fsrsConceptData = [
    { review: 1, stability: 2.5, difficulty: 8.5 },
    { review: 2, stability: 7, difficulty: 8.2 },
    { review: 3, stability: 21, difficulty: 7.9 },
    { review: 4, stability: 55, difficulty: 7.5 },
    { review: 5, stability: 120, difficulty: 7.2 },
];

const forgettingCurveData = Array.from({ length: 101 }, (_, i) => {
    const days = i;
    const stability = 20;
    const retrievability = Math.pow(1 + days / (9 * stability), -1);
    return { days, retrievability: retrievability * 100 };
});

const comparisonData = [
  { name: 'SM-2', review1: 1, review2: 6, review3: 15, review4: 38, review5: 94 },
  { name: 'FSRS', review1: 3, review2: 9, review3: 28, review4: 80, review5: 210 },
];

const AlgorithmGuidePage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button asChild variant="ghost" className="-ml-4">
            <Link to="/settings"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings</Link>
          </Button>

          <h1 className="text-3xl font-bold">Understanding Spaced Repetition Algorithms</h1>
          <p className="text-muted-foreground">
            Spaced Repetition is a learning technique that involves reviewing information at increasing intervals. This guide explains the different scheduling algorithms available in the app to help you choose the best one for your study style.
          </p>

          <Card>
            <CardHeader>
              <CardTitle>SM-2 (The Classic)</CardTitle>
              <CardDescription>
                The SM-2 algorithm is one of the original and most widely used spaced repetition algorithms. It's known for its simplicity and predictability.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-semibold">How it Works:</h3>
              <p className="text-sm">
                SM-2 uses an "easiness factor" (EF) for each card, which starts at 2.5. When you review a card, your rating adjusts this EF up or down. A higher EF means the interval between reviews grows faster.
              </p>
              <h4 className="font-semibold pt-2">Interval Growth Example:</h4>
              <p className="text-sm text-muted-foreground">This chart shows how the next review interval (in days) might grow for a typical card based on your ratings.</p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={sm2GrowthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="review" label={{ value: 'Review Number', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Next Interval (Days)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Easy" stroke="#3b82f6" name="Always 'Easy'" />
                  <Line type="monotone" dataKey="Good" stroke="#22c55e" name="Always 'Good'" />
                  <Line type="monotone" dataKey="Hard" stroke="#f97316" name="Always 'Hard'" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FSRS (The Modern Approach)</CardTitle>
              <CardDescription>
                The Free Spaced Repetition Scheduler (FSRS) is a modern, data-driven algorithm that analyzes your personal review history to predict when you are most likely to forget something.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-semibold">How it Works:</h3>
              <p className="text-sm">
                FSRS calculates two key metrics for each card:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li><strong>Difficulty:</strong> How inherently hard the material on the card is for you.</li>
                <li><strong>Stability:</strong> How long the memory of the card is likely to last in your brain.</li>
              </ul>
              <h4 className="font-semibold pt-2">Stability vs. Difficulty:</h4>
              <p className="text-sm text-muted-foreground">Stability should increase with each successful review, while Difficulty remains relatively constant for a given card.</p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={fsrsConceptData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="review" label={{ value: 'Review Number', position: 'insideBottom', offset: -5 }} />
                    <YAxis yAxisId="left" dataKey="stability" label={{ value: 'Stability (Days)', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" dataKey="difficulty" orientation="right" domain={[1, 10]} label={{ value: 'Difficulty', angle: 90, position: 'insideRight' }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="stability" stroke="#8884d8" name="Stability" />
                    <Line yAxisId="right" type="monotone" dataKey="difficulty" stroke="#82ca9d" name="Difficulty" />
                </LineChart>
              </ResponsiveContainer>
              <h4 className="font-semibold pt-4">The Forgetting Curve:</h4>
              <p className="text-sm text-muted-foreground">FSRS schedules your next review based on your desired retention rate (e.g., 90%) and this predicted curve of forgetting.</p>
               <ResponsiveContainer width="100%" height={250}>
                <LineChart data={forgettingCurveData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="days" type="number" label={{ value: 'Days Since Last Review', position: 'insideBottom', offset: -5 }} />
                  <YAxis domain={[0, 100]} label={{ value: 'Probability of Recall (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value) => `${(value as number).toFixed(1)}%`} />
                  <Line type="monotone" dataKey="retrievability" stroke="#ef4444" dot={false} name="Forgetting Curve" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comparison at a Glance</CardTitle>
              <CardDescription>This chart shows a typical interval schedule for a card answered "Good" five times in a row under both systems. Notice how FSRS intervals grow more aggressively, leading to fewer reviews over time.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" label={{ value: 'Next Interval (Days)', position: 'insideBottom' }} />
                  <YAxis type="category" dataKey="name" width={60} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="review1" stackId="a" fill="#8884d8" name="After 1st Review" />
                  <Bar dataKey="review2" stackId="a" fill="#82ca9d" name="After 2nd Review" />
                  <Bar dataKey="review3" stackId="a" fill="#ffc658" name="After 3rd Review" />
                  <Bar dataKey="review4" stackId="a" fill="#ff8042" name="After 4th Review" />
                  <Bar dataKey="review5" stackId="a" fill="#ff7300" name="After 5th Review" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-primary">Which One Should I Choose?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-primary">
              <p>
                For almost all users, <strong>FSRS-4.5 is the recommended choice</strong>. It is more efficient and adapts to your personal learning patterns, which can save you time and improve long-term retention.
              </p>
              <p>
                You might consider using <strong>SM-2</strong> if you are very familiar with it from other applications and prefer its simple, predictable nature.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AlgorithmGuidePage;