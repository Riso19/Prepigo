import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

const StatCard = ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 text-sm">
      {children}
    </CardContent>
  </Card>
);

const StatisticsGuidePage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button asChild variant="ghost" className="-ml-4">
            <Link to="/statistics"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Statistics</Link>
          </Button>

          <h1 className="text-3xl font-bold">Understanding Your Statistics</h1>
          <p className="text-muted-foreground">
            This guide breaks down each metric on the Statistics page to help you understand your learning progress and make informed decisions about your study habits.
          </p>

          <StatCard title="Learning Progress" description="Metrics that track your study consistency and workload.">
            <div>
              <h3 className="font-semibold">Reviews (Today, 7/30 days)</h3>
              <p>A simple count of the reviews you've completed over different time periods. It's a direct measure of your activity.</p>
            </div>
            <div>
              <h3 className="font-semibold">Study Streak</h3>
              <p>Measures your consistency. The 'Current Streak' is the number of consecutive days you've studied. 'Longest Streak' is your all-time record.</p>
            </div>
            <div>
              <h3 className="font-semibold">Due & Overdue</h3>
              <p>
                <strong>Due Today:</strong> Items scheduled for review today.
                <br />
                <strong>Overdue:</strong> Items that were due on a previous day but haven't been reviewed yet. A large overdue count can impact scheduling accuracy.
              </p>
            </div>
             <div>
              <h3 className="font-semibold">Weighted Overdue Load</h3>
              <p>This advanced metric tells you not just *how many* items are overdue, but also *how difficult* they are. A high number means you have a backlog of challenging material that needs attention.</p>
            </div>
            <div>
              <h3 className="font-semibold">Interval Growth Efficiency</h3>
              <p>Measures how quickly the time between reviews grows for items you answer correctly. A higher number (e.g., 2.5x) means you're learning efficiently, as you need fewer reviews for the same item over time.</p>
            </div>
          </StatCard>

          <StatCard title="Performance Analytics" description="Metrics that measure how well you are learning and retaining information.">
            <div>
              <h3 className="font-semibold">Accuracy (Retention)</h3>
              <p>The percentage of times you correctly recall an item (rated 'Hard', 'Good', or 'Easy'). This is your overall success rate and a key indicator of memory performance.</p>
            </div>
            <div>
              <h3 className="font-semibold">First-Pass Accuracy</h3>
              <p>Your accuracy on the very first time you review an item. This is a great indicator of how well you initially learn new material.</p>
            </div>
            <div>
              <h3 className="font-semibold">Avg. Recall Time</h3>
              <p>The average time you take to answer a question correctly. A decreasing time can indicate increased fluency and automaticity.</p>
            </div>
            <div>
              <h3 className="font-semibold">Leech Count</h3>
              <p>Leeches are items you consistently forget (fail multiple times). Identifying them helps you focus on your most difficult material, which may need to be re-learned or edited for clarity.</p>
            </div>
            <div>
              <h3 className="font-semibold">Tag Heatmap & Weakest Tags</h3>
              <p>This visualizes your accuracy for different topics based on tags. Red tags are your weakest areas, while green tags are your strongest. Use this to identify and target areas that need more focus.</p>
            </div>
          </StatCard>

          <StatCard title="FSRS-Specific Metrics" description="These advanced metrics are only available when using the FSRS scheduler.">
            <div>
              <h3 className="font-semibold">Stability Trend</h3>
              <p><strong>Stability</strong> (in days) is FSRS's estimate of how long a memory will last. An upward trend in this chart is excellent—it means your long-term memory for the material is strengthening across your collection.</p>
            </div>
            <div>
              <h3 className="font-semibold">Decay Velocity</h3>
              <p>This is the rate of change of your average stability over the last 30 days. A positive value means your memory is getting stronger on average; a negative value suggests you might be forgetting things faster than you're learning them, and you may need to adjust your study habits.</p>
            </div>
            <div>
              <h3 className="font-semibold">Knowledge Half-Life</h3>
              <p>The estimated time it takes for your memory of an average reviewed item to decay to a 50% chance of recall. A longer half-life indicates stronger, more durable memories.</p>
            </div>
            <div>
              <h3 className="font-semibold">Difficulty Distribution</h3>
              <p>This chart shows how many of your items FSRS considers easy (1-4), medium (5-7), or hard (8-10). It helps you understand the overall challenge of your collection.</p>
            </div>
          </StatCard>

          <StatCard title="Charts & Deeper Insights" description="Visualizations that provide a deeper look into your memory patterns.">
            <div>
              <h3 className="font-semibold">Forecast</h3>
              <p>Predicts your review workload for the next 30 days. Use this to plan your study schedule and anticipate busy days.</p>
            </div>
            <div>
              <h3 className="font-semibold">Forgetting Curve</h3>
              <p>Shows how your probability of recalling an item decreases as more time passes since the last review. This visualizes your actual memory decay and is the core data FSRS uses for scheduling.</p>
            </div>
            <div>
              <h3 className="font-semibold">Learning Curve</h3>
              <p>Tracks your accuracy over the first few reviews of an item after a lapse. A steep upward curve indicates you're mastering new or forgotten material quickly.</p>
            </div>
            <div>
              <h3 className="font-semibold">Maturity Chart</h3>
              <p>Breaks down your collection into stages: <strong>New</strong> (never seen), <strong>Learning</strong> (in early stages), <strong>Young</strong> (reviewed but not yet long-term), and <strong>Mature</strong> (well-established in long-term memory).</p>
            </div>
          </StatCard>
        </div>
      </main>
    </div>
  );
};

export default StatisticsGuidePage;