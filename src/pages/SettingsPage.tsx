import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Header from '@/components/Header';
import { MadeWithDyad } from '@/components/made-with-dyad';

const SettingsPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 bg-secondary/50 rounded-lg my-4">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Settings</CardTitle>
            <CardDescription>
              Configure your study experience and repetition algorithms.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Spaced Repetition System (SRS)</h3>
              <Card className="bg-background">
                <CardContent className="p-4">
                  <p className="font-medium">Current Algorithm: SM-2</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This is a classic and widely-used SRS algorithm to optimize learning.
                    Future updates will include more advanced algorithms like FSRS.
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="flex justify-start">
                <Button asChild variant="outline">
                    <Link to="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to My Decks
                    </Link>
                </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <MadeWithDyad />
    </div>
  );
};

export default SettingsPage;