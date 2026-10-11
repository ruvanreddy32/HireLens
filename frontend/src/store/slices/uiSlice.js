import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  sidebarOpen: false,
  pageTitle: '',
}

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    setPageTitle: (state, action) => {
      state.pageTitle = action.payload
    },
  },
})

export const { setSidebarOpen, toggleSidebar, setPageTitle } = uiSlice.actions
export default uiSlice.reducer
