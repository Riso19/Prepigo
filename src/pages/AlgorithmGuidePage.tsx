import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const SettingsTable = ({ data }: { data: { setting: string; description: string; impact: string }[] }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead className="w-1/4">Setting</TableHead>
        <TableHead className="w-1/2">Description</TableHead>
        <TableHead className="w-1/4">Impact</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {data.map(({ setting, description, impact }) => (
        <TableRow key={setting}>
          <TableCell className="font-medium">{setting}</TableCell>
          <TableCell className="text-sm">{description}</TableCell>
          <TableCell className="text-sm text-muted-foreground">{impact}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

const sm2SettingsData = [
  { setting: 'Learning Steps', description: 'The sequence of delays for a new card before it "graduates" to a review card. E.g., "1m 10m" means you see it after 1 minute, then 10 minutes.', impact: 'Shorter steps mean you see new cards more frequently at the beginning. Longer steps introduce them more slowly.' },
  { setting: 'Graduating Interval', description: 'The first review interval (in days) after a card successfully passes all learning steps.', impact: 'Higher values give you a longer break after learning a card, but may increase the chance of forgetting it.' },
  { setting: 'Easy Interval', description: 'The first review interval (in days) for a new card that you immediately rate as "Easy".', impact: 'A high value quickly moves easy cards far into the future, reducing your workload.' },
  { setting: 'Starting Ease', description: 'The initial "easiness factor" (EF) for all new cards. The default is 2.5 (or 250%).', impact: 'Higher values cause intervals to grow faster from the start. Lower values result in more frequent reviews initially.' },
  { setting: 'Easy Bonus', description: 'A multiplier applied to the current interval when you rate a review card as "Easy".', impact: 'Increases the jump in time for cards you find very easy, pushing them further out than a "Good" rating.' },
  { setting: 'Interval Modifier', description: 'A global percentage multiplier applied to all calculated review intervals.', impact: 'Values > 100% increase all intervals, leading to fewer reviews. Values < 100% decrease intervals, leading to more reviews.' },
  { setting: 'Hard Interval Multiplier', description: 'A multiplier for the previous interval when you rate a card as "Hard".', impact: 'Determines how much the next interval is for a "Hard" review. A value of 1.2 means the next interval will be 120% of the last one.' },
  { setting: 'Maximum Interval', description: 'The absolute longest interval (in days) that a card can have.', impact: 'Caps how far into the future a card can be scheduled, ensuring you eventually see it again.' },
  { setting: 'Relearning Steps', description: 'The sequence of delays for a card you have forgotten (lapsed).', impact: 'Similar to Learning Steps, but for cards you are re-learning after a lapse.' },
  { setting: 'New Interval Multiplier', description: 'A percentage of the last interval that becomes the new interval after a lapse.', impact: 'A value of 0% completely resets the card\'s interval. Higher values retain some of the previous interval.' },
  { setting: 'Minimum Interval', description: 'The minimum interval (in days) a card is given after a lapse.', impact: 'Ensures a forgotten card is seen again soon, even if the New Interval Multiplier is high.' },
  { setting: 'Leech Threshold', description: 'The number of times you must forget a card for it to be marked as a "leech".', impact: 'Lower values will identify difficult cards as leeches more quickly.' },
  { setting: 'Leech Action', description: 'What happens when a card becomes a leech: either it gets a "leech" tag or it is suspended from review.', impact: 'Tagging keeps the card in rotation, while suspending removes it from your review queue until you manually unsuspend it.' },
];

const fsrsSettingsData = [
  { setting: 'Requested Retention', description: 'The probability of recall you want to aim for. For example, 0.9 means you want to remember the card with 90% accuracy when it becomes due.', impact: 'Higher values (e.g., 0.95) lead to more frequent reviews. Lower values (e.g., 0.85) result in fewer reviews but a higher chance of forgetting.' },
  { setting: 'Maximum Interval', description: 'The absolute longest interval (in days) that a card can have.', impact: 'Caps how far into the future a card can be scheduled.' },
  { setting: 'FSRS Weights (W)', description: 'A set of optimized parameters that define your personal memory model. These are calculated by the FSRS algorithm based on your review history.', impact: 'These are the core of FSRS personalization. They are not meant to be edited manually.' },
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
              <ul className="list-disc list-inside text-sm space-y-1">
                <li><strong>Good/Easy:</strong> Increases the interval based on the current EF.</li>
                <li><strong>Hard:</strong> Increases the interval by a smaller amount and slightly reduces the EF.</li>
                <li><strong>Again (Lapse):</strong> Resets the card's progress and significantly reduces the EF.</li>
              </ul>
              <Accordion type="single" collapsible className="w-full pt-2">
                <AccordionItem value="sm2-settings">
                  <AccordionTrigger>Detailed Settings Breakdown</AccordionTrigger>
                  <AccordionContent>
                    <SettingsTable data={sm2SettingsData} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
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
                FSRS doesn't just use an "easiness factor." It calculates two key metrics for each card:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li><strong>Difficulty:</strong> How inherently hard the material on the card is for you. A rating of "Hard" on a new card will give it a high difficulty.</li>
                <li><strong>Stability:</strong> How long the memory of the card is likely to last in your brain. This grows as you successfully review the card over time.</li>
              </ul>
              <p className="text-sm">
                By analyzing your performance, FSRS creates a personalized model of your memory, leading to a more efficient and effective review schedule.
              </p>
              <Accordion type="single" collapsible className="w-full pt-2">
                <AccordionItem value="fsrs-versions">
                  <AccordionTrigger>FSRS-4.5 vs. FSRS-6</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm">
                      <strong>FSRS-4.5</strong> is the well-tested and stable version of the algorithm. It's recommended for most users.<br/><br/>
                      <strong>FSRS-6</strong> is a newer, experimental version based on the latest research. It may offer improvements but is still under development. Use it if you're interested in cutting-edge scheduling.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="fsrs-settings">
                  <AccordionTrigger>Detailed Settings Breakdown</AccordionTrigger>
                  <AccordionContent>
                    <SettingsTable data={fsrsSettingsData} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comparison at a Glance</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead>SM-2</TableHead>
                    <TableHead>FSRS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Approach</TableCell>
                    <TableCell>Rule-based</TableCell>
                    <TableCell>Data-driven & Predictive</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Personalization</TableCell>
                    <TableCell>Low (same rules for everyone)</TableCell>
                    <TableCell>High (adapts to your memory)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Efficiency</TableCell>
                    <TableCell>Good</TableCell>
                    <TableCell>Excellent (often fewer reviews needed)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Key Concept</TableCell>
                    <TableCell>Easiness Factor</TableCell>
                    <TableCell>Difficulty & Stability</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">"Ease Hell"</TableCell>
                    <TableCell>Can happen (cards get stuck at low intervals)</TableCell>
                    <TableCell>Avoided (difficulty is separate from interval)</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
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
              <p className="text-sm">
                <strong>Note:</strong> When you switch between algorithms, all your cards will be automatically rescheduled based on your review history. This might cause a large number of cards to become due immediately.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AlgorithmGuidePage;