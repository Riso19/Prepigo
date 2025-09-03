import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Trophy, Clock, Target, TrendingUp, Award } from 'lucide-react';
import { UserStats } from '@/data/gamification';

interface StatsOverviewProps {
  stats: UserStats;
  layout?: 'grid' | 'row';
}

export const StatsOverview = ({ stats, layout = 'grid' }: StatsOverviewProps) => {
  const statItems = [
    {
      icon: BookOpen,
      label: 'Cards Reviewed',
      value: stats.totalCardsReviewed.toLocaleString(),
      color: 'text-blue-600',
    },
    {
      icon: Trophy,
      label: 'Exams Completed',
      value: stats.totalExamsCompleted.toLocaleString(),
      color: 'text-yellow-600',
    },
    {
      icon: Clock,
      label: 'Study Time',
      value: `${Math.floor(stats.totalStudyTimeMinutes / 60)}h ${stats.totalStudyTimeMinutes % 60}m`,
      color: 'text-green-600',
    },
    {
      icon: Award,
      label: 'Perfect Exams',
      value: stats.perfectExams.toLocaleString(),
      color: 'text-purple-600',
    },
    {
      icon: TrendingUp,
      label: 'Average Score',
      value: `${stats.averageExamScore.toFixed(1)}%`,
      color: 'text-orange-600',
    },
    {
      icon: Target,
      label: 'Best Streak',
      value: `${stats.studyStreakRecord} days`,
      color: 'text-red-600',
    },
  ];

  if (layout === 'row') {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {statItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <Card key={item.label} className="min-w-[120px] flex-shrink-0">
              <CardContent className="p-3 text-center">
                <IconComponent className={`h-5 w-5 mx-auto mb-1 ${item.color}`} />
                <div className="font-semibold text-sm">{item.value}</div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {statItems.map((item) => {
        const IconComponent = item.icon;
        return (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <IconComponent className={`h-4 w-4 ${item.color}`} />
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{item.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
