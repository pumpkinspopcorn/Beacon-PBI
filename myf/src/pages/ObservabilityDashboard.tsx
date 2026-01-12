import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { getObservabilityStats, getRecentRequests, resetObservabilityStats } from "@/lib/api";
import { ObservabilityStats } from "@/types/chat";
import { Activity, DollarSign, Clock, RefreshCw, AlertCircle, CheckCircle2, Zap, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function ObservabilityDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds
  const navigate = useNavigate();

  const { data: stats, isLoading, refetch } = useQuery<ObservabilityStats>({
    queryKey: ["observability-stats"],
    queryFn: getObservabilityStats,
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const { data: recentData } = useQuery({
    queryKey: ["recent-requests"],
    queryFn: () => getRecentRequests(50),
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const handleReset = async () => {
    if (confirm("Are you sure you want to reset all observability statistics? This cannot be undone.")) {
      try {
        await resetObservabilityStats();
        toast.success("Statistics reset successfully");
        refetch();
      } catch (error) {
        toast.error("Failed to reset statistics");
      }
    }
  };

  const handleNewChat = () => {
    navigate('/');
  };

  // Removed full-screen loading state to always render the dashboard

  const summary = stats?.summary || {
    total_requests: 0,
    successful_requests: 0,
    failed_requests: 0,
    success_rate: 0,
    total_tokens_input: 0,
    total_tokens_output: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    average_latency_ms: 0,
  };

  const totalTokensSafe = Math.max(summary.total_tokens, 1);
  const inputCost = summary.total_cost_usd * (summary.total_tokens_input / totalTokensSafe);
  const outputCost = summary.total_cost_usd * (summary.total_tokens_output / totalTokensSafe);

  // Normalize recent request success based on agent responses (backend failures surface as failed)
  const normalizedRecentRequests = (recentData ?? stats?.recent_requests ?? []).map((request) => {
    const normalizedSuccess = !!request.success && !request.error;
    return { ...request, success: normalizedSuccess };
  });

  const recentSuccessCount = normalizedRecentRequests.filter((request) => request.success).length;
  const recentFailureCount = normalizedRecentRequests.length - recentSuccessCount;
  const recentSuccessRate = normalizedRecentRequests.length > 0
    ? (recentSuccessCount / normalizedRecentRequests.length) * 100
    : summary.success_rate;

  const requestTotals = {
    total: summary.total_requests || normalizedRecentRequests.length,
    success: normalizedRecentRequests.length > 0 ? recentSuccessCount : summary.successful_requests,
    failure: normalizedRecentRequests.length > 0 ? recentFailureCount : summary.failed_requests,
    rate: recentSuccessRate,
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-gradient-to-b from-background via-muted/20 to-background">
        <AppSidebar onNewChat={handleNewChat} />
        
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <Header 
            title="PBI Beacon"
            subtitle="Observability Hub"
            showChatActions={true}
            onNewChat={handleNewChat}
          />
          
          <main className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <div className="p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">Observability Hub</h1>
                    <p className="text-muted-foreground mt-1">
                      Monitor LLM usage, token consumption, and costs
                    </p>
                  </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset} className="hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors">
                    Reset Stats
                  </Button>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(requestTotals.total)}</div>
                    <p className="text-xs text-muted-foreground">
                      {requestTotals.success} successful, {requestTotals.failure} failed
                    </p>
                  </CardContent>
                </Card>


                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Input Tokens</CardTitle>
                    <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(summary.total_tokens_input)}</div>
                    <p className="text-xs text-muted-foreground">
                      Avg: {formatNumber(Math.round(summary.total_tokens_input / Math.max(summary.total_requests, 1)))} per request
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Output Tokens</CardTitle>
                    <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(summary.total_tokens_output)}</div>
                    <p className="text-xs text-muted-foreground">
                      Avg: {formatNumber(Math.round(summary.total_tokens_output / Math.max(summary.total_requests, 1)))} per request
                    </p>
                  </CardContent>
                </Card>

                                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                    <Zap className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(summary.total_tokens)}</div>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(summary.total_tokens_input)} in, {formatNumber(summary.total_tokens_output)} out
                    </p>
                  </CardContent>
                </Card>

                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatTime(summary.average_latency_ms)}</div>
                    <p className="text-xs text-muted-foreground">
                      Success rate: {requestTotals.rate.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
              
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Input Cost</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(inputCost)}</div>
                    <p className="text-xs text-muted-foreground">
                      Avg: {formatCurrency(inputCost / Math.max(summary.total_requests, 1))} per request
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Output Cost</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(outputCost)}</div>
                    <p className="text-xs text-muted-foreground">
                      Avg: {formatCurrency(outputCost / Math.max(summary.total_requests, 1))} per request
                    </p>
                  </CardContent>
                </Card>

                  <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(summary.total_cost_usd)}</div>
                    <p className="text-xs text-muted-foreground">
                      Average: {formatCurrency(summary.total_cost_usd / Math.max(summary.total_requests, 1))} per request
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabs for detailed views */}
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="models">By Model</TabsTrigger>
                  <TabsTrigger value="hourly">Hourly Breakdown</TabsTrigger>
                  <TabsTrigger value="recent">Recent Requests</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>System Health</CardTitle>
                      <CardDescription>Overall system performance metrics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Success Rate</span>
                            <Badge variant={requestTotals.rate >= 95 ? "default" : "secondary"}>
                              {requestTotals.rate.toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${requestTotals.rate}%` }}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Average Tokens/Request</span>
                            <span className="text-sm font-medium">
                              {formatNumber(Math.round(summary.total_tokens / Math.max(summary.total_requests, 1)))}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Cost per Request</span>
                            <span className="text-sm font-medium">
                              {formatCurrency(summary.total_cost_usd / Math.max(summary.total_requests, 1))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Azure Grok Model Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Azure Grok Model Status</CardTitle>
                      <CardDescription>Real-time monitoring of your deployed Azure Grok model</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Model Endpoint</span>
                            <Badge variant="outline" className="text-xs">
                              Azure AI Services
                            </Badge>
                          </div>
                          <p className="text-xs font-mono bg-muted p-2 rounded">
                            mk2bzl3b-eastus2.services.ai.azure.com
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Model Version</span>
                            <Badge variant="default">
                              grok-3-mini
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Deployed via Azure AI Foundry
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="models" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Usage by Model</CardTitle>
                      <CardDescription>Token usage and costs broken down by model</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Model</TableHead>
                            <TableHead>Requests</TableHead>
                            <TableHead>Input Tokens</TableHead>
                            <TableHead>Output Tokens</TableHead>
                            <TableHead>Total Tokens</TableHead>
                            <TableHead>Cost</TableHead>
                            <TableHead>Avg Latency</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats?.by_model && Object.entries(stats.by_model).length > 0 ? (
                            Object.entries(stats.by_model).map(([model, data]) => (
                              <TableRow key={model}>
                                <TableCell className="font-medium">{model}</TableCell>
                                <TableCell>{formatNumber(data.requests)}</TableCell>
                                <TableCell>{formatNumber(data.tokens_input)}</TableCell>
                                <TableCell>{formatNumber(data.tokens_output)}</TableCell>
                                <TableCell>{formatNumber(data.tokens_total)}</TableCell>
                                <TableCell>{formatCurrency(data.cost_usd)}</TableCell>
                                <TableCell>{formatTime(data.average_latency_ms)}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground">
                                No model usage data available
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="hourly" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Hourly Breakdown</CardTitle>
                      <CardDescription>Requests and costs over the last 24 hours</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {stats?.hourly_breakdown && stats.hourly_breakdown.length > 0 ? (
                          stats.hourly_breakdown.map((hour, index) => (
                            <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                              <div>
                                <p className="font-medium">{hour.hour}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatNumber(hour.requests)} requests
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{formatCurrency(hour.cost)}</p>
                                <p className="text-sm text-muted-foreground">Cost</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-muted-foreground py-8">
                            No hourly data available
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="recent" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Requests</CardTitle>
                      <CardDescription>Last 50 LLM requests with detailed information</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead>Tokens</TableHead>
                            <TableHead>Cost</TableHead>
                            <TableHead>Latency</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {normalizedRecentRequests && normalizedRecentRequests.length > 0 ? (
                            normalizedRecentRequests
                              .slice()
                              .reverse()
                              .map((request, index) => (
                                <TableRow key={index}>
                                  <TableCell className="text-sm">
                                    {new Date(request.timestamp).toLocaleString()}
                                  </TableCell>
                                  <TableCell className="font-medium">{request.model}</TableCell>
                                  <TableCell>
                                    {formatNumber(request.total_tokens)} ({formatNumber(request.input_tokens)}/{formatNumber(request.output_tokens)})
                                  </TableCell>
                                  <TableCell>{formatCurrency(request.cost)}</TableCell>
                                  <TableCell>{formatTime(request.latency_ms)}</TableCell>
                                  <TableCell>
                                    {request.success ? (
                                      <Badge variant="default" className="gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Success
                                      </Badge>
                                    ) : (
                                      <Badge variant="destructive" className="gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Failed
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground">
                                No recent requests available
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
                </div>
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default ObservabilityDashboard;

