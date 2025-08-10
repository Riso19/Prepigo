import { motion } from 'framer-motion';
import * as React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const AnimatedCard = ({ children, className, delay = 0, ...props }: AnimatedCardProps) => {
  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      transition={{ duration: 0.5, delay }}
    >
      <Card className={cn(className)} {...props}>
        {children}
      </Card>
    </motion.div>
  );
};