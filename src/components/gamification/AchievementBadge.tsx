import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Achievement, AchievementTier } from '@/data/gamification';
import { LucideIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

interface AchievementBadgeProps {
  achievement: Achievement;
  isUnlocked?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const tierColors: Record<AchievementTier, string> = {
  bronze: 'bg-amber-600 text-amber-50',
  silver: 'bg-gray-400 text-gray-50',
  gold: 'bg-yellow-500 text-yellow-50',
  platinum: 'bg-blue-500 text-blue-50',
  diamond: 'bg-purple-600 text-purple-50',
};

const tierGradients: Record<AchievementTier, string> = {
  bronze: 'from-amber-500 to-amber-700',
  silver: 'from-gray-300 to-gray-500',
  gold: 'from-yellow-400 to-yellow-600',
  platinum: 'from-blue-400 to-blue-600',
  diamond: 'from-purple-500 to-purple-700',
};

export const AchievementBadge = ({
  achievement,
  isUnlocked = false,
  size = 'md',
  showTooltip = true,
}: AchievementBadgeProps) => {
  const IconComponent =
    (Icons[achievement.icon as keyof typeof Icons] as LucideIcon) || Icons.Award;

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
  };

  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  };

  const badge = (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        sizeClasses[size],
        isUnlocked
          ? `bg-gradient-to-br ${tierGradients[achievement.tier]} shadow-lg hover:shadow-xl`
          : 'bg-muted opacity-50 grayscale',
      )}
    >
      <CardContent className="p-0 h-full flex items-center justify-center">
        <IconComponent
          className={cn(iconSizes[size], isUnlocked ? 'text-white' : 'text-muted-foreground')}
        />
        {isUnlocked && (
          <Badge
            className={cn(
              'absolute -top-1 -right-1 text-xs px-1 py-0',
              tierColors[achievement.tier],
            )}
          >
            {achievement.tier}
          </Badge>
        )}
      </CardContent>
    </Card>
  );

  if (!showTooltip) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>
        <div className="text-center space-y-1">
          <p className="font-semibold">{achievement.name}</p>
          <p className="text-sm text-muted-foreground">{achievement.description}</p>
          <div className="flex items-center justify-center gap-2 text-xs">
            <Badge variant="outline" className={tierColors[achievement.tier]}>
              {achievement.tier}
            </Badge>
            <span>+{achievement.xpReward} XP</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
