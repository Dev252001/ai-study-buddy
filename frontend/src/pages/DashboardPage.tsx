import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  MessageSquare,
  Brain,
  CreditCard,
  BarChart2,
  Clock,
  Flame,
  BookOpen,
  Plus,
  ArrowRight,
  Target,
  Edit2,
  Check,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAnalytics, useProgress, useUpdateGoals } from '@/hooks/useAnalytics'
import { useDocuments } from '@/hooks/useDocuments'
import { useQuizzes } from '@/hooks/useQuiz'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { formatDate, getStatusColor, formatFileSize, buildWeeklyChartData } from '@/lib/utils'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  bg,
  loading,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  color: string
  bg: string
  loading: boolean
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
            </div>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics()
  const { data: progress, isLoading: progressLoading } = useProgress()
  const { data: documents = [], isLoading: docsLoading } = useDocuments()
  const { data: quizzes = [], isLoading: quizzesLoading } = useQuizzes()
  const { mutateAsync: updateGoals, isPending: savingGoals } = useUpdateGoals()
  const navigate = useNavigate()

  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')

  const weeklyData = buildWeeklyChartData(progress?.weekly_hours as any)

  const todayHours = weeklyData.find((d) => {
    const today = new Date()
    const todayAbbr = today.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3)
    return d.day === todayAbbr
  })?.hours ?? 0
  const dailyGoal = analytics?.daily_goal_hours ?? 2
  const dailyPct = Math.min(100, (todayHours / dailyGoal) * 100)

  const handleSaveGoal = async () => {
    const val = parseFloat(goalInput)
    if (!isNaN(val) && val > 0) {
      await updateGoals({ daily_goal_hours: val })
    }
    setEditingGoal(false)
  }

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.full_name?.split(' ')[0] || user?.username

  const stats = [
    { title: 'Documents', value: analytics?.total_documents ?? 0, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { title: 'AI Questions', value: analytics?.total_questions_asked ?? 0, icon: MessageSquare, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    { title: 'Quizzes Taken', value: analytics?.total_quizzes_taken ?? 0, icon: Brain, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { title: 'Study Hours', value: `${analytics?.total_study_hours?.toFixed(1) ?? '0'}h`, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Welcome header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold leading-tight">
            {greeting},{' '}
            <span className="text-gradient">{firstName}</span>
          </h2>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5">
            {analytics?.streak_days ? (
              <>
                <Flame className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                <span>
                  <strong className="text-foreground">{analytics.streak_days}-day streak</strong> — keep the momentum going!
                </span>
              </>
            ) : (
              'Ready to continue your learning journey?'
            )}
          </p>
        </div>
        <Button onClick={() => navigate('/documents')} className="shrink-0 sm:self-start">
          <Plus className="mr-2 h-4 w-4" /> Upload Material
        </Button>
      </motion.div>

      {/* Stats grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} loading={analyticsLoading} />
        ))}
      </motion.div>

      {/* Daily Goal Progress */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-5">
            {analyticsLoading ? (
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-2.5 w-full" />
                <Skeleton className="h-3 w-28" />
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold">Daily Study Goal</p>
                    <div className="flex items-center gap-1">
                      {editingGoal ? (
                        <>
                          <input
                            type="number"
                            min={0.5}
                            max={24}
                            step={0.5}
                            value={goalInput}
                            onChange={(e) => setGoalInput(e.target.value)}
                            className="w-16 h-6 text-xs border border-border rounded-md px-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            autoFocus
                          />
                          <span className="text-xs text-muted-foreground">hrs</span>
                          <button
                            onClick={handleSaveGoal}
                            disabled={savingGoals}
                            className="text-emerald-500 hover:text-emerald-600 p-0.5 rounded transition-colors"
                            aria-label="Save goal"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingGoal(false)}
                            className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                            aria-label="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {todayHours.toFixed(1)}h / {dailyGoal}h
                          </span>
                          <button
                            onClick={() => { setGoalInput(String(dailyGoal)); setEditingGoal(true) }}
                            className="text-muted-foreground hover:text-foreground p-0.5 ml-0.5 rounded transition-colors"
                            aria-label="Edit goal"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <Progress value={dailyPct} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {dailyPct >= 100
                      ? '🎉 Daily goal reached! Great work!'
                      : `${(dailyGoal - todayHours).toFixed(1)}h remaining today`}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Weekly Activity Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                Weekly Study Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {progressLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={188}>
                  <BarChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: 'hsl(var(--card-foreground))',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      }}
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      formatter={(value: number) => [`${value}h`, 'Study Hours']}
                    />
                    <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                { label: 'Start AI Chat', icon: MessageSquare, to: '/chat', color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
                { label: 'Generate Quiz', icon: Brain, to: '/quiz/generate', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                { label: 'Create Flashcards', icon: CreditCard, to: '/flashcards', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { label: 'AI Summarizer', icon: BookOpen, to: '/summaries', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
              ].map((action) => (
                <button
                  key={action.to}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-accent transition-colors group"
                  onClick={() => navigate(action.to)}
                >
                  <span className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${action.bg}`}>
                      <action.icon className={`h-3.5 w-3.5 ${action.color}`} />
                    </span>
                    <span className="text-sm font-medium">{action.label}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </button>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Documents */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold">Recent Documents</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground" onClick={() => navigate('/documents')}>
                View all
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {docsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                </div>
              ) : !Array.isArray(documents) || documents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No documents yet</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate('/documents')}>
                    Upload your first document
                  </Button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {(Array.isArray(documents) ? documents : []).slice(0, 5).map((doc) => (
                    <button
                      key={doc.id}
                      className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-accent transition-colors text-left"
                      onClick={() => navigate(`/documents/${doc.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">{doc.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatFileSize(doc.file_size)} · {formatDate(doc.created_at)}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-xs ml-2 ${getStatusColor(doc.status)}`}
                      >
                        {doc.status}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Quizzes */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold">Recent Quizzes</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground" onClick={() => navigate('/quiz')}>
                View all
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {quizzesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                </div>
              ) : quizzes.length === 0 ? (
                <div className="text-center py-8">
                  <Brain className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No quizzes yet</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate('/quiz/generate')}>
                    Generate your first quiz
                  </Button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {quizzes.slice(0, 5).map((quiz) => (
                    <button
                      key={quiz.id}
                      className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-accent transition-colors text-left"
                      onClick={() => navigate(`/quiz/${quiz.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                          <Brain className="h-3.5 w-3.5 text-emerald-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">{quiz.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {quiz.total_questions} questions · {formatDate(quiz.created_at)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs ml-2 capitalize">
                        {quiz.difficulty}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
