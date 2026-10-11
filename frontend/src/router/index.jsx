import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import RoleGuard from './RoleGuard'
import Login from '../pages/auth/Login'

// Implemented pages
import Dashboard from '../pages/jobseeker/Dashboard'
import ResumeAnalysis from '../pages/jobseeker/ResumeAnalysis'
import ResumeManager from '../pages/jobseeker/ResumeManager'
import JobBoard from '../pages/jobseeker/JobBoard'
import JobDetails from '../pages/jobseeker/JobDetails'
import ApplicationsPage from '../pages/jobseeker/ApplicationsPage'
import CandidateRanking from '../pages/recruiter/CandidateRanking'
import RecruiterDashboard from '../pages/recruiter/RecruiterDashboard'
import JobManagement from '../pages/recruiter/JobManagement'
import CandidateAnalysis from '../pages/recruiter/CandidateAnalysis'
import RecruiterAnalytics from '../pages/recruiter/RecruiterAnalytics'
import ProfilePage from '../pages/profile/ProfilePage'

export const router = createBrowserRouter([
  // Auth
  { path: '/auth/login', element: <Login /> },

  // Root redirect
  { path: '/', element: <Navigate to="/auth/login" replace /> },

  // Job Seeker routes
  {
    element: <RoleGuard requiredRole="job_seeker" />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/dashboard',              element: <Dashboard /> },
          { path: '/resume',                 element: <ResumeManager /> },
          { path: '/resume/:id/analysis',    element: <ResumeAnalysis /> },
          { path: '/jobs',                   element: <JobBoard /> },
          { path: '/jobs/:id',               element: <JobDetails /> },
          { path: '/matches',                element: <Navigate to="/jobs" replace /> },
          { path: '/applications',           element: <ApplicationsPage /> },
          { path: '/profile',                element: <ProfilePage /> },
        ],
      },
    ],
  },

  // Recruiter routes
  {
    element: <RoleGuard requiredRole="recruiter" />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/recruiter/dashboard',             element: <RecruiterDashboard /> },
          { path: '/recruiter/jobs',                  element: <JobManagement /> },
          { path: '/recruiter/candidates',            element: <CandidateRanking /> },
          { path: '/recruiter/jobs/:id/candidates',   element: <CandidateRanking /> },
          { path: '/recruiter/candidates/:id',        element: <CandidateAnalysis /> },
          { path: '/recruiter/analytics',             element: <RecruiterAnalytics /> },
          { path: '/profile',                         element: <ProfilePage /> },
        ],
      },
    ],
  },

  // Catch-all
  { path: '*', element: <Navigate to="/auth/login" replace /> },
])
