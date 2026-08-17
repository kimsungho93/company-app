import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router'
import { useAuthBootstrap } from '@/features/auth'
import { router } from './routes'
import { store } from './store'

const Bootstrap = () => {
  useAuthBootstrap()
  return <RouterProvider router={router} />
}

const App = () => (
  <Provider store={store}>
    <Bootstrap />
  </Provider>
)

export default App
