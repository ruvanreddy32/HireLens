import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { api } from '../../services/api'

// Async Thunks
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await api.login({ email, password })
      localStorage.setItem('hirelens_token', response.accessToken)
      return response
    } catch (err) {
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        return rejectWithValue('Cannot connect to backend server. Make sure the NestJS backend is running on http://localhost:3000.')
      }
      return rejectWithValue(err.message || 'Login failed')
    }
  }
)

export const initializeAuth = createAsyncThunk(
  'auth/initializeAuth',
  async (_, { rejectWithValue }) => {
    const token = localStorage.getItem('hirelens_token')
    if (!token) return null
    try {
      const user = await api.getMe()
      return user
    } catch (err) {
      localStorage.removeItem('hirelens_token')
      return rejectWithValue(err.message)
    }
  }
)

const initialState = {
  user: null,
  role: null,
  isAuthenticated: false,
  loading: false,
  error: null,
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      localStorage.removeItem('hirelens_token')
      state.user = null
      state.role = null
      state.isAuthenticated = false
      state.error = null
    },
    clearAuthError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    // Login
    builder.addCase(loginUser.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(loginUser.fulfilled, (state, action) => {
      state.loading = false
      state.user = action.payload.user
      // normalize backend role (e.g. 'RECRUITER' -> 'recruiter', 'JOB_SEEKER' -> 'job_seeker')
      state.role = action.payload.user.role.toLowerCase()
      state.isAuthenticated = true
      state.error = null
    })
    builder.addCase(loginUser.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload || 'Failed to login'
    })

    // Initialize Auth
    builder.addCase(initializeAuth.pending, (state) => {
      state.loading = true
    })
    builder.addCase(initializeAuth.fulfilled, (state, action) => {
      state.loading = false
      if (action.payload) {
        state.user = action.payload
        state.role = action.payload.role.toLowerCase()
        state.isAuthenticated = true
      }
    })
    builder.addCase(initializeAuth.rejected, (state) => {
      state.loading = false
      state.user = null
      state.role = null
      state.isAuthenticated = false
    })
  },
})

export const { logout, clearAuthError } = authSlice.actions
export default authSlice.reducer
