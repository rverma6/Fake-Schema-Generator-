import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import SchemaGenerator from './components/schemagenerator';

function App() {
    const [showInputBox, setShowInputBox] = useState(false);

    const handleButtonClick = () => {
        setShowInputBox(true);
    };

    return (
        <div className="App container">
            <div className="text-center mt-5">
                {/* The SchemaGenerator component that will display the input box based on the state */}
                <div id="promptContainer">
                    <SchemaGenerator showInputBox={showInputBox} />
                </div>
            </div>
        </div>
    );
}

export default App;
