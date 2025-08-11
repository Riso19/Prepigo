import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

interface PauseOverlayProps {
  onResume: () => void;
}

export const PauseOverlay = ({ onResume }: PauseOverlayProps) => (
  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-4">
    <h2 className="text-2xl font-bold">Exam Paused</h2>
    <Button onClick={onResume} size="lg">
      <Play className="mr-2 h-5 w-5" />
      Resume Exam
    </Button>
  </div>
);