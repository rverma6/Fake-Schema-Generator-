import React from 'react';

import './App.css';
import SchemaGenerator from './components/schemagenerator';
//import SchemaGenerator from './components/schemagenerator';

function App() {
  return (
    <div className="App">
      <h1>Schema Generator App</h1>
      <SchemaGenerator/>
      <generateFakeData/>
    </div>
  );
}

export default App;
