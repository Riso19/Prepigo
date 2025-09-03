import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Star, Zap } from 'lucide-react';
import { UserLevel, calculateXpForLevel, getLevelMeta } from '@/data/gamification';

interface XpBarProps {
  userLevel: UserLevel;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const XpBar = ({ userLevel, showDetails = true, size = 'md' }: XpBarProps) => {
  const { currentLevel, totalXp, xpToNextLevel } = userLevel;
  const { name: levelName, colorClass } = getLevelMeta(currentLevel);
  // Calculate XP needed for current level and next level
  const xpForCurrentLevel = calculateXpForLevel(currentLevel);
  const xpForNextLevel = calculateXpForLevel(currentLevel + 1);
  const xpInCurrentLevel = totalXp - xpForCurrentLevel;
  const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = (xpInCurrentLevel / xpNeededForNextLevel) * 100;

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={`flex items-center gap-1 ${colorClass}`}>
            <Star className="h-3 w-3" />
            {levelName} · L{currentLevel}
          </Badge>
          {showDetails && (
            <span className={`text-muted-foreground ${textSizes[size]}`}>
              {totalXp.toLocaleString()} XP
            </span>
          )}
        </div>
        {showDetails && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span className={textSizes[size]}>{xpToNextLevel} to next level</span>
          </div>
        )}
      </div>
      <Progress value={progressPercentage} className={sizeClasses[size]} />
    </div>
  );
};
