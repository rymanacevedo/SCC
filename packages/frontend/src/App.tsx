import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import JobForm from "./components/JobForm";
import DataDisplay from "./components/DataDisplay";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<JobForm />} />
        <Route path="/data" element={<DataDisplay />} />
      </Routes>
    </BrowserRouter>
  );
};
export default App;
