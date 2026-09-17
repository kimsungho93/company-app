import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router'
import { AuthBootstrap } from '@/features/auth'
import { router } from './routes'
import { store } from './store'

const App = () => (
  <Provider store={store}>
    <AuthBootstrap>
      <RouterProvider router={router} />
    </AuthBootstrap>
  </Provider>
)

export default App
