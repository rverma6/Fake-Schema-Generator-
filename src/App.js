import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

import SchemaGenerator from './components/schemagenerator';

function App() {
  return (
    <div className="App container">
      <div className="text-center mt-5">
        <h1>Database Schema Generator</h1>
        <SchemaGenerator />
      </div>
    </div>
  );
}

export default App;
