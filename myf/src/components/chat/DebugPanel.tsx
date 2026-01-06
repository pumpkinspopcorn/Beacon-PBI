import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, Activity, Zap, AlertTriangle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { DebugState } from '@/types/powerbi-chat';
import { updateMockAPIConfig, getMockAPIConfig, getTelemetry, resetTelemetry } from '@/lib/mockAPI';

interface DebugPanelProps {
  className?: string;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ className }) => {
  const [isExpanded, setIsExpanded] = useState(false);
    // Add a body class when debug panel is open to avoid overlap with chat
    React.useEffect(() => {
      const body = document.body;
      if (isExpanded) {
        body.classList.add('debug-open');
      } else {
        body.classList.remove('debug-open');
      }
      return () => body.classList.remove('debug-open');
    }, [isExpanded]);
  const [config, setConfig] = useState(getMockAPIConfig());
  const [telemetry, setTelemetry] = useState(getTelemetry());

  // Update telemetry every second
  React.useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry(getTelemetry());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleConfigChange = (key: keyof typeof config, value: number | boolean) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    updateMockAPIConfig(newConfig);
  };

  const handleResetTelemetry = () => {
    resetTelemetry();
    setTelemetry(getTelemetry());
  };

  const handleTriggerError = () => {
    // Temporarily enable error simulation
    handleConfigChange('errorRate', 1);
    setTimeout(() => {
      handleConfigChange('errorRate', 0);
    }, 100);
  };

  return (
    <div className={cn('fixed bottom-24 right-4 z-40 pointer-events-auto', className)}>
      {/* Circular debug icon that reveals panel on hover */}
      <div
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className="relative"
      >
        <Button
          aria-label="Debug"
          title="Debug"
          variant="default"
          size="icon"
          className="h-10 w-10 rounded-full shadow-md"
        >
          <Bug className="w-5 h-5" />
        </Button>

        {/* Panel content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-12 right-0 w-96 bg-card border border-border rounded-lg shadow-xl"
            >
            <div className="p-4 max-h-[500px] overflow-y-auto scrollbar-thin space-y-6">
              {/* API Configuration */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <h3 className="font-semibold text-slate-900">API Configuration</h3>
                </div>

                <div className="space-y-4">
                  {/* Latency */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="latency" className="text-sm">
                        API Latency
                      </Label>
                      <Badge variant="outline" className="text-xs">
                        {config.latency}ms
                      </Badge>
                    </div>
                    <Slider
                      id="latency"
                      min={0}
                      max={5000}
                      step={100}
                      value={[config.latency]}
                      onValueChange={([value]) => handleConfigChange('latency', value)}
                      className="w-full"
                    />
                  </div>

                  {/* Streaming Speed */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="streaming" className="text-sm">
                        Streaming Speed
                      </Label>
                      <Badge variant="outline" className="text-xs">
                        {config.streamingSpeed} chars/chunk
                      </Badge>
                    </div>
                    <Slider
                      id="streaming"
                      min={1}
                      max={50}
                      step={1}
                      value={[config.streamingSpeed]}
                      onValueChange={([value]) => handleConfigChange('streamingSpeed', value)}
                      className="w-full"
                    />
                  </div>

                  {/* Error Rate */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="errorRate" className="text-sm">
                        Error Rate
                      </Label>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(config.errorRate * 100)}%
                      </Badge>
                    </div>
                    <Slider
                      id="errorRate"
                      min={0}
                      max={1}
                      step={0.1}
                      value={[config.errorRate]}
                      onValueChange={([value]) => handleConfigChange('errorRate', value)}
                      className="w-full"
                    />
                  </div>

                  {/* Upload Failure Rate */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="uploadFailure" className="text-sm">
                        Upload Failure Rate
                      </Label>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(config.uploadFailureRate * 100)}%
                      </Badge>
                    </div>
                    <Slider
                      id="uploadFailure"
                      min={0}
                      max={1}
                      step={0.1}
                      value={[config.uploadFailureRate]}
                      onValueChange={([value]) => handleConfigChange('uploadFailureRate', value)}
                      className="w-full"
                    />
                  </div>
                </div>
              </Card>

              {/* Telemetry */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-green-600" />
                    <h3 className="font-semibold text-slate-900">Telemetry</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetTelemetry}
                    className="h-7 text-xs"
                  >
                    Reset
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(telemetry).map(([key, value]) => (
                    <div key={key} className="bg-slate-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-slate-900">{value}</div>
                      <div className="text-xs text-slate-600 mt-1 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Actions */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <h3 className="font-semibold text-slate-900">Actions</h3>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTriggerError}
                    className="w-full justify-start"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Trigger Error
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => console.log('Conversation store:', { telemetry, config })}
                    className="w-full justify-start"
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    Log State to Console
                  </Button>
                </div>
              </Card>

              {/* Info */}
              <div className="text-xs text-muted-foreground text-center">
                Dev tools — hover to open
              </div>
            </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
