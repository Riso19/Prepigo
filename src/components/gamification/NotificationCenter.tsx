import { useState } from 'react';
import { Bell, Star, Trophy, Flame, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GamificationNotification } from '@/data/gamification';
import { formatDistanceToNow } from 'date-fns';

interface NotificationCenterProps {
  notifications: GamificationNotification[];
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
}

const notificationIcons = {
  achievement: Trophy,
  level_up: Star,
  streak_milestone: Flame,
  goal_completed: Target,
  reminder: Bell,
};

export const NotificationCenter = ({
  notifications,
  onMarkRead,
  onClearAll,
}: NotificationCenterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Notifications</CardTitle>
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" onClick={onClearAll} className="text-xs">
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No notifications</p>
              </div>
            ) : (
              <ScrollArea className="h-80">
                <div className="space-y-1 p-2">
                  {notifications.map((notification) => {
                    const IconComponent = notificationIcons[notification.type];

                    return (
                      <div
                        key={notification.id}
                        className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                          notification.isRead
                            ? 'bg-background hover:bg-muted/50'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                        onClick={() => onMarkRead(notification.id)}
                      >
                        <div className="flex items-start gap-3">
                          <IconComponent className="h-4 w-4 mt-0.5 text-primary" />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">{notification.title}</p>
                              {!notification.isRead && (
                                <div className="h-2 w-2 bg-primary rounded-full" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{notification.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
