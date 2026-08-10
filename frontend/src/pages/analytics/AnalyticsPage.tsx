import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { useAnalytics, useProgress, useUpdateGoals } from '@/hooks/useAnalytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileText, MessageSquare, Brain, Clock, Flame, CreditCard, TrendingUp, Target, Edit2, Check, X, BarChart2,
} from 'lucide-react'
import { buildWeeklyChartData } from '@/lib/utils'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

export function AnalyticsPage() {
  const { data: analytics, isLoading } = useAnalytics()
  const { data: progress, isLoading: progressLoading } = useProgress()
  const { mutateAsync: updateGoals, isPending: savingGoals } = useUpdateGoals()

  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')

  const weeklyData = buildWeeklyChartData(progress?.weekly_hours)
  const weeklyHoursTotal = weeklyData.reduce((s, d) => s + d.hours, 0)
  const weeklyGoal = analytics?.weekly_goal_hours ?? 10
  const weeklyPct = Math.min(100, (weeklyHoursTotal / weeklyGoal) * 100)

  const handleSaveWeeklyGoal = async () => {
    const val = parseFloat(goalInput)
    if (!isNaN(val) && val > 0) {
      await updateGoals({ weekly_goal_hours: val })
    }
    setEditingGoal(false)
  }

  const quizScoreData = (progress?.quiz_scores ?? []).map((entry, i) => ({
    quiz: `Q${i + 1}`,
    score: entry.percentage,
    title: entry.title ?? `Quiz ${i + 1}`,
  }))

  const stats = [
    { title: 'Documents', value: analytics?.total_documents ?? 0, icon: FileText, from: 'from-blue-500', to: 'to-cyan-500' },
    { title: 'AI Questions', value: analytics?.total_questions_asked ?? 0, icon: MessageSquare, from: 'from-violet-500', to: 'to-purple-500' },
    { title: 'Quizzes Taken', value: analytics?.total_quizzes_taken ?? 0, icon: Brain, from: 'from-emerald-500', to: 'to-teal-500' },
    { title: 'Cards Reviewed', value: analytics?.total_flashcards_reviewed ?? 0, icon: CreditCard, from: 'from-amber-500', to: 'to-orange-400' },
    { title: 'Study Hours', value: `${(analytics?.total_study_hours ?? 0).toFixed(1)}h`, icon: Clock, from: 'from-cyan-500', to: 'to-sky-500' },
    { title: 'Day Streak', value: analytics?.streak_days ?? 0, icon: Flame, from: 'from-orange-500', to: 'to-rose-500' },
    { title: 'Avg Score', value: `${(analytics?.avg_quiz_score ?? 0).toFixed(1)}%`, icon: TrendingUp, from: 'from-teal-500', to: 'to-violet-500' },
  ]

  const tooltipStyle = {
    background: 'hsl(var(--card))',
    color: 'hsl(var(--card-foreground))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '12px',
    fontSize: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  }

  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-violet-500 shadow-sm">
          <BarChart2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-foreground">Analytics</h1>
          <p className="text-xs text-muted-foreground">Track your learning progress and study insights</p>
        </div>
      </motion.div>

      {/* Stats grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.title} className="overflow-hidden">
            <div className={`h-1 w-full bg-gradient-to-r ${s.from} ${s.to}`} />
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.from} ${s.to}`}>
                    <s.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{s.title}</p>
                    <p className="text-2xl font-extrabold tabular-nums mt-0.5">{s.value}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Weekly Goal */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-5">
            {isLoading ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-violet-500">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold">Weekly Study Goal</p>
                    <div className="flex items-center gap-1">
                      {editingGoal ? (
                        <>
                          <input
                            type="number"
                            min={1}
                            max={168}
                            step={0.5}
                            value={goalInput}
                            onChange={(e) => setGoalInput(e.target.value)}
                            className="w-16 h-6 text-xs border border-border rounded-lg px-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            autoFocus
                          />
                          <span className="text-xs text-muted-foreground">hrs</span>
                          <button
                            onClick={handleSaveWeeklyGoal}
                            disabled={savingGoals}
                            className="text-emerald-500 hover:text-emerald-600 p-0.5 rounded transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingGoal(false)}
                            className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {weeklyHoursTotal.toFixed(1)}h / {weeklyGoal}h this week
                          </span>
                          <button
                            onClick={() => { setGoalInput(String(weeklyGoal)); setEditingGoal(true) }}
                            className="text-muted-foreground hover:text-foreground p-0.5 ml-0.5 rounded transition-colors"
                            aria-label="Edit weekly goal"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Gradient progress bar */}
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-violet-500 transition-all duration-700"
                      style={{ width: `${weeklyPct}%` }}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground mt-1.5">
                    {weeklyPct >= 100
                      ? '🎉 Weekly goal reached!'
                      : `${(weeklyGoal - weeklyHoursTotal).toFixed(1)}h remaining this week`}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Weekly Study Hours */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-gradient-to-r from-teal-500 to-violet-500" />
                Weekly Study Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              {progressLoading ? <Skeleton className="h-48" /> : (
                <ResponsiveContainer width="100%" height={188}>
                  <BarChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      formatter={(value: number) => [`${value}h`, 'Study Hours']}
                    />
                    <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={36}>
                      {weeklyData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={i === todayIdx ? '#f59e0b' : 'hsl(var(--primary))'}
                          opacity={i === todayIdx ? 1 : 0.75}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quiz Score Trend */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-gradient-to-r from-violet-500 to-pink-500" />
                Quiz Score Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {progressLoading ? <Skeleton className="h-48" /> : quizScoreData.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                    <TrendingUp className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">No quiz attempts yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={188}>
                  <LineChart data={quizScoreData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="quiz" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [`${value}%`, 'Score']}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ fill: 'hsl(var(--primary))', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#8b5cf6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
