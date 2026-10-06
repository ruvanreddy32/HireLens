const BASE_URL = 'http://localhost:3000'

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('hirelens_token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  let data
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const errorMsg =
      data?.message || (Array.isArray(data?.message) ? data.message.join(', ') : 'Request failed')
    throw new Error(errorMsg)
  }

  return data
}

export const api = {
  // Auth
  login: async ({ email, password }) => {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  register: async (userData) => {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  },

  getMe: async () => {
    return request('/auth/me', {
      method: 'GET',
    })
  },

  // Recruiter Jobs
  getRecruiterJobs: async () => {
    return request('/jobs/recruiter/jobs', {
      method: 'GET',
    })
  },

  getJobById: async (jobId) => {
    return request(`/jobs/${jobId}`, {
      method: 'GET',
    })
  },

  createJob: async (jobData) => {
    return request('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    })
  },

  updateJob: async (jobId, jobData) => {
    return request(`/jobs/${jobId}`, {
      method: 'PUT',
      body: JSON.stringify(jobData),
    })
  },

  deleteJob: async (jobId) => {
    return request(`/jobs/${jobId}`, {
      method: 'DELETE',
    })
  },

  // Applications & Candidates
  getJobApplications: async (jobId) => {
    return request(`/jobs/${jobId}/applications`, {
      method: 'GET',
    })
  },

  getApplicationById: async (jobId, applicationId) => {
    return request(`/jobs/${jobId}/applications/${applicationId}`, {
      method: 'GET',
    })
  },

  changeApplicationStatus: async (jobId, applicationId, status) => {
    return request(`/jobs/${jobId}/applications/${applicationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },

  // Job Seeker endpoints
  getActiveJobs: async () => {
    return request('/jobs', {
      method: 'GET',
    })
  },

  getMyApplications: async () => {
    return request('/jobs/applications/me', {
      method: 'GET',
    })
  },

  withdrawApplication: async (applicationId, reason) => {
    return request(`/jobs/applications/${applicationId}/withdraw`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }).catch(() => null)
  },

  applyToJob: async (jobId, file) => {
    const token = localStorage.getItem('hirelens_token')
    const formData = new FormData()
    formData.append('resume', file)

    const response = await fetch(`http://localhost:3000/jobs/${jobId}/apply`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    let data
    try {
      data = await response.json()
    } catch {
      data = null
    }

    if (!response.ok) {
      const errorMsg =
        data?.message || (Array.isArray(data?.message) ? data.message.join(', ') : 'Failed to apply')
      throw new Error(errorMsg)
    }

    return data
  },

  // Candidate Notes
  addCandidateNote: async (jobId, applicationId, noteText) => {
    return request(`/jobs/${jobId}/applications/${applicationId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ noteText }),
    })
  },

  getCandidateNotes: async (jobId, applicationId) => {
    return request(`/jobs/${jobId}/applications/${applicationId}/notes`, {
      method: 'GET',
    })
  },

  deleteCandidateNote: async (jobId, applicationId, noteId) => {
    return request(`/jobs/${jobId}/applications/${applicationId}/notes/${noteId}`, {
      method: 'DELETE',
    })
  },

  // Candidate Bookmarks
  toggleCandidateBookmark: async (jobId, applicationId) => {
    return request(`/jobs/${jobId}/applications/${applicationId}/bookmark`, {
      method: 'POST',
    })
  },

  getRecruiterBookmarks: async () => {
    return request('/jobs/recruiter/bookmarks', {
      method: 'GET',
    })
  },

  // Job Seeker Resume Management
  getResumes: async () => {
    return request('/resumes', {
      method: 'GET',
    })
  },

  uploadResume: async (file, { title, targetRole, isPrimary } = {}) => {
    const token = localStorage.getItem('hirelens_token')
    const formData = new FormData()
    formData.append('file', file)
    if (title) formData.append('title', title)
    if (targetRole) formData.append('targetRole', targetRole)
    if (isPrimary !== undefined) formData.append('isPrimary', String(isPrimary))

    const response = await fetch(`${BASE_URL}/resumes/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.message || 'Failed to upload resume')
    }
    return data
  },

  setPrimaryResume: async (resumeId) => {
    return request(`/resumes/${resumeId}/primary`, {
      method: 'PATCH',
    })
  },

  deleteResume: async (resumeId) => {
    return request(`/resumes/${resumeId}`, {
      method: 'DELETE',
    })
  },

  getResumeFileBlob: async (resumeId) => {
    const token = localStorage.getItem('hirelens_token')
    const response = await fetch(`${BASE_URL}/resumes/${resumeId}/file`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (!response.ok) {
      throw new Error('Failed to download stored resume file')
    }
    return response.blob()
  },
}

