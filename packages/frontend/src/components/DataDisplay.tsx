import React, { useEffect, useState } from "react";
import { get } from "../services/api";

const DataDisplay = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await get("/data");
        setData(response);
      } catch (error) {
        console.error("Error fetching data", error);
      }
    };

    fetchData();
  }, []);

  return (
    <div style={{ margin: "20px" }}>
      <h2>Aggregated Data</h2>
      {data.length === 0 ? (
        <p>No data available.</p>
      ) : (
        <ul>
          {data.map((entry, index) => (
            <li key={index}>
              <strong>Name:</strong> {entry.name} | <strong>Email:</strong> {entry.email} |{" "}
              <strong>Skills:</strong> {entry.skills} | <strong>Experience:</strong> {entry.experience} years |{" "}
              <strong>Job Preference:</strong> {entry.jobPreference}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DataDisplay;
