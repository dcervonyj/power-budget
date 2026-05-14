import React from 'react';
import { Routes, Route } from 'react-router-dom';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<div>Power Budget</div>} />
    </Routes>
  );
}
