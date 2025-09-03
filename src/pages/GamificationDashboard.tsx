import { useGamification } from '@/contexts/GamificationContext';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { XpBar } from '@/components/gamification/XpBar';
import { AchievementBadge } from '@/components/gamification/AchievementBadge';
import { StreakDisplay } from '@/components/gamification/StreakDisplay';
import { StatsOverview } from '@/components/gamification/StatsOverview';
import { Trophy, Star, Flame, Target, TrendingUp } from 'lucide-react';

const GamificationDashboard = () => {
  const { userLevel, achievements, userAchievements, streaks, userStats } = useGamification();

  const unlockedAchievements = userAchievements.filter((ua) => ua.isCompleted);
  const lockedAchievements = achievements.filter(
    (a) => !userAchievements.some((ua) => ua.achievementId === a.id && ua.isCompleted),
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 space-y-6">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Your Progress</h1>
          <p className="text-muted-foreground">Track your learning journey and achievements</p>
        </div>

        {/* XP and Level Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Level & Experience
            </CardTitle>
          </CardHeader>
          <CardContent>
            <XpBar userLevel={userLevel} size="lg" />
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="streaks">Streaks</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  <div className="text-2xl font-bold">{unlockedAchievements.length}</div>
                  <div className="text-sm text-muted-foreground">Achievements</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Flame className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                  <div className="text-2xl font-bold">
                    {Math.max(...streaks.map((s) => s.currentStreak), 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Best Streak</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">{userStats.totalExamsCompleted}</div>
                  <div className="text-sm text-muted-foreground">Exams</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold">{userStats.averageExamScore.toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground">Avg Score</div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Achievements */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Achievements</CardTitle>
              </CardHeader>
              <CardContent>
                {unlockedAchievements.length > 0 ? (
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {unlockedAchievements.slice(0, 6).map((userAchievement) => {
                      const achievement = achievements.find(
                        (a) => a.id === userAchievement.achievementId,
                      );
                      if (!achievement) return null;
                      return (
                        <AchievementBadge
                          key={userAchievement.id}
                          achievement={achievement}
                          isUnlocked={true}
                          size="lg"
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No achievements unlocked yet</p>
                    <p className="text-sm">Start studying to earn your first achievement!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Streaks */}
            <Card>
              <CardHeader>
                <CardTitle>Active Streaks</CardTitle>
              </CardHeader>
              <CardContent>
                <StreakDisplay streaks={streaks} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="achievements" className="space-y-6">
            <div className="space-y-6">
              {/* Unlocked Achievements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Unlocked Achievements</span>
                    <Badge variant="secondary">{unlockedAchievements.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {unlockedAchievements.length > 0 ? (
                    <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-4">
                      {unlockedAchievements.map((userAchievement) => {
                        const achievement = achievements.find(
                          (a) => a.id === userAchievement.achievementId,
                        );
                        if (!achievement) return null;
                        return (
                          <AchievementBadge
                            key={userAchievement.id}
                            achievement={achievement}
                            isUnlocked={true}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No achievements unlocked yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Locked Achievements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Available Achievements</span>
                    <Badge variant="outline">{lockedAchievements.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-4">
                    {lockedAchievements
                      .filter((a) => !a.isSecret)
                      .map((achievement) => (
                        <AchievementBadge
                          key={achievement.id}
                          achievement={achievement}
                          isUnlocked={false}
                        />
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="streaks" className="space-y-6">
            <StreakDisplay streaks={streaks} />
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <StatsOverview stats={userStats} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default GamificationDashboard;
