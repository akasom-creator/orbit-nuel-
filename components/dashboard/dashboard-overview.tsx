"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import { ProgressRing } from "@/components/ui/progress-ring"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import {
  Users,
  Kanban,
  FileText,
  Clock,
  TrendingUp,
  CheckCircle,
  Calendar,
  Plus,
  ArrowRight,
  TrendingDown,
  AlertCircle,
} from "lucide-react"
import { useDashboardData } from "@/lib/queries/dashboard"

export function DashboardOverview() {
  const { data: dashboardData, isLoading, error } = useDashboardData()

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto"></div>
            <p className="mt-4 text-muted">Loading dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">Failed to load dashboard data</p>
            <p className="text-sm text-muted mt-2">
              {error?.message || 'Please check your connection and try again'}
            </p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return null
  }

  const stats = [
    {
      title: "Active Projects",
      value: dashboardData.stats.activeProjects.toString(),
      change: "+2 from last month",
      icon: Kanban,
      color: "text-blue-600",
      trend: "up",
    },
    {
      title: "Team Members",
      value: dashboardData.stats.teamMembers.toString(),
      change: "+5 new this month",
      icon: Users,
      color: "text-green-600",
      trend: "up",
    },
    {
      title: "Tasks Completed",
      value: dashboardData.stats.tasksCompleted.toString(),
      change: "+18% from last month",
      icon: CheckCircle,
      color: "text-purple-600",
      trend: "up",
    },
    {
      title: "Files Shared",
      value: dashboardData.stats.filesShared.toString(),
      change: "+12% from last month",
      icon: FileText,
      color: "text-orange-600",
      trend: "up",
    },
  ]
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard Overview</h1>
          <p className="text-muted mt-1">Welcome back, Sarah! Here's what's happening with your projects.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" className="hover-lift bg-transparent">
            <Calendar className="w-4 h-4 mr-2" />
            This Month
          </Button>
          <Button className="bg-secondary hover:bg-secondary/90 btn-press hover-glow">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card
            key={index}
            className="group hover-lift card-interactive animate-slide-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted">{stat.title}</CardTitle>
              <stat.icon className={`w-5 h-5 ${stat.color} group-hover:scale-110 transition-transform`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                <AnimatedCounter value={Number.parseInt(stat.value.replace(",", ""))} />
              </div>
              <div className="flex items-center mt-1">
                {stat.trend === "up" ? (
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                )}
                <span className={`text-xs font-medium ${stat.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                  {stat.change}
                </span>
                <span className="text-xs text-muted ml-1">from last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Charts Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Completion Chart */}
          <Card className="animate-slide-in-left hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-secondary" />
                Task Completion Trends
              </CardTitle>
              <CardDescription>Monthly task creation vs completion rates</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboardData.taskChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="tasks" fill="#8b5cf6" name="Created" />
                  <Bar dataKey="completed" fill="#10b981" name="Completed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Project Status Distribution */}
          <Card className="animate-slide-in-left stagger-1 hover-lift">
            <CardHeader>
              <CardTitle>Project Status Distribution</CardTitle>
              <CardDescription>Current status of all active projects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <ProgressRing progress={87} size={200}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">87%</div>
                    <div className="text-sm text-muted">Efficiency</div>
                  </div>
                </ProgressRing>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {dashboardData.projectStatusData.map((item, index) => (
                  <div key={index} className="flex items-center space-x-2 hover-scale">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-muted">{item.name}</span>
                    <span className="text-sm font-medium text-foreground">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Projects */}
        <div className="space-y-6">
          <Card className="animate-slide-in-right hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Recent Projects
                <Button variant="ghost" size="sm" className="hover-scale">
                  View All
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dashboardData.recentProjects.map((project, index) => (
                <div
                  key={index}
                  className="space-y-3 p-4 rounded-lg border border-border hover:bg-card/50 transition-colors card-interactive animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground">{project.name}</h4>
                    <Badge
                      variant={
                        project.priority === "High"
                          ? "destructive"
                          : project.priority === "Medium"
                            ? "default"
                            : "secondary"
                      }
                      className="hover-scale"
                    >
                      {project.priority}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Progress</span>
                      <span className="font-medium text-foreground">{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-2 animate-progress" />
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted">
                    <div className="flex items-center hover-scale">
                      <Users className="w-4 h-4 mr-1" />
                      {project.team} members
                    </div>
                    <div className="flex items-center hover-scale">
                      <Clock className="w-4 h-4 mr-1" />
                      {project.dueDate}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="animate-slide-in-right stagger-1 hover-lift">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start bg-transparent hover-lift btn-press">
                <Plus className="w-4 h-4 mr-2" />
                Create New Project
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent hover-lift btn-press">
                <Users className="w-4 h-4 mr-2" />
                Invite Team Member
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent hover-lift btn-press">
                <FileText className="w-4 h-4 mr-2" />
                Upload Files
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent hover-lift btn-press">
                <BarChart className="w-4 h-4 mr-2" />
                View Reports
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
