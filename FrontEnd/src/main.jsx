import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import App from './App'
import './style.css'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider><App /></AuthProvider>
  </BrowserRouter>
)
