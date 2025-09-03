import { useGamification } from '@/contexts/GamificationContext';
import { XpBar } from './XpBar';
import { NotificationCenter } from './NotificationCenter';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

interface GamificationHeaderProps {
  compact?: boolean;
}

export const GamificationHeader = ({ compact = false }: GamificationHeaderProps) => {
  const { userLevel, notifications, markNotificationRead, clearAllNotifications } =
    useGamification();

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="min-w-[200px]">
          <XpBar userLevel={userLevel} showDetails={false} size="sm" />
        </div>
        <NotificationCenter
          notifications={notifications}
          onMarkRead={markNotificationRead}
          onClearAll={clearAllNotifications}
        />
        <Button asChild variant="ghost" size="sm">
          <Link to="/gamification">
            <Trophy className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Progress</h2>
        <div className="flex items-center gap-2">
          <NotificationCenter
            notifications={notifications}
            onMarkRead={markNotificationRead}
            onClearAll={clearAllNotifications}
          />
          <Button asChild variant="outline" size="sm">
            <Link to="/gamification">
              <Trophy className="h-4 w-4 mr-2" />
              View Dashboard
            </Link>
          </Button>
        </div>
      </div>
      <XpBar userLevel={userLevel} size="md" />
    </div>
  );
};
