import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaPlus } from 'react-icons/fa';

function DataDisplay({ data, visibleRows, handleShowMore, loading, additionalRows, setAdditionalRows, handleGenerateMoreData }) {
    console.log('Data in DataDisplay:', data);  // Add this line
    return (
        <div className="card bg-dark mt-4 p-4 shadow-sm">
            <h3>Generated Fake Data</h3>
            <table className="table table-dark table-bordered table-hover">
                <thead>
                    <tr>
                        {Object.keys(data[0]).map((key) => (
                            <th key={key}>{key}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.slice(0, visibleRows).map((row, index) => (
                        <tr key={index}>
                            {Object.values(row).map((value, i) => (
                                <td key={i}>{value}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {visibleRows < data.length && (
                <button
                    className="btn btn-info mt-3"
                    onClick={handleShowMore}
                    disabled={loading}
                >
                    Load More
                </button>
            )}
            <div className="form-group mt-4">
                <label htmlFor="additionalRows">Generate more rows:</label>
                <input
                    type="number"
                    className="form-control bg-secondary text-light"
                    id="additionalRows"
                    value={additionalRows}
                    onChange={(e) => setAdditionalRows(e.target.value)}
                    min="1"
                />
            </div>
            <button
                className="btn btn-warning mt-3"
                onClick={handleGenerateMoreData}
                disabled={loading}
            >
                {loading ? 'Generating More Data...' : <span><FaPlus /> Generate More</span>}
            </button>
        </div>
    );
}

export default DataDisplay;
