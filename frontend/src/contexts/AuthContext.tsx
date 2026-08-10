import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, tokenStorage } from '@/lib/api'
import type { User, RegisterRequest } from '@/types'
import { toast } from 'sonner'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string, remember?: boolean) => Promise<void>
  logout: () => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  const loadUser = useCallback(async () => {
    const token = tokenStorage.getAccess()
    if (!token) {
      setIsLoading(false)
      return
    }
    try {
      const u = await authApi.getMe()
      setUser(u)
    } catch {
      tokenStorage.clear()
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  const login = async (email: string, password: string, remember = true) => {
    const tokens = await authApi.login({ email, password })
    tokenStorage.setTokens(tokens.access_token, tokens.refresh_token, remember)
    const u = await authApi.getMe()
    setUser(u)
    navigate('/dashboard')
    toast.success(`Welcome back, ${u.full_name || u.username}!`)
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore errors on logout
    } finally {
      tokenStorage.clear()
      setUser(null)
      navigate('/login')
      toast.success('Logged out successfully')
    }
  }

  const register = async (data: RegisterRequest) => {
    await authApi.register(data)
    const tokens = await authApi.login({ email: data.email, password: data.password })
    tokenStorage.setTokens(tokens.access_token, tokens.refresh_token, true)
    const u = await authApi.getMe()
    setUser(u)
    navigate('/dashboard')
    toast.success(`Welcome, ${u.full_name || u.username}!`)
  }

  const updateUser = (updated: User) => setUser(updated)

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        register,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
