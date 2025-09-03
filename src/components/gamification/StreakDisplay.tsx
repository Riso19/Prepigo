import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Calendar, Trophy, Zap } from 'lucide-react';
import { Streak, StreakType } from '@/data/gamification';
import { cn } from '@/lib/utils';

interface StreakDisplayProps {
  streaks: Streak[];
  size?: 'sm' | 'md' | 'lg';
}

const streakIcons: Record<StreakType, typeof Flame> = {
  study: Flame,
  exam: Trophy,
  login: Calendar,
  perfect_score: Zap,
};

const streakLabels: Record<StreakType, string> = {
  study: 'Study Streak',
  exam: 'Exam Streak',
  login: 'Login Streak',
  perfect_score: 'Perfect Score Streak',
};

export const StreakDisplay = ({ streaks, size: _size = 'md' }: StreakDisplayProps) => {
  const activeStreaks = streaks.filter((s) => s.isActive && s.currentStreak > 0);

  if (activeStreaks.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-muted-foreground">
          <Flame className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No active streaks</p>
          <p className="text-sm">Start studying to build your streak!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {activeStreaks.map((streak) => {
        const IconComponent = streakIcons[streak.type];
        const isHot = streak.currentStreak >= 7;
        const isOnFire = streak.currentStreak >= 30;

        return (
          <Card
            key={streak.id}
            className={cn(
              'transition-all duration-200',
              isOnFire && 'ring-2 ring-orange-500 shadow-lg',
              isHot && !isOnFire && 'ring-1 ring-yellow-500',
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <IconComponent
                    className={cn(
                      'h-4 w-4',
                      isOnFire && 'text-orange-500',
                      isHot && !isOnFire && 'text-yellow-500',
                      !isHot && 'text-muted-foreground',
                    )}
                  />
                  {streakLabels[streak.type]}
                </div>
                {isOnFire && <Badge variant="destructive">🔥 On Fire!</Badge>}
                {isHot && !isOnFire && <Badge variant="secondary">🔥 Hot!</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{streak.currentStreak}</div>
                  <div className="text-sm text-muted-foreground">
                    {streak.currentStreak === 1 ? 'day' : 'days'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Best</div>
                  <div className="font-semibold">{streak.longestStreak}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
