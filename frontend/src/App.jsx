import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { store } from './store'
import { router } from './router'
import { initializeAuth } from './store/slices/authSlice'

// Restore session from localStorage if token exists
store.dispatch(initializeAuth())

export default function App() {
  return (
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  )
}
